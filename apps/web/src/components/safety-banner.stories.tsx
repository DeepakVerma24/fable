import type { Meta, StoryObj } from '@storybook/react-vite';

import { SafetyBanner } from './safety-banner';

const meta = {
  title: 'Foundation/SafetyBanner',
  component: SafetyBanner,
} satisfies Meta<typeof SafetyBanner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
