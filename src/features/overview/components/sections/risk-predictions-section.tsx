'use client';

import type { NuclearStatus } from '@/features/timeline/data/conflict-events';
import { HISTORICAL_ANCHORS, type PerilResult } from '@/lib/peril-score';
import type { RecessionBreakdown } from '../../lib/recession-score';
import type { ScenarioPrediction } from '../../lib/predictions';
import {
  IconAlertTriangle,
  IconRadioactive,
  IconTrendingUp
} from '@tabler/icons-react';
import { Bar, InfoBox, Row, SectionTitle } from './primitives';

export function NuclearSection({
  nuclear,
  peril
}: {
  nuclear: NuclearStatus | null;
  peril: PerilResult;
}) {
  if (!nuclear) return null;

  return (
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
  );
}

export function RecessionSection({
  recession
}: {
  recession: RecessionBreakdown;
}) {
  return (
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
  );
}

export function PerilSection({ peril }: { peril: PerilResult }) {
  return (
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
  );
}

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

export function PredictionsSection({
  predictions
}: {
  predictions: ScenarioPrediction[];
}) {
  return (
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
        dashboard — not opinions. As the numbers change, the predictions update
        in real time. Scrub the timeline to see how probabilities shift with
        events.
      </InfoBox>
    </div>
  );
}
