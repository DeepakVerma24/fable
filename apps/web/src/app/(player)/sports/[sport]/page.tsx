'use client';
import { use } from 'react';
import { SportsBrowser } from '@/components/sports/sports-browser';
export default function SportPage({ params }: { params: Promise<{ sport: string }> }) {
  const { sport } = use(params);
  return <SportsBrowser sport={sport} />;
}
