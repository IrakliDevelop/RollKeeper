import type { Decorator } from '@storybook/nextjs-vite';
import { Fragment } from 'react';

/**
 * Remounts the story when the toolbar theme changes, so values measured on
 * mount are read again in the new theme.
 */
export const remountOnTheme: Decorator = (Story, { globals }) => (
  <Fragment key={String(globals.theme)}>
    <Story />
  </Fragment>
);
