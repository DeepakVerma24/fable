import type { Decorator, Preview } from '@storybook/react-vite';

import '../src/app/globals.css';

const withTheme: Decorator = (Story) => (
  <div className="dark bg-background p-6 text-foreground">
    <Story />
  </div>
);

const preview: Preview = {
  decorators: [withTheme],
};

export default preview;
