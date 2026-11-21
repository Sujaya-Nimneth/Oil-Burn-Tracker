'use client';

import {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
  useDeferredValue
} from 'react';
import Image from 'next/image';
import { useVirtualizer } from '@tanstack/react-virtual';
import { getYouTubeId, sanitizeUrl } from '@/lib/format';
import { useFireStore } from '@/stores/fire-store';
import { useEventsStore } from '@/stores/events-store';
import {
  getCasualtiesUpTo,
  getVisibleFacilityIds,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  type ConflictEvent,
  type EventCategory,
  type CasualtyAnchors
} from '../data/conflict-events';
import { getSupplyDisruptionUpTo } from '@/features/fires/data/curated-fires';
import { getConsumerImpactUpTo } from '@/features/impact/data/consumer-impact';
import {
  IconExternalLink,
  IconSkull,
  IconMapPin,
  IconDroplet,
  IconReceipt,
  IconAlertTriangle,
  IconPlayerPlay,
  IconSearch,
  IconX
} from '@tabler/icons-react';

const FILTER_CATEGORIES: { id: 'all' | EventCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'military_strike', label: 'Strikes' },
  { id: 'facility_damage', label: 'Facilities' },
  { id: 'chokepoint', label: 'Chokepoints' },
  { id: 'escalation', label: 'Escalation' },
  { id: 'retaliation', label: 'Retaliation' },
  { id: 'diplomatic', label: 'Diplomatic' },
  { id: 'humanitarian', label: 'Humanitarian' }
];

const FEED_SCROLL_STORAGE_KEY = 'obt-feed-scroll';

