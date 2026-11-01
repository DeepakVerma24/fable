import type { Meta, StoryObj } from '@storybook/react-vite';

import { PromotionCard } from './promotion-card';

const meta = {
  title: 'Promotions/Card',
  component: PromotionCard,
  args: {
    promotion: {
      id: 'opening-units',
      title: 'Opening demo units',
      summary: 'A new player receives 1,000.00 FBU once.',
      detail: 'Simulated ledger adjustment.',
      terms: 'Demo only. No cash value.',
      demo: true,
      cashValue: false,
    },
  },
} satisfies Meta<typeof PromotionCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Demo: Story = {};
