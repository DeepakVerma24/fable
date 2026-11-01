import type { Meta, StoryObj } from '@storybook/react-vite';

import { GameCard } from './game-card';

const meta = {
  title: 'Casino/GameCard',
  component: GameCard,
  args: {
    game: {
      id: 'northline-reels',
      name: 'Northline Reels',
      categories: ['slots'],
      provider: 'FABLE Preview',
      summary: 'Three-reel preview. No provider client is connected.',
    },
    favorited: false,
    onFavorite: () => undefined,
  },
} satisfies Meta<typeof GameCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Preview: Story = {};

export const Saved: Story = { args: { favorited: true } };
