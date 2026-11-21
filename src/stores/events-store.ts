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
  archiveError: string | null;
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

// Module-level singleton promise so React StrictMode's unmount/remount cycle
// shares the same in-flight fetch instead of cancelling it and stranding
// `status === 'loading'` forever.
let initialLoadPromise: Promise<void> | null = null;

export function resetTimelineLoadForTest() {
  initialLoadPromise = null;
  useEventsStore.setState({
    events: CURATED_ONLY,
    eventsWithTelemetry: CURATED_ONLY,
    casualtyAnchors: null,
    archiveStartDate: null,
    archiveLoaded: false,
    archiveLoading: false,
    archiveError: null,
    status: 'idle',
    error: null
  });
}

export const useEventsStore = create<EventsStore>((set, get) => ({
  events: CURATED_ONLY,
  eventsWithTelemetry: CURATED_ONLY,
  casualtyAnchors: null,
  archiveStartDate: null,
  archiveLoaded: false,
  archiveLoading: false,
  archiveError: null,
  status: 'idle',
  error: null,
  beginLoad: () => set({ status: 'loading', error: null }),
  hydrate: (autoEvents, dailyStats, anchors) => {
    // Preserve any archive events that finished loading before hydrate()
    const current = get();
    const events = buildUniqueAllEvents([
      ...current.events,
      ...conflictEvents,
      ...autoEvents
    ]);
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
    const initial = get();
    if (initial.archiveLoaded || initial.archiveLoading) return;
    set({ archiveLoading: true, archiveError: null });
    try {
      const res = await fetch('/auto-events-archive.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const archived: unknown = await res.json();
      if (!Array.isArray(archived)) throw new Error('Invalid archive payload');

      // Re-read fresh state AFTER the await so we never clobber a concurrent hydrate()
      const { events, eventsWithTelemetry } = get();
      const dailyStats = eventsWithTelemetry.filter((e) =>
        e.id.startsWith('auto-daily-')
      );
      const ids = new Set(events.map((e) => e.id));
      const extras = (archived as ConflictEvent[]).filter(
        (e) => !ids.has(e.id)
      );
      const merged = buildUniqueAllEvents([...events, ...extras]);
      set({
        events: merged,
        eventsWithTelemetry: [...merged, ...dailyStats],
        archiveLoaded: true,
        archiveLoading: false,
        archiveError: null
      });
    } catch (err) {
      // Leave archiveLoaded=false so the user can retry on a later scrub
      set({
        archiveLoaded: false,
        archiveLoading: false,
        archiveError:
          err instanceof Error ? err.message : 'Failed to load event archive'
      });
    }
  }
}));

async function fetchJsonArray(url: string): Promise<ConflictEvent[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} returned HTTP ${res.status}`);
  const parsed: unknown = await res.json();
  if (!Array.isArray(parsed)) throw new Error(`${url} returned invalid JSON`);
  return parsed as ConflictEvent[];
}

async function fetchAnchors(): Promise<CasualtyAnchors | null> {
  const res = await fetch('/casualty-anchors.json');
  if (!res.ok) return null;
  const parsed: unknown = await res.json();
  if (
    parsed &&
    typeof parsed === 'object' &&
    'regions' in parsed &&
    parsed.regions &&
    typeof parsed.regions === 'object'
  ) {
    return parsed as CasualtyAnchors;
  }
  return null;
}

export function loadTimelineDataOnce(): Promise<void> {
  const store = useEventsStore.getState();
  if (store.status === 'ready') return Promise.resolve();
  if (initialLoadPromise) return initialLoadPromise;

  store.beginLoad();
  initialLoadPromise = (async () => {
    try {
      const [eventsResult, statsResult, anchorsResult] =
        await Promise.allSettled([
          fetchJsonArray('/auto-events.json'),
          fetchJsonArray('/auto-daily-stats.json'),
          fetchAnchors()
        ]);

      const autoEvents =
        eventsResult.status === 'fulfilled' ? eventsResult.value : null;
      const dailyStats =
        statsResult.status === 'fulfilled' ? statsResult.value : null;
      const anchors =
        anchorsResult.status === 'fulfilled' ? anchorsResult.value : null;

      if (!autoEvents && !dailyStats) {
        const firstErr =
          eventsResult.status === 'rejected'
            ? eventsResult.reason
            : statsResult.status === 'rejected'
              ? statsResult.reason
              : new Error('Failed to load timeline data');
        throw firstErr instanceof Error
          ? firstErr
          : new Error(String(firstErr));
      }

      useEventsStore
        .getState()
        .hydrate(autoEvents ?? [], dailyStats ?? [], anchors);
    } catch (err) {
      initialLoadPromise = null;
      useEventsStore
        .getState()
        .fail(
          err instanceof Error ? err.message : 'Failed to load timeline data'
        );
    }
  })();

  return initialLoadPromise;
}

/**
 * Fetches the auto timeline datasets once per session and hydrates the
 * store. Safe under React StrictMode and degrades gracefully if one dataset
 * fails while keeping curated events available synchronously.
 */
export function useTimelineData() {
  useEffect(() => {
    void loadTimelineDataOnce();
  }, []);
}
