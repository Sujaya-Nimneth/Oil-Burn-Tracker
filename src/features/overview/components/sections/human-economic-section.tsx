'use client';

import Link from 'next/link';
import {
  BASELINE,
  type ConsumerImpact
} from '@/features/impact/data/consumer-impact';
import type { getCasualtiesUpTo } from '@/features/timeline/data/conflict-events';
import type { WarCostSummary } from '@/features/timeline/data/war-costs';

type CumulativeCasualties = ReturnType<typeof getCasualtiesUpTo>;
import { formatBillions } from '@/lib/format';
import {
  IconBolt,
  IconBomb,
  IconBook,
  IconCamera,
  IconFriends,
  IconGasStation,
  IconHeart,
  IconHome,
  IconPackage,
  IconReceipt,
  IconSchool,
  IconShoppingCart,
  IconStethoscope,
  IconUsers
} from '@tabler/icons-react';
import { Bar, InfoBox, Row, SectionTitle, StatCard } from './primitives';

export interface RoleLossCount {
  icon: string;
  label: string;
  count: number;
  source: string;
}

export function CasualtiesSection({
  casualties,
  yearsOfLifeLost,
  roleCounts
}: {
  casualties: CumulativeCasualties;
  yearsOfLifeLost: number;
  roleCounts: RoleLossCount[];
}) {
  return (
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
  );
}

export function HouseholdCostSection({
  impact,
  gasExtra,
  oilDelta,
  annualCostPerHousehold
}: {
  impact: ConsumerImpact;
  gasExtra: number;
  oilDelta: number;
  annualCostPerHousehold: number;
}) {
  return (
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
          Oil up → fertilizer up → trucking up → your eggs, milk, and bread cost
          more
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
          Baseline: Sep 2023 pre-crisis averages. Monthly extra = sum of gas (+
          {BASELINE.monthlyGasGallons} gal/mo × price delta), grocery inflation
          on ${BASELINE.monthlyGroceryBaseline}/mo baseline, utility increase
          from nat gas spot, and shipping surcharges.
        </div>
      </div>
    </div>
  );
}

export function WarCostSection({
  cost,
  perTaxpayer,
  warDays
}: {
  cost: WarCostSummary;
  perTaxpayer: number;
  warDays: number;
}) {
  const dailyMillions = Math.round(
    (cost.totalBillions * 1e9) / warDays / 1_000_000
  );

  return (
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
          ? `$${(cost.totalBillions / 1000).toFixed(1)} trillion — that's more than the entire US education budget. About $${dailyMillions.toLocaleString()}M per day across ${warDays.toLocaleString()} days.`
          : `$${cost.totalBillions.toFixed(0)}B and climbing (~$${dailyMillions.toLocaleString()}M/day).`}
      </InfoBox>
    </div>
  );
}
