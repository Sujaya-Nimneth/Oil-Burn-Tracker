import { describe, it, expect } from 'vitest';
import {
  getCasualtiesUpTo,
  theaterOf,
  type CasualtyAnchors,
  type ConflictEvent
} from './conflict-events';

function ev(
  id: string,
  date: string,
  extra: Partial<ConflictEvent> = {}
): ConflictEvent {
  return {
    id,
    date,
    title: id,
    category: 'military_strike',
    description: '',
    ...extra
  };
}

const ANCHORS: CasualtyAnchors = {
  regions: {
    gaza: { killed: 72835, asOf: '2025-06-15' },
    west_bank: { killed: 1127, asOf: '2026-09-28' }
  }
};

describe('theater attribution', () => {
  it('routes events with a facility to the facility country theater', () => {
    expect(
      theaterOf(ev('kharg', '2026-03-13', { facilityId: 'kharg-island' }))
    ).toBe('iran');
    expect(
      theaterOf(ev('raslaffan', '2026-03-18', { facilityId: 'ras-laffan' }))
    ).toBe('gulf');
  });

  it('classifies coordinate-only events into the right theater boxes', () => {
    expect(theaterOf(ev('g1', '2024-01-01', { lat: 31.4, lng: 34.4 }))).toBe(
      'gaza'
    );
    expect(theaterOf(ev('wb1', '2024-01-01', { lat: 32.2, lng: 35.25 }))).toBe(
      'west_bank'
    );
    expect(theaterOf(ev('lb1', '2024-01-01', { lat: 33.9, lng: 35.5 }))).toBe(
      'lebanon'
    );
    expect(theaterOf(ev('ta1', '2024-01-01', { lat: 32.08, lng: 34.78 }))).toBe(
      'israel'
    );
    expect(theaterOf(ev('ye1', '2024-01-01', { lat: 15.3, lng: 44.2 }))).toBe(
      'yemen'
    );
    expect(theaterOf(ev('teh', '2024-01-01', { lat: 35.7, lng: 51.4 }))).toBe(
      'iran'
    );
  });

  it('marks unlocated events as other', () => {
    expect(theaterOf(ev('no-loc', '2024-01-01'))).toBe('other');
  });
});

describe('casualty ledger', () => {
  const events: ConflictEvent[] = [
    // Documented (curated, sourced)
    ev('gaza-event', '2024-02-01', {
      lat: 31.4,
      lng: 34.4,
      casualties: { killed: 100 }
    }),
    ev('ir-event', '2026-04-01', {
      lat: 35.7,
      lng: 51.4,
      casualties: { killed: 40 }
    }),
    // Model telemetry
    ev('auto-daily-2026-10-01', '2026-10-01', {
      lat: 31.0,
      lng: 46.0,
      casualties: { killed: 60 }
    })
  ];

  it('splits documented from estimated and never double counts', () => {
    const r = getCasualtiesUpTo(events, ANCHORS, '2026-10-02');
    // gaza: curated 100 → anchor floor 72,835; west_bank: no events but the
    // registry still documents 1,127, so its floor applies too
    expect(r.byTheater.gaza.killed).toBe(72835);
    expect(r.byTheater.west_bank.killed).toBe(1127);
    expect(r.byTheater.iran.killed).toBe(40);
    expect(r.estimatedKilled).toBe(60);
    expect(r.documentedKilled).toBe(72835 + 1127 + 40);
    expect(r.totalKilled).toBe(72835 + 1127 + 40 + 60);
  });

  it('applies anchor floors only once the timeline passes their as-of date', () => {
    const before = getCasualtiesUpTo(events, ANCHORS, '2025-06-14');
    expect(before.byTheater.gaza.killed).toBe(100); // curated only, floor inactive
    expect(before.totalKilled).toBe(100); // iran event + telemetry are later dates
  });

  it('keeps curated counts above the anchor untouched', () => {
    const higher: ConflictEvent[] = [
      ev('gaza-later', '2026-08-01', {
        lat: 31.4,
        lng: 34.4,
        casualties: { killed: 75000 }
      })
    ];
    const r = getCasualtiesUpTo(higher, ANCHORS, '2026-08-02');
    expect(r.byTheater.gaza.killed).toBe(75000);
    expect(r.totalKilled).toBe(75000);
  });

  it('degrades to curated sums without anchors', () => {
    const r = getCasualtiesUpTo(events, null, '2026-10-02');
    expect(r.documentedKilled).toBe(140);
    expect(r.estimatedKilled).toBe(60);
  });

  it('reports which theaters were registry-anchored', () => {
    const r = getCasualtiesUpTo(events, ANCHORS, '2026-10-02');
    expect(r.anchoredTheaters).toContain('gaza');
    // registries document the theater even when curated events don't
    expect(r.anchoredTheaters).toContain('west_bank');
  });
});
