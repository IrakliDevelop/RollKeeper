import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import ErrorPage from './ErrorPage';
import { emulateCoarsePointer } from '@/test/storybook/emulateCoarsePointer';

/**
 * The 404, route error and global error pages: a heading, two plain lines,
 * the error message when there is one, and Try again plus a Home link.
 */
const meta = {
  title: 'Feedback/ErrorPage',
  component: ErrorPage,
  parameters: { layout: 'fullscreen', a11y: { test: 'error' } },
  args: { onRetry: fn() },
} satisfies Meta<typeof ErrorPage>;

export default meta;
type Story = StoryObj<typeof meta>;

const PHONE = {
  viewport: {
    options: {
      phone: {
        name: 'Phone',
        styles: { width: '390px', height: '844px' },
        type: 'mobile',
      },
    },
  },
} as const;

const PHONE_GLOBALS = { viewport: { value: 'phone', isRotated: false } };

export const NotFound: Story = { args: { kind: 'not-found' } };

export const RouteError: Story = {
  args: {
    kind: 'route',
    error: new Error("Cannot read properties of undefined (reading 'hitDice')"),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { level: 1 })).toHaveTextContent(
      'This page hit an error'
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }));
    await expect(args.onRetry).toHaveBeenCalledTimes(1);
  },
};

export const GlobalError: Story = { args: { kind: 'global' } };

/** A 240-character message with no spaces wraps inside a 390px phone. */
export const LongMessage: Story = {
  args: { kind: 'route', error: new Error('E'.repeat(240)) },
  parameters: PHONE,
  globals: PHONE_GLOBALS,
  play: async ({ canvasElement }) => {
    const main = within(canvasElement).getByRole('main');
    await expect(main.scrollWidth).toBeLessThanOrEqual(main.clientWidth);
  },
};

export const Dark: Story = {
  args: RouteError.args,
  globals: { theme: 'dark' },
};

export const Blue: Story = {
  args: RouteError.args,
  globals: { theme: 'blue' },
};

/** On a coarse pointer both actions grow to a 44px target. */
export const Touch: Story = {
  args: RouteError.args,
  parameters: PHONE,
  globals: PHONE_GLOBALS,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const retry = canvas.getByRole('button', { name: 'Try again' });
    const home = canvas.getByRole('link', { name: 'Home' });
    await expect(retry.getBoundingClientRect().height).toBeLessThan(44);
    const restore = emulateCoarsePointer();
    try {
      await expect(retry.getBoundingClientRect().height).toBeGreaterThanOrEqual(
        44
      );
      await expect(home.getBoundingClientRect().height).toBeGreaterThanOrEqual(
        44
      );
    } finally {
      restore();
    }
  },
};
