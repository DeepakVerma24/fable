export interface PublicPlayer {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface SessionResponse {
  player: PublicPlayer;
  expiresAt: string;
  simulated: true;
}

export interface DemoGame {
  id: string;
  name: string;
  categories: string[];
  provider: string;
  playable: false;
  demo: true;
  summary: string;
  featured: boolean;
  recommended: boolean;
  popularity: number;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  simulated: true;
  demo: true;
}

export interface DemoSelection {
  id: string;
  name: string;
  decimalOdds: string;
  suspended: boolean;
}

export interface DemoMarket {
  id: string;
  name: string;
  selections: DemoSelection[];
}

export interface DemoEvent {
  id: string;
  sport: string;
  competition: string;
  name: string;
  participants: [string, string];
  scheduleLabel: string;
  phase: 'upcoming' | 'demo-live';
  popular: boolean;
  markets: DemoMarket[];
  liveFeed?: false;
}

export interface DemoSport {
  slug: string;
  name: string;
  competitions: string[];
}

export interface DemoPromotion {
  id: string;
  title: string;
  summary: string;
  detail: string;
  terms: string;
  demo: true;
  cashValue: false;
}

export interface WalletSummary {
  simulated: true;
  realMoney: false;
  withdrawable: false;
  currency: 'FBU';
  label: string;
  disclaimer: string;
  availableMinor: string;
  reservedMinor: string;
  totalMinor: string;
}

export interface WalletTransaction {
  id: string;
  reference: string;
  kind: string;
  status: 'posted';
  simulated: true;
  postedAt: string;
  description: string;
  amountMinor: string;
  currency: 'FBU';
}

export interface DemoBet {
  id: string;
  eventName: string;
  marketName: string;
  selectionName: string;
  decimalOdds: string;
  stakeMinor: string;
  payoutMinor: string;
  outcome: 'win' | 'loss';
  outcomeSource: 'deterministic-demo';
  status: 'settled';
  simulated: true;
  realMoney: false;
  note: string;
  createdAt: string;
}

export interface SearchHit {
  kind: 'game' | 'event';
  id: string;
  title: string;
  subtitle: string;
  href: string;
}
