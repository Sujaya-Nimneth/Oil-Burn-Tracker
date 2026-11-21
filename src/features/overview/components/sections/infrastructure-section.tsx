'use client';

import { useState } from 'react';
import {
  curatedFires,
  getEffectiveFacilityStatus,
  getSupplyDisruptionUpTo,
  isChokepoint,
  type CountryDamageEntry,
  type CuratedFire,
  type DamageClassification,
  type FacilityFireStats
} from '@/features/fires/data/curated-fires';

type SupplyDisruption = ReturnType<typeof getSupplyDisruptionUpTo>;
import {
  IconAlertTriangle,
  IconBuildingSkyscraper,
  IconFlame,
  IconShip,
  IconWorld
} from '@tabler/icons-react';
import {
  Bar,
  FacilityCard,
  InfoBox,
  Row,
  SectionTitle,
  StatCard
} from './primitives';

const DISRUPTION_LABELS: Record<string, string> = {
  normal: 'NORMAL',
  mild: 'MILD',
  severe: 'SEVERE',
  crisis: 'CRISIS',
  catastrophe: 'CATASTROPHE'
};

const DISRUPTION_BADGE: Record<string, string> = {
  normal: 'bg-green-100 text-green-800 border-green-200',
  mild: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  severe: 'bg-orange-100 text-orange-800 border-orange-200',
  crisis: 'bg-orange-200 text-orange-900 border-orange-300',
  catastrophe: 'bg-orange-300 text-orange-950 border-orange-400 animate-pulse'
};

const DAMAGE_BADGE: Record<
  DamageClassification,
  { label: string; cls: string }
> = {
  devastated: {
    label: 'DEVASTATED',
    cls: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
  },
  heavy: {
    label: 'HEAVY DAMAGE',
    cls: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800'
  },
  moderate: {
    label: 'MODERATE',
    cls: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'
  },
  light: {
    label: 'LIGHT',
    cls: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800'
  },
  threatened: {
    label: 'THREATENED',
    cls: 'bg-gray-100 dark:bg-zinc-700/50 text-gray-700 dark:text-gray-400 border-gray-300 dark:border-zinc-600'
  },
  unaffected: {
    label: 'UNAFFECTED',
    cls: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
  }
};

export function FacilitiesDamageSection({
  hitFacilityList,
  threatenedFacilityList,
  timelineDate,
  facilityStats
}: {
  hitFacilityList: CuratedFire[];
  threatenedFacilityList: CuratedFire[];
  timelineDate: string;
  facilityStats: Map<string, FacilityFireStats>;
}) {
  if (hitFacilityList.length === 0 && timelineDate < '2024-01-12') {
    return null;
  }

  const productionHit = hitFacilityList.filter((f) => !isChokepoint(f.id));
  const productionBPD = productionHit.reduce((s, f) => s + f.capacityBPD, 0);
  const productionPct = productionHit.reduce(
    (s, f) => s + f.percentGlobalCapacity,
    0
  );

  return (
    <div className='border-b border-gray-200 px-4 pt-4 pb-3 dark:border-zinc-700'>
      <SectionTitle
        icon={<IconBuildingSkyscraper className='h-5 w-5 text-red-600' />}
        title='Facilities Damage Report'
      />
      <div className='mb-3 text-base text-gray-500'>
        <strong className='text-red-600'>{hitFacilityList.length}</strong> hit ·{' '}
        <strong className='text-yellow-600'>
          {threatenedFacilityList.length}
        </strong>{' '}
        threatened · {curatedFires.length} total tracked
      </div>

      {/* Total production capacity damaged/offline (excludes transit chokepoints) */}
      <StatCard>
        <div className='mb-1.5 flex items-center justify-between'>
          <span className='text-base font-bold text-gray-800 dark:text-zinc-200'>
            Total production damaged/offline
          </span>
          <span className='text-xl font-black text-red-600 tabular-nums'>
            {(productionBPD / 1_000_000).toFixed(1)}M BPD
          </span>
        </div>
        <Bar pct={Math.min(100, productionPct * 4)} color='bg-red-500' />
        <div className='mt-1 text-sm text-gray-500'>
          {productionPct.toFixed(1)}% of global production affected (excl.
          transit chokepoints)
        </div>
      </StatCard>

      {hitFacilityList.length > 0 && (
        <>
          <div className='mt-4 mb-2 flex items-center gap-1.5 text-xs font-extrabold tracking-widest text-red-500 uppercase'>
            <IconFlame className='h-3.5 w-3.5' />
            Hit / Damaged ({hitFacilityList.length})
          </div>
          <div className='mb-4 space-y-2'>
            {hitFacilityList.map((f) => (
              <FacilityCard
                key={f.id}
                facility={f}
                hit
                status={getEffectiveFacilityStatus(
                  f,
                  timelineDate,
                  facilityStats.get(f.id)?.maxFRP ?? 0
                )}
              />
            ))}
          </div>
        </>
      )}

      {threatenedFacilityList.length > 0 && (
        <>
          <div className='mb-2 flex items-center gap-1.5 text-xs font-extrabold tracking-widest text-yellow-600 uppercase'>
            <IconAlertTriangle className='h-3.5 w-3.5' />
            Threatened / Monitoring ({threatenedFacilityList.length})
          </div>
          <div className='space-y-2'>
            {threatenedFacilityList.map((f) => (
              <FacilityCard
                key={f.id}
                facility={f}
                hit={false}
                status={getEffectiveFacilityStatus(
                  f,
                  timelineDate,
                  facilityStats.get(f.id)?.maxFRP ?? 0
                )}
              />
            ))}
          </div>
        </>
      )}

      <InfoBox>
        Click any facility for full breakdown — strategic importance, cascade
        impact, and supply chain role.
      </InfoBox>
    </div>
  );
}

