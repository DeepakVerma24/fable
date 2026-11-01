import type { Metadata } from 'next';

import { CasinoBrowser } from '@/components/casino/casino-browser';

export const metadata: Metadata = { title: 'Live Casino' };

export default function LiveCasinoPage() {
  return <CasinoBrowser title="Live casino" lockedCategory="live" />;
}
