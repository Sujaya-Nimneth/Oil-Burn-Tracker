import { describe, it, expect } from 'vitest';
import {
  formatBillions,
  formatBPD,
  formatDate,
  getYouTubeId,
  sanitizeUrl
} from './format';

describe('format helpers', () => {
  it('formats billions and trillions cleanly', () => {
    expect(formatBillions(12.34)).toBe('$12.3B');
    expect(formatBillions(450.4)).toBe('$450B');
    expect(formatBillions(1250)).toBe('$1.25T');
  });

  it('formats barrels per day without producing 0.0M BPD for sub-million capacities', () => {
    expect(formatBPD(7_000_000)).toBe('7.0M BPD');
    expect(formatBPD(550_000)).toBe('550K BPD');
    expect(formatBPD(267_000)).toBe('267K BPD');
    expect(formatBPD(0)).toBe('');
  });

  it('extracts 11-character YouTube video IDs from supported URL formats', () => {
    expect(getYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ'
    );
    expect(getYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(getYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ'
    );
    expect(getYouTubeId('https://example.com/video')).toBeNull();
  });

  it('sanitizes URLs to allow only http and https protocols', () => {
    expect(sanitizeUrl('https://reuters.com/world?id=1')).toBe(
      'https://reuters.com/world?id=1'
    );
    expect(sanitizeUrl('http://example.org/news')).toBe(
      'http://example.org/news'
    );
    expect(sanitizeUrl('javascript:alert(1)')).toBe('');
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('');
    expect(sanitizeUrl('')).toBe('');
    expect(sanitizeUrl(null)).toBe('');
  });

  it('formats valid dates and returns empty string on invalid input', () => {
    expect(formatDate(undefined)).toBe('');
    expect(formatDate('not-a-date')).toBe('');
    expect(formatDate('2026-03-13T12:00:00Z')).toContain('2026');
  });
});
