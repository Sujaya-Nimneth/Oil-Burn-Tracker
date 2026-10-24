import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  sanitizeUrl,
  getYouTubeId,
  buildEventPopupHtml,
  buildFacilityPopupHtml
} from './popup-html';

describe('escapeHtml', () => {
  it('escapes every HTML-significant character', () => {
    expect(escapeHtml(`<img src=x onerror="alert('1')">`)).toBe(
      '&lt;img src=x onerror=&quot;alert(&#39;1&#39;)&quot;&gt;'
    );
  });

  it('handles null/undefined without throwing', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('sanitizeUrl', () => {
  it('rejects javascript: scheme URLs', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('');
  });

  it('rejects data: URLs', () => {
    expect(sanitizeUrl('data:text/html,<script>1</script>')).toBe('');
  });

  it('rejects malformed URLs', () => {
    expect(sanitizeUrl('not a url')).toBe('');
    expect(sanitizeUrl('')).toBe('');
  });

  it('keeps http(s) URLs', () => {
    expect(sanitizeUrl('https://example.com/a?b=1')).toBe(
      'https://example.com/a?b=1'
    );
  });
});

describe('getYouTubeId', () => {
  it('extracts ids from every embed format', () => {
    expect(getYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(getYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ'
    );
    expect(getYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ'
    );
    expect(getYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ'
    );
  });

  it('returns null for non-YouTube URLs', () => {
    expect(getYouTubeId('https://example.com/video')).toBeNull();
  });
});

describe('popup builders escape external content', () => {
  it('does not inject markup from a hostile headline', () => {
    const html = buildEventPopupHtml(
      {
        category: 'escalation',
        color: '#a855f7',
        date: '2026-03-01',
        title: '<script>alert(1)</script>',
        description: '<img src=x onerror=alert(2)>',
        sourceUrl: 'javascript:alert(3)'
      },
      true
    );
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('&lt;script&gt;');
  });

  it('does not inject markup from hostile facility text', () => {
    const html = buildFacilityPopupHtml(
      {
        name: '<b>Hostile</b>',
        country: 'X',
        facilityType: 'refinery',
        status: 'active_fire',
        capacityBPD: 100,
        percentGlobalCapacity: 1,
        whyItMatters: '<iframe src=evil>',
        ifDestroyed: '"><svg onload=alert(1)>',
        newsSourceUrl: 'https://news.example/a'
      },
      true
    );
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('<svg');
    expect(html).not.toContain('<b>');
  });
});
