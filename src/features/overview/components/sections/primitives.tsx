'use client';

import { useState } from 'react';
import type {
  CuratedFire,
  FacilityStatus
} from '@/features/fires/data/curated-fires';
import { IconFlame, IconInfoCircle } from '@tabler/icons-react';

/* ── Reusable data row with optional tooltip (click to expand) ── */
export function Row({
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
              type='button'
              onClick={() => setShowTip(!showTip)}
              className='cursor-pointer rounded-full p-0.5 transition-colors hover:bg-gray-200 dark:hover:bg-zinc-700'
              aria-label={`More info about ${label}`}
              aria-expanded={showTip}
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
export function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className='mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 dark:border-zinc-700/50 dark:bg-zinc-800/50'>
      <div className='text-sm leading-relaxed text-gray-700 dark:text-zinc-400'>
        {children}
      </div>
    </div>
  );
}

/* ── Progress bar ── */
export function Bar({
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
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

/* ── Collapsible sources/methodology dropdown ── */
export function SourcesDropdown() {
  const [open, setOpen] = useState(false);
  return (
    <div className='mt-2'>
      <button
        type='button'
        onClick={() => setOpen(!open)}
        aria-expanded={open}
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
export function SectionTitle({
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
export function StatCard({ children }: { children: React.ReactNode }) {
  return (
    <div className='mb-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-zinc-700/50 dark:bg-zinc-800/40'>
      {children}
    </div>
  );
}

/* ── Facility damage card ── */
const STATUS_CFG: Record<
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

const TYPE_LABEL: Record<string, string> = {
  refinery: 'Refinery',
  lng_terminal: 'LNG Terminal',
  pipeline: 'Pipeline',
  storage: 'Storage',
  oil_field: 'Oil Field',
  port: 'Port/Terminal',
  gas_field: 'Gas Field'
};

const THREAT_CLS: Record<string, string> = {
  critical: 'text-red-600 dark:text-red-400',
  high: 'text-orange-600 dark:text-orange-400',
  elevated: 'text-yellow-600 dark:text-yellow-400',
  moderate: 'text-blue-600',
  low: 'text-green-600'
};

const STATUS_BAR_COLOR: Record<string, string> = {
  active_fire: 'bg-red-500',
  damaged: 'bg-orange-500',
  offline: 'bg-gray-500',
  monitoring: 'bg-yellow-500',
  operational: 'bg-green-500'
};

export function FacilityCard({
  facility,
  hit,
  status
}: {
  facility: CuratedFire;
  hit: boolean;
  status: FacilityStatus;
}) {
  const [open, setOpen] = useState(false);
  const barPct = Math.min(100, facility.percentGlobalCapacity * 20);
  const st = STATUS_CFG[status] || STATUS_CFG.operational;
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
        type='button'
        onClick={() => setOpen(!open)}
        aria-expanded={open}
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
                {TYPE_LABEL[facility.facilityType] || facility.facilityType}
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
              className={`font-bold ${THREAT_CLS[facility.threatLevel] || ''}`}
            >
              {facility.threatLevel.toUpperCase()}
            </span>
            <span className='font-bold text-gray-700 tabular-nums dark:text-zinc-300'>
              {cap}
            </span>
          </div>
          <Bar
            pct={barPct}
            color={
              hit ? 'bg-red-500' : STATUS_BAR_COLOR[status] || 'bg-gray-400'
            }
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
