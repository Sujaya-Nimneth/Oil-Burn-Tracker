import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Fire & Facility List',
  description:
    'Monitored Middle East oil and gas infrastructure, strike statuses, capacity at risk, and live NASA FIRMS thermal detections.'
};

export default function FiresLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return children;
}
