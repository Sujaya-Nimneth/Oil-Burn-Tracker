'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { CATEGORY_COLORS, type ConflictEvent } from '../data/conflict-events';
import { LATEST_CONSUMER_IMPACT_DATE } from '@/features/impact/data/consumer-impact';
import { useFireStore } from '@/stores/fire-store';
import { useEventsStore } from '@/stores/events-store';

const START_DATE = '2023-10-07';
const START_MS = new Date(START_DATE + 'T00:00:00Z').getTime();
const DAY_MS = 86_400_000;

function daysSinceStart(iso: string): number {
  const ms = new Date(iso + 'T00:00:00Z').getTime();
  if (!Number.isFinite(ms)) return 0;
  return Math.round((ms - START_MS) / DAY_MS);
}

function dateFromIndex(index: number): string {
  return new Date(START_MS + index * DAY_MS).toISOString().slice(0, 10);
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

export default function TimelineScrubber() {
  const storedDate = useFireStore((s) => s.timelineDate);
  const timelineHydrated = useFireStore((s) => s.timelineHydrated);
  const setTimelineDate = useFireStore((s) => s.setTimelineDate);
  const events = useEventsStore((s) => s.events);
  const archiveStartDate = useEventsStore((s) => s.archiveStartDate);
  const archiveLoaded = useEventsStore((s) => s.archiveLoaded);
  const loadArchive = useEventsStore((s) => s.loadArchive);

  // Hydration-safe upper bound: deterministic before mount, then expands to
  // client today (or latest event date) once hydrated.
  const endDate = useMemo(() => {
    let maxDate = LATEST_CONSUMER_IMPACT_DATE;
    if (timelineHydrated) {
      const todayIso = new Date().toISOString().slice(0, 10);
      if (todayIso > maxDate) maxDate = todayIso;
    }
    if (storedDate > maxDate) maxDate = storedDate;
    const lastEventDate = events[events.length - 1]?.date;
    if (lastEventDate && lastEventDate > maxDate) maxDate = lastEventDate;
    return maxDate;
  }, [timelineHydrated, storedDate, events]);

  const totalDays = Math.max(1, daysSinceStart(endDate));
  const rawIndex = daysSinceStart(storedDate);
  const currentIndex = Math.min(totalDays, Math.max(0, rawIndex));
  const currentDate = dateFromIndex(currentIndex);
  const dayNumber = currentIndex;

  // Lookup: date → events on that date (for summary + tick marks)
  const { eventsByDate, eventDates } = useMemo(() => {
    const byDate = new Map<string, ConflictEvent[]>();
    for (const event of events) {
      const existing = byDate.get(event.date);
      if (existing) existing.push(event);
      else byDate.set(event.date, [event]);
    }
    const dates = Array.from(byDate.keys()).sort();
    return { eventsByDate: byDate, eventDates: dates };
  }, [events]);

  const todayEvents = eventsByDate.get(currentDate) || [];

  // ── Scrubbed past the hot event window → lazily fetch the archive ──
  useEffect(() => {
    if (
      !archiveLoaded &&
      archiveStartDate !== null &&
      currentDate < archiveStartDate
    ) {
      void loadArchive();
    }
  }, [currentDate, archiveStartDate, archiveLoaded, loadArchive]);

  // ── Sync scrubber when user clicks a pin on the map ──
  useEffect(() => {
    const handler = (e: Event) => {
      const { eventId } = (e as CustomEvent).detail;
      // Vanilla store access — the handler must not capture a stale list
      const ev = useEventsStore.getState().events.find((c) => c.id === eventId);
      if (!ev) return;
      const idx = daysSinceStart(ev.date);
      if (idx >= 0) setTimelineDate(ev.date, 'map');
    };
    window.addEventListener('timeline-sync', handler);
    return () => window.removeEventListener('timeline-sync', handler);
  }, [setTimelineDate]);

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const idx = Number(e.target.value);
      if (Number.isFinite(idx)) {
        const clamped = Math.min(totalDays, Math.max(0, idx));
        setTimelineDate(dateFromIndex(clamped), 'scrubber');
      }
    },
    [setTimelineDate, totalDays]
  );

  // O(1) event tick positions on the slider
  const eventTicks = useMemo(() => {
    const ticks: { date: string; pct: number; color: string }[] = [];
    for (const date of eventDates) {
      const idx = daysSinceStart(date);
      if (idx < 0 || idx > totalDays) continue;
      const pct = (idx / totalDays) * 100;
      const eventsOnDate = eventsByDate.get(date) || [];
      const color =
        eventsOnDate.length > 0
          ? CATEGORY_COLORS[eventsOnDate[eventsOnDate.length - 1].category]
          : '#999';
      ticks.push({ date, pct, color });
    }
    return ticks;
  }, [eventDates, eventsByDate, totalDays]);

  // Dynamic proportional year markers (Oct 2023 .. endYear)
  const yearMarkers = useMemo(() => {
    const endYear = Number(endDate.slice(0, 4));
    const labels: string[] = ['Oct 2023'];
    for (let y = 2024; y <= endYear; y++) {
      labels.push(String(y));
    }
    return labels;
  }, [endDate]);

  const eventSummary =
    todayEvents.length > 0 ? todayEvents.map((e) => e.title).join(' | ') : null;
  const formattedDate = formatDate(currentDate);

  return (
    <div className='shrink-0 border-t border-gray-200 bg-white px-4 py-2 dark:border-zinc-700 dark:bg-zinc-900/95'>
      {/* Date + day counter */}
      <div className='mb-0.5 flex items-center justify-between'>
        <span className='text-sm font-black text-gray-900 dark:text-white'>
          {formattedDate}
        </span>
        <span className='text-sm font-bold text-gray-500 tabular-nums dark:text-zinc-400'>
          Day {dayNumber}
        </span>
      </div>

      {/* Event summary for this date */}
      {eventSummary && (
        <div
          className='mb-1 truncate text-xs font-medium text-blue-700 dark:text-orange-400'
          title={eventSummary}
        >
          {todayEvents.length} event{todayEvents.length > 1 ? 's' : ''}:{' '}
          {eventSummary}
        </div>
      )}

      {/* Wide slider with event ticks */}
      <div className='relative py-2'>
        <input
          type='range'
          min={0}
          max={totalDays}
          value={currentIndex}
          onChange={handleSliderChange}
          aria-label='Conflict timeline date'
          aria-valuetext={`${formattedDate}, Day ${dayNumber}`}
          className='timeline-slider relative z-10 h-5 w-full'
        />
        {/* Track background */}
        <div className='pointer-events-none absolute top-1/2 right-0 left-0 h-2 -translate-y-1/2 rounded-full bg-gray-200 dark:bg-zinc-800'>
          {/* Progress fill */}
          <div
            className='h-full rounded-full bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 dark:from-yellow-500 dark:via-orange-500 dark:to-red-600'
            style={{
              width: `${(currentIndex / totalDays) * 100}%`
            }}
          />
        </div>
        {/* Event tick marks */}
        <div className='pointer-events-none absolute top-1/2 right-0 left-0 h-2 -translate-y-1/2'>
          {eventTicks.map((tick) => (
            <div
              key={tick.date}
              className='absolute -mt-0.5 h-3 w-0.5 rounded-full'
              style={{
                left: `${tick.pct}%`,
                backgroundColor: tick.color,
                opacity: 0.5
              }}
            />
          ))}
        </div>
      </div>

      {/* Year labels */}
      <div className='mt-0.5 flex justify-between'>
        {yearMarkers.map((label) => (
          <span
            key={label}
            className='text-xs font-medium text-gray-400 dark:text-zinc-500'
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
