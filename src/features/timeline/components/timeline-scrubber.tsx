'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { CATEGORY_COLORS, type ConflictEvent } from '../data/conflict-events';
import { useFireStore } from '@/stores/fire-store';
import { useEventsStore } from '@/stores/events-store';

// ── Build day-by-day date array from first event to today (UTC-safe) ──
function buildDayArray(): string[] {
  const start = new Date('2023-10-07T00:00:00Z');
  const todayIso = new Date().toISOString().slice(0, 10);
  const end = new Date(todayIso + 'T00:00:00Z');
  const days: string[] = [];
  const d = new Date(start);
  while (d <= end) {
    days.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}

const ALL_DAYS = buildDayArray();

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function daysSince(from: string, to: string): number {
  return Math.round(
    (new Date(to + 'T00:00:00Z').getTime() -
      new Date(from + 'T00:00:00Z').getTime()) /
      86400000
  );
}

export default function TimelineScrubber() {
  const storedDate = useFireStore((s) => s.timelineDate);
  const setTimelineDate = useFireStore((s) => s.setTimelineDate);
  const events = useEventsStore((s) => s.events);
  const archiveStartDate = useEventsStore((s) => s.archiveStartDate);
  const archiveLoaded = useEventsStore((s) => s.archiveLoaded);
  const loadArchive = useEventsStore((s) => s.loadArchive);
  const foundIndex = ALL_DAYS.indexOf(storedDate);
  const [currentIndex, setCurrentIndex] = useState(
    foundIndex >= 0 ? foundIndex : ALL_DAYS.length - 1
  );

  const currentDate = ALL_DAYS[currentIndex];
  const dayNumber = daysSince('2023-10-07', currentDate);

  // Lookup: date → events on that date (for summary + tick marks)
  const { eventsByDate, eventDates } = useMemo(() => {
    const byDate = new Map<string, ConflictEvent[]>();
    for (const event of events) {
      const existing = byDate.get(event.date) || [];
      existing.push(event);
      byDate.set(event.date, existing);
    }
    const dates = Array.from(byDate.keys()).sort();
    return { eventsByDate: byDate, eventDates: dates };
  }, [events]);

  const todayEvents = eventsByDate.get(currentDate) || [];

  // ── Sync timeline date to global store (and update local index when store changes externally) ──
  useEffect(() => {
    const idx = ALL_DAYS.indexOf(storedDate);
    if (idx >= 0 && idx !== currentIndex) {
      setCurrentIndex(idx);
    }
  }, [storedDate]);

  useEffect(() => {
    setTimelineDate(currentDate);
  }, [currentDate, setTimelineDate]);

  // ── Scrubbed past the hot event window → lazily fetch the archive ──
  useEffect(() => {
    if (
      !archiveLoaded &&
      archiveStartDate !== null &&
      currentDate < archiveStartDate
    ) {
      loadArchive();
    }
  }, [currentDate, archiveStartDate, archiveLoaded, loadArchive]);

  // ── Sync scrubber when user clicks a pin on the map ──
  useEffect(() => {
    const handler = (e: Event) => {
      const { eventId } = (e as CustomEvent).detail;
      // Vanilla store access — the handler must not capture a stale list
      const ev = useEventsStore.getState().events.find((c) => c.id === eventId);
      if (!ev) return;
      const idx = ALL_DAYS.indexOf(ev.date);
      if (idx >= 0) setCurrentIndex(idx);
    };
    window.addEventListener('timeline-sync', handler);
    return () => window.removeEventListener('timeline-sync', handler);
  }, []);

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setCurrentIndex(Number(e.target.value));
    },
    []
  );

  // Event tick positions on the slider
  const eventTicks = useMemo(() => {
    return eventDates.map((date) => {
      const idx = ALL_DAYS.indexOf(date);
      const pct = (idx / (ALL_DAYS.length - 1)) * 100;
      const eventsOnDate = eventsByDate.get(date) || [];
      const color =
        eventsOnDate.length > 0
          ? CATEGORY_COLORS[eventsOnDate[eventsOnDate.length - 1].category]
          : '#999';
      return { date, pct, color };
    });
  }, [eventDates, eventsByDate]);

  const eventSummary =
    todayEvents.length > 0 ? todayEvents.map((e) => e.title).join(' | ') : null;

  return (
    <div className='shrink-0 border-t border-gray-200 bg-white px-4 py-2 dark:border-zinc-700 dark:bg-zinc-900/95'>
      {/* Custom slider thumb styles */}
      <style>{`
        .timeline-slider {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          cursor: pointer;
        }
        .timeline-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #2563eb;
          border: 2px solid white;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
          cursor: grab;
          position: relative;
          z-index: 10;
        }
        .timeline-slider::-webkit-slider-thumb:active {
          cursor: grabbing;
          transform: scale(1.15);
          background: #1d4ed8;
        }
        .timeline-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #2563eb;
          border: 2px solid white;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
          cursor: grab;
        }
        .timeline-slider::-moz-range-thumb:active {
          cursor: grabbing;
          transform: scale(1.15);
          background: #1d4ed8;
        }
        @media (prefers-color-scheme: dark) {
          .timeline-slider::-webkit-slider-thumb {
            background: #f97316;
            border-color: #27272a;
          }
          .timeline-slider::-moz-range-thumb {
            background: #f97316;
            border-color: #27272a;
          }
        }
        .dark .timeline-slider::-webkit-slider-thumb {
          background: #f97316;
          border-color: #27272a;
        }
        .dark .timeline-slider::-moz-range-thumb {
          background: #f97316;
          border-color: #27272a;
        }
      `}</style>

      {/* Date + day counter */}
      <div className='mb-0.5 flex items-center justify-between'>
        <span className='text-sm font-black text-gray-900 dark:text-white'>
          {formatDate(currentDate)}
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
          max={ALL_DAYS.length - 1}
          value={currentIndex}
          onChange={handleSliderChange}
          className='timeline-slider relative z-10 h-5 w-full'
        />
        {/* Track background */}
        <div className='pointer-events-none absolute top-1/2 right-0 left-0 h-2 -translate-y-1/2 rounded-full bg-gray-200 dark:bg-zinc-800'>
          {/* Progress fill */}
          <div
            className='h-full rounded-full bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 dark:from-yellow-500 dark:via-orange-500 dark:to-red-600'
            style={{
              width: `${(currentIndex / (ALL_DAYS.length - 1)) * 100}%`
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
        <span className='text-xs font-medium text-gray-400 dark:text-zinc-500'>
          Oct 2023
        </span>
        <span className='text-xs font-medium text-gray-400 dark:text-zinc-500'>
          2024
        </span>
        <span className='text-xs font-medium text-gray-400 dark:text-zinc-500'>
          2025
        </span>
        <span className='text-xs font-medium text-gray-400 dark:text-zinc-500'>
          2026
        </span>
      </div>
    </div>
  );
}
