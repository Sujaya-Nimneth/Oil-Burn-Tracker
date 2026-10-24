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

/* ── Data loader ── */
function useMemorialData() {
  const [data, setData] = useState<MemorialRecord[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/memorial-data.json')
      .then((r) => r.json())
      .then((d: MemorialData) => {
        setData(
          d.records.map(([age, sex, region, date]) => ({
            age,
            sex,
            region,
            date
          }))
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return { data, loading };
}

/* ── Saved position ── */
function getSavedIndex(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v ? parseInt(v, 10) : 0;
  } catch {
    return 0;
  }
}

function saveIndex(index: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(index));
  } catch {}
}

function formatDate(d: string): string {
  if (!d) return '';
  try {
    const date = new Date(d + 'T00:00:00');
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
            <span className='mt-0.5 shrink-0 text-base opacity-20' aria-hidden>
              {CATEGORY_ICONS[entry.category]}
            </span>
            <div>
              <div className='text-xl leading-snug font-bold text-white md:text-2xl'>
                {entry.humanity}
              </div>
            </div>
          </div>
          <div className='mt-2 ml-7 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-600'>
            {entry.age !== undefined && (
              <span className='tabular-nums'>
                {entry.age === 0
                  ? 'Newborn'
                  : entry.age === 1
                    ? '1 year old'
                    : `Age ${entry.age}`}
              </span>
            )}
            <span>{entry.region}</span>
            {entry.source && (
              <>
                <span className='text-zinc-800'>·</span>
                {entry.sourceUrl ? (
                  <a
                    href={entry.sourceUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-zinc-500 underline underline-offset-2 transition-colors hover:text-zinc-300'
                  >
                    {entry.source}
                  </a>
                ) : (
                  <span className='text-zinc-600'>{entry.source}</span>
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
          <span className='font-[family-name:var(--font-playfair)] text-2xl font-normal text-zinc-500 tabular-nums md:text-3xl'>
            {number.toLocaleString()}
          </span>
        </div>
        <div className='min-w-0 flex-1'>
          <div className='text-xl leading-snug text-zinc-300 md:text-2xl'>
            {entry.humanity}
          </div>
          <div className='mt-1 flex flex-wrap items-center gap-x-2 text-xs text-zinc-700 tabular-nums'>
            <span>
              {record.age === 0
                ? 'Newborn'
                : record.age === 1
                  ? '1 year old'
                  : `Age ${record.age}`}
            </span>
            <span className='text-zinc-800'>·</span>
            <span>{regionName}</span>
            {dateStr && (
              <>
                <span className='text-zinc-800'>·</span>
                <span>{dateStr}</span>
              </>
            )}
            <span className='text-zinc-800'>·</span>
            <button
              onClick={() => onRemember(number)}
              className='cursor-pointer text-zinc-600 transition-colors hover:text-zinc-300'
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
  const eventsWithTelemetry = useEventsStore((s) => s.eventsWithTelemetry);
  const casualtyAnchors = useEventsStore((s) => s.casualtyAnchors);
  const casualties = useMemo(
    () =>
      getCasualtiesUpTo(
        eventsWithTelemetry,
        casualtyAnchors,
        new Date().toISOString().slice(0, 10)
      ),
    [eventsWithTelemetry, casualtyAnchors]
  );
  const total = casualties.totalKilled;
  const { data: records, loading } = useMemorialData();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [restored, setRestored] = useState(false);

  const featuredCount = livesLost.length;
  const datasetCount = records?.length ?? 0;
  const totalEntries = featuredCount + datasetCount;

  const virtualizer = useVirtualizer({
    count: totalEntries,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (i < featuredCount ? 130 : 95),
    overscan: 40
  });

  // Track furthest read position
  const [currentIndex, setCurrentIndex] = useState(0);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitEntry, setSubmitEntry] = useState<number | undefined>();

  const handleRemember = useCallback((n: number) => {
    setSubmitEntry(n);
    setSubmitOpen(true);
  }, []);
  const endIndex = virtualizer.range?.endIndex;
  useEffect(() => {
    if (endIndex !== undefined) {
      const last = endIndex + 1;
      setCurrentIndex(last);
      const saved = getSavedIndex();
      if (last > saved) saveIndex(last);
    }
  }, [endIndex]);

  // Restore scroll position on load
  useEffect(() => {
    if (loading || restored || !records) return;
    const saved = getSavedIndex();
    if (saved > 10) {
      setTimeout(() => {
        virtualizer.scrollToIndex(saved - 5, { align: 'start' });
      }, 100);
    }
    setRestored(true);
  }, [loading, restored, records, virtualizer]);

  return (
    <div className='relative h-[calc(100dvh-64px)] w-full bg-black'>
      <div className='h-full overflow-y-auto' ref={scrollRef}>
        {/* ── Sticky counter ── */}
        <div className='sticky top-0 z-10 border-b border-zinc-900/50 bg-black/90 backdrop-blur-sm'>
          <div className='mx-auto flex max-w-4xl items-center justify-between px-6 py-1.5 md:px-12'>
            <button
              onClick={() =>
                scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' })
              }
              className='cursor-pointer font-mono text-sm text-zinc-400 tabular-nums transition-colors hover:text-zinc-200'
            >
              {Math.min(currentIndex, totalEntries).toLocaleString()} of{' '}
              {totalEntries.toLocaleString()}
            </button>
            {getSavedIndex() > 10 && currentIndex < totalEntries - 100 && (
              <span className='text-xs text-zinc-700'>progress saved</span>
            )}
          </div>
        </div>

        {/* ── Virtualized list ── */}
        <div className='mx-auto max-w-4xl px-6 md:px-12'>
          {loading ? (
            <div className='py-20 text-center font-mono text-sm text-zinc-700'>
              <div>{total.toLocaleString()} people</div>
              <div className='mt-1 text-xs text-zinc-600'>
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
            <p className='mt-6 text-lg leading-relaxed text-zinc-500'>
              You just scrolled past every one of them.
            </p>

            <p className='mt-4 font-mono text-xs text-zinc-700 tabular-nums'>
              Across all theaters, the documented toll stands at{' '}
              {casualties.documentedKilled.toLocaleString()} killed
              (registry-anchored), plus{' '}
              {casualties.estimatedKilled.toLocaleString()} model-estimated
              deaths in theaters without registries —{' '}
              {casualties.totalKilled.toLocaleString()} in total.
            </p>

            <div className='mt-10 space-y-2 border-t border-zinc-900 pt-6 text-sm text-zinc-700'>
              <div className='font-bold text-zinc-600'>Sources</div>
              <div>
                <a
                  href='https://data.techforpalestine.org/docs/killed-in-gaza/'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-zinc-600 underline underline-offset-2 hover:text-zinc-300'
                >
                  Tech for Palestine — 60,199 identified victims (Gaza)
                </a>
              </div>
              <div>
                <a
                  href='https://data.techforpalestine.org/docs/datasets/'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-zinc-600 underline underline-offset-2 hover:text-zinc-300'
                >
                  Tech for Palestine — West Bank daily casualties
                </a>
              </div>
              <div>
                <a
                  href='https://airwars.org/moh-list/'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-zinc-600 underline underline-offset-2 hover:text-zinc-300'
                >
                  Airwars — MoH identified victim list
                </a>
              </div>
              <div>
                <a
                  href='https://www.doctorswithoutborders.org/latest/remembering-our-colleagues-killed-gaza'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-zinc-600 underline underline-offset-2 hover:text-zinc-300'
                >
                  MSF — Staff killed in Gaza
                </a>
              </div>
              <div>
                <a
                  href='https://cpj.org/2024/05/journalist-casualties-in-the-israel-gaza-conflict/'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-zinc-600 underline underline-offset-2 hover:text-zinc-300'
                >
                  CPJ — Journalist casualties
                </a>
              </div>
              <div>
                <a
                  href='https://www.unrwa.org/resources/reports/unrwa-situation-report'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-zinc-600 underline underline-offset-2 hover:text-zinc-300'
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
        onClick={() => {
          setSubmitEntry(undefined);
          setSubmitOpen(true);
        }}
        className='absolute right-4 bottom-4 z-20 flex cursor-pointer items-center gap-1.5 rounded-full border border-zinc-700 bg-white/10 px-4 py-2.5 shadow-lg transition-colors hover:bg-white/20'
        aria-label='Submit a memory'
      >
        <IconHeart className='h-4 w-4 text-zinc-300' />
        <span className='text-sm font-medium text-zinc-300'>
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
