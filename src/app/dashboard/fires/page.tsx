'use client';

import { useMemo } from 'react';
import { useFireData } from '@/features/map/hooks/use-fire-data';
import {
  curatedFires,
  getEffectiveFacilityStatus,
  getFacilityFireStatsMap,
  type FacilityStatus
} from '@/features/fires/data/curated-fires';
import FacilityDrawer, {
  FACILITY_STATUS_CONFIG
} from '@/features/fires/components/facility-drawer';
import { useFireStore } from '@/stores/fire-store';
import { formatCO2 } from '@/features/emissions/utils/emissions-model';
import PageContainer from '@/components/layout/page-container';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  IconExternalLink,
  IconMapPin,
  IconCalendar,
  IconInfoCircle
} from '@tabler/icons-react';
import Link from 'next/link';

export default function FiresPage() {
  useFireData();
  const fireData = useFireStore((s) => s.fireData);
  const timelineDate = useFireStore((s) => s.timelineDate);
  const setMapCenter = useFireStore((s) => s.setMapCenter);
  const setMapZoom = useFireStore((s) => s.setMapZoom);
  const setSelectedFacility = useFireStore((s) => s.setSelectedFacility);
  const setMapMode = useFireStore((s) => s.setMapMode);

  const facilityStats = useMemo(
    () => getFacilityFireStatsMap(fireData.features),
    [fireData.features]
  );

  const facilityData = useMemo(
    () =>
      curatedFires
        .map((facility) => {
          const stats = facilityStats.get(facility.id);
          const fireCount = stats?.fireCount ?? 0;
          const maxFRP = stats?.maxFRP ?? 0;
          const totalCO2 = stats?.totalCO2 ?? 0;
          const liveStatus = getEffectiveFacilityStatus(
            facility,
            timelineDate,
            maxFRP
          );

          return {
            ...facility,
            liveStatus,
            fireCount,
            maxFRP,
            totalCO2
          };
        })
        .sort((a, b) => {
          const order: Record<FacilityStatus, number> = {
            active_fire: 0,
            damaged: 1,
            monitoring: 2,
            offline: 3,
            operational: 4
          };
          return (order[a.liveStatus] || 4) - (order[b.liveStatus] || 4);
        }),
    [facilityStats, timelineDate]
  );

  return (
    <PageContainer>
      <div className='space-y-4'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>
            Fire & Facility List
          </h1>
          <p className='text-muted-foreground text-sm'>
            All {curatedFires.length} monitored facilities with live satellite
            fire detection status.
          </p>
        </div>
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          {facilityData.map((f) => {
            const config = FACILITY_STATUS_CONFIG[f.liveStatus];
            const StatusIcon = config.icon;
            return (
              <Card key={f.id} className='flex flex-col'>
                <CardHeader className='pb-2'>
                  <div className='flex items-start justify-between gap-2'>
                    <div>
                      <CardTitle className='text-base'>{f.name}</CardTitle>
                      <CardDescription>
                        {f.country} &middot; {f.facilityType.replace('_', ' ')}
                      </CardDescription>
                    </div>
                    <Badge variant={config.variant} className='shrink-0'>
                      <StatusIcon className='mr-1 h-3 w-3' />
                      {config.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className='text-muted-foreground flex-1 space-y-2 text-sm'>
                  <p>{f.description}</p>

                  {/* Attack date */}
                  {f.attackDate && (
                    <div className='flex items-center gap-1.5 text-xs'>
                      <IconCalendar className='h-3.5 w-3.5 text-red-400' />
                      <span className='font-semibold text-red-400'>
                        Struck:{' '}
                        {new Date(
                          f.attackDate + 'T00:00:00'
                        ).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                  )}

                  {/* Strategic info */}
                  <p className='text-muted-foreground/80 text-[11px]'>
                    {f.whyItMatters}
                  </p>

                  <div className='flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs'>
                    <span>
                      Capacity: {(f.capacityBPD / 1000).toFixed(0)}K BPD
                    </span>
                    <span>Global: {f.percentGlobalCapacity}%</span>
                    {f.fireCount > 0 && (
                      <>
                        <span className='text-orange-400'>
                          FRP: {f.maxFRP.toFixed(1)} MW
                        </span>
                        <span className='text-red-400'>
                          CO2: {formatCO2(f.totalCO2)} t/day
                        </span>
                      </>
                    )}
                  </div>

                  {/* Action links */}
                  <div className='flex flex-wrap gap-2 border-t pt-2'>
                    {f.newsSourceUrl && (
                      <a
                        href={f.newsSourceUrl}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='bg-muted/60 hover:bg-accent inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors'
                      >
                        <IconExternalLink className='h-3 w-3 text-blue-400' />
                        {(() => {
                          try {
                            return new URL(f.newsSourceUrl).hostname.replace(
                              'www.',
                              ''
                            );
                          } catch {
                            return 'News source';
                          }
                        })()}
                      </a>
                    )}
                    <button
                      type='button'
                      onClick={() => setSelectedFacility(f)}
                      className='bg-muted/60 hover:bg-accent inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors'
                    >
                      <IconInfoCircle className='h-3 w-3 text-orange-400' />
                      Details
                    </button>
                    <Link
                      href='/dashboard/overview'
                      onClick={() => {
                        setMapCenter([f.lng, f.lat]);
                        setMapZoom(11);
                        setSelectedFacility(f);
                        setMapMode(true);
                      }}
                      className='bg-muted/60 hover:bg-accent inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors'
                    >
                      <IconMapPin className='h-3 w-3 text-green-400' />
                      View on map
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
      <FacilityDrawer />
    </PageContainer>
  );
}
