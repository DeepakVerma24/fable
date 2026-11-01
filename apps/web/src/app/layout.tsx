import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import { Providers } from '@/components/providers';

import './globals.css';

const sans = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
});

const mono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  title: {
    default: 'FABLE',
    template: '%s · FABLE',
  },
  description:
    'FABLE player lobby. Casino previews and sportsbook fixtures use simulated Fable demo units. No real-money wagering.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} dark h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
