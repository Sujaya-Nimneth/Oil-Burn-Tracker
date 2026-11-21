'use client';

import { curatedFires } from '@/features/fires/data/curated-fires';
import {
  formatCO2,
  type CapacityCO2Estimate,
  type FacilityEmissionParams
} from '@/features/emissions/utils/emissions-model';
import { IconCloud, IconFlame, IconWorld } from '@tabler/icons-react';
import { Row, SectionTitle, SourcesDropdown } from './primitives';

export interface CO2ByTypeItem {
  type: string;
  co2: number;
  frp: number;
  count: number;
  params: FacilityEmissionParams;
}

export interface EmissionsSectionProps {
  loading: boolean;
  totalCO2: number;
  satelliteCO2: number;
  capacityCO2: number;
  equiv: {
    carsPerYear: number;
    homesPerYear: number;
    percentGlobalDaily: string;
  };
  co2ByType: CO2ByTypeItem[];
  capacityEstimates: CapacityCO2Estimate[];
  calcTooltip: string;
  facilityFireCount: number;
  totalDetections: number;
  curatedBurningCount: number;
  onMapMode?: () => void;
}

export function EmissionsSection({
  loading,
  totalCO2,
  satelliteCO2,
  capacityCO2,
  equiv,
  co2ByType,
  capacityEstimates,
  calcTooltip,
  facilityFireCount,
  totalDetections,
  curatedBurningCount,
  onMapMode
}: EmissionsSectionProps) {
  return (
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
              news reports. CO₂ estimates update when NASA FIRMS detects active
              thermal signatures.
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
                  '',
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
            <strong className='text-orange-600'>{facilityFireCount}</strong> of{' '}
            {totalDetections} satellite detections matched to tracked
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

      <SourcesDropdown />
    </div>
  );
}
