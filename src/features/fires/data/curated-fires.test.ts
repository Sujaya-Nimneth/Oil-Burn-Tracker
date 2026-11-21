import { describe, it, expect } from 'vitest';
import {
  curatedFires,
  FACILITY_STATUS_ORDER,
  getEffectiveFacilityStatus,
  getFacilityFireStatsMap,
  getSupplyDisruptionUpTo,
  isChokepoint
} from './curated-fires';
import { formatBPD } from '@/lib/format';

describe('getEffectiveFacilityStatus', () => {
  const activeFireFacility = curatedFires.find((f) => f.id === 'ras-laffan')!;
  const damagedMar19Facility = curatedFires.find(
    (f) => f.id === 'haifa-refinery'
  )!;

  it('returns monitoring before a facility attackDate even with live FRP', () => {
    expect(
      getEffectiveFacilityStatus(activeFireFacility, '2026-03-01', 120)
    ).toBe('monitoring');
    expect(getEffectiveFacilityStatus(damagedMar19Facility, '2026-03-18')).toBe(
      'monitoring'
    );
  });

  it('boosts status to active_fire when live FRP exceeds 50 MW after attackDate', () => {
    expect(
      getEffectiveFacilityStatus(damagedMar19Facility, '2026-03-19', 75)
    ).toBe('active_fire');
  });

  it('transitions static active_fire to damaged after 21 days without low-FRP thermal activity', () => {
    expect(
      getEffectiveFacilityStatus(activeFireFacility, '2026-03-25', 10)
    ).toBe('active_fire');
    expect(
      getEffectiveFacilityStatus(activeFireFacility, '2026-04-15', 10)
    ).toBe('damaged');
    expect(
      getEffectiveFacilityStatus(activeFireFacility, '2026-04-15', 30)
    ).toBe('active_fire');
  });
});

describe('getFacilityFireStatsMap', () => {
  it('aggregates fireCount, maxFRP, and totalCO2 per facility id', () => {
    const map = getFacilityFireStatsMap([
      {
        properties: {
          matchedFacility: { id: 'ras-laffan' },
          frp: 42.5,
          estimatedCO2TonsDay: 100
        }
      },
      {
        properties: {
          matchedFacility: { id: 'ras-laffan' },
          frp: 88.0,
          estimatedCO2TonsDay: 250
        }
      },
      {
        properties: {
          matchedFacility: null,
          frp: 200,
          estimatedCO2TonsDay: 500
        }
      }
    ]);

    expect(map.size).toBe(1);
    expect(map.get('ras-laffan')).toEqual({
      fireCount: 2,
      maxFRP: 88.0,
      totalCO2: 350
    });
  });

  it('ignores live satellite detections when scrubbed to historical timeline dates', () => {
    const features = [
      {
        properties: {
          matchedFacility: { id: 'ras-laffan' },
          frp: 142.6,
          estimatedCO2TonsDay: 5000,
          acq_date: '2026-11-20'
        }
      }
    ];
    expect(getFacilityFireStatsMap(features, '2024-06-01').size).toBe(0);
    expect(getFacilityFireStatsMap(features, '2026-11-21').size).toBe(1);
  });
});

describe('status ordering, chokepoints, and BPD formatting', () => {
  it('ranks active_fire first (0) without falsy fallback bugs', () => {
    const statuses = ['operational', 'damaged', 'active_fire'] as const;
    const sorted = [...statuses].sort(
      (a, b) =>
        (FACILITY_STATUS_ORDER[a] ?? 4) - (FACILITY_STATUS_ORDER[b] ?? 4)
    );
    expect(sorted).toEqual(['active_fire', 'damaged', 'operational']);
  });

  it('separates shipping chokepoints from oil production capacity', () => {
    expect(isChokepoint('strait-of-hormuz')).toBe(true);
    expect(isChokepoint('ras-tanura')).toBe(false);
    const disruption = getSupplyDisruptionUpTo(
      new Set(['strait-of-hormuz', 'ras-tanura']),
      '2026-03-21'
    );
    expect(disruption.facilitiesHit).toBe(1);
    expect(disruption.chokepointsHit).toBe(1);
    expect(disruption.productionBPDOffline).toBe(550000);
  });

  it('formats sub-million and multi-million BPD capacities cleanly', () => {
    expect(formatBPD(50_000)).toBe('50K BPD');
    expect(formatBPD(550_000)).toBe('550K BPD');
    expect(formatBPD(5_000_000)).toBe('5.0M BPD');
    expect(formatBPD(0)).toBe('');
  });
});
