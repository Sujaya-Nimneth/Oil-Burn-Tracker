'use client';

import { useMemo } from 'react';
import { useFireStore } from '@/stores/fire-store';
import { useEventsStore } from '@/stores/events-store';
import {
  getConsumerImpactUpTo,
  BASELINE
} from '@/features/impact/data/consumer-impact';
import {
  getCasualtiesUpTo,
  getNuclearStatusUpTo,
  getVisibleFacilityIds,
  getEventsUpTo,
  getRecentEventStats
} from '@/features/timeline/data/conflict-events';
import { getWarCostUpTo } from '@/features/timeline/data/war-costs';
import {
  curatedFires,
  FACILITY_STATUS_ORDER,
  getSupplyDisruptionUpTo,
  getInfrastructureDamageByCountry,
  getEffectiveFacilityStatus,
  getFacilityFireStatsMap,
  type FacilityType
} from '@/features/fires/data/curated-fires';
import {
  co2Equivalents,
  FACILITY_PARAMS,
  getCapacityCO2Estimates
} from '@/features/emissions/utils/emissions-model';
import { computePerilScore } from '@/lib/peril-score';
import { computeRecessionScore } from '../lib/recession-score';
import { computeScenarioPredictions } from '../lib/predictions';
import { IconClock } from '@tabler/icons-react';
import { EmissionsSection } from './sections/emissions-section';
import {
  CountryDamageSection,
  FacilitiesDamageSection,
  SupplyDisruptionSection
} from './sections/infrastructure-section';
import {
  CasualtiesSection,
  HouseholdCostSection,
  WarCostSection
} from './sections/human-economic-section';
import {
  NuclearSection,
  PerilSection,
  PredictionsSection,
  RecessionSection
} from './sections/risk-predictions-section';

const THREAT_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  elevated: 2,
  moderate: 3,
  low: 4
};

