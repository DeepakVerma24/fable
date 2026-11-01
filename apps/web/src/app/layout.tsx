import type { Metadata } from 'next';
import { Fraunces, Geist_Mono, Outfit } from 'next/font/google';

import { Providers } from '@/components/providers';

import './globals.css';

const sans = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
});

const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
});

const mono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  title: 'FABLE foundation',
  description:
    'Simulated platform foundation for the FABLE modular monolith. No real-money transactions.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${display.variable} ${mono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
