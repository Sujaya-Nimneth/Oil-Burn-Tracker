import { describe, it, expect } from 'vitest';
import {
  parseRSSItems,
  decodeHTMLEntities,
  detectCategory,
  normalizeCategory,
  cleanHeadlineTitle,
  generateEventId,
  geocodeHeadline,
  isTrustedSource
} from './headline-monitor.js';

describe('RSS parsing', () => {
  const xml = `<?xml version="1.0"?>
<rss><channel>
  <item>
    <title><![CDATA[Missile strike hits Ras Tanura refinery]]></title>
    <link>https://example.com/a</link>
    <pubDate>Fri, 13 Mar 2026 04:30:00 GMT</pubDate>
    <source url="https://reuters.com">Reuters</source>
  </item>
  <item>
    <title>Plain title &amp; entities</title>
    <link>https://example.com/b</link>
  </item>
  <item><title>No link — dropped</title></item>
</channel></rss>`;

  it('extracts CDATA and plain titles, drops items without links', () => {
    const items = parseRSSItems(xml);
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe('Missile strike hits Ras Tanura refinery');
    expect(items[0].source).toBe('Reuters');
  });

  it('normalizes pubDate to ISO', () => {
    expect(parseRSSItems(xml)[0].pubDate).toBe('2026-03-13T04:30:00.000Z');
  });
});

describe('decodeHTMLEntities', () => {
  it('decodes the common entities Google News emits', () => {
    expect(decodeHTMLEntities('a &amp; b &#39;c&#39; &#8220;d&#8221;')).toBe(
      'a & b \'c\' "d"'
    );
  });
});

describe('category detection', () => {
  it('prioritizes facility damage over generic strikes', () => {
    expect(detectCategory('Missile strike hits Ras Tanura refinery')).toBe(
      'facility_damage'
    );
  });

  it('maps chokepoint keywords', () => {
    expect(detectCategory('Tanker attacked in Strait of Hormuz')).toBe(
      'chokepoint'
    );
  });

  it('maps diplomatic keywords', () => {
    expect(detectCategory('Ceasefire talks resume in Doha')).toBe('diplomatic');
  });

  it('falls back to escalation', () => {
    expect(detectCategory('Something completely unrelated')).toBe('escalation');
  });

  it('normalizes legacy categories through the mapping', () => {
    expect(normalizeCategory('shipping')).toBe('chokepoint');
    expect(normalizeCategory('nuclear')).toBe('facility_damage');
    // unknown category → re-detect from title
    expect(normalizeCategory('bogus', 'Pipeline on fire')).toBe(
      'facility_damage'
    );
  });
});

describe('headline cleanup', () => {
  it('strips the trailing source name', () => {
    expect(cleanHeadlineTitle('Oil prices surge - Reuters', 'Reuters')).toBe(
      'Oil prices surge'
    );
    expect(
      cleanHeadlineTitle('Oil prices surge | Al Jazeera', 'Al Jazeera')
    ).toBe('Oil prices surge');
  });

  it('strips a trailing bare domain', () => {
    expect(cleanHeadlineTitle('Ceasefire holds for now - example.com')).toBe(
      'Ceasefire holds for now'
    );
  });
});

describe('event ids and geocoding', () => {
  it('slugs the first five words plus date', () => {
    expect(
      generateEventId(
        'Missile Strike Hits Ras Tanura Oil Refinery',
        '2026-03-13'
      )
    ).toBe('auto-missile-strike-hits-ras-tanura-2026-03-13');
  });

  it('geocodes known facilities and falls back to the region', () => {
    const hit = geocodeHeadline('Fire reported at Ras Tanura');
    expect(hit.facilityId).toBe('ras-tanura');
    const fallback = geocodeHeadline('Totally unknown place event');
    expect(fallback.zoom).toBe(5);
  });
});

describe('trusted source gate', () => {
  it('accepts major outlets by source or title', () => {
    expect(isTrustedSource('Reuters', 'anything')).toBe(true);
    expect(isTrustedSource('', 'report says - BBC')).toBe(true);
  });

  it('rejects unknown sources', () => {
    expect(isTrustedSource('Random Blog', 'a story')).toBe(false);
  });
});
