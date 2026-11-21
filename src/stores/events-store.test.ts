import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  useEventsStore,
  loadTimelineDataOnce,
  resetTimelineLoadForTest
} from './events-store';
import type { ConflictEvent } from '@/features/timeline/data/conflict-events';

function makeEvent(id: string, date: string, title = id): ConflictEvent {
  return {
    id,
    date,
    title,
    category: 'escalation',
    description: 'test'
  };
}

describe('events-store', () => {
  beforeEach(() => {
    resetTimelineLoadForTest();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deduplicates concurrent StrictMode calls and transitions to ready', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('auto-events.json')) {
          return new Response(
            JSON.stringify([makeEvent('auto-1', '2026-11-10', 'Auto 1')]),
            { status: 200 }
          );
        }
        if (url.includes('auto-daily-stats.json')) {
          return new Response(
            JSON.stringify([
              makeEvent('auto-daily-2026-11-10', '2026-11-10', 'Daily')
            ]),
            { status: 200 }
          );
        }
        return new Response(
          JSON.stringify({
            regions: { gaza: { killed: 70000, asOf: '2025-06-15' } }
          }),
          { status: 200 }
        );
      });

    await Promise.all([loadTimelineDataOnce(), loadTimelineDataOnce()]);

    const state = useEventsStore.getState();
    expect(state.status).toBe('ready');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(state.events.some((e) => e.id === 'auto-1')).toBe(true);
    expect(
      state.eventsWithTelemetry.some((e) => e.id === 'auto-daily-2026-11-10')
    ).toBe(true);
    expect(state.casualtyAnchors?.regions.gaza?.killed).toBe(70000);
  });

  it('does not clobber hydrate() when loadArchive() resolves after hydrate()', async () => {
    let resolveArchive!: (res: Response) => void;
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('auto-events-archive.json')) {
        return new Promise<Response>((resolve) => {
          resolveArchive = resolve;
        });
      }
      return Promise.resolve(new Response('[]', { status: 200 }));
    });

    const archivePromise = useEventsStore.getState().loadArchive();

    // Hydrate arrives while archive fetch is still in flight
    useEventsStore
      .getState()
      .hydrate(
        [makeEvent('auto-hot', '2026-11-12', 'Hot event')],
        [makeEvent('auto-daily-2026-11-12', '2026-11-12', 'Daily telemetry')],
        null
      );

    resolveArchive(
      new Response(
        JSON.stringify([makeEvent('auto-old', '2026-04-01', 'Archived event')]),
        { status: 200 }
      )
    );
    await archivePromise;

    const state = useEventsStore.getState();
    expect(state.archiveLoaded).toBe(true);
    expect(state.events.some((e) => e.id === 'auto-hot')).toBe(true);
    expect(state.events.some((e) => e.id === 'auto-old')).toBe(true);
    expect(
      state.eventsWithTelemetry.some((e) => e.id === 'auto-daily-2026-11-12')
    ).toBe(true);
  });

  it('allows retrying loadArchive() after a transient failure', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([makeEvent('auto-retry', '2026-05-01', 'Retry ok')]),
          { status: 200 }
        )
      );

    await useEventsStore.getState().loadArchive();
    expect(useEventsStore.getState().archiveLoaded).toBe(false);
    expect(useEventsStore.getState().archiveError).toBe('offline');

    await useEventsStore.getState().loadArchive();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(useEventsStore.getState().archiveLoaded).toBe(true);
    expect(
      useEventsStore.getState().events.some((e) => e.id === 'auto-retry')
    ).toBe(true);
  });
});
