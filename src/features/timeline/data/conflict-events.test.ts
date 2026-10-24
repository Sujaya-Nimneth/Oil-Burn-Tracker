import { describe, it, expect } from 'vitest';
import {
  buildUniqueAllEvents,
  getEventsUpTo,
  getVisibleFacilityIds
} from './conflict-events';
import type { ConflictEvent } from './conflict-events';

function ev(
  id: string,
  date: string,
  title: string,
  extra: Partial<ConflictEvent> = {}
): ConflictEvent {
  return { id, date, title, category: 'escalation', description: '', ...extra };
}

describe('buildUniqueAllEvents', () => {
  it('drops duplicates with the same date and title (case-insensitive)', () => {
    const merged = buildUniqueAllEvents([
      ev('a', '2026-03-01', 'Strike hits refinery'),
      ev('b', '2026-03-01', 'strike hits REFINERY'),
      ev('c', '2026-03-02', 'Strike hits refinery')
    ]);
    expect(merged).toHaveLength(2);
  });

  it('suffixes ids when two kept events would share one', () => {
    const merged = buildUniqueAllEvents([
      ev('auto-x', '2026-03-01', 'First'),
      ev('auto-x', '2026-03-02', 'Second')
    ]);
    expect(merged.map((e) => e.id)).toEqual(['auto-x', 'auto-x-2026-03-02-2']);
  });

  it('sorts by date and then time', () => {
    const merged = buildUniqueAllEvents([
      ev('a', '2026-03-02', 'Later day'),
      ev('b', '2026-03-01', 'Early day, late time', { time: '23:00' }),
      ev('c', '2026-03-01', 'Early day, early time', { time: '01:00' })
    ]);
    expect(merged.map((e) => e.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('timeline helpers over explicit arrays', () => {
  const events = [
    ev('a', '2026-03-01', 'One', { facilityId: 'ras-tanura' }),
    ev('b', '2026-03-05', 'Two'),
    ev('c', '2026-03-10', 'Three', { facilityId: 'kharg-island' })
  ];

  it('getEventsUpTo filters inclusively by date', () => {
    expect(getEventsUpTo(events, '2026-03-04').map((e) => e.id)).toEqual(['a']);
    expect(getEventsUpTo(events, '2026-03-05')).toHaveLength(2);
  });

  it('getVisibleFacilityIds collects facility links up to a date', () => {
    expect(getVisibleFacilityIds(events, '2026-03-09')).toEqual(
      new Set(['ras-tanura'])
    );
    expect(getVisibleFacilityIds(events, '2026-03-10').size).toBe(2);
  });
});