export default function DeepDivePanel({
  onMapMode
}: { onMapMode?: () => void } = {}) {
  const fireData = useFireStore((s) => s.fireData);
  const loading = useFireStore((s) => s.loading);
  const timelineDate = useFireStore((s) => s.timelineDate);
  const storeEvents = useEventsStore((s) => s.events);
  const eventsWithTelemetry = useEventsStore((s) => s.eventsWithTelemetry);
  const casualtyAnchors = useEventsStore((s) => s.casualtyAnchors);

  const facilityStats = useMemo(
    () => getFacilityFireStatsMap(fireData.features, timelineDate),
    [fireData.features, timelineDate]
  );

  const data = useMemo(() => {
    const impact = getConsumerImpactUpTo(timelineDate);
    const casualties = getCasualtiesUpTo(
      eventsWithTelemetry,
      casualtyAnchors,
      timelineDate
    );
    const nuclear = getNuclearStatusUpTo(timelineDate);
    const cost = getWarCostUpTo(timelineDate);
    const facilityIds = getVisibleFacilityIds(storeEvents, timelineDate);
    const supply = getSupplyDisruptionUpTo(facilityIds, timelineDate);
    const events = getEventsUpTo(storeEvents, timelineDate);
    const stats = getRecentEventStats(storeEvents, timelineDate);
    const peril = computePerilScore(
      nuclear,
      supply.productionPct,
      supply.transitBlockedPct,
      stats.eventsLast7,
      stats.severeEventsLast30,
      stats.totalEvents
    );
    const gasExtra = Math.max(
      0,
      (impact.gasPriceGallon - BASELINE.gasPriceGallon) *
        BASELINE.monthlyGasGallons
    );
    const oilDelta = impact.oilPriceBbl - BASELINE.oilPriceBbl;
    const perTaxpayer = Math.round((cost.totalBillions * 1e9) / 330_000_000);
    const warStart = new Date('2023-10-07');
    const current = new Date(timelineDate);
    const warDays = Math.max(
      1,
      Math.round((current.getTime() - warStart.getTime()) / 86400000)
    );

    const recession = computeRecessionScore({
      oilPriceBbl: impact.oilPriceBbl,
      productionPct: supply.productionPct,
      groceryInflationPct: impact.groceryInflationPct,
      warCostBillions: cost.totalBillions,
      shippingSurchargePct: impact.shippingSurchargePct
    });

    const hormuzBlocked =
      supply.chokepoints.find((c) => c.id === 'strait-of-hormuz')?.blockedPct ||
      0;

    const predictions = computeScenarioPredictions({
      hormuzBlockedPct: hormuzBlocked,
      productionPct: supply.productionPct,
      nuclearDestroyed: nuclear?.facilitiesDestroyed || 0,
      enrichmentPct: nuclear?.enrichmentPct ?? 100,
      radiationRisk: nuclear?.radiationRisk || 'none',
      eventsLast7: stats.eventsLast7,
      warDays,
      totalCostBillions: cost.totalBillions,
      totalKilled: casualties.totalKilled,
      oilPriceBbl: impact.oilPriceBbl,
      oilDelta,
      totalMonthlyExtra: impact.totalMonthlyExtra,
      recession
    });

    const hitFacilityList = curatedFires
      .filter((f) => facilityIds.has(f.id))
      .sort((a, b) => {
        const statusA = getEffectiveFacilityStatus(
          a,
          timelineDate,
          facilityStats.get(a.id)?.maxFRP ?? 0
        );
        const statusB = getEffectiveFacilityStatus(
          b,
          timelineDate,
          facilityStats.get(b.id)?.maxFRP ?? 0
        );
        return (
          (FACILITY_STATUS_ORDER[statusA] ?? 5) -
          (FACILITY_STATUS_ORDER[statusB] ?? 5)
        );
      });

    const threatenedFacilityList = curatedFires
      .filter((f) => !facilityIds.has(f.id))
      .sort(
        (a, b) =>
          (THREAT_ORDER[a.threatLevel] ?? 5) -
          (THREAT_ORDER[b.threatLevel] ?? 5)
      );

    const countryDamage = getInfrastructureDamageByCountry(
      facilityIds,
      timelineDate,
      events
    );

    // Years of life lost: avg age in memorial data ~29, WHO life expectancy 72 → ~43 yrs remaining
    const yearsOfLifeLost = Math.round(casualties.totalKilled * 43);

    // Role-based loss counts — sourced documented numbers, scaled proportionally to timeline
    const baseTotal = 85000;
    const scale = Math.min(1, casualties.totalKilled / baseTotal);
    const roleCounts = [
      {
        icon: 'stethoscope',
        label: 'Medical professionals',
        count: Math.round(1722 * scale),
        source: 'MSF / WHO'
      },
      {
        icon: 'heart',
        label: 'Children',
        count: casualties.totalChildren,
        source: 'UNICEF / MoH'
      },
      {
        icon: 'book',
        label: 'Teachers & UN staff',
        count: Math.round(300 * scale),
        source: 'UNRWA'
      },
      {
        icon: 'camera',
        label: 'Journalists',
        count: Math.round(254 * scale),
        source: 'CPJ'
      },
      {
        icon: 'school',
        label: 'University students',
        count: Math.round(4200 * scale),
        source: 'Al Jazeera / MoE'
      },
      {
        icon: 'friends',
        label: 'Parents',
        count: Math.round(casualties.totalKilled * 0.35),
        source: 'Demographic estimate'
      }
    ];

    return {
      impact,
      casualties,
      nuclear,
      cost,
      supply,
      stats,
      peril,
      gasExtra,
      oilDelta,
      perTaxpayer,
      warDays,
      recession,
      predictions,
      hitFacilityList,
      threatenedFacilityList,
      countryDamage,
      facilityIds,
      yearsOfLifeLost,
      roleCounts
    };
  }, [
    timelineDate,
    storeEvents,
    eventsWithTelemetry,
    casualtyAnchors,
    facilityStats
  ]);

  const {
    impact,
    casualties,
    nuclear,
    cost,
    supply,
    stats,
    peril,
    gasExtra,
    oilDelta,
    perTaxpayer,
    warDays,
    recession,
    predictions,
    hitFacilityList,
    threatenedFacilityList,
    countryDamage,
    facilityIds,
    yearsOfLifeLost,
    roleCounts
  } = data;

  const facilityFires = useMemo(
    () =>
      fireData.features.filter((f) => {
        const id = f.properties.matchedFacility?.id;
        return Boolean(id && facilityStats.has(id));
      }),
    [fireData.features, facilityStats]
  );

  const satelliteCO2 = useMemo(
    () =>
      facilityFires.reduce((s, f) => s + f.properties.estimatedCO2TonsDay, 0),
    [facilityFires]
  );
  const totalDetections = fireData.features.length;
  const facilityFireCount = facilityFires.length;

  const capacityEstimates = useMemo(
    () =>
      getCapacityCO2Estimates(curatedFires, {
        timelineDate,
        hitFacilityIds: facilityIds,
        facilityStats
      }),
    [facilityStats, facilityIds, timelineDate]
  );

  const capacityCO2 = useMemo(
    () => capacityEstimates.reduce((sum, e) => sum + e.co2, 0),
    [capacityEstimates]
  );
  const totalCO2 = satelliteCO2 + capacityCO2;
  const equiv = useMemo(() => co2Equivalents(totalCO2), [totalCO2]);

  const co2ByType = useMemo(() => {
    const byType: Record<string, { co2: number; frp: number; count: number }> =
      {};
    for (const f of facilityFires) {
      const type = f.properties.matchedFacility?.facilityType || 'unknown';
      if (!byType[type]) byType[type] = { co2: 0, frp: 0, count: 0 };
      byType[type].co2 += f.properties.estimatedCO2TonsDay || 0;
      byType[type].frp += f.properties.frp || 0;
      byType[type].count++;
    }
    return Object.entries(byType)
      .sort((a, b) => b[1].co2 - a[1].co2)
      .map(([type, d]) => {
        const p =
          FACILITY_PARAMS[type as FacilityType] || FACILITY_PARAMS.unknown;
        return { type, ...d, params: p };
      });
  }, [facilityFires]);

  const calcTooltip = useMemo(() => {
    const lines: string[] = [];
    if (co2ByType.length > 0) {
      lines.push(
        'CO\u2082 Calculation Breakdown',
        '\u2500'.repeat(40),
        'SATELLITE-BASED (FRP):',
        'Formula: CO\u2082 = FRP \u00d7 86400 / (f_rad \u00d7 H_c) \u00d7 EF / 1000',
        ''
      );
      for (const t of co2ByType) {
        const label = t.type.replace('_', ' ');
        lines.push(
          `\u25cf ${label} (${t.count} detection${t.count > 1 ? 's' : ''})`,
          `  FRP: ${t.frp.toFixed(1)} MW \u00d7 ${t.params.multiplier} t/MW/day = ${t.co2.toFixed(1)} t/day`,
          `  f_rad=${t.params.fRad}, H_c=${t.params.hc} MJ/kg (${t.params.fuel}), EF=${t.params.ef}`,
          ''
        );
      }
      lines.push(
        `Satellite subtotal: ${satelliteCO2.toFixed(1)} t CO\u2082/day`
      );
    }
    if (capacityEstimates.length > 0) {
      lines.push('', 'CAPACITY-BASED (no satellite data):');
      for (const e of capacityEstimates) {
        lines.push(`\u25cf ${e.facility.name}: ${e.co2.toFixed(0)} t/day`);
      }
      lines.push(`Capacity subtotal: ${capacityCO2.toFixed(0)} t CO\u2082/day`);
    }
    if (lines.length > 0) {
      lines.push('', `Total: ${totalCO2.toFixed(1)} t CO\u2082/day`);
      lines.push('', 'Sources: IPCC 2006, Elvidge et al. 2020, EPA 2024');
    }
    return lines.join('\n');
  }, [co2ByType, satelliteCO2, capacityEstimates, capacityCO2, totalCO2]);

  const curatedBurningCount = useMemo(
    () =>
      curatedFires.filter((f) => {
        const status = getEffectiveFacilityStatus(
          f,
          timelineDate,
          facilityStats.get(f.id)?.maxFRP ?? 0
        );
        return status === 'active_fire' || status === 'damaged';
      }).length,
    [timelineDate, facilityStats]
  );

  const dateFormatted = useMemo(
    () =>
      new Date(timelineDate + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      }),
    [timelineDate]
  );

  const annualCostPerHousehold = impact.totalMonthlyExtra * 12;

  return (
    <div className='h-full overflow-y-auto bg-gray-50 pb-8 dark:bg-zinc-950'>
      {/* ── DATE HEADER ── */}
      <div className='border-b border-gray-200 bg-white px-4 pt-4 pb-3 dark:border-zinc-700 dark:bg-zinc-900/80'>
        <div className='text-2xl leading-tight font-black text-gray-900 dark:text-white'>
          {dateFormatted}
        </div>
        <div className='mt-1.5 flex items-center gap-3'>
          <div className='flex items-center gap-1.5'>
            <IconClock className='h-4 w-4 text-gray-400 dark:text-zinc-500' />
            <span className='text-base font-extrabold text-gray-800 tabular-nums dark:text-zinc-200'>
              Day {warDays.toLocaleString()}
            </span>
          </div>
          <span className='text-gray-300 dark:text-zinc-700'>|</span>
          <span className='text-sm text-gray-500'>
            {stats.totalEvents} events
          </span>
          <span className='text-gray-300 dark:text-zinc-700'>|</span>
          <span className='text-sm font-bold text-blue-600 dark:text-blue-400'>
            {stats.eventsLast7} this week
          </span>
        </div>
      </div>

      <EmissionsSection
        loading={loading}
        totalCO2={totalCO2}
        satelliteCO2={satelliteCO2}
        capacityCO2={capacityCO2}
        equiv={equiv}
        co2ByType={co2ByType}
        capacityEstimates={capacityEstimates}
        calcTooltip={calcTooltip}
        facilityFireCount={facilityFireCount}
        totalDetections={totalDetections}
        curatedBurningCount={curatedBurningCount}
        onMapMode={onMapMode}
      />

      <FacilitiesDamageSection
        hitFacilityList={hitFacilityList}
        threatenedFacilityList={threatenedFacilityList}
        timelineDate={timelineDate}
        facilityStats={facilityStats}
      />

      <CasualtiesSection
        casualties={casualties}
        yearsOfLifeLost={yearsOfLifeLost}
        roleCounts={roleCounts}
      />

      <HouseholdCostSection
        impact={impact}
        gasExtra={gasExtra}
        oilDelta={oilDelta}
        annualCostPerHousehold={annualCostPerHousehold}
      />

      <WarCostSection cost={cost} perTaxpayer={perTaxpayer} warDays={warDays} />

      <NuclearSection nuclear={nuclear} peril={peril} />

      <RecessionSection recession={recession} />

      <PerilSection peril={peril} />

      <SupplyDisruptionSection supply={supply} />

      <CountryDamageSection
        countryDamage={countryDamage}
        facilityIds={facilityIds}
        timelineDate={timelineDate}
        facilityStats={facilityStats}
      />

      <PredictionsSection predictions={predictions} />

      <div className='h-8' />
    </div>
  );
}
