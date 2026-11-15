import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, waitFor, within } from 'storybook/test';

import { ImageLightbox } from './ImageLightbox';

const SQUARE = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><rect width="320" height="320" fill="#8a7a5a"/></svg>'
)}`;

/**
 * A portrait shown full size in the shared Dialog. Escape or Close closes it
 * and focus goes back to whatever opened it.
 */
const meta = {
  title: 'Feedback/ImageLightbox',
  component: ImageLightbox,
  parameters: {
    layout: 'fullscreen',
    a11y: { test: 'error', context: { include: ['body'] } },
  },
  args: { alt: 'Portrait', src: SQUARE, onClose: fn() },
} satisfies Meta<typeof ImageLightbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async () => {
    const body = within(document.body);
    const dialog = await body.findByRole('dialog', {
      name: 'Portrait full-size image',
    });
    // The dialog zooms and fades in; wait until it settles before checking
    // what is visible.
    await waitFor(() => expect(dialog.getAnimations()).toHaveLength(0));
    await expect(body.getByRole('button', { name: 'Close' })).toBeVisible();
  },
};

export const Dark: Story = { globals: { theme: 'dark' } };
