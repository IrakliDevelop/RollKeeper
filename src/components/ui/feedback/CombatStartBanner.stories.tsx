import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';

import { CombatStartBanner } from './CombatStartBanner';

/**
 * A non-blocking "Combat begins" banner on a neutral floating surface. It
 * portals to `body`, takes no pointer events and has no scrim. The stories
 * hold it open (600000 ms) so it can be inspected.
 */
const meta = {
  title: 'Feedback/CombatStartBanner',
  component: CombatStartBanner,
  parameters: {
    layout: 'fullscreen',
    a11y: { test: 'error', context: { include: ['body'] } },
  },
  args: { isVisible: true, durationMs: 600000 },
} satisfies Meta<typeof CombatStartBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async () => {
    const status = await within(document.body).findByRole('status');
    await expect(status).toHaveTextContent('Combat begins');
    await expect(getComputedStyle(status).textTransform).toBe('none');
  },
};

export const Dark: Story = { globals: { theme: 'dark' } };

export const Blue: Story = { globals: { theme: 'blue' } };

/** On a 390px phone the pill stays inside the viewport. */
export const Phone: Story = {
  parameters: {
    viewport: {
      options: {
        phone: {
          name: 'Phone',
          styles: { width: '390px', height: '844px' },
          type: 'mobile',
        },
      },
    },
  },
  globals: { viewport: { value: 'phone', isRotated: false } },
  play: async () => {
    const status = await within(document.body).findByRole('status');
    const pill = status.parentElement as HTMLElement;
    await expect(pill.getBoundingClientRect().width).toBeLessThanOrEqual(390);
  },
};