export function SupplyDisruptionSection({
  supply
}: {
  supply: SupplyDisruption;
}) {
  return (
    <div className='border-b border-gray-200 px-4 pt-4 pb-3 dark:border-zinc-700'>
      <SectionTitle
        icon={<IconAlertTriangle className='h-5 w-5 text-blue-600' />}
        title='Global Oil Supply'
      />

      <div
        className={`mb-2 inline-block rounded-md border px-3 py-1 text-sm font-black tracking-wider uppercase ${DISRUPTION_BADGE[supply.level] || DISRUPTION_BADGE.normal}`}
      >
        {DISRUPTION_LABELS[supply.level] || 'NORMAL'}
      </div>

      <div className='space-y-1'>
        <Row
          label='Production offline'
          value={`${supply.productionPct.toFixed(1)}%`}
          valueColor='text-blue-700 dark:text-blue-400'
          tip="How much of the world's 100M barrels/day is offline"
        />
        <Row
          label='Barrels/day offline'
          value={`${(supply.productionBPDOffline / 1_000_000).toFixed(1)}M BPD`}
          tip='Millions of barrels per day no longer being produced'
        />
        <Row
          label='Facilities hit'
          value={String(supply.facilitiesHit)}
          tip='Number of oil/gas facilities damaged or destroyed'
        />
      </div>
      <div className='mt-1.5'>
        <Bar
          pct={supply.productionPct * 4}
          color={
            supply.level === 'catastrophe'
              ? 'bg-orange-700'
              : supply.level === 'crisis'
                ? 'bg-orange-600'
                : 'bg-orange-500'
          }
        />
      </div>

      {supply.chokepoints.length > 0 && (
        <div className='mt-3 space-y-2 border-t border-gray-200 pt-2 dark:border-zinc-800/50'>
          <div className='flex items-center gap-1.5 text-sm font-extrabold tracking-wider text-gray-500 uppercase'>
            <IconShip className='h-4 w-4' />
            Shipping Chokepoints
          </div>
          {supply.chokepoints.map((cp) => (
            <StatCard key={cp.id}>
              <div className='mb-1 flex items-center justify-between'>
                <span className='text-base font-bold text-gray-800 dark:text-zinc-200'>
                  {cp.id === 'strait-of-hormuz'
                    ? 'Strait of Hormuz'
                    : 'Bab el-Mandeb'}
                </span>
                <span
                  className={`text-lg font-black tabular-nums ${cp.blockedPct >= 60 ? 'text-orange-800 dark:text-orange-400' : cp.blockedPct >= 30 ? 'text-orange-700 dark:text-orange-400' : 'text-amber-700 dark:text-amber-400'}`}
                >
                  {cp.blockedPct}%
                </span>
              </div>
              <Bar
                pct={cp.blockedPct}
                color={
                  cp.blockedPct >= 60
                    ? 'bg-orange-600'
                    : cp.blockedPct >= 30
                      ? 'bg-orange-500'
                      : 'bg-amber-500'
                }
                height='h-2'
              />
              <div className='mt-1 text-sm text-gray-500'>
                {(cp.capacityBPD / 1_000_000).toFixed(1)}M BPD capacity —{' '}
                {(cp.blockedBPD / 1_000_000).toFixed(1)}M blocked
              </div>
            </StatCard>
          ))}
          <Row
            label='Global transit disrupted'
            value={`${supply.transitBlockedPct.toFixed(1)}%`}
            valueColor='text-blue-700 dark:text-blue-400'
          />
        </div>
      )}

      <InfoBox>
        {supply.level === 'catastrophe'
          ? 'This is worse than the 1973 oil embargo. Gas stations may run dry. Rationing is being discussed.'
          : supply.level === 'crisis'
            ? 'Like the 2019 Saudi Aramco attack — but sustained across multiple countries simultaneously.'
            : 'Global oil supply under pressure. Every barrel offline means higher prices at the pump.'}
      </InfoBox>
    </div>
  );
}

