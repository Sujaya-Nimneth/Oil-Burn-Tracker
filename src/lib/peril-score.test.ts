import { describe, it, expect } from 'vitest';
import { computePerilScore, HISTORICAL_ANCHORS } from './peril-score';
import type { NuclearStatus } from '@/features/timeline/data/conflict-events';

function nuclear(partial: Partial<NuclearStatus>): NuclearStatus {
  return {
    facilitiesTargeted: 6,
    facilitiesDestroyed: 0,
    enrichmentPct: 100,
    radiationRisk: 'none',
    label: 'test',
    ...partial
  };
}

describe('OBT peril index', () => {
  it('scores a quiet board as elevated', () => {
    const result = computePerilScore(null, 0, 0, 0, 0, 0);
    expect(result.score).toBe(0);
    expect(result.level).toBe('elevated');
  });

  it('computes the nuclear sub-score from facilities, enrichment, radiation', () => {
    // 6/6 facilities destroyed (25) + all enrichment destroyed (20) +
    // high contamination risk (25) = 70
    const result = computePerilScore(
      nuclear({
        facilitiesDestroyed: 6,
        enrichmentPct: 0,
        radiationRisk: 'high'
      }),
      0,
      0,
      0,
      0,
      0
    );
    expect(result.nuclearScore).toBe(70);
  });

  it('applies the 40/35/25 weighting across sub-scores', () => {
    const result = computePerilScore(
      nuclear({
        facilitiesDestroyed: 6,
        enrichmentPct: 0,
        radiationRisk: 'high'
      }),
      100, // supply sub-score maxes at 100 when combined disruption ≥ 50
      100,
      1000, // escalation caps at 100
      1000,
      1000
    );
    expect(result.supplyScore).toBe(100);
    expect(result.escalationScore).toBe(100);
    // 70×0.4 + 100×0.35 + 100×0.25 = 88
    expect(result.score).toBe(88);
    expect(result.level).toBe('extreme');
  });

  it('maps supply disruption piecewise (2/5/10/20% breakpoints)', () => {
    expect(computePerilScore(null, 1, 0, 0, 0, 0).supplyScore).toBe(8); // (1/2)×15 = 7.5 → 8
    expect(computePerilScore(null, 19, 0, 0, 0, 0).supplyScore).toBe(78); // 60 + (9/10)×20
    expect(computePerilScore(null, 20, 0, 0, 0, 0).supplyScore).toBe(80); // ≥20 band
  });

  it('keeps historical anchors ordered for comparison context', () => {
    const scores = HISTORICAL_ANCHORS.map((a) => a.score);
    expect(scores).toEqual([...scores].sort((a, b) => a - b));
  });
});
