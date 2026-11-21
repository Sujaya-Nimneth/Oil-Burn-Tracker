import { describe, it, expect, vi } from 'vitest';
import { curatedFires } from '@/features/fires/data/curated-fires';
import {
  LOCATION_GAZETTEER,
  safeParsePubDate,
  parseRSSItems,
  decodeHTMLEntities,
  detectCategory,
  normalizeCategory,
  cleanHeadlineTitle,
  generateEventId,
  geocodeHeadline,
  shouldAttachFacilityId,
  toPublishedEvent,
  mergeIntoAutoEvents,
  isTrustedSource,
  selectHeadlinesBatch,
  matchFromCorpus,
  findVideoForHeadline
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

  it('falls back cleanly on malformed pubDate instead of throwing RangeError', () => {
    const malformedXml = `<rss><channel><item>
      <title>Malformed date item</title>
      <link>https://example.com/bad-date</link>
      <pubDate>not-a-valid-date</pubDate>
    </item></channel></rss>`;
    const items = parseRSSItems(malformedXml);
    expect(items).toHaveLength(1);
    expect(Number.isNaN(Date.parse(items[0].pubDate))).toBe(false);
    expect(safeParsePubDate('garbage', '2026-03-01T00:00:00.000Z')).toBe(
      '2026-03-01T00:00:00.000Z'
    );
  });
});