function CountryComparisonBar({
  countries
}: {
  countries: CountryDamageEntry[];
}) {
  const oilCountries = countries.filter(
    (c) => c.hasOilInfra && c.pctGlobalOffline > 0
  );
  if (oilCountries.length === 0) return null;
  const maxPct = Math.max(...oilCountries.map((c) => c.pctGlobalOffline), 1);

  return (
    <StatCard>
      <div className='mb-2 text-xs font-extrabold tracking-widest text-gray-500 uppercase'>
        % Global Supply Offline by Country
      </div>
      <div className='space-y-1.5'>
        {oilCountries.map((c) => (
          <div key={c.country}>
            <div className='mb-0.5 flex items-center justify-between text-sm'>
              <span className='font-bold text-gray-700 dark:text-zinc-300'>
                {c.country}
              </span>
              <span className='font-bold text-gray-900 tabular-nums dark:text-zinc-100'>
                {c.pctGlobalOffline.toFixed(1)}%
              </span>
            </div>
            <Bar
              pct={(c.pctGlobalOffline / maxPct) * 100}
              color={
                c.damageClassification === 'devastated'
                  ? 'bg-red-600'
                  : c.damageClassification === 'heavy'
                    ? 'bg-red-500'
                    : c.damageClassification === 'moderate'
                      ? 'bg-orange-500'
                      : 'bg-yellow-500'
              }
              height='h-2'
            />
          </div>
        ))}
      </div>
    </StatCard>
  );
}

