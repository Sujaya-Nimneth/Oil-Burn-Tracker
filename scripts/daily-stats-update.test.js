import { describe, it, expect } from 'vitest';
import lib from './daily-stats-update.js';

const {
  dateHash,
  seededRandom,
  getPhaseTargets,
  blendLivePrices,
  generateConsumerImpact,
  daysSince,
  generateDays
} = lib;

describe('deterministic randomness', () => {
  it('hashes the same date to the same value', () => {
    expect(dateHash('2026-03-15')).toBe(dateHash('2026-03-15'));
    expect(dateHash('2026-03-15')).not.toBe(dateHash('2026-03-16'));
  });

  it('produces seeded values in [0, 1)', () => {
    for (let i = 0; i < 500; i++) {
      const v = seededRandom(i);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(seededRandom(42)).toBe(seededRandom(42));
  });
});

describe('phase-aware targets', () => {
  it('returns the acute Gulf phase through April 2026', () => {
    const t = getPhaseTargets('2026-04-30');
    expect(t.oilTarget).toBe(106);
    expect(t.phaseLabel).toContain('Hormuz');
  });

  it('switches to the escort-corridor phase from May 2026', () => {
    const t = getPhaseTargets('2026-06-15');
    expect(t.oilTarget).toBe(94);
    expect(t.dailyKilled).toBe(65);
  });

  it('uses live prices in phase 3 with sane fallbacks', () => {
    const t = getPhaseTargets('2026-10-01');
    expect(t.oilTarget).toBe(88); // no live feed → fallback
    const live = getPhaseTargets('2026-10-01', { brent: 101.4, natGas: 4.2 });
    expect(live.oilTarget).toBe(101);
    expect(live.natGasTarget).toBe(4.2);
  });
});

describe('date helpers', () => {
  it('counts whole days between ISO dates', () => {
    expect(daysSince('2026-03-01', '2026-03-31')).toBe(30);
  });

  it('generates every day after the baseline through today', () => {
    const days = generateDays('2026-03-27', '2026-03-30');
    expect(days).toEqual(['2026-03-28', '2026-03-29', '2026-03-30']);
  });
});

describe('live commodity smoothing', () => {
  it('returns empty overrides outside the trailing 14-day window or before phase 3', () => {
    expect(
      blendLivePrices('2026-10-01', '2026-11-21', { brent: 112, natGas: 6.2 })
    ).toEqual({});
    expect(
      blendLivePrices('2026-07-31', '2026-08-05', { brent: 112, natGas: 6.2 })
    ).toEqual({});
  });

  it('ramps smoothly from static baseline to live quote on today', () => {
    const today = '2026-11-21';
    const weekAgo = blendLivePrices('2026-11-14', today, {
      brent: 116,
      natGas: 6.5
    });
    const onToday = blendLivePrices(today, today, {
      brent: 116,
      natGas: 6.5
    });
    expect(weekAgo.brent).toBeCloseTo(102, 1); // midpoint between 88 and 116
    expect(weekAgo.natGas).toBeCloseTo(5.5, 1); // midpoint between 4.5 and 6.5
    expect(onToday.brent).toBe(116);
    expect(onToday.natGas).toBe(6.5);
  });

  it('converges consumer impact oil price smoothly without a single-day cliff', () => {
    const today = '2026-11-21';
    const days = generateDays('2026-03-27', today);
    const liveSeries = generateConsumerImpact(days, today, {
      brent: 115,
      natGas: 6.2
    });
    const last = liveSeries[liveSeries.length - 1];
    const prev = liveSeries[liveSeries.length - 2];
    expect(Math.abs(last.oilPriceBbl - prev.oilPriceBbl)).toBeLessThanOrEqual(
      10
    );
    expect(last.oilPriceBbl).toBeGreaterThan(100);
    expect(last.source).toContain('Live market feed');
  });
});