describe('decodeHTMLEntities', () => {
  it('decodes the common entities Google News emits', () => {
    expect(decodeHTMLEntities('a &amp; b &#39;c&#39; &#8220;d&#8221;')).toBe(
      'a & b \'c\' "d"'
    );
  });

  it('decodes decimal, hex, and named entities safely without double-decoding', () => {
    expect(
      decodeHTMLEntities(
        'Iran&#x2019;s oil &mdash; &apos;price&apos;&nbsp;&#x201c;surge&#x201d; &#8211; &amp;lt;tag&amp;gt;'
      )
    ).toBe("Iran's oil — 'price' \"surge\" – &lt;tag&gt;");
    expect(decodeHTMLEntities('bad &#99999999; entity')).toBe(
      'bad &#99999999; entity'
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

  it('maps every gazetteer facilityId to a canonical curated facility', () => {
    const validIds = new Set(curatedFires.map((f) => f.id));
    for (const entry of LOCATION_GAZETTEER) {
      if (entry.facilityId) {
        expect(validIds.has(entry.facilityId)).toBe(true);
      }
    }
    expect(geocodeHeadline('Drone strike near Fujairah').facilityId).toBe(
      'fujairah-oil-zone'
    );
    expect(geocodeHeadline('Fire at Shah Gas plant').facilityId).toBe(
      'shah-gas-field'
    );
    expect(geocodeHeadline('Habshan complex shutdown').facilityId).toBe(
      'al-hosn-gas'
    );
    expect(geocodeHeadline('Jubail petrochemical alert').facilityId).toBe(
      'jubail-petrochem'
    );
    expect(geocodeHeadline('Missile hits Haifa oil refinery').facilityId).toBe(
      'haifa-refinery'
    );
  });
});

describe('trusted source gate', () => {
  it('accepts major outlets by source or fallback title', () => {
    expect(isTrustedSource('Reuters', 'anything')).toBe(true);
    expect(isTrustedSource('The Guardian', 'oil update')).toBe(true);
    expect(isTrustedSource('WSJ', 'oil update')).toBe(true);
    expect(isTrustedSource('Haaretz', 'briefing')).toBe(true);
    expect(isTrustedSource('Anadolu Ajansı', 'dispatch')).toBe(true);
    expect(isTrustedSource('', 'report says - BBC')).toBe(true);
  });

  it('rejects unknown sources even if headline quotes a trusted outlet', () => {
    expect(isTrustedSource('Random Blog', 'a story')).toBe(false);
    expect(isTrustedSource('The Sunday Guardian', 'report')).toBe(false);
    expect(isTrustedSource('Random Blog', 'Reuters reports oil spike')).toBe(
      false
    );
  });
});

describe('headline batch selection', () => {
  const nowMs = Date.parse('2026-11-15T12:00:00.000Z');

  it('prioritizes trusted outlets over untrusted ones and sorts newest-first', () => {
    const seen = new Set(['already seen headline']);
    const items = [
      {
        title: 'Untrusted newer breaking headline',
        source: 'Random Blog',
        pubDate: '2026-11-15T11:00:00.000Z'
      },
      {
        title: 'Older trusted story',
        source: 'Reuters',
        pubDate: '2026-11-14T10:00:00.000Z'
      },
      {
        title: 'Newest trusted story',
        source: 'Al Jazeera',
        pubDate: '2026-11-15T10:00:00.000Z'
      },
      {
        title: 'Already seen headline',
        source: 'BBC News',
        pubDate: '2026-11-15T11:30:00.000Z'
      }
    ];

    const { selected, totalNew } = selectHeadlinesBatch(items, seen, {
      maxItems: 2,
      nowMs
    });

    expect(totalNew).toBe(3);
    expect(selected.map((i) => i.title)).toEqual([
      'Newest trusted story',
      'Older trusted story'
    ]);
    // Does not mutate seenSet — caller marks only selected/processed items
    expect(seen.has('untrusted newer breaking headline')).toBe(false);
  });

  it('excludes headlines older than maxAgeDays and deduplicates preferring trusted', () => {
    const items = [
      {
        title: 'Stale strike report',
        source: 'Reuters',
        pubDate: '2026-10-01T00:00:00.000Z'
      },
      {
        title: 'Hormuz tanker alert',
        source: 'Random Blog',
        pubDate: '2026-11-15T08:00:00.000Z'
      },
      {
        title: 'Hormuz tanker alert',
        source: 'WSJ',
        pubDate: '2026-11-15T09:00:00.000Z'
      }
    ];

    const { selected, totalNew } = selectHeadlinesBatch(items, new Set(), {
      maxAgeDays: 30,
      nowMs
    });

    expect(totalNew).toBe(1);
    expect(selected).toHaveLength(1);
    expect(selected[0].source).toBe('WSJ');
  });
});

describe('YouTube corpus matching', () => {
  const corpus = [
    {
      videoId: 'aaa11111111',
      title: 'Missile strike hits Ras Tanura refinery in Saudi Arabia',
      url: 'https://www.youtube.com/watch?v=aaa11111111'
    },
    {
      videoId: 'bbb22222222',
      title: 'Ceasefire negotiations continue in Geneva',
      url: 'https://www.youtube.com/watch?v=bbb22222222'
    }
  ];

  it('matches a headline sharing two or more significant tokens', () => {
    const m = matchFromCorpus('Strike hits Ras Tanura oil refinery', corpus);
    expect(m?.videoId).toBe('aaa11111111');
  });

  it('picks the video with the most overlapping tokens', () => {
    const m = matchFromCorpus(
      'Ras Tanura refinery missile strike aftermath',
      corpus
    );
    expect(m?.videoId).toBe('aaa11111111');
  });

  it('returns null below the two-token threshold', () => {
    // only "strike" overlaps — stopwords and single hits must not match
    expect(matchFromCorpus('Airstrike reported elsewhere', corpus)).toBeNull();
  });

  it('ignores stopwords when counting overlap', () => {
    // shares only 'the/new/live' style words with the ceasefire title
    expect(matchFromCorpus('Live: the new update', corpus)).toBeNull();
  });

  it('skips legacy YouTube search fallback when the RSS corpus is populated', async () => {
    const fallback = vi.fn(async () => [
      { videoId: 'zzz99999999', title: 'Fallback', url: 'https://youtu.be/zzz' }
    ]);
    const match = await findVideoForHeadline(
      'Unmatched regional headline',
      corpus,
      fallback
    );
    expect(match).toBeNull();
    expect(fallback).not.toHaveBeenCalled();
  });

  it('uses legacy YouTube search fallback only when the RSS corpus is empty', async () => {
    const fallback = vi.fn(async () => [
      { videoId: 'zzz99999999', title: 'Fallback', url: 'https://youtu.be/zzz' }
    ]);
    const match = await findVideoForHeadline(
      'Missile strike hits Ras Tanura',
      [],
      fallback
    );
    expect(match?.videoId).toBe('zzz99999999');
    expect(fallback).toHaveBeenCalledTimes(1);
  });
});

describe('facilityId gating and archive deduplication', () => {
  it('gates facilityId attachment on impact keywords and categories', () => {
    expect(
      shouldAttachFacilityId(
        'Missile strike hits Ras Tanura refinery',
        '',
        'facility_damage'
      )
    ).toBe(true);
    expect(
      shouldAttachFacilityId(
        'Saudi Aramco says Abqaiq output remains steady',
        '',
        'facility_damage'
      )
    ).toBe(false);
    expect(
      shouldAttachFacilityId(
        'Ceasefire negotiators meet near Haifa port',
        '',
        'diplomatic'
      )
    ).toBe(false);
    expect(
      shouldAttachFacilityId(
        'Gulf Railway Project aims to reduce Strait of Hormuz reliance',
        '',
        'chokepoint'
      )
    ).toBe(false);
    expect(
      shouldAttachFacilityId(
        'Tanker ablaze after mine blast in Strait of Hormuz',
        '',
        'chokepoint'
      )
    ).toBe(true);
  });

  it('omits facilityId on published non-impact headlines while keeping coordinates', () => {
    const routine = toPublishedEvent({
      id: 'auto-abqaiq-steady-2026-11-20',
      date: '2026-11-20',
      title: 'Saudi Aramco says Abqaiq output remains steady',
      source: 'Reuters',
      category: 'facility_damage',
      lat: 25.937,
      lng: 49.681,
      facilityId: 'abqaiq'
    });
    expect(routine.lat).toBe(25.937);
    expect(routine.facilityId).toBeUndefined();

    const struck = toPublishedEvent({
      id: 'auto-haifa-strike-2026-11-20',
      date: '2026-11-20',
      title: 'Missile strike damages Haifa refinery',
      source: 'Reuters',
      category: 'facility_damage'
    });
    expect(struck.facilityId).toBe('haifa-refinery');
  });

  it('deduplicates incoming candidates against archived events', () => {
    const existing = [
      { id: 'auto-hot-1', date: '2026-11-20', title: 'Hot event' }
    ];
    const archived = [
      { id: 'auto-old-1', date: '2026-06-01', title: 'Archived Hormuz attack' }
    ];
    const added = mergeIntoAutoEvents(
      existing,
      [
        {
          id: 'auto-old-1',
          date: '2026-06-01',
          title: 'Archived Hormuz attack'
        },
        {
          id: 'auto-old-1',
          date: '2026-11-21',
          title: 'Distinct event with colliding id'
        }
      ],
      archived
    );
    expect(added).toBe(1);
    expect(existing).toHaveLength(2);
    expect(existing[1].id).toBe('auto-old-1-2026-11-21-2');
  });
});
