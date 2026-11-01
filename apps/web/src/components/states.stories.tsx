import type { Meta, StoryObj } from '@storybook/react-vite';

import { EmptyState, ErrorState, LoadingSkeleton } from './states';

const meta = {
  title: 'States/Empty',
  component: EmptyState,
  args: {
    title: 'Slip is empty',
    body: 'Choose one demo price. Nothing here is a live market.',
  },
} satisfies Meta<typeof EmptyState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Error: Story = {
  render: () => <ErrorState body="The lobby could not reach the API." onRetry={() => undefined} />,
};

export const Loading: Story = {
  render: () => <LoadingSkeleton rows={2} />,
};
