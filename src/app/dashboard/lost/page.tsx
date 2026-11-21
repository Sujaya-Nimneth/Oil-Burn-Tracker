'use client';

import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { livesLost, CATEGORY_ICONS } from '@/features/memorial/data/lives-lost';
import {
  generateEntry,
  REGION_NAMES
} from '@/features/memorial/lib/memorial-templates';
import { getCasualtiesUpTo } from '@/features/timeline/data/conflict-events';
import { useEventsStore } from '@/stores/events-store';
import { useFireStore } from '@/stores/fire-store';
import { sanitizeUrl } from '@/lib/format';
import { IconHeart } from '@tabler/icons-react';
import SubmitDialog from '@/features/memorial/components/submit-dialog';

/* ── Types ── */
interface MemorialRecord {
  age: number;
  sex: number;
  region: number;
  date: string;
}
interface MemorialData {
  count: number;
  regions: string[];
  records: [number, number, number, string][];
}

const STORAGE_KEY = 'memorial-scroll-index';

/* ── Data loader with AbortController + error/retry ── */
function useMemorialData() {
  const [data, setData] = useState<MemorialRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/memorial-data.json', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<MemorialData>;
      })
      .then((d) => {
        if (!d || !Array.isArray(d.records)) {
          throw new Error('Invalid memorial dataset');
        }
        setData(
          d.records.map(([age, sex, region, date]) => ({
            age,
            sex,
            region,
            date
          }))
        );
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load the full memorial dataset.'
        );
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setLoading(true);
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  return { data, loading, error, retry };
}

/* ── Saved position ── */
function getSavedIndex(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (!v) return 0;
    const parsed = Number.parseInt(v, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function saveIndex(index: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(index));
  } catch {}
}

function formatAge(age: number): string {
  if (age < 0) return 'Age unknown';
  if (age === 0) return 'Newborn';
  if (age === 1) return '1 year old';
  return `Age ${age}`;
}

function formatDate(d: string): string {
  if (!d) return '';
  try {
    const date = new Date(d + 'T00:00:00');
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return '';
  }
}