function YouTubeThumbnail({
  videoId,
  title
}: {
  videoId: string;
  title: string;
}) {
  const [useDefault, setUseDefault] = useState(false);

  return (
    <Image
      src={`https://img.youtube.com/vi/${videoId}/${useDefault ? 'default' : 'hqdefault'}.jpg`}
      alt={title}
      fill
      sizes='(max-width: 768px) 100vw, 480px'
      className='object-cover'
      onError={() => setUseDefault(true)}
    />
  );
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function timeAgo(iso: string, nowMs: number | null): string {
  if (nowMs === null) return '';
  const eventMs = new Date(iso + 'T00:00:00Z').getTime();
  if (!Number.isFinite(eventMs)) return '';
  const diff = Math.max(0, Math.floor((nowMs - eventMs) / 86400000));
  if (diff === 0) return 'Today';
  if (diff === 1) return '1d ago';
  if (diff < 30) return `${diff}d ago`;
  if (diff < 365) return `${Math.floor(diff / 30)}mo ago`;
  return `${(diff / 365).toFixed(1)}yr ago`;
}

// Compute cumulative impact stats at a given date
function getImpactAt(
  date: string,
  events: ConflictEvent[],
  eventsWithTelemetry: ConflictEvent[],
  casualtyAnchors: CasualtyAnchors | null
) {
  const casualties = getCasualtiesUpTo(
    eventsWithTelemetry,
    casualtyAnchors,
    date
  );
  const facilityIds = getVisibleFacilityIds(events, date);
  const supply = getSupplyDisruptionUpTo(facilityIds, date);
  const impact = getConsumerImpactUpTo(date);
  return { casualties, supply, impact };
}

interface EventFeedProps {
  onFlyTo?: (lat: number, lng: number, zoom: number) => void;
  fullPage?: boolean;
}

export default function EventFeed({
  onFlyTo,
  fullPage = false
}: EventFeedProps) {
  'use no memo';

  const timelineDate = useFireStore((s) => s.timelineDate);
  const timelineDateSource = useFireStore((s) => s.timelineDateSource);
  const setTimelineDate = useFireStore((s) => s.setTimelineDate);
  const allEvents = useEventsStore((s) => s.events);
  const eventsWithTelemetry = useEventsStore((s) => s.eventsWithTelemetry);
  const casualtyAnchors = useEventsStore((s) => s.casualtyAnchors);
  const archiveLoaded = useEventsStore((s) => s.archiveLoaded);
  const archiveLoading = useEventsStore((s) => s.archiveLoading);
  const loadArchive = useEventsStore((s) => s.loadArchive);

  const [selectedCategory, setSelectedCategory] = useState<
    'all' | EventCategory
  >('all');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredQuery = useDeferredValue(searchQuery);
  const [nowMs, setNowMs] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const programmaticScrollRef = useRef(false);
  const programmaticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // Hydrate client clock post-mount to prevent static-export hydration mismatch
  useEffect(() => {
    setNowMs(Date.now());
  }, []);

  // Keep all loaded events in reverse-chronological order — never truncate by
  // timelineDate so scrolling down smoothly updates the date without removing
  // newer cards above the viewport.
  const events = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const filtered: ConflictEvent[] = [];
    for (let i = allEvents.length - 1; i >= 0; i--) {
      const e = allEvents[i];
      if (selectedCategory !== 'all' && e.category !== selectedCategory) {
        continue;
      }
      if (
        q &&
        !e.title.toLowerCase().includes(q) &&
        !e.description.toLowerCase().includes(q)
      ) {
        continue;
      }
      filtered.push(e);
    }
    return filtered;
  }, [allEvents, selectedCategory, deferredQuery]);

  // Lazy per-date cache keyed to the underlying store arrays (not search/filter)
  const getCachedImpact = useMemo(() => {
    const cache = new Map<string, ReturnType<typeof getImpactAt>>();
    return (date: string) => {
      const existing = cache.get(date);
      if (existing) return existing;
      const computed = getImpactAt(
        date,
        allEvents,
        eventsWithTelemetry,
        casualtyAnchors
      );
      cache.set(date, computed);
      return computed;
    };
  }, [allEvents, eventsWithTelemetry, casualtyAnchors]);

  // TanStack Virtual returns unmemoizable helpers; EventFeed opts out via 'use no memo' above.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const ev = events[index];
      const hasVideo = ev?.mediaUrls?.some((m) => m.type === 'youtube');
      return hasVideo ? 390 : 190;
    },
    overscan: 6
  });

  // Restore saved scroll position safely on mount
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    let savedTop: number | null = null;
    try {
      const raw = sessionStorage.getItem(FEED_SCROLL_STORAGE_KEY);
      if (raw) {
        const parsed = Number.parseInt(raw, 10);
        if (Number.isFinite(parsed) && parsed >= 0) savedTop = parsed;
      }
    } catch {}
    let rafId: number | null = null;
    if (savedTop !== null && savedTop > 0) {
      rafId = requestAnimationFrame(() => {
        container.scrollTop = savedTop!;
      });
    }
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  // Scrubber / map change -> jump feed smoothly to the newest event <= timelineDate
  useEffect(() => {
    if (
      !fullPage ||
      (timelineDateSource !== 'scrubber' && timelineDateSource !== 'map')
    ) {
      return;
    }
    if (events.length === 0) return;
    const targetIdx = events.findIndex((e) => e.date <= timelineDate);
    if (targetIdx < 0) return;

    programmaticScrollRef.current = true;
    if (programmaticTimerRef.current) {
      clearTimeout(programmaticTimerRef.current);
    }
    virtualizer.scrollToIndex(targetIdx, { align: 'start' });
    programmaticTimerRef.current = setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 350);
  }, [timelineDate, timelineDateSource, events, fullPage, virtualizer]);

  useEffect(() => {
    return () => {
      if (programmaticTimerRef.current) {
        clearTimeout(programmaticTimerRef.current);
      }
    };
  }, []);

  // Scroll listener: persist scrollTop, sync timelineDate from topmost visible card,
  // and lazily load archived events when approaching the older end of the feed.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    let saveTimeout: ReturnType<typeof setTimeout> | null = null;
    let syncRaf: number | null = null;

    const onScroll = () => {
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        try {
          sessionStorage.setItem(
            FEED_SCROLL_STORAGE_KEY,
            String(Math.round(container.scrollTop))
          );
        } catch {}
      }, 300);

      if (syncRaf !== null) return;
      syncRaf = requestAnimationFrame(() => {
        syncRaf = null;
        if (programmaticScrollRef.current || events.length === 0) return;

        const virtualItems = virtualizer.getVirtualItems();
        if (virtualItems.length === 0) return;

        const scrollTop = container.scrollTop;
        const activeItem =
          virtualItems.find((item) => item.end > scrollTop + 24) ??
          virtualItems[0];
        const activeEvent = events[activeItem.index];

        if (
          fullPage &&
          activeEvent &&
          activeEvent.date !== useFireStore.getState().timelineDate
        ) {
          setTimelineDate(activeEvent.date, 'feed');
        }

        // Approaching the bottom of the loaded hot window → pull in archive
        if (
          !archiveLoaded &&
          !archiveLoading &&
          activeItem.index >= events.length - 15
        ) {
          void loadArchive();
        }
      });
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      if (saveTimeout) clearTimeout(saveTimeout);
      if (syncRaf !== null) cancelAnimationFrame(syncRaf);
    };
  }, [
    events,
    fullPage,
    setTimelineDate,
    virtualizer,
    archiveLoaded,
    archiveLoading,
    loadArchive
  ]);

  const handleFlyTo = useCallback(
    (event: ConflictEvent) => {
      if (event.lat && event.lng && onFlyTo) {
        onFlyTo(event.lat, event.lng, event.zoom || 8);
      }
    },
    [onFlyTo]
  );

  return (
    <div
      className={
        fullPage
          ? 'flex h-full flex-col'
          : 'flex max-h-[calc(100dvh-180px)] w-[360px] flex-col overflow-hidden rounded-xl border border-gray-300 bg-white/95 shadow-2xl backdrop-blur-md dark:border-zinc-700/80 dark:bg-zinc-950/95'
      }
    >
      {/* Search & Category Filter Header */}
      <div className='shrink-0 space-y-2 border-b border-gray-200 bg-gray-50/80 px-3 pt-2.5 pb-2 dark:border-zinc-800/80 dark:bg-zinc-900/50'>
        <div className='relative flex items-center'>
          <IconSearch className='pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-gray-400 dark:text-zinc-500' />
          <input
            type='text'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder='Search events, facilities, locations...'
            aria-label='Search events, facilities, and locations'
            className='w-full rounded-lg border border-gray-200 bg-white py-1 pr-16 pl-8 text-xs text-gray-900 placeholder:text-gray-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:placeholder:text-zinc-600'
          />
          {searchQuery ? (
            <button
              type='button'
              onClick={() => setSearchQuery('')}
              className='absolute right-2 cursor-pointer text-gray-400 hover:text-gray-700 dark:hover:text-white'
              aria-label='Clear search'
            >
              <IconX className='h-3.5 w-3.5' />
            </button>
          ) : (
            <span className='pointer-events-none absolute right-2.5 font-mono text-[10px] text-gray-400 tabular-nums dark:text-zinc-600'>
              {events.length}
            </span>
          )}
        </div>
        <div className='no-scrollbar flex items-center gap-1 overflow-x-auto pb-0.5'>
          {FILTER_CATEGORIES.map((cat) => {
            const active = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type='button'
                onClick={() => setSelectedCategory(cat.id)}
                className={`cursor-pointer rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
                    : 'bg-gray-200/70 text-gray-600 hover:bg-gray-300 dark:bg-zinc-800/80 dark:text-zinc-400 dark:hover:bg-zinc-700'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      <div ref={scrollRef} className='flex-1 overflow-y-auto px-3 pt-3 pb-4'>
        {events.length === 0 ? (
          <div className='py-8 text-center text-xs text-gray-500 dark:text-zinc-500'>
            No matching events found.
          </div>
        ) : (
          <div
            style={{
              height: virtualizer.getTotalSize(),
              position: 'relative',
              width: '100%'
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const event = events[virtualRow.index];
              const ytMedia = event.mediaUrls?.find(
                (m) => m.type === 'youtube'
              );
              const videoId = ytMedia ? getYouTubeId(ytMedia.url) : null;
              const safeYtUrl = ytMedia ? sanitizeUrl(ytMedia.url) : '';
              const safeSourceUrl = sanitizeUrl(event.sourceUrl);
              const catColor = CATEGORY_COLORS[event.category];
              const stats = getCachedImpact(event.date);
              const relativeAge = timeAgo(event.date, nowMs);

              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  data-event-id={event.id}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`
                  }}
                  className='pb-3'
                >
                  <div className='overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-black/60'>
                    {/* Impact pills — cumulative damage at this date */}
                    {stats && (
                      <div className='flex items-center gap-2 overflow-x-auto border-b border-gray-100 bg-gray-50 px-3 py-1.5 dark:border-zinc-800/50 dark:bg-zinc-900/60'>
                        <span className='flex items-center gap-1 text-[10px] font-bold whitespace-nowrap text-red-600 tabular-nums dark:text-red-400'>
                          <IconSkull className='h-3 w-3' />
                          {stats.casualties.totalKilled.toLocaleString()}
                        </span>
                        <span className='text-gray-300 dark:text-zinc-700'>
                          |
                        </span>
                        <span className='flex items-center gap-1 text-[10px] font-bold whitespace-nowrap text-blue-600 tabular-nums dark:text-blue-400'>
                          <IconDroplet className='h-3 w-3' />
                          {stats.supply.productionPct.toFixed(1)}% offline
                        </span>
                        <span className='text-gray-300 dark:text-zinc-700'>
                          |
                        </span>
                        <span className='flex items-center gap-1 text-[10px] font-bold whitespace-nowrap text-green-700 tabular-nums dark:text-green-400'>
                          <IconReceipt className='h-3 w-3' />
                          +${stats.impact.totalMonthlyExtra}/mo
                        </span>
                        {stats.supply.level !== 'normal' && (
                          <>
                            <span className='text-gray-300 dark:text-zinc-700'>
                              |
                            </span>
                            <span
                              className={`text-[10px] font-black whitespace-nowrap uppercase ${
                                stats.supply.level === 'catastrophe'
                                  ? 'text-orange-700 dark:text-orange-400'
                                  : stats.supply.level === 'crisis'
                                    ? 'text-orange-600 dark:text-orange-400'
                                    : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              <IconAlertTriangle className='inline h-3 w-3' />{' '}
                              {stats.supply.level}
                            </span>
                          </>
                        )}
                      </div>
                    )}

                    {/* Card header */}
                    <div className='px-3 pt-2.5 pb-2'>
                      <div className='mb-1.5 flex items-center justify-between'>
                        <div className='flex items-center gap-2'>
                          <div
                            className='h-2.5 w-2.5 rounded-full'
                            style={{ backgroundColor: catColor }}
                          />
                          <span
                            className='text-[10px] font-bold tracking-widest uppercase'
                            style={{ color: catColor }}
                          >
                            {CATEGORY_LABELS[event.category]}
                          </span>
                        </div>
                        <div className='flex items-center gap-2'>
                          <span className='font-mono text-[10px] text-gray-500 dark:text-zinc-500'>
                            {formatDate(event.date)}
                          </span>
                          {relativeAge && (
                            <span className='text-[10px] text-gray-400 dark:text-zinc-600'>
                              {relativeAge}
                            </span>
                          )}
                        </div>
                      </div>
                      <h3 className='text-sm leading-snug font-black text-gray-900 dark:text-zinc-100'>
                        {event.title}
                      </h3>
                    </div>

                    {/* YouTube thumbnail — always visible, click to watch */}
                    {videoId && safeYtUrl && (
                      <a
                        href={safeYtUrl}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='group relative block w-full bg-gray-100 dark:bg-black'
                        style={{ paddingBottom: '56.25%' }}
                      >
                        <YouTubeThumbnail
                          videoId={videoId}
                          title={event.title}
                        />
                        {/* Play button overlay */}
                        <div className='absolute inset-0 flex items-center justify-center'>
                          <div className='flex h-12 w-12 items-center justify-center rounded-full bg-black/60 transition-colors group-hover:bg-red-600'>
                            <IconPlayerPlay className='ml-0.5 h-6 w-6 text-white' />
                          </div>
                        </div>
                        {ytMedia?.label && (
                          <div className='absolute bottom-2 left-2 rounded bg-black/80 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm'>
                            {ytMedia.label}
                          </div>
                        )}
                      </a>
                    )}

                    {/* Body */}
                    <div className='space-y-2 px-3 py-2.5'>
                      <p className='text-[11px] leading-relaxed text-gray-600 dark:text-zinc-400'>
                        {event.description}
                      </p>

                      {/* Casualties from this event */}
                      {event.casualties &&
                        (event.casualties.killed ||
                          event.casualties.displaced) && (
                          <div className='flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 dark:border-red-500/20 dark:bg-red-950/30'>
                            {event.casualties.killed != null &&
                              event.casualties.killed > 0 && (
                                <span className='flex items-center gap-1 text-[11px] font-bold text-red-600 dark:text-red-400'>
                                  <IconSkull className='h-3 w-3' />
                                  {event.casualties.killed.toLocaleString()}+
                                  killed
                                </span>
                              )}
                            {event.casualties.displaced != null &&
                              event.casualties.displaced > 0 && (
                                <span className='text-[11px] font-bold text-amber-600 dark:text-amber-400'>
                                  {event.casualties.displaced.toLocaleString()}{' '}
                                  displaced
                                </span>
                              )}
                            {event.casualties.children != null &&
                              event.casualties.children > 0 && (
                                <span className='text-[11px] font-bold text-red-500 dark:text-red-300'>
                                  {event.casualties.children.toLocaleString()}{' '}
                                  children
                                </span>
                              )}
                          </div>
                        )}

                      {/* Action row */}
                      <div className='flex items-center justify-between border-t border-gray-200 pt-1 dark:border-zinc-800/50'>
                        <div className='flex flex-wrap gap-2'>
                          {safeSourceUrl && (
                            <a
                              href={safeSourceUrl}
                              target='_blank'
                              rel='noopener noreferrer'
                              className='inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-blue-600 transition-colors hover:bg-gray-100 hover:text-blue-500 dark:text-blue-400 dark:hover:bg-zinc-800/50 dark:hover:text-blue-300'
                            >
                              <IconExternalLink className='h-3 w-3' />
                              Source
                            </a>
                          )}
                          {event.mediaUrls
                            ?.filter((m) => m.type !== 'youtube')
                            .map((media, i) => {
                              const safeMediaUrl = sanitizeUrl(media.url);
                              if (!safeMediaUrl) return null;
                              return (
                                <a
                                  key={i}
                                  href={safeMediaUrl}
                                  target='_blank'
                                  rel='noopener noreferrer'
                                  className='inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-blue-600 transition-colors hover:bg-gray-100 hover:text-blue-500 dark:text-blue-400 dark:hover:bg-zinc-800/50 dark:hover:text-blue-300'
                                >
                                  <IconExternalLink className='h-3 w-3' />
                                  {media.label || media.type}
                                </a>
                              );
                            })}
                        </div>
                        {event.lat && event.lng && (
                          <button
                            type='button'
                            onClick={() => handleFlyTo(event)}
                            className='inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-zinc-500 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-300'
                          >
                            <IconMapPin className='h-3 w-3' />
                            Map
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
