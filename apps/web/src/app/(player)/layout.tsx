import type { ReactNode } from 'react';

import { PlayerLayout } from '@/components/shell/player-layout';

export default function Layout({ children }: { children: ReactNode }) {
  return <PlayerLayout>{children}</PlayerLayout>;
}
