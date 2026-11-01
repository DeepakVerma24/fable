import type { Meta, StoryObj } from '@storybook/react-vite';

import { OddsButton } from './odds-button';

const meta = {
  title: 'Sports/OddsButton',
  component: OddsButton,
  args: {
    name: 'North Harbor',
    decimalOdds: '1.91',
    selected: false,
    suspended: false,
    onSelect: () => undefined,
  },
} satisfies Meta<typeof OddsButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Price: Story = {};

export const Selected: Story = { args: { selected: true } };

export const Suspended: Story = { args: { suspended: true } };
