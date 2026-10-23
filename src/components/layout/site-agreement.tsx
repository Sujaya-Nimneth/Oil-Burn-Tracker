'use client';

import { useState, useEffect } from 'react';
import { IconX } from '@tabler/icons-react';

const STORAGE_KEY = 'obt-agreement-v1';

export default function SiteAgreement() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const agreed = localStorage.getItem(STORAGE_KEY);
    if (!agreed) setVisible(true);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, '1');
  };

  return (
    <div className='fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm'>
      <div className='relative mx-4 max-w-lg rounded-xl border border-zinc-700 bg-zinc-950 p-6 shadow-2xl md:p-8'>
        <button
          onClick={dismiss}
          className='absolute top-4 right-4 cursor-pointer text-zinc-500 transition-colors hover:text-white'
          aria-label='Close and agree'
        >
          <IconX className='h-5 w-5' />
        </button>

        <h2 className='text-2xl font-black text-white'>OilBurnTracker</h2>
        <p className='mt-1 text-sm text-zinc-500'>
          Open source conflict impact analysis
        </p>

        <div className='mt-5 space-y-3 text-sm leading-relaxed text-zinc-400'>
          <p>
            This site tracks the real-world impact of ongoing conflicts using
            verified, open-source data. Every number comes from a documented
            source — satellite imagery, government reports, UN agencies, or
            international press.
          </p>
          <p>
            We cover all sides. We don&apos;t pick one. The data includes
            casualties from Gaza, Israel, Lebanon, the West Bank, and Iran.
            Facility damage, emissions estimates, and economic impact are
            derived from publicly available datasets.
          </p>
          <p className='text-zinc-300'>
            This site contains graphic descriptions of war casualties, including
            children and infants. The memorial section documents over 60,000
            identified victims by what they were to the world — not by name.
          </p>
        </div>

        <div className='mt-5 border-t border-zinc-800 pt-4'>
          <a
            href='https://github.com/Sujaya-Nimneth/Oil-Burn-Tracker'
            target='_blank'
            rel='noopener noreferrer'
            className='group flex items-center gap-3 rounded-lg border border-zinc-800 p-3 transition-colors hover:border-zinc-600'
          >
            <svg
              viewBox='0 0 24 24'
              className='h-6 w-6 shrink-0 text-zinc-500 transition-colors group-hover:text-white'
              fill='currentColor'
            >
              <path d='M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z' />
            </svg>
            <div>
              <div className='text-sm font-bold text-zinc-300 transition-colors group-hover:text-white'>
                This project is open source
              </div>
              <div className='text-xs text-zinc-600'>
                View the source code, add a memorial entry, or open an issue on
                GitHub
              </div>
            </div>
          </a>
          <p className='mt-3 text-xs text-zinc-500'>
            Made by{' '}
            <span className='font-semibold text-zinc-300'>Sujaya Nimneth</span>
          </p>
          <p className='mt-1 text-xs text-zinc-700'>
            No accounts. No tracking. No cookies except to remember this.
          </p>
        </div>

        <p className='mt-4 text-center text-[11px] text-zinc-700'>
          Close to continue
        </p>
      </div>
    </div>
  );
}
