import type { Metadata } from 'next';

import { CasinoBrowser } from '@/components/casino/casino-browser';

export const metadata: Metadata = { title: 'Slots' };

export default function SlotsPage() {
  return <CasinoBrowser title="Slots" lockedCategory="slots" />;
}
