'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import {
  conflictEvents,
  buildUniqueAllEvents,
  type ConflictEvent,
  type CasualtyAnchors
} from '@/features/timeline/data/conflict-events';

// ═══ TIMELINE EVENT STORE ═══
//
// Curated events (conflict-events.ts) are bundled with the app and available
// synchronously. The machine-generated datasets — public/auto-events.json
// (headline monitor) and public/auto-daily-stats.json (casualty telemetry) —
// are fetched once at runtime and merged in here, keeping 1MB+ of growing
// data out of the JS bundle and letting app chunks stay cached across the
// every-6-hour data commits.
//
// auto-events.json only carries the most recent window of headlines; older
// entries live in public/auto-events-archive.json and are fetched lazily by
// loadArchive() when the timeline scrubber moves back past the window.

interface EventsStore {
  /** Curated + auto events, deduped and sorted (no daily telemetry). */
  events: ConflictEvent[];
  /** events + daily casualty telemetry entries (for cumulative totals). */
  eventsWithTelemetry: ConflictEvent[];
  /** Registry casualty anchors (public/casualty-anchors.json) or null. */
  casualtyAnchors: CasualtyAnchors | null;
  /** Oldest date in the loaded auto events; scrubbing past it needs the archive. */
  archiveStartDate: string | null;
  archiveLoaded: boolean;
  archiveLoading: boolean;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  beginLoad: () => void;
  hydrate: (
    autoEvents: ConflictEvent[],
    dailyStats: ConflictEvent[],
    anchors: CasualtyAnchors | null
  ) => void;
  fail: (error: string) => void;
  loadArchive: () => Promise<void>;
}

const CURATED_ONLY = buildUniqueAllEvents(conflictEvents);

function oldestDate(events: ConflictEvent[]): string | null {
  let min: string | null = null;
  for (const e of events) {
    if (min === null || e.date < min) min = e.date;
  }
  return min;
}

export const useEventsStore = create<EventsStore>((set, get) => ({
  events: CURATED_ONLY,
  eventsWithTelemetry: CURATED_ONLY,
  casualtyAnchors: null,
  archiveStartDate: null,
  archiveLoaded: false,
  archiveLoading: false,
  status: 'idle',
  error: null,
  beginLoad: () => set({ status: 'loading' }),
  hydrate: (autoEvents, dailyStats, anchors) => {
    const events = buildUniqueAllEvents([...conflictEvents, ...autoEvents]);
    set({
      events,
      eventsWithTelemetry: [...events, ...dailyStats],
      casualtyAnchors: anchors,
      archiveStartDate: oldestDate(autoEvents),
      status: 'ready',
      error: null
    });
  },
  fail: (error) => set({ status: 'error', error }),
  loadArchive: async () => {
    const { archiveLoaded, archiveLoading, events, eventsWithTelemetry } =
      get();
    if (archiveLoaded || archiveLoading) return;
    set({ archiveLoading: true });
    try {
      const res = await fetch('/auto-events-archive.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const archived: ConflictEvent[] = await res.json();
      if (!Array.isArray(archived)) throw new Error('Invalid archive payload');

      // Keep daily telemetry entries out of the merged event list
      const dailyStats = eventsWithTelemetry.filter((e) =>
        e.id.startsWith('auto-daily-')
      );
      const ids = new Set(events.map((e) => e.id));
      const extras = archived.filter((e) => !ids.has(e.id));
      const merged = buildUniqueAllEvents([...events, ...extras]);
      set({
        events: merged,
        eventsWithTelemetry: [...merged, ...dailyStats],
        archiveLoaded: true,
        archiveLoading: false
      });
    } catch {
      // Curated events still cover the deep timeline — degrade quietly
      set({ archiveLoaded: true, archiveLoading: false });
    }
  }
}));

/**
 * Fetches the auto timeline datasets once per session and hydrates the
 * store. On failure the site keeps rendering the curated events — the
 * timeline degrades gracefully instead of breaking.
 */
export function useTimelineData() {
  useEffect(() => {
    // Read status from the store, not a reactive dep: beginLoad() flips the
    // status to 'loading' mid-effect, and with status in the dependency
    // array React would tear the effect down and cancel the in-flight fetch.
    if (useEventsStore.getState().status !== 'idle') return;
    const store = useEventsStore.getState();
    store.beginLoad();
    let cancelled = false;

    (async () => {
      try {
        const [eventsRes, statsRes, anchorsRes] = await Promise.all([
          fetch('/auto-events.json'),
          fetch('/auto-daily-stats.json'),
          // Registry anchors are optional — the ledger degrades to
          // curated-event sums when unavailable
          fetch('/casualty-anchors.json').catch(() => null)
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

        let anchors: CasualtyAnchors | null = null;
        if (anchorsRes && anchorsRes.ok) {
          try {
            const parsed = await anchorsRes.json();
            if (
              parsed &&
              typeof parsed === 'object' &&
              parsed.regions &&
              typeof parsed.regions === 'object'
            ) {
              anchors = parsed as CasualtyAnchors;
            }
          } catch {
            // Malformed anchors — proceed without the registry floor
          }
        }
        if (cancelled) return;

        store.hydrate(autoEvents, dailyStats, anchors);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-once by design
  }, []);
}
