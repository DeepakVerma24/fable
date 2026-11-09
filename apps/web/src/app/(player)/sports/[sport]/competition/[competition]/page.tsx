'use client';
import { use } from 'react';
import { SportsBrowser } from '@/components/sports/sports-browser';
export default function CompetitionPage({
  params,
}: {
  params: Promise<{ sport: string; competition: string }>;
}) {
  const { sport, competition } = use(params);
  let name = competition;
  try {
    name = decodeURIComponent(competition);
  } catch {
    /* Malformed paths are displayed as empty categories. */
  }
  return <SportsBrowser sport={sport} competition={name} />;
}
