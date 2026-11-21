export type RecessionRiskLabel =
  'DEPRESSION RISK' | 'HIGH RISK' | 'ELEVATED' | 'MODERATE' | 'LOW';

export interface RecessionInput {
  oilPriceBbl: number;
  productionPct: number;
  groceryInflationPct: number;
  warCostBillions: number;
  shippingSurchargePct: number;
}

export interface RecessionBreakdown {
  score: number;
  oilSpikePct: number;
  supplyRisk: number;
  inflationPressure: number;
  warCostDrag: number;
  shippingStress: number;
  label: RecessionRiskLabel;
}

function clamp100(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function getRecessionRiskLabel(score: number): RecessionRiskLabel {
  if (score >= 80) return 'DEPRESSION RISK';
  if (score >= 60) return 'HIGH RISK';
  if (score >= 40) return 'ELEVATED';
  if (score >= 20) return 'MODERATE';
  return 'LOW';
}

/**
 * Composite 12-month US recession probability from conflict-driven economic stress.
 * Calibrated to ~25% at elevated crisis levels ($101 oil, 5% grocery inflation,
 * 65% shipping surcharge), 80-90% under full Hormuz closure / $200 oil, and ~5%
 * at pre-crisis baseline.
 */
export function computeRecessionScore(
  input: RecessionInput
): RecessionBreakdown {
  const oilSpikePct = clamp100(((input.oilPriceBbl - 75) / 75) * 100); // 100% at $150/bbl
  const supplyRisk = clamp100(input.productionPct * 5); // 100% at 20% offline
  const inflationPressure = clamp100((input.groceryInflationPct / 15) * 100); // 100% at 15% grocery inflation
  const warCostDrag = clamp100((input.warCostBillions / 2000) * 100); // 100% at $2T
  const shippingStress = clamp100(input.shippingSurchargePct); // 100% at 100% surcharge

  const rawScore = Math.round(
    oilSpikePct * 0.3 +
      supplyRisk * 0.25 +
      inflationPressure * 0.2 +
      warCostDrag * 0.15 +
      shippingStress * 0.1
  );
  const score = Math.min(99, Math.max(0, rawScore));

  return {
    score,
    oilSpikePct: Math.round(oilSpikePct),
    supplyRisk: Math.round(supplyRisk),
    inflationPressure: Math.round(inflationPressure),
    warCostDrag: Math.round(warCostDrag),
    shippingStress: Math.round(shippingStress),
    label: getRecessionRiskLabel(score)
  };
}