/* ── Featured entry (hand-crafted, sourced) ── */
function FeaturedEntry({
  entry,
  number
}: {
  entry: (typeof livesLost)[0];
  number: number;
}) {
  const safeSourceUrl = sanitizeUrl(entry.sourceUrl);
  return (
    <div className='border-b border-zinc-900/80 py-5'>
      <div className='flex items-start gap-4'>
        <div className='w-16 shrink-0 pt-0.5 text-right md:w-20'>
          <span className='font-[family-name:var(--font-playfair)] text-3xl font-normal tracking-tight text-zinc-400 tabular-nums md:text-4xl'>
            {number.toLocaleString()}
          </span>
        </div>
        <div className='min-w-0 flex-1'>
          <div className='flex items-start gap-2'>
            <span className='mt-0.5 shrink-0 text-base opacity-30' aria-hidden>
              {CATEGORY_ICONS[entry.category]}
            </span>
            <div>
              <div className='text-xl leading-snug font-bold text-white md:text-2xl'>
                {entry.humanity}
              </div>
            </div>
          </div>
          <div className='mt-2 ml-7 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-400'>
            {entry.age !== undefined && (
              <span className='tabular-nums'>{formatAge(entry.age)}</span>
            )}
            <span>{entry.region}</span>
            {entry.source && (
              <>
                <span className='text-zinc-600'>·</span>
                {safeSourceUrl ? (
                  <a
                    href={safeSourceUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-zinc-400 underline underline-offset-2 transition-colors hover:text-zinc-200'
                  >
                    {entry.source}
                  </a>
                ) : (
                  <span className='text-zinc-400'>{entry.source}</span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Generated entry (from dataset demographics) ── */
function DataEntry({
  index,
  record,
  number,
  onRemember
}: {
  index: number;
  record: MemorialRecord;
  number: number;
  onRemember: (n: number) => void;
}) {
  const entry = useMemo(
    () => generateEntry(index, record.age, record.sex, record.region),
    [index, record.age, record.sex, record.region]
  );
  const dateStr = formatDate(record.date);
  const regionName = REGION_NAMES[record.region] || 'Gaza';

  return (
    <div className='border-b border-zinc-900/60 py-4'>
      <div className='flex items-start gap-4'>
        <div className='w-16 shrink-0 pt-0.5 text-right md:w-20'>
          <span className='font-[family-name:var(--font-playfair)] text-2xl font-normal text-zinc-400 tabular-nums md:text-3xl'>
            {number.toLocaleString()}
          </span>
        </div>
        <div className='min-w-0 flex-1'>
          <div className='text-xl leading-snug text-zinc-200 md:text-2xl'>
            {entry.humanity}
          </div>
          <div className='mt-1 flex flex-wrap items-center gap-x-2 text-xs text-zinc-400 tabular-nums'>
            <span>{formatAge(record.age)}</span>
            <span className='text-zinc-600'>·</span>
            <span>{regionName}</span>
            {dateStr && (
              <>
                <span className='text-zinc-600'>·</span>
                <span>{dateStr}</span>
              </>
            )}
            <span className='text-zinc-600'>·</span>
            <button
              type='button'
              onClick={() => onRemember(number)}
              className='cursor-pointer text-zinc-400 underline-offset-2 transition-colors hover:text-white hover:underline'
            >
              remember them
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Page ── */
export default function WhatWeLostPage() {
  'use no memo';
  const timelineDate = useFireStore((s) => s.timelineDate);
  const eventsWithTelemetry = useEventsStore((s) => s.eventsWithTelemetry);
  const casualtyAnchors = useEventsStore((s) => s.casualtyAnchors);
  const casualties = useMemo(
    () => getCasualtiesUpTo(eventsWithTelemetry, casualtyAnchors, timelineDate),
    [eventsWithTelemetry, casualtyAnchors, timelineDate]
  );
  const total = casualties.totalKilled;
  const { data: records, loading, error, retry } = useMemorialData();
  const scrollRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);

  const featuredCount = livesLost.length;
  const datasetCount = records?.length ?? 0;
  const totalEntries = featuredCount + datasetCount;

  const gazaCount = useMemo(() => {
    if (casualtyAnchors?.regions.gaza?.killed) {
      return casualtyAnchors.regions.gaza.killed;
    }
    if (records) {
      let n = 0;
      for (const r of records) {
        if (r.region === 0) n++;
      }
      if (n > 0) return n;
    }
    return null;
  }, [casualtyAnchors, records]);

  // TanStack Virtual returns unmemoizable helpers; WhatWeLostPage opts out via 'use no memo' above.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: totalEntries,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (i < featuredCount ? 130 : 95),
    overscan: 40
  });

  // Track furthest read position without reading localStorage during render
  const [currentIndex, setCurrentIndex] = useState(0);
  const [savedIndex, setSavedIndex] = useState(0);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitEntry, setSubmitEntry] = useState<number | undefined>();

  useEffect(() => {
    setSavedIndex(getSavedIndex());
  }, []);

  const handleRemember = useCallback((n: number) => {
    setSubmitEntry(n);
    setSubmitOpen(true);
  }, []);

  const endIndex = virtualizer.range?.endIndex;
  useEffect(() => {
    if (endIndex !== undefined) {
      const last = endIndex + 1;
      setCurrentIndex(last);
      setSavedIndex((prev) => {
        if (last > prev) {
          saveIndex(last);
          return last;
        }
        return prev;
      });
    }
  }, [endIndex]);

  // Restore scroll position on load (with timeout cleanup on unmount)
  useEffect(() => {
    if (loading || restoredRef.current || !records) return;
    const saved = getSavedIndex();
    restoredRef.current = true;
    if (saved > 10) {
      const clamped = Math.min(saved - 5, Math.max(0, totalEntries - 1));
      const timer = setTimeout(() => {
        virtualizer.scrollToIndex(clamped, { align: 'start' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading, records, totalEntries, virtualizer]);

  return (
    <div className='relative h-[calc(100dvh-64px)] w-full bg-black'>
      <div className='h-full overflow-y-auto' ref={scrollRef}>
        {/* ── Sticky counter ── */}
        <div className='sticky top-0 z-10 border-b border-zinc-900/50 bg-black/90 backdrop-blur-sm'>
          <div className='mx-auto flex max-w-4xl items-center justify-between px-6 py-1.5 md:px-12'>
            <button
              type='button'
              onClick={() =>
                scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' })
              }
              aria-label='Scroll back to top of memorial'
              className='cursor-pointer font-mono text-sm text-zinc-300 tabular-nums transition-colors hover:text-white'
            >
              {Math.min(currentIndex, totalEntries).toLocaleString()} of{' '}
              {totalEntries.toLocaleString()}
            </button>
            {savedIndex > 10 && currentIndex < totalEntries - 100 && (
              <span className='text-xs text-zinc-400'>progress saved</span>
            )}
          </div>
        </div>

        {/* ── Error banner if full dataset failed ── */}
        {error && (
          <div className='mx-auto mt-4 max-w-4xl px-6 md:px-12'>
            <div className='flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200'>
              <span>
                Unable to load the full registry dataset ({error}). Showing{' '}
                {featuredCount} documented entries.
              </span>
              <button
                type='button'
                onClick={retry}
                className='cursor-pointer rounded-md border border-red-700 bg-red-900/60 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-red-800'
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* ── Virtualized list ── */}
        <div className='mx-auto max-w-4xl px-6 md:px-12'>
          {loading ? (
            <div className='py-20 text-center font-mono text-sm text-zinc-400'>
              <div>{total.toLocaleString()} people</div>
              <div className='mt-1 text-xs text-zinc-500'>
                {casualties.documentedKilled.toLocaleString()} documented ·{' '}
                {casualties.estimatedKilled.toLocaleString()} estimated (OBT
                model)
              </div>
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
                const idx = virtualRow.index;
                const number = idx + 1;

                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`
                    }}
                  >
                    {idx < featuredCount ? (
                      <FeaturedEntry entry={livesLost[idx]} number={number} />
                    ) : records ? (
                      <DataEntry
                        index={idx - featuredCount}
                        record={records[idx - featuredCount]}
                        number={number}
                        onRemember={handleRemember}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── End ── */}
        <div className='mx-auto max-w-4xl px-6 py-16 md:px-12'>
          <div className='border-t border-zinc-800 pt-12'>
            <div className='font-[family-name:var(--font-playfair)] text-6xl font-normal text-white tabular-nums md:text-8xl'>
              {totalEntries.toLocaleString()}
            </div>
            <p className='mt-6 text-lg leading-relaxed text-zinc-400'>
              {error
                ? 'Showing documented highlights while the full registry dataset is unavailable.'
                : 'You just scrolled past every one of them.'}
            </p>

            <p className='mt-4 font-mono text-xs text-zinc-400 tabular-nums'>
              Across all theaters, the documented toll stands at{' '}
              {casualties.documentedKilled.toLocaleString()} killed
              (registry-anchored), plus{' '}
              {casualties.estimatedKilled.toLocaleString()} model-estimated
              deaths in theaters without registries —{' '}
              {casualties.totalKilled.toLocaleString()} in total.
            </p>

            <div className='mt-10 space-y-2 border-t border-zinc-900 pt-6 text-sm text-zinc-400'>
              <div className='font-bold text-zinc-300'>Sources</div>
              <div>
                <a
                  href='https://data.techforpalestine.org/docs/killed-in-gaza/'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-zinc-400 underline underline-offset-2 hover:text-zinc-200'
                >
                  Tech for Palestine —{' '}
                  {gazaCount ? `${gazaCount.toLocaleString()} ` : ''}identified
                  victims (Gaza)
                </a>
              </div>
              <div>
                <a
                  href='https://data.techforpalestine.org/docs/datasets/'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-zinc-400 underline underline-offset-2 hover:text-zinc-200'
                >
                  Tech for Palestine — West Bank daily casualties
                </a>
              </div>
              <div>
                <a
                  href='https://airwars.org/moh-list/'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-zinc-400 underline underline-offset-2 hover:text-zinc-200'
                >
                  Airwars — MoH identified victim list
                </a>
              </div>
              <div>
                <a
                  href='https://www.doctorswithoutborders.org/latest/remembering-our-colleagues-killed-gaza'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-zinc-400 underline underline-offset-2 hover:text-zinc-200'
                >
                  MSF — Staff killed in Gaza
                </a>
              </div>
              <div>
                <a
                  href='https://cpj.org/2024/05/journalist-casualties-in-the-israel-gaza-conflict/'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-zinc-400 underline underline-offset-2 hover:text-zinc-200'
                >
                  CPJ — Journalist casualties
                </a>
              </div>
              <div>
                <a
                  href='https://www.unrwa.org/resources/reports/unrwa-situation-report'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-zinc-400 underline underline-offset-2 hover:text-zinc-200'
                >
                  UNRWA — Staff and teacher casualties
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Submit memory FAB */}
      <button
        type='button'
        onClick={() => {
          setSubmitEntry(undefined);
          setSubmitOpen(true);
        }}
        className='absolute right-4 bottom-4 z-20 flex cursor-pointer items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900/90 px-4 py-2.5 shadow-lg backdrop-blur-sm transition-colors hover:bg-zinc-800'
        aria-label='Submit a memory'
      >
        <IconHeart className='h-4 w-4 text-zinc-200' />
        <span className='text-sm font-medium text-zinc-200'>
          Remember someone
        </span>
      </button>

      <SubmitDialog
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        entryNumber={submitEntry}
      />
    </div>
  );
}
