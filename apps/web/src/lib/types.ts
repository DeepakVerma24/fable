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
  playable: boolean;
  originalKind?: 'dice' | 'mines' | 'plinko' | 'limbo';
  rules?: readonly string[];
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
  selections: readonly DemoSelection[];
  status?: 'open' | 'suspended' | 'closed' | 'unavailable';
  group?: string;
  unavailableReason?: string;
}

export interface DemoEvent {
  id: string;
  sport: string;
  competition: string;
  name: string;
  participants: readonly [string, string];
  /** Shown instead of a clock. These fixtures are not a live feed. */
  scheduleLabel: string;
  phase: 'upcoming' | 'demo-live' | 'completed';
  scheduledAt?: string;
  venue?: string;
  result?: string;
  cricket?: CricketMatch;
  score?: { label: string; values: readonly [string, string]; detail: string };
  popular: boolean;
  markets: readonly DemoMarket[];
}

export interface DemoSport {
  slug: string;
  name: string;
  competitions: readonly string[];
}

export interface CricketInnings {
  team: string;
  runs: number;
  wickets: number;
  legalBalls: number;
  batting?: readonly {
    name: string;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    dismissal: string;
  }[];
  bowling?: readonly {
    name: string;
    legalBalls: number;
    maidens: number;
    runs: number;
    wickets: number;
  }[];
}

export interface CricketMatch {
  format: 'T20' | 'ODI' | 'Test' | 'T10' | 'Other';
  currentInnings?: number;
  innings: readonly CricketInnings[];
  target?: number;
  inningsBallLimit?: number;
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
  status: 'accepted' | 'settled' | 'cancelled' | 'refunded';
  eventId: string;
  selectionId: string;
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
