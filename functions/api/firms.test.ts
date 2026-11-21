import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  MIDDLE_EAST_BBOX,
  classifyIntensity,
  csvToGeoJSON,
  isValidFirmsCsv,
  parseFirmsParams,
  redactSecret,
  onRequestGet
} from './firms';

// Mirrors the header NASA FIRMS returns for VIIRS area CSV downloads.
const SAMPLE_CSV = [
  'latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,confidence,version,bright_ti5,frp,daynight',
  '29.2360,50.3210,366.4,0.4,0.4,2026-03-13,1015,N,high,2.0NRT,370.2,245.8,D',
  '27.5040,52.0080,371.0,0.5,0.5,2026-03-18,0950,N,nominal,2.0NRT,369.1,312.5,D',
  'not,a,valid,row',
  '25.9280,51.5320,349.8,0.3,0.3,2026-03-18,1005,N,l,2.0NRT,350.0,4.7,N'
].join('\n');

describe('classifyIntensity', () => {
  it('buckets FRP into the four intensity bands', () => {
    expect(classifyIntensity(0)).toBe('low');
    expect(classifyIntensity(10)).toBe('medium');
    expect(classifyIntensity(50)).toBe('high');
    expect(classifyIntensity(200)).toBe('extreme');
  });
});

describe('csvToGeoJSON', () => {
  const geojson = csvToGeoJSON(SAMPLE_CSV) as {
    features: Array<{
      geometry: { coordinates: number[] };
      properties: Record<string, unknown>;
    }>;
  };

  it('skips malformed rows and parses valid ones', () => {
    expect(geojson.features).toHaveLength(3);
  });

  it('maps [lng, lat] coordinates', () => {
    const [lng, lat] = geojson.features[0].geometry.coordinates;
    expect(lng).toBeCloseTo(50.321, 5);
    expect(lat).toBeCloseTo(29.236, 5);
  });

  it('keeps in sync with scripts/fetch-firms-snapshot.js defaults', () => {
    const props = geojson.features[0].properties;
    expect(props.frp).toBe(245.8);
    expect(props.intensity).toBe('extreme');
    // conservative default multiplier: mult(0.12, 42.3, 3.10) = 52.8
    expect(props.estimatedCO2TonsDay).toBe(Math.round(245.8 * 52.8));
    expect(props.confidence).toBe('high');
  });

  it('returns an empty collection for header-only input', () => {
    expect(csvToGeoJSON('latitude,longitude,frp')).toEqual({
      type: 'FeatureCollection',
      features: []
    });
  });
});

describe('MIDDLE_EAST_BBOX & parseFirmsParams', () => {
  it('uses west,south,east,north order covering Persian Gulf and Red Sea', () => {
    const [west, south, east, north] = MIDDLE_EAST_BBOX.split(',').map(Number);
    expect(west).toBe(30);
    expect(south).toBe(10);
    expect(east).toBe(65);
    expect(north).toBe(40);
    // Ras Tanura (lat 26.64, lng 50.15) and Bab el-Mandeb (lat 12.58, lng 43.33)
    expect(50.15).toBeGreaterThanOrEqual(west);
    expect(50.15).toBeLessThanOrEqual(east);
    expect(26.64).toBeGreaterThanOrEqual(south);
    expect(26.64).toBeLessThanOrEqual(north);
    expect(12.58).toBeGreaterThanOrEqual(south);
  });

  it('defaults to VIIRS_SNPP_NRT, MIDDLE_EAST_BBOX, and 2 days', () => {
    const res = parseFirmsParams(new URLSearchParams());
    expect(res).toEqual({
      ok: true,
      params: {
        source: 'VIIRS_SNPP_NRT',
        bbox: MIDDLE_EAST_BBOX,
        days: 2
      }
    });
  });

  it('handles NaN days and clamps valid days to 1..5', () => {
    expect(parseFirmsParams(new URLSearchParams('days=abc'))).toMatchObject({
      ok: true,
      params: { days: 2 }
    });
    expect(parseFirmsParams(new URLSearchParams('days=0'))).toMatchObject({
      ok: true,
      params: { days: 1 }
    });
    expect(parseFirmsParams(new URLSearchParams('days=99'))).toMatchObject({
      ok: true,
      params: { days: 5 }
    });
  });

  it('rejects unsupported sources and path traversal attempts', () => {
    expect(
      parseFirmsParams(new URLSearchParams('source=../../etc/passwd')).ok
    ).toBe(false);
    expect(parseFirmsParams(new URLSearchParams('source=UNKNOWN')).ok).toBe(
      false
    );
  });

  it('rejects global or malformed bounding boxes', () => {
    expect(
      parseFirmsParams(new URLSearchParams('bbox=-180,-90,180,90')).ok
    ).toBe(false);
    expect(parseFirmsParams(new URLSearchParams('bbox=50,20,40,30')).ok).toBe(
      false
    );
    expect(parseFirmsParams(new URLSearchParams('bbox=30,10,65')).ok).toBe(
      false
    );
    expect(parseFirmsParams(new URLSearchParams('bbox=35,20,55,35')).ok).toBe(
      true
    );
  });
});

describe('isValidFirmsCsv & redactSecret', () => {
  it('validates FIRMS CSV headers and rejects API error text', () => {
    expect(isValidFirmsCsv(SAMPLE_CSV)).toBe(true);
    expect(isValidFirmsCsv('')).toBe(false);
    expect(isValidFirmsCsv('Invalid MAP_KEY')).toBe(false);
  });

  it('redacts secrets from log messages', () => {
    expect(
      redactSecret(
        'fetch failed for https://firms/SECRET123/VIIRS',
        'SECRET123'
      )
    ).toBe('fetch failed for https://firms/[REDACTED]/VIIRS');
  });
});

describe('onRequestGet', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 400 for invalid source parameter', async () => {
    const res = await onRequestGet({
      request: new Request('https://example.com/api/firms?source=BAD'),
      env: { FIRMS_MAP_KEY: 'test-key' }
    } as Parameters<typeof onRequestGet>[0]);
    expect(res.status).toBe(400);
  });

  it('never leaks FIRMS_MAP_KEY in error responses', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
      new Error('network error for https://firms/TOP_SECRET_KEY/VIIRS')
    );

    const res = await onRequestGet({
      request: new Request('https://example.com/api/firms?days=2'),
      env: { FIRMS_MAP_KEY: 'TOP_SECRET_KEY' }
    } as Parameters<typeof onRequestGet>[0]);

    const body = (await res.json()) as { metadata?: { error?: string } };
    expect(res.status).toBe(200);
    expect(JSON.stringify(body)).not.toContain('TOP_SECRET_KEY');
    expect(body.metadata?.error).toBe(
      'Failed to fetch live FIRMS satellite data'
    );
  });
});
