'use client';

import { Suspense, type ReactNode } from 'react';

import { AppShell } from '@/components/shell/app-shell';

export function PlayerLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