function CountryCard({
  entry,
  hitFacilityIds,
  timelineDate,
  facilityStats
}: {
  entry: CountryDamageEntry;
  hitFacilityIds: Set<string>;
  timelineDate: string;
  facilityStats: Map<string, FacilityFireStats>;
}) {
  const [open, setOpen] = useState(false);
  const badge = DAMAGE_BADGE[entry.damageClassification];

  return (
    <div
      className={`overflow-hidden rounded-xl border ${
        entry.damageSeverity >= 80
          ? 'border-red-200 bg-red-50/30 dark:border-red-900/50 dark:bg-red-950/10'
          : entry.damageSeverity >= 40
            ? 'border-orange-200 bg-orange-50/20 dark:border-orange-900/50 dark:bg-orange-950/10'
            : 'border-gray-200 bg-white dark:border-zinc-700/50 dark:bg-zinc-800/40'
      }`}
    >
      <button
        type='button'
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className='w-full cursor-pointer p-3 text-left'
      >
        <div className='flex items-start justify-between gap-2'>
          <div className='min-w-0'>
            <span className='text-base font-black text-gray-900 dark:text-zinc-100'>
              {entry.country}
            </span>
            {entry.hasOilInfra ? (
              <div className='mt-0.5 text-sm text-gray-500'>
                <strong className='text-red-600'>{entry.facilitiesHit}</strong>/
                {entry.facilitiesTotal} facilities hit
                {entry.capacityOfflineBPD > 0 && (
                  <>
                    {' '}
                    ·{' '}
                    <strong>
                      {(entry.capacityOfflineBPD / 1_000_000).toFixed(1)}M BPD
                    </strong>{' '}
                    offline
                  </>
                )}
              </div>
            ) : (
              <div className='mt-0.5 text-sm text-gray-500'>
                {entry.events} events ·{' '}
                <strong className='text-red-600'>
                  {entry.casualties.killed.toLocaleString()}
                </strong>{' '}
                killed
                {entry.casualties.injured > 0 && (
                  <> · {entry.casualties.injured.toLocaleString()} injured</>
                )}
              </div>
            )}
          </div>
          <span
            className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-black uppercase ${badge.cls}`}
          >
            {badge.label}
          </span>
        </div>
        {entry.hasOilInfra && entry.pctGlobalOffline > 0 && (
          <div className='mt-2'>
            <Bar
              pct={entry.pctGlobalOffline * 10}
              color={
                entry.damageClassification === 'devastated'
                  ? 'bg-red-600'
                  : entry.damageClassification === 'heavy'
                    ? 'bg-red-500'
                    : 'bg-orange-500'
              }
              height='h-2'
            />
            <div className='mt-0.5 text-xs text-gray-400 tabular-nums'>
              {entry.pctGlobalOffline.toFixed(1)}% of global supply offline
            </div>
          </div>
        )}
        {entry.events > 0 && (
          <div className='mt-1.5 flex items-center gap-3 text-xs text-gray-400'>
            <span>{entry.events} events</span>
            {entry.casualties.killed > 0 && (
              <span>{entry.casualties.killed.toLocaleString()} killed</span>
            )}
            {entry.casualties.displaced > 0 && (
              <span>
                {(entry.casualties.displaced / 1_000_000).toFixed(1)}M displaced
              </span>
            )}
          </div>
        )}
      </button>
      {open && entry.facilities.length > 0 && (
        <div className='space-y-2 border-t border-gray-100 px-3 pt-2 pb-3 dark:border-zinc-800/50'>
          {entry.facilities.map((f) => (
            <FacilityCard
              key={f.id}
              facility={f}
              hit={hitFacilityIds.has(f.id)}
              status={getEffectiveFacilityStatus(
                f,
                timelineDate,
                facilityStats.get(f.id)?.maxFRP ?? 0
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CountryDamageSection({
  countryDamage,
  facilityIds,
  timelineDate,
  facilityStats
}: {
  countryDamage: CountryDamageEntry[];
  facilityIds: Set<string>;
  timelineDate: string;
  facilityStats: Map<string, FacilityFireStats>;
}) {
  if (countryDamage.length === 0) return null;

  return (
    <div className='border-b border-gray-200 px-4 pt-4 pb-3 dark:border-zinc-700'>
      <SectionTitle
        icon={<IconWorld className='h-5 w-5 text-blue-600' />}
        title='Country Damage Report'
      />
      <div className='mb-3 text-base text-gray-500'>
        Infrastructure and conflict damage by country — sorted by severity
      </div>

      <CountryComparisonBar countries={countryDamage} />

      <div className='mt-3 space-y-2'>
        {countryDamage.map((entry) => (
          <CountryCard
            key={entry.country}
            entry={entry}
            hitFacilityIds={facilityIds}
            timelineDate={timelineDate}
            facilityStats={facilityStats}
          />
        ))}
      </div>

      <InfoBox>
        Click any country to expand and see individual facility damage cards.
        Countries like Lebanon and Yemen appear based on conflict events even
        without oil infrastructure.
      </InfoBox>
    </div>
  );
}
