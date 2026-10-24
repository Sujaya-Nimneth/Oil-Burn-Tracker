import { describe, it, expect } from 'vitest';
import {
  FACILITY_PARAMS,
  estimateCO2,
  estimateCO2FromCapacity,
  co2Equivalents,
  formatCO2
} from './emissions-model';

describe('FRP → CO₂ multipliers (IPCC-derived)', () => {
  it('derives the refinery multiplier from first principles', () => {
    // 86400 / (0.08 × 42.3) × 3.10 / 1000 = 79.148… → 79.1 t/MW/day
    expect(FACILITY_PARAMS.refinery.multiplier).toBe(79.1);
  });

  it('uses the conservative 52.8 multiplier for unknown facility types', () => {
    expect(FACILITY_PARAMS.unknown.multiplier).toBe(52.8);
  });

  it('scales linearly with FRP', () => {
    expect(estimateCO2(100, 'refinery')).toBeCloseTo(7910, 5);
    expect(estimateCO2(10)).toBeCloseTo(528, 5);
  });

  it('falls back to unknown when facility type is null', () => {
    expect(estimateCO2(1, null)).toBeCloseTo(52.8, 5);
  });
});

describe('capacity-based fallback estimates (EPA factors)', () => {
  it('estimates active gas-field fires from BCF/day capacity', () => {
    // 1 BCF/day × 54,600 t/BCF × 5% burn fraction
    expect(
      estimateCO2FromCapacity('gas_field', 'active_fire', 0, 1)
    ).toBeCloseTo(54600 * 0.05, 5);
  });

  it('uses the lower burn fraction for damaged facilities', () => {
    expect(
      estimateCO2FromCapacity('refinery', 'damaged', 1_000_000)
    ).toBeCloseTo(1_000_000 * 0.43 * 0.02, 5);
  });

  it('derives daily-equivalent BPD from storage when capacity is zero', () => {
    // 42M bbl storage → 42e6/365 bbl/day equivalent
    const expected = ((42 * 1_000_000) / 365) * 0.43 * 0.05;
    expect(
      estimateCO2FromCapacity('storage', 'active_fire', 0, undefined, 42)
    ).toBeCloseTo(expected, 3);
  });

  it('returns zero for facilities that are not burning', () => {
    expect(estimateCO2FromCapacity('refinery', 'operational', 500_000)).toBe(0);
  });
});

describe('CO₂ equivalents and formatting', () => {
  it('converts tonnes/day to car-year equivalents', () => {
    // 4.6 t/day = one car's annual emissions (EPA 4.6 t/yr)
    expect(co2Equivalents(4.6).carsPerYear).toBe(365);
  });

  it('formats large tonnages compactly', () => {
    expect(formatCO2(999)).toBe('999');
    expect(formatCO2(1500)).toBe('1.5K');
    expect(formatCO2(2_400_000)).toBe('2.4M');
  });
});
