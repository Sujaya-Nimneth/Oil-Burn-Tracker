'use client';

import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

type BreadcrumbItem = {
  title: string;
  link: string;
};

const ROUTE_MAPPING: Record<string, BreadcrumbItem[]> = {
  '/dashboard': [{ title: 'OilBurnTracker', link: '/dashboard/overview' }],
  '/dashboard/overview': [
    { title: 'OilBurnTracker', link: '/dashboard/overview' },
    { title: 'Live Map & Feed', link: '/dashboard/overview' }
  ],
  '/dashboard/fires': [
    { title: 'OilBurnTracker', link: '/dashboard/overview' },
    { title: 'Fire & Facility List', link: '/dashboard/fires' }
  ],
  '/dashboard/impact': [
    { title: 'OilBurnTracker', link: '/dashboard/overview' },
    { title: 'Consumer Impact', link: '/dashboard/impact' }
  ],
  '/dashboard/timeline': [
    { title: 'OilBurnTracker', link: '/dashboard/overview' },
    { title: 'Emissions', link: '/dashboard/timeline' }
  ],
  '/dashboard/lost': [
    { title: 'OilBurnTracker', link: '/dashboard/overview' },
    { title: 'What We Lost', link: '/dashboard/lost' }
  ],
  '/dashboard/about': [
    { title: 'OilBurnTracker', link: '/dashboard/overview' },
    { title: 'About', link: '/dashboard/about' }
  ]
};

export function useBreadcrumbs() {
  const pathname = usePathname();

  return useMemo(() => {
    const normalized =
      pathname.length > 1 && pathname.endsWith('/')
        ? pathname.slice(0, -1)
        : pathname;

    if (ROUTE_MAPPING[normalized]) {
      return ROUTE_MAPPING[normalized];
    }

    const segments = normalized.split('/').filter(Boolean);
    return segments.map((segment, index) => {
      const path = `/${segments.slice(0, index + 1).join('/')}`;
      return {
        title: segment.charAt(0).toUpperCase() + segment.slice(1),
        link: path
      };
    });
  }, [pathname]);
}
