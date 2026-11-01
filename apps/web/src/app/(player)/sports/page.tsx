import { Suspense } from 'react';
import type { Metadata } from 'next';

import { SportsHome } from '@/components/sports/sports-home';
import { LoadingSkeleton } from '@/components/states';

export const metadata: Metadata = { title: 'Sports' };

export default function SportsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <SportsHome />
    </Suspense>
  );
}
