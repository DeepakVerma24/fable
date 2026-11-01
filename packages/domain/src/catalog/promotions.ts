export interface DemoPromotion {
  id: string;
  title: string;
  summary: string;
  detail: string;
  terms: string;
  demo: true;
  cashValue: false;
}

export const DEMO_PROMOTIONS: readonly DemoPromotion[] = [
  {
    id: 'opening-units',
    title: 'Opening demo units',
    summary: 'A new player directory entry receives 1,000.00 FBU once.',
    detail:
      'The grant is a simulated ledger adjustment. It is credited to the player wallet and debited to the house demo account.',
    terms: 'Demo only. No cash value. Units cannot be withdrawn or deposited.',
    demo: true,
    cashValue: false,
  },
  {
    id: 'preview-week',
    title: 'Preview week',
    summary: 'Casino tiles added this phase are original previews.',
    detail: 'Nothing in the lobby launches a third-party game client or streams a studio.',
    terms: 'Artwork is original. Titles are not licensed games.',
    demo: true,
    cashValue: false,
  },
  {
    id: 'fixture-board',
    title: 'Fixture board',
    summary: 'Sports prices are written into the API and do not move on their own.',
    detail:
      'A suspended market stays suspended. Demo bet settlement uses a fixed rule on the selection id, which the slip states before you submit.',
    terms: 'Not a live price. Not a sports result.',
    demo: true,
    cashValue: false,
  },
];

export function promotionById(id: string): DemoPromotion | null {
  return DEMO_PROMOTIONS.find((item) => item.id === id) ?? null;
}
