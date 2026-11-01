import type { Metadata } from 'next';

import { CasinoBrowser } from '@/components/casino/casino-browser';

export const metadata: Metadata = { title: 'Casino' };

export default function CasinoPage() {
  return <CasinoBrowser title="Casino lobby" />;
}
