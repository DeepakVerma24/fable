import { CRICKET_EVENTS, CRICKET_COMPETITIONS } from './cricket';

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

export const DEMO_SPORTS: readonly DemoSport[] = [
  { slug: 'cricket', name: 'Cricket', competitions: CRICKET_COMPETITIONS },
  { slug: 'football', name: 'Football', competitions: ['Harbor Cup', 'Paper League'] },
  { slug: 'basketball', name: 'Basketball', competitions: ['Quiet Conference'] },
  { slug: 'tennis', name: 'Tennis', competitions: ['Indoor Series'] },
  { slug: 'baseball', name: 'Baseball', competitions: ['Pier League'] },
  { slug: 'hockey', name: 'Hockey', competitions: ['Glasshouse'] },
];

export const DEMO_EVENTS: readonly DemoEvent[] = [
  {
    id: 'fbl-north-harbor',
    sport: 'football',
    competition: 'Harbor Cup',
    name: 'North Harbor vs West Signal',
    participants: ['North Harbor', 'West Signal'],
    scheduleLabel: 'Demo fixture · not a live clock',
    phase: 'upcoming',
    popular: true,
    markets: [
      market('fbl-north-harbor-result', 'Match result', [
        ['home', 'North Harbor', '1.91', false],
        ['draw', 'Draw', '3.40', false],
        ['away', 'West Signal', '4.20', false],
      ]),
      market('fbl-north-harbor-total', 'Total goals 2.5', [
        ['over', 'Over 2.5', '1.83', false],
        ['under', 'Under 2.5', '1.97', false],
      ]),
    ],
  },
  {
    score: {
      label: 'Goals',
      values: ['1', '1'],
      detail: 'Simulated second half · frozen score snapshot',
    },
    id: 'fbl-paper-city',
    sport: 'football',
    competition: 'Paper League',
    name: 'Paper City vs Old Line',
    participants: ['Paper City', 'Old Line'],
    scheduleLabel: 'Simulated in-play · not a live feed',
    phase: 'demo-live',
    popular: true,
    markets: [
      market('fbl-paper-city-result', 'Match result', [
        ['home', 'Paper City', '2.10', false],
        ['draw', 'Draw', '3.10', false],
        ['away', 'Old Line', '3.60', false],
      ]),
    ],
  },
  {
    id: 'bsk-quiet-court',
    sport: 'basketball',
    competition: 'Quiet Conference',
    name: 'Quiet Court vs Lampblack',
    participants: ['Quiet Court', 'Lampblack'],
    scheduleLabel: 'Demo fixture · not a live clock',
    phase: 'upcoming',
    popular: true,
    markets: [
      market('bsk-quiet-court-winner', 'Moneyline', [
        ['home', 'Quiet Court', '1.74', false],
        ['away', 'Lampblack', '2.15', false],
      ]),
      market('bsk-quiet-court-total', 'Total points 208.5', [
        ['over', 'Over 208.5', '1.90', false],
        ['under', 'Under 208.5', '1.90', false],
      ]),
    ],
  },
  {
    score: {
      label: 'Points',
      values: ['78', '74'],
      detail: 'Simulated third quarter · frozen score snapshot',
    },
    id: 'bsk-archive',
    sport: 'basketball',
    competition: 'Quiet Conference',
    name: 'Archive vs Lower Bowl',
    participants: ['Archive', 'Lower Bowl'],
    scheduleLabel: 'Simulated in-play · market suspended',
    phase: 'demo-live',
    popular: false,
    markets: [
      market('bsk-archive-winner', 'Moneyline', [
        ['home', 'Archive', '1.66', true],
        ['away', 'Lower Bowl', '2.25', true],
      ]),
    ],
  },
  {
    id: 'ten-lane',
    sport: 'tennis',
    competition: 'Indoor Series',
    name: 'Lane vs Morrow',
    participants: ['A. Lane', 'S. Morrow'],
    scheduleLabel: 'Demo fixture · not a live clock',
    phase: 'upcoming',
    popular: true,
    markets: [
      market('ten-lane-winner', 'Match winner', [
        ['home', 'A. Lane', '1.62', false],
        ['away', 'S. Morrow', '2.30', false],
      ]),
    ],
  },
  {
    score: {
      label: 'Sets',
      values: ['1', '0'],
      detail: 'Simulated sets: 6–4, 3–2 · frozen score snapshot',
    },
    id: 'ten-glass',
    sport: 'tennis',
    competition: 'Indoor Series',
    name: 'Voss vs Keel',
    participants: ['M. Voss', 'R. Keel'],
    scheduleLabel: 'Simulated in-play · not a live feed',
    phase: 'demo-live',
    popular: false,
    markets: [
      market('ten-glass-winner', 'Match winner', [
        ['home', 'M. Voss', '1.48', false],
        ['away', 'R. Keel', '2.62', false],
      ]),
    ],
  },
  {
    id: 'bsb-kiln',
    sport: 'baseball',
    competition: 'Pier League',
    name: 'Kiln vs South Pier',
    participants: ['Kiln', 'South Pier'],
    scheduleLabel: 'Demo fixture · not a live clock',
    phase: 'upcoming',
    popular: false,
    markets: [
      market('bsb-kiln-winner', 'Moneyline', [
        ['home', 'Kiln', '1.87', false],
        ['away', 'South Pier', '1.95', false],
      ]),
    ],
  },
  {
    id: 'hky-glass',
    sport: 'hockey',
    competition: 'Glasshouse',
    name: 'Glasshouse vs Red Docket',
    participants: ['Glasshouse', 'Red Docket'],
    scheduleLabel: 'Demo fixture · not a live clock',
    phase: 'upcoming',
    popular: true,
    markets: [
      market('hky-glass-result', 'Match result', [
        ['home', 'Glasshouse', '2.05', false],
        ['draw', 'Draw', '3.70', false],
        ['away', 'Red Docket', '2.45', false],
      ]),
    ],
  },
  ...CRICKET_EVENTS,
];

function market(
  id: string,
  name: string,
  rows: readonly (readonly [string, string, string, boolean])[],
): DemoMarket {
  return {
    id,
    name,
    selections: rows.map(([suffix, label, odds, suspended]) => ({
      id: `${id}-${suffix}`,
      name: label,
      decimalOdds: odds,
      suspended,
    })),
  };
}

export interface QuotedSelection {
  event: DemoEvent;
  market: DemoMarket;
  selection: DemoSelection;
}

export function sportBySlug(slug: string): DemoSport | null {
  return DEMO_SPORTS.find((sport) => sport.slug === slug) ?? null;
}

export function eventsForSport(slug: string, competition?: string): readonly DemoEvent[] {
  return DEMO_EVENTS.filter((event) => {
    if (event.sport !== slug) return false;
    if (competition && event.competition !== competition) return false;
    return true;
  });
}

export function eventById(id: string): DemoEvent | null {
  return DEMO_EVENTS.find((event) => event.id === id) ?? null;
}

export function quoteSelection(selectionId: string): QuotedSelection | null {
  for (const event of DEMO_EVENTS) {
    if (event.phase === 'completed') continue;
    for (const marketRow of event.markets) {
      if (marketRow.status && marketRow.status !== 'open') continue;
      const selection = marketRow.selections.find((item) => item.id === selectionId);
      if (selection) return { event, market: marketRow, selection };
    }
  }
  return null;
}
