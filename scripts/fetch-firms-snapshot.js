#!/usr/bin/env node
/**
 * NASA FIRMS Snapshot Updater
 *
 * Fetches the latest VIIRS satellite thermal detections for the Middle East
 * bounding box (10,30,40,65) when FIRMS_MAP_KEY is available, or generates
 * a calibrated baseline thermal snapshot for Persian Gulf energy corridors
 * so local development (`npm run dev`) and static exports always have
 * a valid `/firms-latest.json` fallback.
 *
 * Fallback rules (a failed/missing-key fetch must never destroy real data):
 *   - If the existing snapshot holds live satellite data, it is kept as-is.
 *   - A baseline is only written when no snapshot exists, or the existing
 *     one is itself a baseline that is more than 3 days old.
 *   - Pass --force-baseline to regenerate the baseline unconditionally.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_FILE = path.join(ROOT, 'public', 'firms-latest.json');
const FIRMS_BASE_URL = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';
const MIDDLE_EAST_BBOX = '10,30,40,65';

function classifyIntensity(frp) {
  if (frp < 10) return 'low';
  if (frp < 50) return 'medium';
  if (frp < 200) return 'high';
  return 'extreme';
}

// CSV→GeoJSON parsing — keep in sync with functions/api/firms.ts
// (same parsing, defaults, and CO2 constant; only fetch/caching differs).
function csvToGeoJSON(csv) {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return { type: 'FeatureCollection', features: [] };

  const headers = lines[0].split(',').map((h) => h.trim());
  const features = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    if (values.length !== headers.length) continue;

    const row = {};
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
        acq_date: row.acq_date || new Date().toISOString().slice(0, 10),
        acq_time: row.acq_time || '0930',
        satellite: row.satellite || 'N',
        daynight: row.daynight || 'D',
        intensity: classifyIntensity(frp),
        estimatedCO2TonsDay: Math.round(frp * 52.7),
        matchedFacility: null,
      },
    });
  }

  return { type: 'FeatureCollection', features };
}

function buildBaselineSnapshot() {
  const today = new Date();
  const date0 = today.toISOString().slice(0, 10);
  const yesterday = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);

  // Representative thermal anomalies across Persian Gulf / Middle East oil & gas facilities
  const hotspots = [
    { lat: 29.236, lng: 50.321, frp: 245.8, bright: 366.4, conf: 'high', date: date0, time: '1015', dn: 'D' },      // Kharg Island
    { lat: 29.229, lng: 50.328, frp: 168.2, bright: 354.1, conf: 'high', date: yesterday, time: '2240', dn: 'N' },  // Kharg Island storage
    { lat: 27.504, lng: 52.008, frp: 312.5, bright: 371.0, conf: 'high', date: date0, time: '0950', dn: 'D' },      // South Pars Gas Field
    { lat: 27.495, lng: 51.992, frp: 194.0, bright: 358.2, conf: 'high', date: yesterday, time: '2115', dn: 'N' },  // South Pars Phase 14
    { lat: 25.928, lng: 51.532, frp: 142.6, bright: 349.8, conf: 'high', date: date0, time: '1005', dn: 'D' },      // Ras Laffan LNG
    { lat: 26.641, lng: 50.161, frp: 88.4, bright: 341.2, conf: 'nominal', date: date0, time: '1010', dn: 'D' },    // Ras Tanura
    { lat: 29.069, lng: 48.135, frp: 115.3, bright: 345.9, conf: 'high', date: yesterday, time: '2255', dn: 'N' },  // Mina al-Ahmadi
    { lat: 26.153, lng: 50.612, frp: 64.7, bright: 338.5, conf: 'nominal', date: yesterday, time: '1008', dn: 'D' },// BAPCO Sitra
    { lat: 25.131, lng: 56.329, frp: 72.1, bright: 339.7, conf: 'nominal', date: date0, time: '0940', dn: 'D' },    // Fujairah Storage Zone
    { lat: 22.931, lng: 53.881, frp: 95.0, bright: 343.0, conf: 'nominal', date: yesterday, time: '2150', dn: 'N' },// Shah Gas Field
    { lat: 25.939, lng: 49.683, frp: 54.2, bright: 336.1, conf: 'nominal', date: date0, time: '1012', dn: 'D' },    // Abqaiq
    { lat: 25.431, lng: 49.585, frp: 48.9, bright: 334.8, conf: 'nominal', date: yesterday, time: '2230', dn: 'N' },// Ghawar
    { lat: 30.512, lng: 47.781, frp: 134.0, bright: 348.5, conf: 'high', date: date0, time: '1020', dn: 'D' },      // Rumaila / Basra flaring
    { lat: 31.345, lng: 48.672, frp: 108.6, bright: 344.2, conf: 'high', date: date0, time: '1018', dn: 'D' },      // Ahvaz oil field
    { lat: 23.865, lng: 53.648, frp: 41.5, bright: 332.9, conf: 'nominal', date: yesterday, time: '0945', dn: 'D' },// Habshan
  ];

  return {
    type: 'FeatureCollection',
    features: hotspots.map((h) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [h.lng, h.lat] },
      properties: {
        latitude: h.lat,
        longitude: h.lng,
        bright_ti4: h.bright,
        frp: h.frp,
        confidence: h.conf,
        acq_date: h.date,
        acq_time: h.time,
        satellite: 'N',
        daynight: h.dn,
        intensity: classifyIntensity(h.frp),
        estimatedCO2TonsDay: Math.round(h.frp * 52.7),
        matchedFacility: null,
      },
    })),
    metadata: {
      source: 'VIIRS_SNPP_NRT_SNAPSHOT',
      bbox: MIDDLE_EAST_BBOX,
      days: 2,
      fetchedAt: today.toISOString(),
      count: hotspots.length,
      fallback: true,
    },
  };
}

function readExistingSnapshot() {
  try {
    if (!fs.existsSync(OUT_FILE)) return null;
    const parsed = JSON.parse(fs.readFileSync(OUT_FILE, 'utf-8'));
    if (!parsed || !Array.isArray(parsed.features)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isOlderThan(snapshot, maxAgeDays) {
  const fetchedAt = snapshot?.metadata?.fetchedAt ? Date.parse(snapshot.metadata.fetchedAt) : NaN;
  if (Number.isNaN(fetchedAt)) return true;
  return Date.now() - fetchedAt > maxAgeDays * 86400000;
}

async function main() {
  const forceBaseline = process.argv.includes('--force-baseline');
  const mapKey = process.env.FIRMS_MAP_KEY;
  console.log('[fetch-firms-snapshot] Starting...');

  if (mapKey && !forceBaseline) {
    try {
      const url = `${FIRMS_BASE_URL}/${mapKey}/VIIRS_SNPP_NRT/${MIDDLE_EAST_BBOX}/2`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const csv = await res.text();
      if (!csv || csv.trim().length === 0 || csv.includes('Invalid')) {
        throw new Error('Empty or invalid CSV from FIRMS');
      }
      const geojson = csvToGeoJSON(csv);
      if (geojson.features.length > 0) {
        const payload = {
          ...geojson,
          metadata: {
            source: 'VIIRS_SNPP_NRT',
            bbox: MIDDLE_EAST_BBOX,
            days: 2,
            fetchedAt: new Date().toISOString(),
            count: geojson.features.length,
          },
        };
        fs.writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2) + '\n');
        console.log(`  Saved ${geojson.features.length} live FIRMS detections to public/firms-latest.json`);
        return;
      }
    } catch (e) {
      console.warn(`  Live FIRMS fetch failed (${e.message}).`);
    }
  } else if (!mapKey) {
    console.log('  FIRMS_MAP_KEY not set.');
  } else {
    console.log('  --force-baseline specified.');
  }

  // Fallback path: never overwrite real satellite data with a fabricated
  // baseline — keep the last good live snapshot instead.
  const existing = readExistingSnapshot();
  if (!forceBaseline && existing && existing.metadata && !existing.metadata.fallback) {
    console.log(
      `  Keeping existing live snapshot (${existing.features.length} detections, fetched ${existing.metadata.fetchedAt || 'unknown'}) instead of writing baseline data.`
    );
    return;
  }

  // Write a baseline only when there is no usable snapshot, or the existing
  // one is itself a baseline that has gone stale.
  if (existing && existing.metadata && existing.metadata.fallback && !isOlderThan(existing, 3) && !forceBaseline) {
    console.log(`  Existing baseline snapshot is recent (fetched ${existing.metadata.fetchedAt}) — nothing to do.`);
    return;
  }

  const snapshot = buildBaselineSnapshot();
  fs.writeFileSync(OUT_FILE, JSON.stringify(snapshot, null, 2) + '\n');
  console.log(`  Wrote ${snapshot.features.length} baseline thermal detections to public/firms-latest.json`);
}

main().catch(console.error);
