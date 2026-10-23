'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useFireStore } from '@/stores/fire-store';
import {
  getEventsUpTo,
  getCasualtiesUpTo,
  getVisibleFacilityIds,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  type ConflictEvent,
  type EventCategory
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

function getYouTubeId(url: string): string | null {
  const m = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([a-zA-Z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return '1d ago';
  if (diff < 30) return `${diff}d ago`;
  if (diff < 365) return `${Math.floor(diff / 30)}mo ago`;
  return `${(diff / 365).toFixed(1)}yr ago`;
}

// Compute cumulative impact stats at a given date
function getImpactAt(date: string) {
  const casualties = getCasualtiesUpTo(date);
  const facilityIds = getVisibleFacilityIds(date);
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
  const timelineDate = useFireStore((s) => s.timelineDate);
  const setTimelineDate = useFireStore((s) => s.setTimelineDate);
  const [selectedCategory, setSelectedCategory] = useState<
    'all' | EventCategory
  >('all');
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const ratiosRef = useRef<Map<string, number>>(new Map());
  const eventMapRef = useRef<Map<string, ConflictEvent>>(new Map());

  const events = useMemo(() => {
    const base = getEventsUpTo(timelineDate).reverse();
    const q = searchQuery.trim().toLowerCase();
    return base.filter((e) => {
      if (selectedCategory !== 'all' && e.category !== selectedCategory)
        return false;
      if (
        q &&
        !e.title.toLowerCase().includes(q) &&
        !e.description.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [timelineDate, selectedCategory, searchQuery]);

  // id → event lookup for the IntersectionObserver callback below
  const eventMap = useMemo(() => {
    const m = new Map<string, ConflictEvent>();
    events.forEach((e) => m.set(e.id, e));
    return m;
  }, [events]);
  const eventCount = events.length;

  // Refs must not be written during render — sync after commit instead
  useEffect(() => {
    eventMapRef.current = eventMap;
  }, [eventMap]);

  // Precompute impact stats for each unique date in visible events
  const impactByDate = useMemo(() => {
    const dates = new Set(events.map((e) => e.date));
    const map = new Map<string, ReturnType<typeof getImpactAt>>();
    dates.forEach((d) => map.set(d, getImpactAt(d)));
    return map;
  }, [events]);

  // Save & restore scroll position
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const saved = sessionStorage.getItem('obt-feed-scroll');
    if (saved) {
      requestAnimationFrame(() => {
        container.scrollTop = parseInt(saved, 10);
      });
    }
    let timeout: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        try {
          sessionStorage.setItem(
            'obt-feed-scroll',
            String(container.scrollTop)
          );
        } catch {}
      }, 300);
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      clearTimeout(timeout);
    };
  }, []);

  // IntersectionObserver: scrolling syncs timeline date
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    ratiosRef.current.clear();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.getAttribute('data-event-id');
          if (id) {
            ratiosRef.current.set(
              id,
              entry.isIntersecting ? entry.intersectionRatio : 0
            );
          }
        });

        let bestId: string | null = null;
        let bestRatio = 0;
        ratiosRef.current.forEach((ratio, id) => {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        });

        if (bestId && bestRatio > 0.3) {
          const event = eventMapRef.current.get(bestId);
          if (event && fullPage) {
            setTimelineDate(event.date);
          }
        }
      },
      {
        root: container,
        threshold: [0, 0.2, 0.4, 0.6, 0.8, 1]
      }
    );

    const timer = setTimeout(() => {
      const elements = container.querySelectorAll('[data-event-id]');
      elements.forEach((el) => observer.observe(el));
    }, 150);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [eventCount, fullPage, setTimelineDate]);

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
            className='w-full rounded-lg border border-gray-200 bg-white py-1 pr-16 pl-8 text-xs text-gray-900 placeholder:text-gray-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:placeholder:text-zinc-600'
          />
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              className='absolute right-2 cursor-pointer text-gray-400 hover:text-gray-700 dark:hover:text-white'
              aria-label='Clear search'
            >
              <IconX className='h-3.5 w-3.5' />
            </button>
          ) : (
            <span className='pointer-events-none absolute right-2.5 font-mono text-[10px] text-gray-400 dark:text-zinc-600'>
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

      <div
        ref={scrollRef}
        className='flex-1 space-y-3 overflow-y-auto px-3 py-3'
      >
        {events.length === 0 && (
          <div className='py-8 text-center text-xs text-gray-500 dark:text-zinc-500'>
            No matching events found up to {formatDate(timelineDate)}.
          </div>
        )}
        {events.map((event) => {
          const ytMedia = event.mediaUrls?.find((m) => m.type === 'youtube');
          const videoId = ytMedia ? getYouTubeId(ytMedia.url) : null;
          const catColor = CATEGORY_COLORS[event.category];
          const stats = impactByDate.get(event.date);

          return (
            <div
              key={event.id}
              data-event-id={event.id}
              className='overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-black/60'
            >
              {/* Impact pills — cumulative damage at this date */}
              {stats && (
                <div className='flex items-center gap-2 overflow-x-auto border-b border-gray-100 bg-gray-50 px-3 py-1.5 dark:border-zinc-800/50 dark:bg-zinc-900/60'>
                  <span className='flex items-center gap-1 text-[10px] font-bold whitespace-nowrap text-red-600 dark:text-red-400'>
                    <IconSkull className='h-3 w-3' />
                    {stats.casualties.totalKilled.toLocaleString()}
                  </span>
                  <span className='text-gray-300 dark:text-zinc-700'>|</span>
                  <span className='flex items-center gap-1 text-[10px] font-bold whitespace-nowrap text-blue-600 dark:text-blue-400'>
                    <IconDroplet className='h-3 w-3' />
                    {stats.supply.productionPct.toFixed(1)}% offline
                  </span>
                  <span className='text-gray-300 dark:text-zinc-700'>|</span>
                  <span className='flex items-center gap-1 text-[10px] font-bold whitespace-nowrap text-green-700 dark:text-green-400'>
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
                    <span className='text-[10px] text-gray-400 dark:text-zinc-600'>
                      {timeAgo(event.date)}
                    </span>
                  </div>
                </div>
                <h3 className='text-sm leading-snug font-black text-gray-900 dark:text-zinc-100'>
                  {event.title}
                </h3>
              </div>

              {/* YouTube thumbnail — always visible, click to watch */}
              {videoId && (
                <a
                  href={ytMedia!.url}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='group relative block w-full bg-gray-100 dark:bg-black'
                  style={{ paddingBottom: '56.25%' }}
                >
                  <img
                    src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                    alt={event.title}
                    className='absolute inset-0 h-full w-full object-cover'
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        `https://img.youtube.com/vi/${videoId}/default.jpg`;
                    }}
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
                  (event.casualties.killed || event.casualties.displaced) && (
                    <div className='flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 dark:border-red-500/20 dark:bg-red-950/30'>
                      {event.casualties.killed != null &&
                        event.casualties.killed > 0 && (
                          <span className='flex items-center gap-1 text-[11px] font-bold text-red-600 dark:text-red-400'>
                            <IconSkull className='h-3 w-3' />
                            {event.casualties.killed.toLocaleString()}+ killed
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
                    {event.sourceUrl && (
                      <a
                        href={event.sourceUrl}
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
                      .map((media, i) => (
                        <a
                          key={i}
                          href={media.url}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-blue-600 transition-colors hover:bg-gray-100 hover:text-blue-500 dark:text-blue-400 dark:hover:bg-zinc-800/50 dark:hover:text-blue-300'
                        >
                          <IconExternalLink className='h-3 w-3' />
                          {media.label || media.type}
                        </a>
                      ))}
                  </div>
                  {event.lat && event.lng && (
                    <button
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
          );
        })}
      </div>
    </div>
  );
}
