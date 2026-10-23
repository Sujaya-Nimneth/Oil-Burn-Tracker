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
      <div className='flex shrink-0 items-center border-b border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-950'>
        <button
          onClick={() => setTab('data')}
          className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 py-2.5 text-sm font-bold transition-colors ${
            tab === 'data'
              ? 'border-b-2 border-red-600 text-gray-900 dark:border-orange-500 dark:text-zinc-100'
              : 'text-gray-400 dark:text-zinc-500'
          }`}
        >
          <IconChartBar className='h-4 w-4' />
          Data
        </button>
        <button
          onClick={() => setTab('feed')}
          className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 py-2.5 text-sm font-bold transition-colors ${
            tab === 'feed'
              ? 'border-b-2 border-red-600 text-gray-900 dark:border-orange-500 dark:text-zinc-100'
              : 'text-gray-400 dark:text-zinc-500'
          }`}
        >
          <IconNews className='h-4 w-4' />
          Feed
        </button>
        <button
          onClick={onMapMode}
          className='cursor-pointer px-3 py-2.5 text-gray-400 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-300'
        >
          <IconMap className='h-5 w-5' />
        </button>
      </div>

      {/* Tab content — use display:none so EventFeed observer stays mounted */}
      <div className='relative min-h-0 flex-1'>
        <div className={`h-full ${tab === 'data' ? '' : 'hidden'}`}>
          <DeepDivePanel onMapMode={onMapMode} />
        </div>
        <div className={`h-full ${tab === 'feed' ? '' : 'hidden'}`}>
          <EventFeed onFlyTo={onFlyTo} fullPage />
        </div>
      </div>
    </div>
  );
}
