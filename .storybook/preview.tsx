import type { Preview, Decorator } from '@storybook/nextjs-vite';
import React, { useEffect, type ReactNode } from 'react';
import '../src/app/globals.css';
import { MotionProvider } from '../src/app/MotionProvider';

type StoryTheme = 'light' | 'dark';

// Paper unless the toolbar asks for felt. Story links saved with a retired
// or unknown theme value render as paper.
function toStoryTheme(value: unknown): StoryTheme {
  return value === 'dark' ? 'dark' : 'light';
}

// Colours come from the theme tokens, which resolve per data-theme scope.
const WRAPPER_STYLE = {
  padding: '1rem',
  minHeight: '100vh',
  backgroundColor: 'var(--background)',
  color: 'var(--foreground)',
} as const;

// Theme wrapper component (must be PascalCase to use hooks)
function ThemeWrapper({
  theme,
  children,
}: {
  theme: StoryTheme;
  children: ReactNode;
}) {
  useEffect(() => {
    // Apply theme to the document root for CSS variables. The body takes
    // its background and text colour from the tokens in globals.css.
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <div data-theme={theme} style={WRAPPER_STYLE}>
      {children}
    </div>
  );
}

// Theme decorator that applies data-theme attribute based on toolbar selection
const withTheme: Decorator = (Story, context) => {
  const theme = toStoryTheme(context.globals.theme);

  return (
    <MotionProvider>
      <ThemeWrapper theme={theme}>
        <Story />
      </ThemeWrapper>
    </MotionProvider>
  );
};

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo',
    },
    backgrounds: {
      disable: true, // Disable default backgrounds addon, we use theme switcher
    },
    layout: 'fullscreen',
  },
  globalTypes: {
    theme: {
      description: 'Global theme for components',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [
          { value: 'light', title: 'Light', icon: 'sun' },
          { value: 'dark', title: 'Dark', icon: 'moon' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: 'light',
  },
  decorators: [withTheme],
};

export default preview;
