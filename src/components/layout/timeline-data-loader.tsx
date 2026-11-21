'use client';

import { useEffect } from 'react';
import { useTimelineData } from '@/stores/events-store';
import { useFireStore } from '@/stores/fire-store';

/**
 * Mounts the runtime timeline-data fetch and client timeline-date hydration
 * once for every dashboard page. Renders nothing — the hydrated stores drive
 * the timeline UI without SSR hydration mismatches.
 */
export default function TimelineDataLoader() {
  useTimelineData();
  const hydrateTimelineDate = useFireStore((s) => s.hydrateTimelineDate);

  useEffect(() => {
    hydrateTimelineDate();
  }, [hydrateTimelineDate]);

  return null;
}
