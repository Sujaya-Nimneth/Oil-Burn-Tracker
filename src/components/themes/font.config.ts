import { Geist, Geist_Mono, Playfair_Display } from 'next/font/google';

import { cn } from '@/lib/utils';

const fontSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans'
});

const fontMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono'
});

const fontPlayfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-playfair'
});

export const fontVariables = cn(
  fontSans.variable,
  fontMono.variable,
  fontPlayfair.variable
);
