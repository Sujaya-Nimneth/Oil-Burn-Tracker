'use client';

import { useMemo } from 'react';
import { useFireStore } from '@/stores/fire-store';
import { useEventsStore } from '@/stores/events-store';
import {
  getCasualtiesUpTo,
  getVisibleFacilityIds
} from '@/features/timeline/data/conflict-events';
import { getConsumerImpactUpTo } from '@/features/impact/data/consumer-impact';
import {
  formatCO2,
  estimateCO2FromCapacity
} from '@/features/emissions/utils/emissions-model';
import { curatedFires } from '@/features/fires/data/curated-fires';
import { IconFlame, IconReceipt, IconSkull } from '@tabler/icons-react';

export default function HeroPills() {
  const fireData = useFireStore((s) => s.fireData);
  const timelineDate = useFireStore((s) => s.timelineDate);
  const events = useEventsStore((s) => s.events);
  const eventsWithTelemetry = useEventsStore((s) => s.eventsWithTelemetry);

  const facilityFires = fireData.features.filter(
    (f) => f.properties.matchedFacility
  );
  const satelliteCO2 = facilityFires.reduce(
    (s, f) => s + f.properties.estimatedCO2TonsDay,
    0
  );

  // Capacity-based fallback for burning facilities without satellite match (synced to timelineDate)
  const capacityCO2 = useMemo(() => {
    const matchedIds = new Set(
      facilityFires.map((f) => f.properties.matchedFacility!.id)
    );
    const hitIds = getVisibleFacilityIds(events, timelineDate);
    return curatedFires
      .filter(
        (f) =>
          (f.status === 'active_fire' || f.status === 'damaged') &&
          !matchedIds.has(f.id) &&
          (hitIds.has(f.id) ||
            (f.attackDate != null && f.attackDate <= timelineDate))
      )
      .reduce(
        (sum, f) =>
          sum +
          estimateCO2FromCapacity(
            f.facilityType,
            f.status,
            f.capacityBPD,
            f.gasCapacityBCFD,
            f.storageMBBL
          ),
        0
      );
  }, [facilityFires, events, timelineDate]);

  const totalCO2 = satelliteCO2 + capacityCO2;
  const casualties = getCasualtiesUpTo(eventsWithTelemetry, timelineDate);
  const impact = getConsumerImpactUpTo(timelineDate);

  const co2Label =
    capacityCO2 > 0 && satelliteCO2 === 0 ? 't/day CO₂ (est.)' : 't/day CO₂';

  return (
    <div className='flex min-w-0 flex-1 items-center gap-3 md:gap-4'>
      {/* CO2 */}
      <div className='flex min-w-0 items-center gap-1.5'>
        <IconFlame className='h-5 w-5 shrink-0 text-orange-600' />
        <div className='min-w-0'>
          <div className='text-base leading-none font-black text-orange-700 tabular-nums md:text-lg dark:text-orange-500'>
            {totalCO2 > 0 ? formatCO2(totalCO2) : '—'}
          </div>
          <div className='mt-0.5 hidden text-[10px] leading-none text-gray-500 md:block'>
            {co2Label}
          </div>
        </div>
      </div>

      <div className='h-7 w-px shrink-0 bg-gray-300 dark:bg-zinc-800' />

      {/* Energy cost */}
      <div className='flex min-w-0 items-center gap-1.5'>
        <IconReceipt className='h-5 w-5 shrink-0 text-green-700 dark:text-green-500' />
        <div className='min-w-0'>
          <div className='text-base leading-none font-black text-green-800 tabular-nums md:text-lg dark:text-green-400'>
            +${impact.totalMonthlyExtra}
          </div>
          <div className='mt-0.5 hidden text-[10px] leading-none text-gray-500 md:block'>
            /mo per household
          </div>
        </div>
      </div>

      <div className='h-7 w-px shrink-0 bg-gray-300 dark:bg-zinc-800' />

      {/* Human cost */}
      <a
        href='/dashboard/lost'
        className='group flex min-w-0 items-center gap-1.5'
      >
        <IconSkull className='h-5 w-5 shrink-0 animate-pulse text-red-600' />
        <span className='text-base leading-none font-black text-red-600 tabular-nums underline decoration-red-500/60 decoration-2 underline-offset-2 transition-colors group-hover:decoration-red-400 md:text-lg dark:text-red-500'>
          {casualties.totalKilled.toLocaleString()}+ people
        </span>
      </a>
    </div>
  );
}
