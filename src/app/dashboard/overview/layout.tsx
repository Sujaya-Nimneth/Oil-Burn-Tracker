import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Live Map & Conflict Feed',
  description:
    'Interactive 3D satellite map, NASA FIRMS fire detections, conflict timeline feed, and real-time energy disruption analysis.'
};

export default function OverviewLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return children;
}
