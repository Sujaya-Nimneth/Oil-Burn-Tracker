import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Emissions Timeline',
  description:
    'Estimated daily CO₂ emissions from satellite-detected oil and gas facility fires, derived from NASA FIRMS VIIRS Fire Radiative Power.'
};

export default function TimelineLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return children;
}
