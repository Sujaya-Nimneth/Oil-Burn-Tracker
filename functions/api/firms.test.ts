import { describe, it, expect } from 'vitest';
import { classifyIntensity, csvToGeoJSON } from './firms';

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
