import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Consumer Impact',
  description:
    'Household-level impact of Middle East energy infrastructure disruption on gas prices, groceries, utilities, and global shipping.'
};

export default function ImpactLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return children;
}
