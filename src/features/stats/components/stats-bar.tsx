'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFireStore } from '@/stores/fire-store';
import { curatedFires } from '@/features/fires/data/curated-fires';
import {
  formatCO2,
  estimateCO2FromCapacity
} from '@/features/emissions/utils/emissions-model';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import {
  IconFlame,
  IconCloud,
  IconBuildingFactory,
  IconWorld,
  IconSatellite,
  IconClock
} from '@tabler/icons-react';

export default function StatsBar() {
  const fireData = useFireStore((s) => s.fireData);
  const loading = useFireStore((s) => s.loading);
  const lastUpdated = useFireStore((s) => s.lastUpdated);
  const timelineDate = useFireStore((s) => s.timelineDate);
  const setTimelineDate = useFireStore((s) => s.setTimelineDate);

  // Read the clock after mount so the build-time prerender never disagrees
  // with the client (avoids hydration mismatches around midnight).
  const [todayIso, setTodayIso] = useState('');
  useEffect(() => {
    setTodayIso(new Date().toISOString().slice(0, 10));
  }, []);
  const isHistorical = todayIso !== '' && timelineDate < todayIso;

  // Facility-matched fires and their ids in one pass, memoized so the
  // derived memos below keep stable dependencies.
  const { facilityFires, matchedFacilityIds } = useMemo(() => {
    const fires = fireData.features.filter((f) => f.properties.matchedFacility);
    const ids = new Set(fires.map((f) => f.properties.matchedFacility!.id));
    return { facilityFires: fires, matchedFacilityIds: ids };
  }, [fireData]);

  const activeFires = facilityFires.length;
  const totalDetections = fireData.features.length;
  const satelliteCO2 = useMemo(
    () =>
      facilityFires.reduce(
        (sum, f) => sum + (f.properties.estimatedCO2TonsDay || 0),
        0
      ),
    [facilityFires]
  );

  // Capacity-based fallback for burning facilities without satellite match (respecting timelineDate)
  const capacityCO2 = useMemo(() => {
    return curatedFires
      .filter(
        (f) =>
          (f.status === 'active_fire' || f.status === 'damaged') &&
          (!f.attackDate || f.attackDate <= timelineDate) &&
          !matchedFacilityIds.has(f.id)
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
  }, [matchedFacilityIds, timelineDate]);

  const totalCO2 = satelliteCO2 + capacityCO2;

  const facilitiesAffected = matchedFacilityIds.size;

  const globalEnergyAtRisk = Array.from(matchedFacilityIds).reduce(
    (sum, id) => {
      const facility = curatedFires.find((f) => f.id === id);
      return sum + (facility?.percentGlobalCapacity || 0);
    },
    0
  );

  return (
    <div className='space-y-2.5'>
      <div className='bg-muted/30 text-muted-foreground flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-xs'>
        <div className='flex items-center gap-2'>
          <span className='text-foreground inline-flex items-center gap-1.5 font-medium'>
            <span
              className={`h-2 w-2 rounded-full ${loading ? 'animate-pulse bg-amber-400' : 'bg-emerald-500'}`}
            />
            <IconSatellite className='h-3.5 w-3.5 text-emerald-500' />
            {loading
              ? 'Syncing NASA FIRMS VIIRS...'
              : `VIIRS Satellite Active (${totalDetections} thermal points)`}
          </span>
          {lastUpdated && (
            <span className='text-muted-foreground/80 hidden items-center gap-1 text-[11px] sm:inline-flex'>
              &middot; <IconClock className='h-3 w-3' /> Synced{' '}
              {lastUpdated.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          )}
        </div>
        <div className='flex items-center gap-2'>
          <span className='text-[11px]'>
            Timeline:{' '}
            <strong className='text-foreground'>{timelineDate}</strong>
          </span>
          {isHistorical && (
            <button
              onClick={() => setTimelineDate(todayIso)}
              className='bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer rounded px-2 py-0.5 text-[11px] font-semibold transition-colors'
            >
              Jump to Latest
            </button>
          )}
        </div>
      </div>

      <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
        <Card>
          <CardHeader className='pb-2'>
            <div className='flex items-center justify-between'>
              <CardDescription>Facility Fires</CardDescription>
              <IconFlame className='h-4 w-4 text-orange-500' />
            </div>
            <CardTitle className='text-2xl tabular-nums'>
              {loading ? '...' : activeFires.toLocaleString()}
            </CardTitle>
            <p className='text-muted-foreground text-xs'>
              {loading ? '' : `of ${totalDetections} satellite detections`}
            </p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <div className='flex items-center justify-between'>
              <CardDescription>Est. CO₂/day</CardDescription>
              <IconCloud className='h-4 w-4 text-red-400' />
            </div>
            <CardTitle className='text-2xl tabular-nums'>
              {loading ? '...' : `${formatCO2(totalCO2)} tons`}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <div className='flex items-center justify-between'>
              <CardDescription>Facilities Hit</CardDescription>
              <IconBuildingFactory className='h-4 w-4 text-yellow-500' />
            </div>
            <CardTitle className='text-2xl tabular-nums'>
              {loading ? '...' : facilitiesAffected}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <div className='flex items-center justify-between'>
              <CardDescription>Global Energy at Risk</CardDescription>
              <IconWorld className='h-4 w-4 text-cyan-400' />
            </div>
            <CardTitle className='text-2xl tabular-nums'>
              {loading ? '...' : `${globalEnergyAtRisk.toFixed(1)}%`}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
