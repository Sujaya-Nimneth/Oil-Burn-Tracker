'use client';

import { useState } from 'react';
import EventFeed from '@/features/timeline/components/event-feed';
import DeepDivePanel from './deep-dive-panel';
import { IconMap, IconNews, IconChartBar } from '@tabler/icons-react';

interface MobileTabsProps {
  onFlyTo: (lat: number, lng: number, zoom: number) => void;
  onMapMode: () => void;
}

export default function MobileTabs({ onFlyTo, onMapMode }: MobileTabsProps) {
  const [tab, setTab] = useState<'feed' | 'data'>('data');

  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      {/* Tab bar */}
      <div
        role='tablist'
        aria-label='Dashboard views'
        className='flex shrink-0 items-center border-b border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-950'
      >
        <button
          type='button'
          role='tab'
          aria-selected={tab === 'data'}
          aria-controls='mobile-panel-data'
          id='mobile-tab-data'
          onClick={() => setTab('data')}
          className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 py-2.5 text-sm font-bold transition-colors ${
            tab === 'data'
              ? 'border-b-2 border-red-600 text-gray-900 dark:border-orange-500 dark:text-zinc-100'
              : 'text-gray-500 dark:text-zinc-400'
          }`}
        >
          <IconChartBar className='h-4 w-4' />
          Data
        </button>
        <button
          type='button'
          role='tab'
          aria-selected={tab === 'feed'}
          aria-controls='mobile-panel-feed'
          id='mobile-tab-feed'
          onClick={() => setTab('feed')}
          className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 py-2.5 text-sm font-bold transition-colors ${
            tab === 'feed'
              ? 'border-b-2 border-red-600 text-gray-900 dark:border-orange-500 dark:text-zinc-100'
              : 'text-gray-500 dark:text-zinc-400'
          }`}
        >
          <IconNews className='h-4 w-4' />
          Feed
        </button>
        <button
          type='button'
          onClick={onMapMode}
          aria-label='Switch to interactive map view'
          className='cursor-pointer px-3 py-2.5 text-gray-500 hover:text-gray-800 dark:text-zinc-400 dark:hover:text-zinc-200'
        >
          <IconMap className='h-5 w-5' />
        </button>
      </div>

      {/* Tab content — preserve scroll state across tab switches */}
      <div className='relative min-h-0 flex-1'>
        <div
          id='mobile-panel-data'
          role='tabpanel'
          aria-labelledby='mobile-tab-data'
          className={`h-full ${tab === 'data' ? '' : 'hidden'}`}
        >
          <DeepDivePanel onMapMode={onMapMode} />
        </div>
        <div
          id='mobile-panel-feed'
          role='tabpanel'
          aria-labelledby='mobile-tab-feed'
          className={`h-full ${tab === 'feed' ? '' : 'hidden'}`}
        >
          <EventFeed onFlyTo={onFlyTo} fullPage />
        </div>
      </div>
    </div>
  );
}
