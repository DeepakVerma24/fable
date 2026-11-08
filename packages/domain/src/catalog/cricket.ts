import type { DemoEvent, DemoMarket } from './sports';

/** Configuration only: named competitions do not imply a provider feed or fixtures. */
export const CRICKET_COMPETITIONS = [
  'Fable T20 Showcase',
  'Fable ODI Series',
  'Fable Test Series',
  'Fable T10 Showcase',
  'Indian Premier League (IPL)',
  "ICC Men's T20 World Cup",
  'ICC Cricket World Cup',
  'ICC Champions Trophy',
  'The Ashes',
  'Big Bash League (BBL)',
  'Pakistan Super League (PSL)',
  'SA20',
  'Caribbean Premier League (CPL)',
  'International bilateral series',
  'Domestic T20',
  'Domestic ODI',
  'Domestic Test',
] as const;

const unavailableNames = [
  'Toss Winner',
  'Total Match Runs Over/Under',
  'Team Total Runs',
  'First Innings Total',
  'Most Sixes',
  'Most Fours',
  'Powerplay Runs',
  'First Over Runs',
  'Top Team Run Scorer',
  'Top Team Wicket Taker',
  'Highest Opening Partnership',
  'Fall of First Wicket',
  'Player Performance Markets',
];
function markets(id: string, teams: readonly [string, string], closed = false): DemoMarket[] {
  return [
    {
      id: `${id}-winner`,
      name: 'Match Winner',
      group: 'Main markets',
      status: closed ? 'closed' : 'open',
      selections: teams.map((name, index) => ({
        id: `${id}-winner-${index === 0 ? 'home' : 'away'}`,
        name,
        decimalOdds: index === 0 ? '1.85' : '2.05',
        suspended: closed,
      })),
    },
    ...unavailableNames.map((name, index): DemoMarket => ({
      id: `${id}-preview-${index}`,
      name,
      group: index > 7 ? 'Player markets' : 'Innings & match markets',
      status: 'unavailable',
      selections: [],
      unavailableReason:
        'Unavailable for placement: no validated settlement support for this market. No price is offered.',
    })),
  ];
}
const teams = ['Ivory XI', 'Emerald XI'] as const;
export const CRICKET_EVENTS: readonly DemoEvent[] = [
  {
    id: 'crk-ivory-t20',
    sport: 'cricket',
    competition: 'Fable T20 Showcase',
    name: 'Ivory XI vs Emerald XI',
    participants: teams,
    phase: 'demo-live',
    popular: true,
    scheduleLabel: 'Simulated in-play · frozen score, not a live feed',
    venue: 'Fable Oval (fictional)',
    scheduledAt: '2026-11-04T09:00:00Z',
    markets: markets('crk-ivory-t20', teams),
    cricket: {
      format: 'T20',
      currentInnings: 2,
      target: 177,
      inningsBallLimit: 120,
      innings: [
        { team: 'Ivory XI', runs: 176, wickets: 6, legalBalls: 120 },
        {
          team: 'Emerald XI',
          runs: 170,
          wickets: 5,
          legalBalls: 119,
          batting: [
            { name: 'E. Vale', runs: 67, balls: 43, fours: 6, sixes: 2, dismissal: 'not out' },
            { name: 'R. Moss', runs: 18, balls: 11, fours: 2, sixes: 0, dismissal: 'not out' },
          ],
          bowling: [{ name: 'A. Reed', legalBalls: 23, maidens: 0, runs: 31, wickets: 2 }],
        },
      ],
    },
  },
  {
    id: 'crk-harbor-odi',
    sport: 'cricket',
    competition: 'Fable ODI Series',
    name: 'Harbor XI vs Orchard XI',
    participants: ['Harbor XI', 'Orchard XI'],
    phase: 'upcoming',
    popular: false,
    scheduleLabel: 'Simulated scheduled fixture · illustrative date only',
    scheduledAt: '2027-01-10T08:00:00Z',
    venue: 'Orchard Ground (fictional)',
    cricket: { format: 'ODI', innings: [], inningsBallLimit: 300 },
    markets: markets('crk-harbor-odi', ['Harbor XI', 'Orchard XI']),
  },
  {
    id: 'crk-archive-test',
    sport: 'cricket',
    competition: 'Fable Test Series',
    name: 'Archive XI vs Pavilion XI',
    participants: ['Archive XI', 'Pavilion XI'],
    phase: 'completed',
    popular: false,
    scheduleLabel: 'Completed simulated fixture · not an actual sports result',
    scheduledAt: '2026-10-01T09:00:00Z',
    venue: 'Archive Ground (fictional)',
    result: 'Archive XI won by 75 runs (simulated)',
    cricket: {
      format: 'Test',
      currentInnings: 4,
      target: 286,
      innings: [
        { team: 'Archive XI', runs: 320, wickets: 10, legalBalls: 540 },
        { team: 'Pavilion XI', runs: 285, wickets: 10, legalBalls: 510 },
        { team: 'Archive XI', runs: 250, wickets: 7, legalBalls: 420 },
        { team: 'Pavilion XI', runs: 210, wickets: 10, legalBalls: 439 },
      ],
    },
    markets: markets('crk-archive-test', ['Archive XI', 'Pavilion XI'], true),
  },
  {
    id: 'crk-coast-t10',
    sport: 'cricket',
    competition: 'Fable T10 Showcase',
    name: 'Coast XI vs Meadow XI',
    participants: ['Coast XI', 'Meadow XI'],
    phase: 'upcoming',
    popular: false,
    scheduleLabel: 'Simulated fixture · match winner suspended',
    cricket: { format: 'T10', innings: [], inningsBallLimit: 60 },
    markets: markets('crk-coast-t10', ['Coast XI', 'Meadow XI']).map((market) =>
      market.status === 'open'
        ? {
            ...market,
            status: 'suspended',
            selections: market.selections.map((selection) => ({ ...selection, suspended: true })),
          }
        : market,
    ),
  },
];
