'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import {
  conflictEvents,
  buildUniqueAllEvents,
  type ConflictEvent
} from '@/features/timeline/data/conflict-events';

// ═══ TIMELINE EVENT STORE ═══
//
// Curated events (conflict-events.ts) are bundled with the app and available
// synchronously. The machine-generated datasets — public/auto-events.json
// (headline monitor) and public/auto-daily-stats.json (casualty telemetry) —
// are fetched once at runtime and merged in here, keeping 1MB+ of growing
// data out of the JS bundle and letting app chunks stay cached across the
// every-6-hour data commits.

interface EventsStore {
  /** Curated + auto events, deduped and sorted (no daily telemetry). */
  events: ConflictEvent[];
  /** events + daily casualty telemetry entries (for cumulative totals). */
  eventsWithTelemetry: ConflictEvent[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  beginLoad: () => void;
  hydrate: (autoEvents: ConflictEvent[], dailyStats: ConflictEvent[]) => void;
  fail: (error: string) => void;
}

const CURATED_ONLY = buildUniqueAllEvents(conflictEvents);

export const useEventsStore = create<EventsStore>((set) => ({
  events: CURATED_ONLY,
  eventsWithTelemetry: CURATED_ONLY,
  status: 'idle',
  error: null,
  beginLoad: () => set({ status: 'loading' }),
  hydrate: (autoEvents, dailyStats) => {
    const events = buildUniqueAllEvents([...conflictEvents, ...autoEvents]);
    set({
      events,
      eventsWithTelemetry: [...events, ...dailyStats],
      status: 'ready',
      error: null
    });
  },
  fail: (error) => set({ status: 'error', error })
}));

/**
 * Fetches the auto timeline datasets once per session and hydrates the
 * store. On failure the site keeps rendering the curated events — the
 * timeline degrades gracefully instead of breaking.
 */
export function useTimelineData() {
  const status = useEventsStore((s) => s.status);

  useEffect(() => {
    if (status !== 'idle') return;
    const store = useEventsStore.getState();
    store.beginLoad();
    let cancelled = false;

    (async () => {
      try {
        const [eventsRes, statsRes] = await Promise.all([
          fetch('/auto-events.json'),
          fetch('/auto-daily-stats.json')
        ]);
        if (!eventsRes.ok) {
          throw new Error(`auto-events.json returned HTTP ${eventsRes.status}`);
        }
        if (!statsRes.ok) {
          throw new Error(
            `auto-daily-stats.json returned HTTP ${statsRes.status}`
          );
        }
        const [autoEvents, dailyStats] = await Promise.all([
          eventsRes.json(),
          statsRes.json()
        ]);
        if (cancelled) return;
        if (!Array.isArray(autoEvents) || !Array.isArray(dailyStats)) {
          throw new Error('Invalid timeline data payload');
        }
        store.hydrate(autoEvents, dailyStats);
      } catch (err) {
        if (!cancelled) {
          store.fail(
            err instanceof Error ? err.message : 'Failed to load timeline data'
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status]);
}
