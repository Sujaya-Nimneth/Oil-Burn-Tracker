import type { MetadataRoute } from 'next';

// Required for output: 'export' — the sitemap route must be fully static.
export const dynamic = 'force-static';

// Canonical deployment — keep in sync with SITE_URL in src/app/layout.tsx
// and the Sitemap line in public/robots.txt.
const SITE_URL = 'https://monitor-the-war.pages.dev';

// Content routes only: / and /dashboard are client-side redirects to
// /dashboard/overview, so listing them would create duplicate entries.
const CONTENT_ROUTES = [
  '/dashboard/overview',
  '/dashboard/fires',
  '/dashboard/timeline',
  '/dashboard/impact',
  '/dashboard/lost',
  '/dashboard/about'
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return CONTENT_ROUTES.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: route === '/dashboard/overview' ? 1 : 0.7
  }));
}
