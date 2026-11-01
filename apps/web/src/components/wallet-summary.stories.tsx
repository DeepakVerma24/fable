import type { Meta, StoryObj } from '@storybook/react-vite';

import { DemoBalance, WalletSummary } from './wallet-summary';

const wallet = {
  simulated: true as const,
  realMoney: false as const,
  withdrawable: false as const,
  currency: 'FBU' as const,
  label: 'Fable demo units',
  disclaimer: 'Demo units cannot be withdrawn, deposited, or converted to money.',
  availableMinor: '102200',
  reservedMinor: '0',
  totalMinor: '102200',
};

const meta = {
  title: 'Wallet/Summary',
  component: WalletSummary,
  args: { wallet },
} satisfies Meta<typeof WalletSummary>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const HeaderBalance: Story = {
  render: () => <DemoBalance signedIn availableMinor="102200" />,
};
