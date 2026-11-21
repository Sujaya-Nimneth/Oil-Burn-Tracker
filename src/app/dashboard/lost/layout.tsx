import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'What We Lost — Memorial',
  description:
    'A virtualized memorial documenting tens of thousands of identified lives lost across Gaza, West Bank, Lebanon, and Israel.'
};

export default function LostLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return children;
}
