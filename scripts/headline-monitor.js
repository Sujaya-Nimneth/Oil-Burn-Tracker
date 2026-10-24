#!/usr/bin/env node
/**
 * Headline Monitor — checks news RSS + YouTube every hour
 * Finds conflict-related headlines and matching videos,
 * and saves draft events for review.
 *
 * Usage: node scripts/headline-monitor.js
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = __dirname;
const SEEN_FILE = join(DATA_DIR, 'seen-headlines.json');
const DRAFTS_FILE = join(DATA_DIR, 'draft-events.json');
const AUTO_EVENTS_FILE = join(DATA_DIR, '..', 'public', 'auto-events.json');

const ARGS = new Set(process.argv.slice(2));
const SHOULD_PUBLISH = ARGS.has('--publish') || !ARGS.has('--drafts-only');
const PROMOTE_DRAFTS = ARGS.has('--promote-drafts');

const TRUSTED_SOURCE_PATTERN =
  /reuters|associated press|\bap\b|ap news|bbc|al jazeera|the guardian|guardian|cnn|france 24|bloomberg|cnbc|new york times|washington post|un news|pbs|npr|financial times|economist|times of israel|middle east eye|axios|cbs news|abc news|nbc news|sky news|dw\.com|deutsche welle|euronews/i;

// ── Search queries for Google News RSS ──
const NEWS_QUERIES = [
  'Israel Iran war',
  'Gaza conflict',
  'Middle East oil disruption',
  'Strait of Hormuz',
  'Yemen Houthi attacks shipping',
  'Iran nuclear facilities',
  'oil price surge conflict',
  'Israel Lebanon Hezbollah',
  'Gaza ceasefire',
  'Iran retaliation Israel'
];

// ── YouTube search queries ──
const YT_QUERIES = [
  'Israel Iran war today',
  'Gaza latest news today',
  'Middle East conflict oil',
  'Houthi shipping attack',
  'Iran nuclear news'
];

// ── Category detection (maps strictly to EventCategory in conflict-events.ts) ──
const CATEGORY_RULES = [
  {
    pattern:
      /refiner|pipeline|oil field|gas field|lng|ras tanura|abqaiq|kharg|south pars|ras laffan|bapco|mina al-ahmadi|fujairah|natanz|fordow|arak|bushehr/i,
    category: 'facility_damage'
  },
  {
    pattern:
      /houthi|shipping|strait|hormuz|bab.el|tanker|maritime|red sea|vessel|cargo ship/i,
    category: 'chokepoint'
  },
  {
    pattern:
      /ceasefire|peace|negotiat|diplomat|UN\b|united nations|treaty|talks|envoy|summit/i,
    category: 'diplomatic'
  },
  {
    pattern: /retaliat|response|counter-strike|vows revenge|hits back/i,
    category: 'retaliation'
  },
  {
    pattern:
      /strike|bomb|attack|missile|drone|raid|airstrike|shelling|intercept/i,
    category: 'military_strike'
  },
  {
    pattern:
      /humanitarian|famine|aid|hospital|refugee|displaced|unicef|unrwa|ocha|red cross|civilian toll/i,
    category: 'humanitarian'
  },
  {
    pattern:
      /escalat|nuclear|enrichment|sanction|oil price|crude|barrel|inflation|troops|mobiliz/i,
    category: 'escalation'
  }
];

const VALID_CATEGORIES = new Set([
  'military_strike',
  'facility_damage',
  'chokepoint',
  'diplomatic',
  'escalation',
  'retaliation',
  'humanitarian'
]);

function normalizeCategory(cat, title = '', description = '') {
  if (VALID_CATEGORIES.has(cat)) return cat;
  const legacyMap = {
    infrastructure: 'facility_damage',
    nuclear: 'facility_damage',
    shipping: 'chokepoint',
    diplomacy: 'diplomatic',
    economic: 'escalation'
  };
  if (cat && legacyMap[cat]) return legacyMap[cat];
  return detectCategory(title, description);
}

function detectCategory(title, description = '') {
  const text = `${title} ${description}`;
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(text)) return rule.category;
  }
  return 'escalation';
}

// ── Middle East Location & Energy Facility Gazetteer ──
const LOCATION_GAZETTEER = [
  // Curated Energy & Nuclear Facilities
  {
    pattern: /ras tanura/i,
    lat: 26.643,
    lng: 50.158,
    zoom: 11,
    facilityId: 'ras-tanura'
  },
  {
    pattern: /abqaiq/i,
    lat: 25.937,
    lng: 49.681,
    zoom: 11,
    facilityId: 'abqaiq'
  },
  {
    pattern: /kharg island/i,
    lat: 29.233,
    lng: 50.324,
    zoom: 11,
    facilityId: 'kharg-island'
  },
  {
    pattern: /south pars/i,
    lat: 27.5,
    lng: 52.0,
    zoom: 9,
    facilityId: 'south-pars'
  },
  {
    pattern: /ras laffan/i,
    lat: 25.926,
    lng: 51.535,
    zoom: 11,
    facilityId: 'ras-laffan'
  },
  {
    pattern: /bapco|sitra/i,
    lat: 26.155,
    lng: 50.614,
    zoom: 12,
    facilityId: 'bapco-sitra'
  },
  {
    pattern: /mina al-ahmadi|ahmadi refinery/i,
    lat: 29.067,
    lng: 48.133,
    zoom: 11,
    facilityId: 'mina-al-ahmadi'
  },
  {
    pattern: /fujairah/i,
    lat: 25.128,
    lng: 56.326,
    zoom: 11,
    facilityId: 'fujairah'
  },
  {
    pattern: /shah gas|al hosn/i,
    lat: 22.933,
    lng: 53.883,
    zoom: 10,
    facilityId: 'shah-gas'
  },
  {
    pattern: /yanbu|samref/i,
    lat: 23.989,
    lng: 38.221,
    zoom: 11,
    facilityId: 'samref-yanbu'
  },
  {
    pattern: /jubail|satorp/i,
    lat: 27.011,
    lng: 49.658,
    zoom: 11,
    facilityId: 'jubail-satorp'
  },
  {
    pattern: /ghawar/i,
    lat: 25.433,
    lng: 49.583,
    zoom: 9,
    facilityId: 'ghawar'
  },
  {
    pattern: /habshan/i,
    lat: 23.867,
    lng: 53.65,
    zoom: 10,
    facilityId: 'habshan'
  },
  {
    pattern: /haifa/i,
    lat: 32.794,
    lng: 35.034,
    zoom: 11,
    facilityId: 'haifa-bazan'
  },
  { pattern: /natanz/i, lat: 33.724, lng: 51.727, zoom: 11 },
  { pattern: /fordow/i, lat: 34.884, lng: 50.996, zoom: 11 },
  { pattern: /isfahan/i, lat: 32.655, lng: 51.667, zoom: 9 },
  { pattern: /bushehr/i, lat: 28.829, lng: 50.886, zoom: 10 },
  { pattern: /arak/i, lat: 34.374, lng: 49.241, zoom: 10 },
  // Chokepoints
  {
    pattern: /hormuz/i,
    lat: 26.566,
    lng: 56.25,
    zoom: 8,
    facilityId: 'strait-of-hormuz'
  },
  {
    pattern: /bab el-mandeb|bab al-mandab|red sea/i,
    lat: 12.583,
    lng: 43.333,
    zoom: 7,
    facilityId: 'bab-el-mandeb'
  },
  { pattern: /suez canal/i, lat: 30.585, lng: 32.265, zoom: 8 },
  // Cities & Conflict Theaters
  { pattern: /rafah/i, lat: 31.297, lng: 34.243, zoom: 12 },
  { pattern: /khan younis/i, lat: 31.346, lng: 34.303, zoom: 12 },
  { pattern: /gaza/i, lat: 31.501, lng: 34.467, zoom: 10 },
  {
    pattern: /west bank|jenin|nablus|ramallah|tulkarm/i,
    lat: 32.221,
    lng: 35.254,
    zoom: 9
  },
  { pattern: /tel aviv/i, lat: 32.085, lng: 34.782, zoom: 10 },
  { pattern: /jerusalem/i, lat: 31.768, lng: 35.214, zoom: 11 },
  { pattern: /beirut/i, lat: 33.894, lng: 35.502, zoom: 11 },
  {
    pattern: /lebanon|hezbollah|tyre|sidon|litani/i,
    lat: 33.366,
    lng: 35.433,
    zoom: 8
  },
  { pattern: /damascus|syria|aleppo/i, lat: 33.514, lng: 36.276, zoom: 8 },
  { pattern: /baghdad|iraq/i, lat: 33.315, lng: 44.366, zoom: 7 },
  {
    pattern: /sanaa|hodeidah|yemen|houthi/i,
    lat: 15.369,
    lng: 44.191,
    zoom: 7
  },
  { pattern: /riyadh|saudi/i, lat: 24.714, lng: 46.675, zoom: 6 },
  {
    pattern: /abu dhabi|dubai|\buae\b|emirates/i,
    lat: 24.454,
    lng: 54.377,
    zoom: 7
  },
  { pattern: /doha|qatar/i, lat: 25.285, lng: 51.531, zoom: 8 },
  { pattern: /kuwait/i, lat: 29.376, lng: 47.977, zoom: 8 },
  { pattern: /bahrain|manama/i, lat: 26.228, lng: 50.586, zoom: 9 },
  { pattern: /tehran|iran|irgc/i, lat: 35.689, lng: 51.389, zoom: 6 },
  { pattern: /israel|idf|netanyahu/i, lat: 31.768, lng: 34.851, zoom: 7 }
];

function geocodeHeadline(title, description = '') {
  const text = `${title} ${description}`;
  for (const loc of LOCATION_GAZETTEER) {
    if (loc.pattern.test(text)) {
      return {
        lat: loc.lat,
        lng: loc.lng,
        zoom: loc.zoom || 7,
        ...(loc.facilityId ? { facilityId: loc.facilityId } : {})
      };
    }
  }
  // Regional default (central Persian Gulf / Middle East)
  return { lat: 29.5, lng: 48.5, zoom: 5 };
}

// ── Load/save seen headlines ──
function loadSeen() {
  if (!existsSync(SEEN_FILE)) return new Set();
  try {
    return new Set(JSON.parse(readFileSync(SEEN_FILE, 'utf-8')));
  } catch {
    return new Set();
  }
}

function saveSeen(seen) {
  // Keep last 2000 entries to prevent unbounded growth
  const arr = [...seen].slice(-2000);
  writeFileSync(SEEN_FILE, JSON.stringify(arr, null, 2));
}

function loadDrafts() {
  if (!existsSync(DRAFTS_FILE)) return [];
  try {
    return JSON.parse(readFileSync(DRAFTS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveDrafts(drafts) {
  // Keep last 200 drafts
  writeFileSync(DRAFTS_FILE, JSON.stringify(drafts.slice(-200), null, 2));
}

// ── Fetch Google News RSS ──
async function fetchGoogleNewsRSS(query) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'OilBurnTracker-Monitor/1.0' },
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRSSItems(xml);
  } catch (e) {
    console.error(`  RSS fetch failed for "${query}": ${e.message}`);
    return [];
  }
}

function parseRSSItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const pubDate = extractTag(block, 'pubDate');
    const source = extractTag(block, 'source');
    if (title && link) {
      items.push({
        title: decodeHTMLEntities(title),
        link,
        pubDate: pubDate
          ? new Date(pubDate).toISOString()
          : new Date().toISOString(),
        source: source ? decodeHTMLEntities(source) : ''
      });
    }
  }
  return items;
}

function extractTag(xml, tag) {
  // Handle CDATA
  const cdataRegex = new RegExp(
    `<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`,
    'i'
  );
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const m = xml.match(regex);
  return m ? m[1].trim() : '';
}

function decodeHTMLEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"');
}

// ── Search YouTube via RSS (no API key needed) ──
async function searchYouTube(query) {
  // Use YouTube's search page and extract video IDs from the HTML
  // This is a lightweight approach that doesn't need an API key
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=CAI%253D`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) return [];
    const html = await res.text();

    // Extract video IDs from the page
    const videoIds = [];
    const idRegex = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
    let m;
    const seen = new Set();
    while ((m = idRegex.exec(html)) !== null) {
      if (!seen.has(m[1])) {
        seen.add(m[1]);
        videoIds.push(m[1]);
      }
      if (videoIds.length >= 5) break;
    }

    // Extract titles
    const results = [];
    for (const vid of videoIds) {
      const titleRegex = new RegExp(
        `"videoId":"${vid}"[^}]*?"title":\\{"runs":\\[\\{"text":"([^"]+)"`,
        's'
      );
      const tm = html.match(titleRegex);
      results.push({
        videoId: vid,
        title: tm ? decodeHTMLEntities(tm[1]) : '',
        url: `https://www.youtube.com/watch?v=${vid}`
      });
    }
    return results;
  } catch (e) {
    console.error(`  YouTube search failed for "${query}": ${e.message}`);
    return [];
  }
}

// ── Find best YouTube match for a headline ──
async function findVideoForHeadline(headline) {
  // Simplify headline for search
  const searchQuery = headline
    .replace(
      /\b(the|a|an|in|on|at|to|for|of|and|or|but|is|are|was|were|has|have|had|with)\b/gi,
      ''
    )
    .replace(/[^\w\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join(' ');

  const results = await searchYouTube(searchQuery);
  if (results.length > 0) return results[0];
  return null;
}

// ── Generate event ID from title ──
function generateEventId(title, date = '') {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join('-');
  return date ? `auto-${slug}-${date}` : `auto-${slug}`;
}

function cleanHeadlineTitle(title, source = '') {
  let cleaned = title.trim();
  if (source) {
    const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    cleaned = cleaned.replace(new RegExp(`\\s*[-–|]\\s*${escaped}$`, 'i'), '');
  }
  cleaned = cleaned.replace(/\s*[-–|]\s*[A-Za-z0-9 .,'&]+\.[a-z]{2,4}$/i, '');
  return cleaned.trim();
}

function isTrustedSource(source = '', title = '') {
  return TRUSTED_SOURCE_PATTERN.test(`${source} ${title}`);
}

function loadAutoEvents() {
  if (!existsSync(AUTO_EVENTS_FILE)) return [];
  try {
    return JSON.parse(readFileSync(AUTO_EVENTS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveAutoEvents(events) {
  writeFileSync(AUTO_EVENTS_FILE, JSON.stringify(events, null, 2) + '\n');
}

function toPublishedEvent(draft) {
  const cleanTitle = cleanHeadlineTitle(draft.title, draft.source);
  const geo =
    draft.lat && draft.lng
      ? {
          lat: draft.lat,
          lng: draft.lng,
          ...(draft.zoom ? { zoom: draft.zoom } : {}),
          ...(draft.facilityId ? { facilityId: draft.facilityId } : {})
        }
      : geocodeHeadline(cleanTitle, draft.description);
  const category = normalizeCategory(
    draft.category,
    cleanTitle,
    draft.description
  );

  const event = {
    id: draft.id.startsWith('auto-') ? draft.id : `auto-${draft.id}`,
    date: draft.date,
    title: cleanTitle,
    category,
    description:
      draft.description ||
      `Via ${draft.source || 'news'}. Auto-detected by headline monitor.`,
    lat: geo.lat,
    lng: geo.lng,
    ...(geo.facilityId ? { facilityId: geo.facilityId } : {}),
    ...(draft.sourceUrl ? { sourceUrl: draft.sourceUrl } : {}),
    ...(Array.isArray(draft.mediaUrls) && draft.mediaUrls.length > 0
      ? { mediaUrls: draft.mediaUrls }
      : {})
  };
  return event;
}

function mergeIntoAutoEvents(existingAuto, candidateEvents) {
  const seenKeys = new Set(
    existingAuto.map((e) => `${e.date}|${e.title.trim().toLowerCase()}`)
  );
  const usedIds = new Set(existingAuto.map((e) => e.id));
  let added = 0;

  for (const candidate of candidateEvents) {
    const key = `${candidate.date}|${candidate.title.trim().toLowerCase()}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    let id = candidate.id;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${candidate.id}-${candidate.date}-${suffix}`;
      suffix++;
    }
    usedIds.add(id);

    existingAuto.push({ ...candidate, id });
    added++;
  }

  existingAuto.sort((a, b) => a.date.localeCompare(b.date));
  return added;
}

// ── Main ──
async function main() {
  console.log(`[${new Date().toISOString()}] Headline Monitor starting...`);

  const seen = loadSeen();
  const drafts = loadDrafts();
  const autoEvents = loadAutoEvents();
  const newHeadlines = [];
  const candidatesToPublish = [];

  // Optional: promote existing trusted drafts from draft-events.json
  if (PROMOTE_DRAFTS) {
    for (const d of drafts) {
      if (isTrustedSource(d.source, d.title)) {
        candidatesToPublish.push(toPublishedEvent(d));
      }
    }
  }

  // 1. Fetch news from all queries
  console.log('  Fetching news RSS feeds...');
  const allItems = [];
  for (const query of NEWS_QUERIES) {
    const items = await fetchGoogleNewsRSS(query);
    allItems.push(...items);
    // Small delay to be respectful
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(
    `  Found ${allItems.length} total items across ${NEWS_QUERIES.length} queries`
  );

  // 2. Deduplicate and filter new ones
  const uniqueNew = [];
  for (const item of allItems) {
    const key = item.title.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueNew.push(item);
    }
  }

  console.log(`  ${uniqueNew.length} new headlines after dedup`);

  // 3. For each new headline, find a YouTube video, geocode, and create event
  for (const item of uniqueNew.slice(0, 15)) {
    // Cap at 15 per run
    console.log(`  Processing: ${item.title.slice(0, 60)}...`);

    const video = await findVideoForHeadline(item.title);
    const cleanTitle = cleanHeadlineTitle(item.title, item.source);
    const category = detectCategory(cleanTitle);
    const geo = geocodeHeadline(cleanTitle);
    const dateStr = item.pubDate.slice(0, 10);

    const draft = {
      id: generateEventId(cleanTitle, dateStr),
      date: dateStr,
      title: cleanTitle,
      description: `Via ${item.source || 'news'}. Auto-detected by headline monitor.`,
      category,
      sourceUrl: item.link,
      source: item.source,
      fetchedAt: new Date().toISOString(),
      mediaUrls: video
        ? [{ type: 'youtube', url: video.url, label: video.title }]
        : [],
      videoMatch: video
        ? { videoId: video.videoId, title: video.title, confidence: 'auto' }
        : null,
      lat: geo.lat,
      lng: geo.lng,
      zoom: geo.zoom || 7,
      ...(geo.facilityId ? { facilityId: geo.facilityId } : {}),
      casualties: null,
      status: isTrustedSource(item.source, item.title) ? 'published' : 'draft'
    };

    drafts.push(draft);
    newHeadlines.push({ ...item, video, category });

    if (SHOULD_PUBLISH && isTrustedSource(item.source, item.title)) {
      candidatesToPublish.push(toPublishedEvent(draft));
    }

    // Rate limit YouTube requests
    await new Promise((r) => setTimeout(r, 800));
  }

  // 4. Save state & publish to auto-events.json
  saveSeen(seen);
  saveDrafts(drafts);

  if (SHOULD_PUBLISH && candidatesToPublish.length > 0) {
    const publishedCount = mergeIntoAutoEvents(autoEvents, candidatesToPublish);
    if (publishedCount > 0) {
      saveAutoEvents(autoEvents);
      console.log(
        `  Published ${publishedCount} verified event(s) to auto-events.json`
      );
    }
  }

  // 5. Also fetch latest YouTube videos from key channels
  if (uniqueNew.length > 0) {
    console.log('  Searching YouTube for latest conflict videos...');
    const ytResults = [];
    for (const query of YT_QUERIES) {
      const videos = await searchYouTube(query);
      ytResults.push(...videos);
      await new Promise((r) => setTimeout(r, 800));
    }

    const ytFile = join(DATA_DIR, 'youtube-latest.json');
    const ytUnique = [];
    const ytSeen = new Set();
    for (const v of ytResults) {
      if (!ytSeen.has(v.videoId)) {
        ytSeen.add(v.videoId);
        ytUnique.push({ ...v, fetchedAt: new Date().toISOString() });
      }
    }
    if (ytUnique.length > 0) {
      writeFileSync(ytFile, JSON.stringify(ytUnique.slice(0, 30), null, 2));
      console.log(`  Saved ${ytUnique.length} unique YouTube videos`);
    }
  }

  // 6. Log summary
  if (newHeadlines.length > 0) {
    console.log(`\n  NEW HEADLINES:`);
    newHeadlines.forEach((h, i) => {
      console.log(`  ${i + 1}. [${h.category}] ${h.title}`);
      if (h.video) console.log(`     Video: ${h.video.url}`);
    });
  } else {
    console.log('  No new headlines this run');
  }

  console.log(
    `[${new Date().toISOString()}] Done. ${newHeadlines.length} new, ${drafts.length} total drafts.`
  );
}

main().catch(console.error);
