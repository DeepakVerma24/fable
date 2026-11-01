/**
 * Module map for the modular monolith.
 * Casino and sportsbook are not allowed to change balances.
 * Only the ledger records journals, and every journal in this foundation is simulated.
 */
export const moduleBoundaries = [
  {
    name: 'identity',
    role: 'Player directory. Password hashes only, never a raw password. Does not change balances.',
    authoritativeForBalances: false,
    mutatesBalances: false,
  },
  {
    name: 'ledger',
    role: 'Authoritative double-entry journal. The only module that records balance changes.',
    authoritativeForBalances: true,
    mutatesBalances: true,
  },
  {
    name: 'casino',
    role: 'Submits simulated settlement journals to the ledger. It does not change balances itself.',
    authoritativeForBalances: false,
    mutatesBalances: false,
  },
  {
    name: 'sportsbook',
    role: 'Submits simulated reservation and settlement journals to the ledger. It does not change balances itself.',
    authoritativeForBalances: false,
    mutatesBalances: false,
  },
  {
    name: 'providers',
    role: 'Mock provider adapters. No live casino or sports data providers are connected.',
    authoritativeForBalances: false,
    mutatesBalances: false,
  },
] as const;

export type ModuleBoundary = (typeof moduleBoundaries)[number];

export const JOB_QUEUE_NAME = 'fable.jobs';
export const PLATFORM_PING_JOB = 'platform.ping';
