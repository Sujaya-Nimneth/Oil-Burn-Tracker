'use client';

import { useTimelineData } from '@/stores/events-store';

/**
 * Mounts the runtime timeline-data fetch once for every dashboard page.
 * Renders nothing — the hydrated store drives the timeline UI.
 */
export default function TimelineDataLoader() {
  useTimelineData();
  return null;
}
