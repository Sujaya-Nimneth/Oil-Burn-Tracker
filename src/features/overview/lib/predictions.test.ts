import { describe, it, expect } from 'vitest';
import { computeRecessionScore } from './recession-score';
import { computeScenarioPredictions } from './predictions';

describe('computeScenarioPredictions', () => {
  const calmRecession = computeRecessionScore({
    oilPriceBbl: 75,
    productionPct: 0,
    groceryInflationPct: 2,
    warCostBillions: 10,
    shippingSurchargePct: 0
  });

  const severeRecession = computeRecessionScore({
    oilPriceBbl: 160,
    productionPct: 20,
    groceryInflationPct: 14,
    warCostBillions: 1500,
    shippingSurchargePct: 95
  });

  it('returns 8 scenarios sorted descending by probability with valid bounds', () => {
    const preds = computeScenarioPredictions({
      hormuzBlockedPct: 60,
      productionPct: 12,
      nuclearDestroyed: 4,
      enrichmentPct: 15,
      radiationRisk: 'high',
      eventsLast7: 14,
      warDays: 500,
      totalCostBillions: 1100,
      totalKilled: 80000,
      oilPriceBbl: 160,
      oilDelta: 85,
      totalMonthlyExtra: 450,
      recession: severeRecession
    });

    expect(preds).toHaveLength(8);
    for (let i = 1; i < preds.length; i++) {
      expect(preds[i - 1].probability).toBeGreaterThanOrEqual(
        preds[i].probability
      );
    }
    for (const p of preds) {
      expect(p.probability).toBeGreaterThanOrEqual(0);
      expect(p.probability).toBeLessThanOrEqual(100);
      expect(p.expect.length).toBeGreaterThan(0);
    }
  });

  it('scales escalation scenarios upward and ceasefire downward under severe crisis', () => {
    const calm = computeScenarioPredictions({
      hormuzBlockedPct: 0,
      productionPct: 0,
      nuclearDestroyed: 0,
      enrichmentPct: 100,
      radiationRisk: 'none',
      eventsLast7: 2,
      warDays: 30,
      totalCostBillions: 10,
      totalKilled: 1500,
      oilPriceBbl: 75,
      oilDelta: 0,
      totalMonthlyExtra: 0,
      recession: calmRecession
    });
    const severe = computeScenarioPredictions({
      hormuzBlockedPct: 75,
      productionPct: 18,
      nuclearDestroyed: 4,
      enrichmentPct: 10,
      radiationRisk: 'high',
      eventsLast7: 16,
      warDays: 500,
      totalCostBillions: 1200,
      totalKilled: 85000,
      oilPriceBbl: 160,
      oilDelta: 85,
      totalMonthlyExtra: 450,
      recession: severeRecession
    });

    const byName = (arr: typeof calm, name: string) =>
      arr.find((p) => p.scenario === name)!.probability;

    expect(byName(severe, 'Hormuz fully closed')).toBeGreaterThan(
      byName(calm, 'Hormuz fully closed')
    );
    expect(byName(severe, 'Nuclear accident / meltdown')).toBeGreaterThan(
      byName(calm, 'Nuclear accident / meltdown')
    );
    expect(byName(severe, 'Ceasefire within 90 days')).toBeLessThan(
      byName(calm, 'Ceasefire within 90 days')
    );
    expect(byName(severe, 'Ceasefire within 90 days')).toBeGreaterThanOrEqual(
      2
    );
    expect(byName(severe, 'US recession (12-month)')).toBe(
      severeRecession.score
    );
  });
});
