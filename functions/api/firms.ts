// Cloudflare Pages Function — proxies NASA FIRMS API
// Env var FIRMS_MAP_KEY must be set in Cloudflare Pages dashboard

interface Env {
  FIRMS_MAP_KEY: string;
}

const FIRMS_BASE_URL = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';
// NASA FIRMS Area API format: west_lon,south_lat,east_lon,north_lat
export const MIDDLE_EAST_BBOX = '30,10,65,40';
const CACHE_SECONDS = 1800; // 30 min
const FETCH_TIMEOUT_MS = 10_000;

export const ALLOWED_SOURCES = new Set([
  'VIIRS_SNPP_NRT',
  'VIIRS_NOAA20_NRT',
  'VIIRS_NOAA21_NRT',
  'MODIS_NRT'
]);

const BBOX_BOUNDS = {
  minLon: 25,
  maxLon: 70,
  minLat: 5,
  maxLat: 45
} as const;

export interface FirmsQueryParams {
  bbox: string;
  days: number;
  source: string;
}

export function parseFirmsParams(
  searchParams: URLSearchParams
): { ok: true; params: FirmsQueryParams } | { ok: false; error: string } {
  const source = searchParams.get('source') || 'VIIRS_SNPP_NRT';
  if (!ALLOWED_SOURCES.has(source)) {
    return { ok: false, error: 'Unsupported FIRMS satellite source' };
  }

  const bbox = searchParams.get('bbox') || MIDDLE_EAST_BBOX;
  const parts = bbox.split(',');
  if (parts.length !== 4 || parts.some((p) => !/^-?\d+(?:\.\d+)?$/.test(p))) {
    return { ok: false, error: 'Invalid bbox format' };
  }
  const [west, south, east, north] = parts.map(Number);
  if (
    !Number.isFinite(west) ||
    !Number.isFinite(south) ||
    !Number.isFinite(east) ||
    !Number.isFinite(north) ||
    west >= east ||
    south >= north ||
    west < BBOX_BOUNDS.minLon ||
    east > BBOX_BOUNDS.maxLon ||
    south < BBOX_BOUNDS.minLat ||
    north > BBOX_BOUNDS.maxLat
  ) {
    return { ok: false, error: 'bbox out of supported regional bounds' };
  }

  const rawDays = searchParams.get('days');
  const parsedDays = rawDays !== null ? Number.parseInt(rawDays, 10) : 2;
  const days = Number.isFinite(parsedDays)
    ? Math.min(Math.max(parsedDays, 1), 5)
    : 2;

  return {
    ok: true,
    params: {
      bbox: `${west},${south},${east},${north}`,
      days,
      source
    }
  };
}

export function isValidFirmsCsv(csv: string): boolean {
  const trimmed = csv.trim();
  if (!trimmed) return false;
  const firstLine = trimmed.split('\n', 1)[0].toLowerCase();
  if (firstLine.startsWith('invalid')) return false;
  return firstLine.includes('latitude') && firstLine.includes('longitude');
}

export function redactSecret(message: string, secret?: string): string {
  if (!secret) return message;
  return message.split(secret).join('[REDACTED]');
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const parsed = parseFirmsParams(url.searchParams);
  if (!parsed.ok) {
    return Response.json(
      {
        type: 'FeatureCollection',
        features: [],
        metadata: { error: parsed.error, count: 0 }
      },
      { status: 400, headers: corsHeaders() }
    );
  }

  const { bbox, days, source } = parsed.params;
  const mapKey = context.env.FIRMS_MAP_KEY;

  if (!mapKey) {
    return Response.json(
      {
        type: 'FeatureCollection',
        features: [],
        metadata: { error: 'FIRMS_MAP_KEY not configured', count: 0 }
      },
      { status: 200, headers: corsHeaders() }
    );
  }

  try {
    const firmsUrl = `${FIRMS_BASE_URL}/${encodeURIComponent(mapKey)}/${source}/${bbox}/${days}`;
    const res = await fetch(firmsUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cf: {
        cacheTtl: CACHE_SECONDS,
        cacheEverything: true
      }
    });

    if (!res.ok) {
      throw new Error(`FIRMS API returned ${res.status}`);
    }

    const csv = await res.text();
    if (!isValidFirmsCsv(csv)) {
      throw new Error('FIRMS returned empty or invalid CSV');
    }

    const geojson = csvToGeoJSON(csv);

    return Response.json(
      {
        ...geojson,
        metadata: {
          source,
          bbox,
          days,
          fetchedAt: new Date().toISOString(),
          count: geojson.features.length
        }
      },
      {
        headers: {
          ...corsHeaders(),
          'Cache-Control': `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}`
        }
      }
    );
  } catch (error) {
    console.error('FIRMS fetch error:', redactSecret(String(error), mapKey));
    return Response.json(
      {
        type: 'FeatureCollection',
        features: [],
        metadata: {
          error: 'Failed to fetch live FIRMS satellite data',
          fetchedAt: new Date().toISOString(),
          count: 0
        }
      },
      { status: 200, headers: corsHeaders() }
    );
  }
};

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };
}

// Inline CSV→GeoJSON — keep in sync with scripts/fetch-firms-snapshot.js
// (same parsing, defaults, and CO2 constant; only fetch/caching differs).
// Exported for unit tests (functions/api/firms.test.ts).
export function classifyIntensity(frp: number): string {
  if (frp < 10) return 'low';
  if (frp < 50) return 'medium';
  if (frp < 200) return 'high';
  return 'extreme';
}

export function csvToGeoJSON(csv: string) {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return { type: 'FeatureCollection', features: [] };

  const headers = lines[0].split(',').map((h) => h.trim());

  const features = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    if (values.length !== headers.length) continue;

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx]?.trim() || '';
    });

    const lat = parseFloat(row.latitude);
    const lng = parseFloat(row.longitude);
    if (isNaN(lat) || isNaN(lng)) continue;

    const frp = parseFloat(row.frp) || 0;

    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {
        latitude: lat,
        longitude: lng,
        bright_ti4: parseFloat(row.bright_ti4) || 335,
        frp,
        confidence: row.confidence || 'nominal',
        acq_date: row.acq_date || '',
        acq_time: row.acq_time || '',
        satellite: row.satellite || '',
        daynight: row.daynight || '',
        intensity: classifyIntensity(frp),
        estimatedCO2TonsDay: Math.round(frp * 52.8), // conservative default: mult(0.12, 42.3, 3.10) = 52.8
        matchedFacility: null
      }
    });
  }

  return { type: 'FeatureCollection', features };
}
