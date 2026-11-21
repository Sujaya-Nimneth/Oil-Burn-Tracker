import { describe, it, expect } from 'vitest';
import { generateEntry } from './memorial-templates';

describe('generateEntry', () => {
  it('assigns infant copy only for age 0, never for unknown age (-1)', () => {
    const unknown = generateEntry(0, -1, 0, 0);
    expect(unknown.humanity.toLowerCase()).not.toContain('baby');
    expect(unknown.humanity.toLowerCase()).not.toContain('newborn');
    expect(unknown.region).toBe('Gaza');

    const newborn = generateEntry(0, 0, 1, 0);
    expect(newborn.humanity.toLowerCase()).toMatch(/baby|newborn/);
  });

  it('produces deterministic regional copy for unknown age across all regions', () => {
    for (const region of [0, 1, 2, 3, 4]) {
      const a = generateEntry(42, -1, 1, region);
      const b = generateEntry(42, -1, 1, region);
      expect(a).toEqual(b);
      expect(a.humanity.length).toBeGreaterThan(5);
      expect(a.lost.length).toBeGreaterThan(5);
    }
  });
});
