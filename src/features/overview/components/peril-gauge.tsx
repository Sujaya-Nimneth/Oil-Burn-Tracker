'use client';

import { useMemo } from 'react';
import { useFireStore } from '@/stores/fire-store';
import {
  getNuclearStatusUpTo,
  getVisibleFacilityIds,
  getRecentEventStats
} from '@/features/timeline/data/conflict-events';
import { getSupplyDisruptionUpTo } from '@/features/fires/data/curated-fires';
import { computePerilScore, HISTORICAL_ANCHORS } from '@/lib/peril-score';

export default function PerilGauge() {
  const timelineDate = useFireStore((s) => s.timelineDate);

  const peril = useMemo(() => {
    const nuclear = getNuclearStatusUpTo(timelineDate);
    const facilityIds = getVisibleFacilityIds(timelineDate);
    const supply = getSupplyDisruptionUpTo(facilityIds, timelineDate);
    const stats = getRecentEventStats(timelineDate);

    return computePerilScore(
      nuclear,
      supply.productionPct,
      supply.transitBlockedPct,
      stats.eventsLast7,
      stats.severeEventsLast30,
      stats.totalEvents
    );
  }, [timelineDate]);

  return (
    <div className='px-3 py-2 md:px-4 md:py-2.5'>
      {/* Bar + score */}
      <div className='flex items-center gap-3'>
        <div className='relative h-3 flex-1 overflow-hidden rounded-full bg-gray-200 md:h-4 dark:bg-zinc-800'>
          <div
            className='h-full rounded-full transition-all duration-500 ease-out'
            style={{
              width: `${peril.score}%`,
              background: `linear-gradient(90deg, #eab308 0%, #f97316 30%, #ea580c 50%, #ef4444 70%, #dc2626 100%)`
            }}
          />
          {/* Historical anchor marks — desktop only */}
          <div className='hidden md:block'>
            {HISTORICAL_ANCHORS.map((a) => (
              <div
                key={a.label}
                className='absolute top-0 h-full w-px bg-gray-400/50 dark:bg-zinc-500/50'
                style={{ left: `${a.score}%` }}
                title={`${a.label} (${a.year})`}
              />
            ))}
          </div>
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          <span
            className='text-lg font-black tabular-nums md:text-xl'
            style={{ color: peril.color }}
          >
            {peril.score}
          </span>
          <span
            className='hidden text-xs font-bold tracking-wide uppercase md:inline md:text-sm'
            style={{ color: peril.color }}
          >
            {peril.label}
          </span>
        </div>
      </div>

      {/* Historical anchors legend — desktop only */}
      <div className='mt-0.5 hidden items-center gap-4 md:flex'>
        <span className='text-[10px] font-bold tracking-wider text-gray-400 uppercase dark:text-zinc-600'>
          Peril
        </span>
        {HISTORICAL_ANCHORS.map((a) => (
          <span
            key={a.label}
            className='text-[10px] text-gray-400 dark:text-zinc-600'
          >
            {a.label} ({a.score})
          </span>
        ))}
      </div>
    </div>
  );
}
