import { describe, it, expect } from 'vitest';
import {
  computeRecessionScore,
  getRecessionRiskLabel
} from './recession-score';

describe('computeRecessionScore', () => {
  it('clamps below-baseline oil and negative inputs to 0', () => {
    const res = computeRecessionScore({
      oilPriceBbl: 60,
      productionPct: 0,
      groceryInflationPct: 0,
      warCostBillions: 0,
      shippingSurchargePct: 0
    });
    expect(res.oilSpikePct).toBe(0);
    expect(res.score).toBe(0);
    expect(res.label).toBe('LOW');
  });

  it('caps sub-scores at 100 and total score at 99 under extreme crisis', () => {
    const res = computeRecessionScore({
      oilPriceBbl: 250,
      productionPct: 35,
      groceryInflationPct: 25,
      warCostBillions: 5000,
      shippingSurchargePct: 180
    });
    expect(res.oilSpikePct).toBe(100);
    expect(res.supplyRisk).toBe(100);
    expect(res.inflationPressure).toBe(100);
    expect(res.warCostDrag).toBe(100);
    expect(res.shippingStress).toBe(100);
    expect(res.score).toBe(99);
    expect(res.label).toBe('DEPRESSION RISK');
  });

  it('computes weighted mid-crisis stress and maps risk labels at thresholds', () => {
    const res = computeRecessionScore({
      oilPriceBbl: 105, // 40%
      productionPct: 10, // 50%
      groceryInflationPct: 6, // 40%
      warCostBillions: 400, // 20%
      shippingSurchargePct: 65 // 65%
    });
    // 40*0.3 + 50*0.25 + 40*0.2 + 20*0.15 + 65*0.1 = 12 + 12.5 + 8 + 3 + 6.5 = 42
    expect(res.score).toBe(42);
    expect(res.label).toBe('ELEVATED');

    expect(getRecessionRiskLabel(19)).toBe('LOW');
    expect(getRecessionRiskLabel(20)).toBe('MODERATE');
    expect(getRecessionRiskLabel(40)).toBe('ELEVATED');
    expect(getRecessionRiskLabel(60)).toBe('HIGH RISK');
    expect(getRecessionRiskLabel(80)).toBe('DEPRESSION RISK');
  });
});
