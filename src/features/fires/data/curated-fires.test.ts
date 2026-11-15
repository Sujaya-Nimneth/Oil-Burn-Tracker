import { describe, it, expect } from 'vitest';
import {
  curatedFires,
  getEffectiveFacilityStatus,
  getFacilityFireStatsMap
} from './curated-fires';

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
});
