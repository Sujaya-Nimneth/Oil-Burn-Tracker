'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
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
  getSupplyDisruptionUpTo,
  getInfrastructureDamageByCountry,
  getEffectiveFacilityStatus,
  getFacilityFireStatsMap,
  isChokepoint
} from '@/features/fires/data/curated-fires';
import { curatedFires } from '@/features/fires/data/curated-fires';
import type {
  CountryDamageEntry,
  DamageClassification,
  FacilityFireStats,
  FacilityStatus,
  FacilityType
} from '@/features/fires/data/curated-fires';
import {
  formatCO2,
  co2Equivalents,
  FACILITY_PARAMS,
  getCapacityCO2Estimates
} from '@/features/emissions/utils/emissions-model';
import { computePerilScore, HISTORICAL_ANCHORS } from '@/lib/peril-score';
import { formatBillions } from '@/lib/format';
import { computeRecessionScore } from '../lib/recession-score';
import {
  computeScenarioPredictions,
  type ScenarioPrediction
} from '../lib/predictions';
import {
  IconGasStation,
  IconShoppingCart,
  IconBolt,
  IconPackage,
  IconRadioactive,
  IconBomb,
  IconCloud,
  IconAlertTriangle,
  IconFlame,
  IconWorld,
  IconBuildingSkyscraper,
  IconTrendingUp,
  IconReceipt,
  IconShip,
  IconClock,
  IconUsers,
  IconHome,
  IconInfoCircle,
  IconHeart,
  IconStethoscope,
  IconBook,
  IconCamera,
  IconSchool,
  IconFriends
} from '@tabler/icons-react';

/* ── Reusable data row with optional tooltip (click to expand) ── */
function Row({
  label,
  value,
  valueColor,
  tip,
  sub
}: {
  label: string;
  value: string;
  valueColor?: string;
  tip?: string;
  sub?: string;
}) {
  const [showTip, setShowTip] = useState(false);
  return (
    <div>
      <div className='flex items-center justify-between py-1'>
        <span className='flex items-center gap-1 text-base text-gray-600 dark:text-zinc-300'>
          {label}
          {tip && (
            <button
              onClick={() => setShowTip(!showTip)}
              className='cursor-pointer rounded-full p-0.5 transition-colors hover:bg-gray-200 dark:hover:bg-zinc-700'
              aria-label='More info'
            >
              <IconInfoCircle
                className={`h-4 w-4 transition-colors ${showTip ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-zinc-600'}`}
              />
            </button>
          )}
        </span>
        <span
          className={`text-base font-bold tabular-nums ${valueColor || 'text-gray-900 dark:text-white'}`}
        >
          {value}
        </span>
      </div>
      {showTip && tip && (
        <div className='mb-1.5 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5 text-sm leading-relaxed text-gray-600 dark:border-zinc-700/50 dark:bg-zinc-800/60 dark:text-zinc-400'>
          {tip}
        </div>
      )}
      {sub && (
        <div className='-mt-0.5 mb-0.5 text-sm text-gray-400 dark:text-zinc-500'>
          {sub}
        </div>
      )}
    </div>
  );
}

/* ── Info box for context/connection ── */
function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className='mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 dark:border-zinc-700/50 dark:bg-zinc-800/50'>
      <div className='text-sm leading-relaxed text-gray-700 dark:text-zinc-400'>
        {children}
      </div>
    </div>
  );
}

/* ── Progress bar ── */
function Bar({
  pct,
  color,
  height
}: {
  pct: number;
  color: string;
  height?: string;
}) {
  return (
    <div
      className={`w-full overflow-hidden rounded-full bg-gray-200 dark:bg-zinc-800 ${height || 'h-2.5'}`}
    >
      <div
        className={`h-full rounded-full transition-all duration-300 ${color}`}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}

/* ── Collapsible sources/methodology dropdown ── */
function SourcesDropdown() {
  const [open, setOpen] = useState(false);
  return (
    <div className='mt-2'>
      <button
        onClick={() => setOpen(!open)}
        className='flex cursor-pointer items-center gap-1 text-xs font-bold text-gray-500 transition-colors hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-300'
      >
        <IconInfoCircle className='h-3.5 w-3.5' />
        <span>Sources &amp; methodology</span>
        <span className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          &#9662;
        </span>
      </button>
      {open && (
        <div className='mt-1.5 space-y-1 px-1 text-xs text-gray-400 dark:text-zinc-600'>
          <div>
            Fire detection:{' '}
            <a
              href='https://firms.modaps.eosdis.nasa.gov/'
              target='_blank'
              rel='noopener noreferrer'
              className='underline hover:text-gray-600'
            >
              NASA FIRMS VIIRS
            </a>{' '}
            (375m resolution, updated every 30 min)
          </div>
          <div>
            CO₂ factors:{' '}
            <a
              href='https://www.ipcc-nggip.iges.or.jp/public/2006gl/'
              target='_blank'
              rel='noopener noreferrer'
              className='underline hover:text-gray-600'
            >
              IPCC 2006 Guidelines
            </a>{' '}
            Vol 2 · Crude oil NCV 42.3 GJ/t, EF 73,300 kg CO₂/TJ
          </div>
          <div>
            FRP method: Wooster et al. (2005){' '}
            <a
              href='https://doi.org/10.1029/2005JD006318'
              target='_blank'
              rel='noopener noreferrer'
              className='underline hover:text-gray-600'
            >
              doi:10.1029/2005JD006318
            </a>
          </div>
          <div>
            Petroleum correction: Elvidge et al. (2020){' '}
            <a
              href='https://doi.org/10.3390/rs12020238'
              target='_blank'
              rel='noopener noreferrer'
              className='underline hover:text-gray-600'
            >
              doi:10.3390/rs12020238
            </a>{' '}
            — FRP underestimates petroleum fires ~2x
          </div>
          <div>
            EPA factors:{' '}
            <a
              href='https://www.epa.gov/ghgemissions/emission-factors-hub'
              target='_blank'
              rel='noopener noreferrer'
              className='underline hover:text-gray-600'
            >
              EPA GHG Emission Factors Hub (2024)
            </a>
          </div>
          <div>
            Equivalents: 4.6 t CO₂/car/yr (
            <a
              href='https://www.epa.gov/greenvehicles'
              target='_blank'
              rel='noopener noreferrer'
              className='underline hover:text-gray-600'
            >
              EPA
            </a>
            ) · 7.5 t CO₂/home/yr (
            <a
              href='https://www.eia.gov/consumption/residential/'
              target='_blank'
              rel='noopener noreferrer'
              className='underline hover:text-gray-600'
            >
              EIA RECS
            </a>
            )
          </div>
          <div className='pt-1 text-gray-500 dark:text-zinc-500'>
            Formula: CO₂ (t/day) = FRP(MW) × 86400 / (f_rad × H_c) × EF / 1000.
            Hover any row above for the full calculation.
          </div>
          <div>
            Only fires geo-matched within facility radius are counted. These are
            order-of-magnitude estimates.
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Section header ── */
function SectionTitle({
  icon,
  title
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className='mb-2 flex items-center gap-2'>
      {icon}
      <span className='text-sm font-extrabold tracking-widest text-gray-500 uppercase dark:text-zinc-500'>
        {title}
      </span>
    </div>
  );
}

/* ── Stat card ── */
function StatCard({ children }: { children: React.ReactNode }) {
  return (
    <div className='mb-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-zinc-700/50 dark:bg-zinc-800/40'>
      {children}
    </div>
  );
}

/* ── Always-open prediction card — clean, credible ── */
function PredictionCard({ prediction: p }: { prediction: ScenarioPrediction }) {
  const barColor =
    p.probability >= 60
      ? 'bg-red-500'
      : p.probability >= 35
        ? 'bg-orange-500'
        : p.probability >= 15
          ? 'bg-yellow-500'
          : 'bg-green-500';

  return (
    <div className='overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-zinc-700/50 dark:bg-zinc-800/40'>
      {/* Header */}
      <div className='p-4'>
        <div className='mb-2 flex items-center justify-between'>
          <span className='text-xl leading-tight font-black text-gray-900 dark:text-zinc-100'>
            {p.scenario}
          </span>
          <span
            className={`text-4xl font-black tabular-nums ${p.color} ml-3 shrink-0`}
          >
            {p.probability}%
          </span>
        </div>
        <Bar pct={p.probability} color={barColor} height='h-3' />
      </div>

      {/* Full analysis */}
      <div className='space-y-4 border-t border-gray-100 px-4 pb-4 dark:border-zinc-800/50'>
        <div className='pt-3'>
          <div className='mb-1.5 text-sm font-extrabold tracking-widest text-gray-400 uppercase'>
            What happens
          </div>
          <div className='text-base leading-relaxed text-gray-700 dark:text-zinc-300'>
            {p.what}
          </div>
        </div>

        <div>
          <div className='mb-1.5 text-sm font-extrabold tracking-widest text-gray-400 uppercase'>
            Why it&apos;s likely
          </div>
          <div className='text-base leading-relaxed text-gray-700 dark:text-zinc-300'>
            {p.why}
          </div>
        </div>

        <div>
          <div className='mb-1.5 text-sm font-extrabold tracking-widest text-gray-400 uppercase'>
            How it plays out
          </div>
          <div className='text-base leading-relaxed text-gray-700 dark:text-zinc-300'>
            {p.how}
          </div>
        </div>

        <div>
          <div className='mb-1.5 text-sm font-extrabold tracking-widest text-gray-400 uppercase'>
            Timeline
          </div>
          <div className='text-base leading-relaxed text-gray-700 dark:text-zinc-300'>
            {p.when}
          </div>
        </div>

        <div>
          <div className='mb-2 text-sm font-extrabold tracking-widest text-gray-400 uppercase'>
            What to expect
          </div>
          <div className='space-y-2'>
            {p.expect.map((e) => (
              <div
                key={e.label}
                className='rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 dark:border-zinc-800/50 dark:bg-zinc-900/60'
              >
                <div className='flex items-center justify-between'>
                  <span className='text-sm font-bold text-gray-700 dark:text-zinc-300'>
                    {e.label}
                  </span>
                  <span
                    className={`text-lg font-black tabular-nums ${p.color}`}
                  >
                    {e.value}
                  </span>
                </div>
                <div className='mt-0.5 text-sm leading-relaxed text-gray-500 dark:text-zinc-500'>
                  {e.detail}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Facility damage card ── */
function FacilityCard({
  facility,
  hit,
  status
}: {
  facility: (typeof curatedFires)[number];
  hit: boolean;
  status: FacilityStatus;
}) {
  const [open, setOpen] = useState(false);
  const statusCfg: Record<
    string,
    { label: string; cls: string; pulse?: boolean }
  > = {
    active_fire: {
      label: 'ON FIRE',
      cls: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
      pulse: true
    },
    damaged: {
      label: 'DAMAGED',
      cls: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800'
    },
    offline: {
      label: 'OFFLINE',
      cls: 'bg-gray-200 dark:bg-zinc-700/50 text-gray-700 dark:text-gray-400 border-gray-300 dark:border-zinc-600'
    },
    monitoring: {
      label: 'THREATENED',
      cls: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'
    },
    operational: {
      label: 'OK',
      cls: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
    }
  };
  const typeLabel: Record<string, string> = {
    refinery: 'Refinery',
    lng_terminal: 'LNG Terminal',
    pipeline: 'Pipeline',
    storage: 'Storage',
    oil_field: 'Oil Field',
    port: 'Port/Terminal',
    gas_field: 'Gas Field'
  };
  const threatCls: Record<string, string> = {
    critical: 'text-red-600 dark:text-red-400',
    high: 'text-orange-600 dark:text-orange-400',
    elevated: 'text-yellow-600 dark:text-yellow-400',
    moderate: 'text-blue-600',
    low: 'text-green-600'
  };
  // Bar represents % of global supply — scaled so 1% fills ~20%, 5% fills 100%
  const barPct = Math.min(100, facility.percentGlobalCapacity * 20);
  const statusBarColor: Record<string, string> = {
    active_fire: 'bg-red-500',
    damaged: 'bg-orange-500',
    offline: 'bg-gray-500',
    monitoring: 'bg-yellow-500',
    operational: 'bg-green-500'
  };
  const st = statusCfg[status] || statusCfg.operational;
  const cap = facility.gasCapacityBCFD
    ? `${facility.gasCapacityBCFD} BCF/d`
    : facility.capacityBPD >= 1_000_000
      ? `${(facility.capacityBPD / 1_000_000).toFixed(1)}M BPD`
      : facility.capacityBPD > 0
        ? `${(facility.capacityBPD / 1_000).toFixed(0)}K BPD`
        : facility.storageMBBL
          ? `${facility.storageMBBL}M bbl storage`
          : '';
  const pct = facility.percentGlobalCapacity;

  return (
    <div
      className={`overflow-hidden rounded-xl border ${hit ? 'border-red-200 bg-red-50/30 dark:border-red-900/50 dark:bg-red-950/10' : 'border-gray-200 bg-white dark:border-zinc-700/50 dark:bg-zinc-800/40'}`}
    >
      <button
        onClick={() => setOpen(!open)}
        className='w-full cursor-pointer p-3 text-left'
      >
        <div className='flex items-start justify-between gap-2'>
          <div className='min-w-0'>
            <div className='flex items-center gap-1.5'>
              {hit && (
                <IconFlame
                  className={`h-4 w-4 shrink-0 text-red-500 ${st.pulse ? 'animate-pulse' : ''}`}
                />
              )}
              <span className='text-base leading-tight font-black text-gray-900 dark:text-zinc-100'>
                {facility.name}
              </span>
            </div>
            <div className='mt-0.5 flex items-center gap-1.5 text-sm text-gray-500'>
              <span>{facility.country}</span>
              <span>·</span>
              <span>
                {typeLabel[facility.facilityType] || facility.facilityType}
              </span>
            </div>
          </div>
          <span
            className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-black uppercase ${st.cls} ${st.pulse ? 'animate-pulse' : ''}`}
          >
            {st.label}
          </span>
        </div>
        <div className='mt-2'>
          <div className='mb-1 flex items-center justify-between text-sm'>
            <span
              className={`font-bold ${threatCls[facility.threatLevel] || ''}`}
            >
              {facility.threatLevel.toUpperCase()}
            </span>
            <span className='font-bold text-gray-700 tabular-nums dark:text-zinc-300'>
              {cap}
            </span>
          </div>
          <Bar
            pct={barPct}
            color={hit ? 'bg-red-500' : statusBarColor[status] || 'bg-gray-400'}
            height='h-2'
          />
          <div className='mt-0.5 text-xs text-gray-400 tabular-nums'>
            {pct}% of global supply
            {facility.attackDate && hit ? ` · Hit ${facility.attackDate}` : ''}
          </div>
        </div>
      </button>
      {open && (
        <div className='space-y-2.5 border-t border-gray-100 px-3 pt-2 pb-3 dark:border-zinc-800/50'>
          <div>
            <div className='mb-1 text-xs font-extrabold tracking-widest text-gray-400 uppercase'>
              Strategic importance
            </div>
            <div className='text-sm leading-relaxed text-gray-700 dark:text-zinc-300'>
              {facility.whyItMatters}
            </div>
          </div>
          <div>
            <div className='mb-1 text-xs font-extrabold tracking-widest text-red-400 uppercase'>
              If destroyed
            </div>
            <div className='text-sm leading-relaxed text-gray-700 dark:text-zinc-300'>
              {facility.ifDestroyed}
            </div>
          </div>
          {facility.supplyChainRole && (
            <div>
              <div className='mb-1 text-xs font-extrabold tracking-widest text-gray-400 uppercase'>
                Supply chain
              </div>
              <div className='text-sm leading-relaxed text-gray-700 dark:text-zinc-300'>
                {facility.supplyChainRole}
              </div>
            </div>
          )}
          {(facility.storageMBBL || facility.lngMTPA) && (
            <div className='flex flex-wrap gap-2 text-sm'>
              {facility.storageMBBL && (
                <span className='rounded bg-gray-100 px-2 py-1 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400'>
                  Storage: <strong>{facility.storageMBBL}M bbl</strong>
                </span>
              )}
              {facility.lngMTPA && (
                <span className='rounded bg-gray-100 px-2 py-1 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400'>
                  LNG: <strong>{facility.lngMTPA} MTPA</strong>
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Country comparison bar chart ── */
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

/* ── Country damage card ── */
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
        onClick={() => setOpen(!open)}
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

    // ── Facility damage map ──
    const hitFacilityList = curatedFires
      .filter((f) => facilityIds.has(f.id))
      .sort((a, b) => {
        const o: Record<string, number> = {
          active_fire: 0,
          damaged: 1,
          offline: 2,
          monitoring: 3,
          operational: 4
        };
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
        return (o[statusA] ?? 5) - (o[statusB] ?? 5);
      });
    const threatenedFacilityList = curatedFires
      .filter((f) => !facilityIds.has(f.id))
      .sort((a, b) => {
        const o: Record<string, number> = {
          critical: 0,
          high: 1,
          elevated: 2,
          moderate: 3,
          low: 4
        };
        return (o[a.threatLevel] ?? 5) - (o[b.threatLevel] ?? 5);
      });

    const countryDamage = getInfrastructureDamageByCountry(
      facilityIds,
      timelineDate,
      events
    );

    // ── Years of life lost: avg age in memorial data ~29, WHO life expectancy 72 → ~43 years remaining per person ──
    const yearsOfLifeLost = Math.round(casualties.totalKilled * 43);

    // ── Role-based loss counts — sourced documented numbers, scaled proportionally to timeline ──
    // Base counts are at ~85,000 total killed (current conflict total)
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
      events,
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
  const satelliteCO2 = facilityFires.reduce(
    (s, f) => s + f.properties.estimatedCO2TonsDay,
    0
  );
  const totalDetections = fireData.features.length;
  const facilityFireCount = facilityFires.length;

  // Capacity-based CO2 for burning facilities WITHOUT satellite data (synced to timelineDate)
  const capacityEstimates = useMemo(
    () =>
      getCapacityCO2Estimates(curatedFires, {
        timelineDate,
        hitFacilityIds: facilityIds,
        facilityStats
      }),
    [facilityStats, facilityIds, timelineDate]
  );

  const capacityCO2 = capacityEstimates.reduce((sum, e) => sum + e.co2, 0);
  const totalCO2 = satelliteCO2 + capacityCO2;
  const equiv = co2Equivalents(totalCO2);

  // Per-facility-type CO2 breakdown for tooltip (satellite-based)
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

  // Build full calculation tooltip text
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

  // Count facilities confirmed burning/damaged at timelineDate
  const curatedBurningCount = curatedFires.filter((f) => {
    const status = getEffectiveFacilityStatus(
      f,
      timelineDate,
      facilityStats.get(f.id)?.maxFRP ?? 0
    );
    return status === 'active_fire' || status === 'damaged';
  }).length;

  const displayDate = new Date(timelineDate + 'T00:00:00');
  const dateFormatted = displayDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
  const annualCostPerHousehold = impact.totalMonthlyExtra * 12;

  const disruptionLabels: Record<string, string> = {
    normal: 'NORMAL',
    mild: 'MILD',
    severe: 'SEVERE',
    crisis: 'CRISIS',
    catastrophe: 'CATASTROPHE'
  };
  const disruptionBadge: Record<string, string> = {
    normal: 'bg-green-100 text-green-800 border-green-200',
    mild: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    severe: 'bg-orange-100 text-orange-800 border-orange-200',
    crisis: 'bg-orange-200 text-orange-900 border-orange-300',
    catastrophe: 'bg-orange-300 text-orange-950 border-orange-400 animate-pulse'
  };

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

      {/* ── EMISSIONS ── */}
      <div className='border-b border-gray-200 px-4 pt-4 pb-3 dark:border-zinc-700'>
        <SectionTitle
          icon={<IconCloud className='h-5 w-5 text-orange-600' />}
          title='Emissions'
        />

        {/* Headline CO2 number with calculation tooltip */}
        {totalCO2 > 0 ? (
          <div>
            <div
              className='cursor-help text-3xl leading-none font-black text-orange-700 tabular-nums dark:text-orange-400'
              title={calcTooltip}
            >
              {formatCO2(totalCO2)}{' '}
              <span className='text-lg font-bold'>tons/day CO₂</span>
            </div>
            {/* Source breakdown label */}
            {satelliteCO2 > 0 && capacityCO2 > 0 && (
              <div className='mt-1 text-sm text-gray-500 dark:text-zinc-400'>
                {formatCO2(satelliteCO2)} t/day satellite +{' '}
                {formatCO2(capacityCO2)} t/day estimated from facility capacity
              </div>
            )}
            {satelliteCO2 === 0 && capacityCO2 > 0 && (
              <div className='mt-1 text-sm text-gray-500 dark:text-zinc-400'>
                Estimated from facility capacity (no live satellite data)
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className='text-lg font-black text-gray-400'>
              {loading ? '...' : 'Awaiting satellite data'}
            </div>
            {curatedBurningCount > 0 && (
              <div className='mt-1 text-sm text-gray-500 dark:text-zinc-400'>
                {curatedBurningCount} facilities confirmed burning/damaged per
                news reports. CO₂ estimates update when NASA FIRMS detects
                active thermal signatures.
              </div>
            )}
          </div>
        )}

        {/* Equivalents */}
        {totalCO2 > 0 && (
          <div className='mt-2 space-y-1'>
            <Row
              label='Same CO₂ as this many cars (yearly)'
              value={equiv.carsPerYear.toLocaleString()}
              tip={`${formatCO2(totalCO2)} t/day × 365 days / 4.6 t/car/yr = ${equiv.carsPerYear.toLocaleString()} cars. Source: EPA (epa.gov/greenvehicles)`}
            />
            <Row
              label='Same as this many homes (yearly)'
              value={equiv.homesPerYear.toLocaleString()}
              tip={`${formatCO2(totalCO2)} t/day × 365 days / 7.5 t/home/yr = ${equiv.homesPerYear.toLocaleString()} homes. Source: EIA Residential Energy Consumption Survey`}
            />
            <Row
              label='% of global daily emissions'
              value={`${equiv.percentGlobalDaily}%`}
              tip={`${formatCO2(totalCO2)} t/day / 100,000,000 t/day global × 100. Source: IEA (36.8 Gt/yr ÷ 365 = ~100M t/day)`}
            />
          </div>
        )}

        {/* Per-facility-type breakdown with formula (satellite) */}
        {co2ByType.length > 0 && (
          <div className='mt-3 space-y-1.5'>
            {co2ByType.map((t) => {
              const label = t.type.replace('_', ' ');
              return (
                <div
                  key={t.type}
                  className='flex cursor-help items-center justify-between rounded px-2 py-1 text-sm transition-colors hover:bg-orange-50 dark:hover:bg-zinc-800/60'
                  title={[
                    `${label}: ${t.count} detection${t.count > 1 ? 's' : ''}`,
                    `Total FRP: ${t.frp.toFixed(1)} MW`,
                    `Fuel: ${t.params.fuel} (H_c = ${t.params.hc} MJ/kg, EF = ${t.params.ef} kg CO₂/kg)`,
                    `Radiative fraction: ${t.params.fRad} (${t.params.note})`,
                    ``,
                    `Multiplier = 86400 / (${t.params.fRad} × ${t.params.hc}) × ${t.params.ef} / 1000 = ${t.params.multiplier} t/MW/day`,
                    `CO₂ = ${t.frp.toFixed(1)} MW × ${t.params.multiplier} = ${t.co2.toFixed(1)} t/day`
                  ].join('\n')}
                >
                  <span className='text-gray-600 capitalize dark:text-zinc-300'>
                    {label}
                  </span>
                  <span className='font-bold text-orange-700 tabular-nums dark:text-orange-400'>
                    {formatCO2(t.co2)} t/day
                    <span className='ml-1 text-xs font-normal text-gray-400 dark:text-zinc-600'>
                      ({t.frp.toFixed(0)} MW × {t.params.multiplier})
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Capacity-based estimates breakdown */}
        {capacityEstimates.length > 0 && (
          <div className='mt-3 space-y-1.5'>
            {satelliteCO2 > 0 && (
              <div className='text-xs font-semibold tracking-wide text-gray-400 uppercase dark:text-zinc-500'>
                Capacity-based estimates
              </div>
            )}
            {capacityEstimates.map((e) => (
              <div
                key={e.facility.id}
                className='flex cursor-help items-center justify-between rounded px-2 py-1 text-sm transition-colors hover:bg-amber-50 dark:hover:bg-zinc-800/60'
                title={e.breakdown}
              >
                <span className='text-gray-600 dark:text-zinc-300'>
                  {e.facility.name}
                </span>
                <span className='font-bold text-amber-700 tabular-nums dark:text-amber-400'>
                  {formatCO2(e.co2)} t/day
                  <span className='ml-1 text-xs font-normal text-gray-400 dark:text-zinc-600'>
                    (capacity est.)
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Detection match info */}
        <div className='mt-2 text-sm text-gray-500 dark:text-zinc-400'>
          {facilityFireCount > 0 ? (
            <>
              <strong className='text-orange-600'>{facilityFireCount}</strong>{' '}
              of {totalDetections} satellite detections matched to tracked
              facilities. Unmatched detections (agricultural, wildfire, flaring)
              excluded.
              {capacityEstimates.length > 0 && (
                <>
                  {' '}
                  + {capacityEstimates.length} facility estimates from capacity
                  data.
                </>
              )}
            </>
          ) : loading ? (
            '...'
          ) : capacityEstimates.length > 0 ? (
            <>
              {totalDetections > 0
                ? `${totalDetections} satellite detections in region — none within tracked facility zones. `
                : ''}
              {capacityEstimates.length} burning{' '}
              {capacityEstimates.length === 1 ? 'facility' : 'facilities'}{' '}
              estimated from capacity data (EPA factors).
            </>
          ) : totalDetections > 0 ? (
            <>
              {totalDetections} satellite detections in region — none currently
              within tracked facility zones.
              {curatedBurningCount > 0 &&
                ` ${curatedBurningCount} facilities confirmed burning per news reports.`}
            </>
          ) : (
            'Awaiting satellite data...'
          )}
        </div>

        {/* Map button — only shown when caller provides map toggle */}
        {onMapMode && (
          <div className='mt-3 border-t border-gray-200 pt-2 dark:border-zinc-800/50'>
            <button
              type='button'
              onClick={onMapMode}
              className='flex w-full cursor-pointer items-center justify-between rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-700/50 dark:bg-zinc-800/40'
            >
              <div className='flex items-center gap-4 text-sm'>
                <span className='flex items-center gap-1.5 text-orange-600'>
                  <IconFlame className='h-4 w-4' />
                  <span className='font-bold tabular-nums'>
                    {loading
                      ? '...'
                      : facilityFireCount > 0
                        ? `${facilityFireCount} facility fires`
                        : `${totalDetections} detections`}
                  </span>
                </span>
                <span className='flex items-center gap-1.5 text-teal-600 dark:text-teal-400'>
                  <IconWorld className='h-4 w-4' />
                  <span className='font-bold tabular-nums'>
                    {curatedFires.length} tracked
                  </span>
                </span>
              </div>
              <span className='text-sm font-bold text-blue-600 dark:text-blue-400'>
                View map →
              </span>
            </button>
          </div>
        )}

        {/* Sources — collapsible dropdown */}
        <SourcesDropdown />
      </div>

      {/* ── FACILITIES DAMAGE REPORT ── (only show after facility events exist) */}
      {(hitFacilityList.length > 0 || timelineDate >= '2024-01-12') && (
        <div className='border-b border-gray-200 px-4 pt-4 pb-3 dark:border-zinc-700'>
          <SectionTitle
            icon={<IconBuildingSkyscraper className='h-5 w-5 text-red-600' />}
            title='Facilities Damage Report'
          />
          <div className='mb-3 text-base text-gray-500'>
            <strong className='text-red-600'>{hitFacilityList.length}</strong>{' '}
            hit ·{' '}
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
                {(
                  hitFacilityList
                    .filter((f) => !isChokepoint(f.id))
                    .reduce((s, f) => s + f.capacityBPD, 0) / 1_000_000
                ).toFixed(1)}
                M BPD
              </span>
            </div>
            <Bar
              pct={Math.min(
                100,
                hitFacilityList
                  .filter((f) => !isChokepoint(f.id))
                  .reduce((s, f) => s + f.percentGlobalCapacity, 0) * 4
              )}
              color='bg-red-500'
            />
            <div className='mt-1 text-sm text-gray-500'>
              {hitFacilityList
                .filter((f) => !isChokepoint(f.id))
                .reduce((s, f) => s + f.percentGlobalCapacity, 0)
                .toFixed(1)}
              % of global production affected (excl. transit chokepoints)
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
            Click any facility for full breakdown — strategic importance,
            cascade impact, and supply chain role.
          </InfoBox>
        </div>
      )}

      {/* ── WHAT WE LOST ── */}
      <div className='border-b border-gray-200 px-4 pt-4 pb-3 dark:border-zinc-700'>
        <SectionTitle
          icon={<IconHeart className='h-5 w-5 text-red-600' />}
          title='What We Lost'
        />

        {/* Years of life lost — the unifying number */}
        <Link
          href='/dashboard/lost'
          className='block transition-opacity hover:opacity-80'
        >
          <div
            className='text-4xl leading-none font-black text-red-600 tabular-nums dark:text-red-500'
            title={`${casualties.totalKilled.toLocaleString()} lives × 43 avg years remaining = ${(yearsOfLifeLost / 1_000_000).toFixed(1)}M years. Based on WHO global life expectancy of 72 and avg victim age of 29 from identified casualty records.`}
          >
            {(yearsOfLifeLost / 1_000_000).toFixed(1)}M years
          </div>
          <div className='mt-1 text-base font-bold text-gray-500 dark:text-zinc-400'>
            of human life
          </div>
          <div className='mt-0.5 text-sm text-gray-400 tabular-nums dark:text-zinc-500'>
            {casualties.totalKilled.toLocaleString()}+ killed ·{' '}
            {casualties.totalInjured.toLocaleString()}+ injured
            {casualties.totalDisplaced > 0
              ? ` · ${(casualties.totalDisplaced / 1_000_000).toFixed(1)}M displaced`
              : ''}
          </div>
          <div className='mt-1 text-xs text-gray-400/80 tabular-nums dark:text-zinc-600'>
            {casualties.documentedKilled.toLocaleString()} documented ·{' '}
            {casualties.estimatedKilled.toLocaleString()} estimated (OBT model)
          </div>
        </Link>

        {/* Role-based loss grid — no sides, just people */}
        <div className='mt-4 grid grid-cols-2 gap-2'>
          {roleCounts.map((role) => {
            const Icon =
              role.icon === 'stethoscope'
                ? IconStethoscope
                : role.icon === 'heart'
                  ? IconHeart
                  : role.icon === 'book'
                    ? IconBook
                    : role.icon === 'camera'
                      ? IconCamera
                      : role.icon === 'school'
                        ? IconSchool
                        : IconFriends;
            return (
              <div
                key={role.label}
                className='flex items-center gap-2.5 rounded-lg bg-gray-100 px-3 py-2 dark:bg-zinc-900'
                title={`Source: ${role.source}`}
              >
                <Icon className='h-4 w-4 shrink-0 text-gray-400 dark:text-zinc-500' />
                <div className='min-w-0'>
                  <div className='text-base leading-tight font-black text-gray-900 tabular-nums dark:text-zinc-100'>
                    {role.count.toLocaleString()}+
                  </div>
                  <div className='truncate text-xs text-gray-500 dark:text-zinc-400'>
                    {role.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <Link
          href='/dashboard/lost'
          className='mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm font-bold text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white'
        >
          Scroll through every one →
        </Link>
      </div>

      {/* ── YOUR HOUSEHOLD COST ── */}
      <div className='border-b border-gray-200 px-4 pt-4 pb-3 dark:border-zinc-700'>
        <SectionTitle
          icon={
            <IconReceipt className='h-5 w-5 text-green-700 dark:text-green-500' />
          }
          title='Cost to American Households'
        />
        <div className='text-4xl leading-none font-black text-green-800 tabular-nums dark:text-green-400'>
          +${impact.totalMonthlyExtra}
        </div>
        <div className='mt-1 text-base font-bold text-green-700 dark:text-green-300'>
          extra per month (avg US household)
        </div>
        <div className='mb-3 text-base text-gray-500'>
          That&apos;s{' '}
          <strong className='text-green-800 dark:text-green-200'>
            ${annualCostPerHousehold.toLocaleString()}/year
          </strong>{' '}
          more than before the war
        </div>

        {/* Gas */}
        <StatCard>
          <div className='mb-1.5 flex items-center justify-between'>
            <span className='flex items-center gap-2 text-base font-bold text-gray-800 dark:text-zinc-200'>
              <IconGasStation className='h-5 w-5 text-orange-600' />
              Gas Price
            </span>
            <span className='text-2xl font-black text-orange-700 tabular-nums dark:text-orange-400'>
              ${impact.gasPriceGallon.toFixed(2)}
            </span>
          </div>
          <div className='mb-1 text-sm text-gray-500'>per gallon</div>
          <Bar pct={(impact.gasPriceGallon / 8) * 100} color='bg-orange-500' />
          <div className='mt-1.5 flex items-center justify-between text-base'>
            <span className='text-gray-500'>
              Before war: ${BASELINE.gasPriceGallon.toFixed(2)}
            </span>
            <span className='text-gray-500'>2008 peak: $4.11</span>
          </div>
          <div className='mt-1 text-base font-bold text-orange-700 dark:text-orange-300'>
            That&apos;s +${gasExtra.toFixed(0)}/month extra at the pump
          </div>
        </StatCard>

        {/* Groceries */}
        <StatCard>
          <div className='mb-1.5 flex items-center justify-between'>
            <span className='flex items-center gap-2 text-base font-bold text-gray-800 dark:text-zinc-200'>
              <IconShoppingCart className='h-5 w-5 text-amber-600' />
              Groceries
            </span>
            <span className='text-2xl font-black text-amber-700 tabular-nums dark:text-amber-400'>
              +{impact.groceryInflationPct}%
            </span>
          </div>
          <Bar pct={impact.groceryInflationPct * 3} color='bg-amber-500' />
          <div className='mt-1.5 text-base text-gray-600 dark:text-zinc-400'>
            <strong className='text-amber-700 dark:text-amber-300'>
              +${impact.monthlyGroceryExtra}/mo
            </strong>{' '}
            extra for a family of 4
          </div>
          <div className='mt-0.5 text-sm text-gray-500'>
            Oil up → fertilizer up → trucking up → your eggs, milk, and bread
            cost more
          </div>
        </StatCard>

        {/* Home Energy */}
        <StatCard>
          <div className='mb-1.5 flex items-center justify-between'>
            <span className='flex items-center gap-2 text-base font-bold text-gray-800 dark:text-zinc-200'>
              <IconBolt className='h-5 w-5 text-yellow-600' />
              Home Energy
            </span>
            <span className='text-2xl font-black text-yellow-700 tabular-nums dark:text-yellow-400'>
              +${impact.monthlyUtilityExtra}
            </span>
          </div>
          <div className='mb-1 text-sm text-gray-500'>extra per month</div>
          <Bar pct={(impact.natGasMMBtu / 25) * 100} color='bg-yellow-500' />
          <div className='mt-1.5 text-base text-gray-600 dark:text-zinc-400'>
            Natural gas: <strong>${impact.natGasMMBtu.toFixed(1)}/MMBtu</strong>{' '}
            (was ${BASELINE.natGasMMBtu.toFixed(1)})
          </div>
          {impact.natGasMMBtu > 12 && (
            <div className='mt-1 text-base font-bold text-green-800 dark:text-green-300'>
              Qatar&apos;s Ras Laffan destroyed — 17% of global LNG gone
            </div>
          )}
        </StatCard>

        {/* Shipping */}
        <StatCard>
          <div className='mb-1.5 flex items-center justify-between'>
            <span className='flex items-center gap-2 text-base font-bold text-gray-800 dark:text-zinc-200'>
              <IconPackage className='h-5 w-5 text-blue-600' />
              Shipping &amp; Delivery
            </span>
            <span className='text-2xl font-black text-blue-700 tabular-nums dark:text-blue-400'>
              +{impact.shippingSurchargePct}%
            </span>
          </div>
          <Bar pct={impact.shippingSurchargePct} color='bg-blue-500' />
          <div className='mt-1.5 text-base text-gray-600 dark:text-zinc-400'>
            Your packages take{' '}
            <strong className='text-blue-700 dark:text-blue-300'>
              +{impact.deliveryDelayDays} days
            </strong>{' '}
            longer
          </div>
          <div className='mt-0.5 text-sm text-gray-500'>
            Ships reroute around Africa instead of through Suez/Hormuz — adds
            weeks
          </div>
        </StatCard>

        {/* Oil price */}
        <StatCard>
          <div className='flex items-center justify-between'>
            <span className='text-base font-bold text-gray-800 dark:text-zinc-200'>
              Oil (Brent crude)
            </span>
            <span className='text-2xl font-black text-gray-900 tabular-nums dark:text-white'>
              ${impact.oilPriceBbl}/bbl
            </span>
          </div>
          <div className='mt-1 flex items-center justify-between text-sm'>
            <span className='text-gray-500'>
              Before: ${BASELINE.oilPriceBbl}/bbl
            </span>
            <span className='font-bold text-green-700 dark:text-green-400'>
              {oilDelta >= 0
                ? `+$${oilDelta.toFixed(0)}`
                : `-$${Math.abs(oilDelta).toFixed(0)}`}
              /barrel
            </span>
          </div>
        </StatCard>

        <InfoBox>{impact.headline}</InfoBox>

        <div className='mt-2 space-y-1 px-1 text-xs text-gray-400 dark:text-zinc-600'>
          <div className='font-bold text-gray-500 dark:text-zinc-500'>
            Sources &amp; methodology
          </div>
          <div>
            Gas prices:{' '}
            <a
              href='https://gasprices.aaa.com/'
              target='_blank'
              rel='noopener noreferrer'
              className='underline hover:text-gray-600'
            >
              AAA national average
            </a>
          </div>
          <div>
            Oil (Brent):{' '}
            <a
              href='https://www.eia.gov/dnav/pet/pet_pri_spt_s1_d.htm'
              target='_blank'
              rel='noopener noreferrer'
              className='underline hover:text-gray-600'
            >
              EIA / IEA spot price
            </a>
          </div>
          <div>
            Groceries:{' '}
            <a
              href='https://www.bls.gov/cpi/'
              target='_blank'
              rel='noopener noreferrer'
              className='underline hover:text-gray-600'
            >
              BLS CPI Food Index
            </a>{' '}
            ·{' '}
            <a
              href='https://www.ers.usda.gov/data-products/food-price-outlook/'
              target='_blank'
              rel='noopener noreferrer'
              className='underline hover:text-gray-600'
            >
              USDA Food Price Outlook
            </a>
          </div>
          <div>
            Natural gas:{' '}
            <a
              href='https://www.eia.gov/dnav/ng/ng_pri_sum_dcu_nus_m.htm'
              target='_blank'
              rel='noopener noreferrer'
              className='underline hover:text-gray-600'
            >
              EIA Henry Hub spot
            </a>
          </div>
          <div>
            Shipping:{' '}
            <a
              href='https://www.drewry.co.uk/supply-chain-advisors/supply-chain-expertise/world-container-index-assessed-by-drewry'
              target='_blank'
              rel='noopener noreferrer'
              className='underline hover:text-gray-600'
            >
              Drewry World Container Index
            </a>
          </div>
          <div>
            Baseline: Sep 2023 pre-crisis averages. Monthly extra = sum of gas
            (+{BASELINE.monthlyGasGallons} gal/mo × price delta), grocery
            inflation on ${BASELINE.monthlyGroceryBaseline}/mo baseline, utility
            increase from nat gas spot, and shipping surcharges.
          </div>
        </div>
      </div>

      {/* ── COST OF WAR ── */}
      <div className='border-b border-gray-200 px-4 pt-4 pb-3 dark:border-zinc-700'>
        <SectionTitle
          icon={<IconBomb className='h-5 w-5 text-gray-700 dark:text-white' />}
          title='Cost of War'
        />
        <div className='text-4xl leading-none font-black text-gray-900 tabular-nums dark:text-white'>
          {formatBillions(cost.totalBillions)}
        </div>
        <div className='mt-1 mb-3 text-base font-bold text-gray-600'>
          total economic cost
        </div>

        <div className='space-y-1'>
          <Row
            label='Weapons & military'
            value={formatBillions(cost.weaponsBillions)}
            valueColor='text-gray-900 dark:text-zinc-100'
            tip='Missiles, carriers, military aid, Iron Dome — your tax dollars'
          />
          <Row
            label='Infrastructure destroyed'
            value={formatBillions(cost.resourcesBillions)}
            valueColor='text-blue-700 dark:text-blue-400'
            tip='Oil fields, gas plants, nuclear sites, refineries — gone forever'
          />
          <Row
            label='Economic / inflation'
            value={formatBillions(cost.economicBillions)}
            valueColor='text-yellow-700 dark:text-yellow-400'
            tip='Higher prices on everything — oil, shipping, insurance, food'
          />
        </div>

        <StatCard>
          <div className='flex items-center justify-between'>
            <span className='flex items-center gap-2 text-base text-gray-700 dark:text-zinc-200'>
              <IconUsers className='h-5 w-5 text-gray-600' />
              Your share (per taxpayer)
            </span>
            <span className='text-2xl font-black text-gray-900 tabular-nums dark:text-white'>
              ${perTaxpayer.toLocaleString()}
            </span>
          </div>
          <div className='mt-1 flex items-center justify-between'>
            <span className='flex items-center gap-2 text-sm text-gray-600 dark:text-zinc-300'>
              <IconHome className='h-4 w-4 text-gray-500' />
              Per household
            </span>
            <span className='text-lg font-bold text-gray-800 tabular-nums dark:text-zinc-200'>
              ${Math.round(perTaxpayer * 2.5).toLocaleString()}
            </span>
          </div>
        </StatCard>

        <InfoBox>
          {cost.totalBillions >= 1000
            ? `$${(cost.totalBillions / 1000).toFixed(1)} trillion — that's more than the entire US education budget. About $${Math.round((cost.totalBillions * 1e9) / warDays / 1_000_000).toLocaleString()}M per day across ${warDays.toLocaleString()} days.`
            : `$${cost.totalBillions.toFixed(0)}B and climbing (~$${Math.round((cost.totalBillions * 1e9) / warDays / 1_000_000).toLocaleString()}M/day).`}
        </InfoBox>
      </div>

      {/* ── NUCLEAR THREAT ── */}
      {nuclear && (
        <div className='border-b border-gray-200 px-4 pt-4 pb-3 dark:border-zinc-700'>
          <SectionTitle
            icon={<IconRadioactive className='h-5 w-5 text-green-600' />}
            title='Nuclear Threat'
          />

          <div className='space-y-1'>
            <Row
              label='Facilities targeted'
              value={`${nuclear.facilitiesTargeted} sites`}
              tip='Natanz, Fordow, Isfahan, Arak, Yazd/Ardakan, Bushehr vicinity, and associated nuclear fuel-cycle sites'
            />
            <Row
              label='Facilities destroyed'
              value={`${nuclear.facilitiesDestroyed} destroyed`}
              valueColor='text-orange-700 dark:text-orange-400'
            />
            <Row
              label='Enrichment remaining'
              value={`${nuclear.enrichmentPct}%`}
              valueColor={
                nuclear.enrichmentPct > 50
                  ? 'text-green-700 dark:text-green-400'
                  : nuclear.enrichmentPct > 20
                    ? 'text-orange-700 dark:text-orange-400'
                    : 'text-orange-800 dark:text-orange-300'
              }
              tip="Iran's ability to enrich uranium. Lower = more destroyed."
            />
          </div>
          <div className='mt-1.5'>
            <Bar
              pct={nuclear.enrichmentPct}
              color={
                nuclear.enrichmentPct < 30
                  ? 'bg-orange-600'
                  : nuclear.enrichmentPct < 60
                    ? 'bg-orange-500'
                    : 'bg-green-500'
              }
            />
          </div>

          <Row
            label='Radiation risk'
            value={nuclear.radiationRisk.toUpperCase()}
            valueColor={
              nuclear.radiationRisk === 'high'
                ? 'text-orange-800 dark:text-orange-400'
                : nuclear.radiationRisk === 'elevated'
                  ? 'text-orange-700 dark:text-orange-400'
                  : 'text-yellow-700 dark:text-yellow-400'
            }
            tip='Risk of radioactive contamination to nearby populations'
          />

          <div className='mt-1 text-base text-gray-500 italic dark:text-zinc-400'>
            {nuclear.label}
          </div>

          <div className='mt-3 space-y-2 border-t border-gray-200 pt-2 dark:border-zinc-800/50'>
            <div className='mb-1.5 text-sm font-extrabold tracking-wider text-gray-500 uppercase'>
              How does this compare?
            </div>
            {[
              {
                label: 'Three Mile Island (1979)',
                score: 25,
                color: 'bg-yellow-400'
              },
              { label: 'Fukushima (2011)', score: 55, color: 'bg-orange-400' },
              { label: 'Chernobyl (1986)', score: 75, color: 'bg-red-400' },
              {
                label: 'Cuban Missile Crisis (1962)',
                score: 92,
                color: 'bg-red-600'
              },
              {
                label: 'RIGHT NOW',
                score: peril.nuclearScore,
                color:
                  peril.nuclearScore >= 70
                    ? 'bg-red-600'
                    : peril.nuclearScore >= 50
                      ? 'bg-orange-500'
                      : peril.nuclearScore >= 25
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
              }
            ].map((h) => (
              <div key={h.label}>
                <div className='mb-0.5 flex items-center justify-between text-sm'>
                  <span
                    className={
                      h.label === 'RIGHT NOW'
                        ? 'font-black text-gray-900 dark:text-white'
                        : 'text-gray-600 dark:text-zinc-400'
                    }
                  >
                    {h.label}
                  </span>
                  <span
                    className={`tabular-nums ${h.label === 'RIGHT NOW' ? 'font-black text-gray-900 dark:text-white' : 'text-gray-400'}`}
                  >
                    {h.score}
                  </span>
                </div>
                <Bar pct={h.score} color={h.color} height='h-2' />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── RECESSION & ECONOMIC RISK INDEX ── */}
      <div className='border-b border-gray-200 px-4 pt-4 pb-3 dark:border-zinc-700'>
        <SectionTitle
          icon={<IconTrendingUp className='h-5 w-5 text-blue-600' />}
          title='Recession Probability Index'
        />
        <div className='flex items-baseline gap-2'>
          <span
            className={`text-4xl font-black tabular-nums ${recession.score >= 70 ? 'text-red-600' : recession.score >= 40 ? 'text-orange-600' : 'text-blue-600'}`}
          >
            {recession.score}%
          </span>
          <span
            className={`text-lg font-black tracking-wide uppercase ${
              recession.score >= 70
                ? 'text-red-500'
                : recession.score >= 40
                  ? 'text-orange-500'
                  : 'text-blue-500'
            }`}
          >
            {recession.label}
          </span>
        </div>
        <div className='mt-1 mb-3 text-base text-gray-500'>
          Likelihood of US recession within 12 months based on conflict-driven
          economic stress
        </div>

        <div className='space-y-1'>
          <Row
            label='Oil price shock'
            value={`${recession.oilSpikePct}/100`}
            sub='30% weight'
            tip='How far oil has spiked above $75/bbl baseline. Every $10 increase historically adds 0.3% to recession odds.'
          />
          <Row
            label='Supply chain stress'
            value={`${recession.supplyRisk}/100`}
            sub='25% weight'
            tip='Oil production offline and chokepoint disruptions. When >10% of global supply is disrupted, recessions follow within 6-12 months.'
          />
          <Row
            label='Inflationary pressure'
            value={`${recession.inflationPressure}/100`}
            sub='20% weight'
            tip='Grocery and consumer price inflation driven by energy costs. Rising food prices erode consumer spending — the engine of 70% of GDP.'
          />
          <Row
            label='War spending drag'
            value={`${recession.warCostDrag}/100`}
            sub='15% weight'
            tip='Military spending diverted from productive economy. Each $100B in war cost = ~0.5% GDP drag.'
          />
          <Row
            label='Shipping disruption'
            value={`${recession.shippingStress}/100`}
            sub='10% weight'
            tip='Shipping surcharges and delays. Rerouting around conflict zones adds weeks and billions in logistics costs.'
          />
        </div>

        <div className='mt-2'>
          <Bar
            pct={recession.score}
            color={
              recession.score >= 70
                ? 'bg-red-500'
                : recession.score >= 40
                  ? 'bg-orange-500'
                  : 'bg-blue-500'
            }
          />
        </div>

        <InfoBox>
          {recession.score >= 70
            ? 'Multiple recession indicators are flashing red. The 1973 oil embargo caused a 3.2% GDP contraction — current conditions are comparable or worse.'
            : recession.score >= 40
              ? 'Economic stress is building. The combination of energy costs and supply disruption historically precedes downturns within 6-12 months.'
              : 'Economic impact is present but manageable. Consumer spending is absorbing the shocks — for now.'}
        </InfoBox>
      </div>

      {/* ── CATASTROPHE INDEX ── */}
      <div className='border-b border-gray-200 px-4 pt-4 pb-3 dark:border-zinc-700'>
        <SectionTitle
          icon={
            <IconAlertTriangle
              className='h-5 w-5'
              style={{ color: peril.color }}
            />
          }
          title='Catastrophe Index'
        />
        <div className='flex items-baseline gap-2'>
          <span
            className='text-4xl font-black tabular-nums'
            style={{ color: peril.color }}
          >
            {peril.score}
          </span>
          <span className='text-xl font-bold text-gray-400'>/100</span>
          <span
            className='ml-2 text-lg font-black tracking-wide uppercase'
            style={{ color: peril.color }}
          >
            {peril.label}
          </span>
        </div>

        <div className='mt-3 space-y-1'>
          <Row
            label='Nuclear risk'
            value={`${peril.nuclearScore}/100`}
            sub='40% of score'
            tip='Facilities destroyed + enrichment gone + radiation risk'
          />
          <Row
            label='Supply disruption'
            value={`${peril.supplyScore}/100`}
            sub='35% of score'
            tip='Oil offline + shipping chokepoints blocked'
          />
          <Row
            label='Escalation tempo'
            value={`${peril.escalationScore}/100`}
            sub='25% of score'
            tip='How fast things are getting worse — event frequency and severity'
          />
        </div>

        <div className='mt-3 space-y-2 border-t border-gray-200 pt-2 dark:border-zinc-800/50'>
          {HISTORICAL_ANCHORS.map((a) => (
            <div key={a.label}>
              <div className='mb-0.5 flex items-center justify-between text-sm'>
                <span className='text-gray-600 dark:text-zinc-400'>
                  {a.label} ({a.year})
                </span>
                <span className='text-gray-400 tabular-nums'>{a.score}</span>
              </div>
              <Bar
                pct={a.score}
                color='bg-gray-400 dark:bg-zinc-600'
                height='h-2'
              />
            </div>
          ))}
          <div>
            <div className='mb-0.5 flex items-center justify-between text-sm'>
              <span className='font-black text-gray-900 dark:text-white'>
                RIGHT NOW
              </span>
              <span
                className='font-black tabular-nums'
                style={{ color: peril.color }}
              >
                {peril.score}
              </span>
            </div>
            <Bar pct={peril.score} color='bg-orange-500' height='h-2' />
          </div>
        </div>
      </div>

      {/* ── SUPPLY DISRUPTION ── */}
      <div className='border-b border-gray-200 px-4 pt-4 pb-3 dark:border-zinc-700'>
        <SectionTitle
          icon={<IconAlertTriangle className='h-5 w-5 text-blue-600' />}
          title='Global Oil Supply'
        />

        <div
          className={`mb-2 inline-block rounded-md border px-3 py-1 text-sm font-black tracking-wider uppercase ${disruptionBadge[supply.level] || disruptionBadge.normal}`}
        >
          {disruptionLabels[supply.level] || 'NORMAL'}
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

      {/* ── COUNTRY DAMAGE REPORT ── */}
      {countryDamage.length > 0 && (
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
            Click any country to expand and see individual facility damage
            cards. Countries like Lebanon and Yemen appear based on conflict
            events even without oil infrastructure.
          </InfoBox>
        </div>
      )}

      {/* ── PREDICTIONS BY THE NUMBERS ── */}
      <div className='border-b border-gray-200 px-4 pt-4 pb-3 dark:border-zinc-700'>
        <SectionTitle
          icon={
            <IconTrendingUp className='h-5 w-5 text-gray-700 dark:text-zinc-300' />
          }
          title='Predictions by the Numbers'
        />
        <div className='mb-3 text-sm text-gray-500'>
          Scenario probabilities computed from current conflict data — supply
          disruption, nuclear status, escalation tempo, and economic indicators.
        </div>

        <div className='space-y-2.5'>
          {predictions.map((p) => (
            <PredictionCard key={p.scenario} prediction={p} />
          ))}
        </div>

        <InfoBox>
          These probabilities are derived from the same data powering this
          dashboard — not opinions. As the numbers change, the predictions
          update in real time. Scrub the timeline to see how probabilities shift
          with events.
        </InfoBox>
      </div>

      <div className='h-8' />
    </div>
  );
}
