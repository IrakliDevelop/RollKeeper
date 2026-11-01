import { sb } from 'storybook/test';

sb.mock(import('../src/lib/supabase/authConfig.ts'), { spy: true });
sb.mock(import('../src/lib/supabase/browser.ts'), { spy: true });
sb.mock(import('../src/hooks/useClassData.ts'), { spy: true });
sb.mock(import('../src/hooks/useSpellsData.ts'), { spy: true });
sb.mock(import('../src/hooks/useFeatsData.ts'), { spy: true });
import type { Preview, Decorator } from '@storybook/nextjs-vite';
import React, { useEffect, type ReactNode } from 'react';
import '../src/app/globals.css';
import './fonts.css';
import { MotionProvider } from '../src/app/MotionProvider';
import { ConfirmDialogHost } from '../src/components/ui/feedback/confirm-dialog';

type StoryTheme = 'light' | 'dark' | 'blue';

// Paper unless the toolbar asks for felt. Story links saved with a retired
// or unknown theme value render as paper.
function toStoryTheme(value: unknown): StoryTheme {
  return value === 'dark' || value === 'blue' ? value : 'light';
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
  scoped,
  children,
}: {
  theme: StoryTheme;
  scoped: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    // A single story themes the document root, so the body (coloured from
    // the tokens in globals.css) matches it. A docs page shows several
    // stories in one document: each wrapper carries its own theme and the
    // root stays paper, so `dark:` utilities never leak into a light story.
    // On docs pages, portaled content (tooltips, popovers) renders under the
    // unthemed root, so it shows paper even in a Dark story.
    if (scoped) {
      document.documentElement.removeAttribute('data-theme');
      return;
    }
    document.documentElement.setAttribute('data-theme', theme);
    // Leaving for a page without a story (an MDX docs page) resets to paper.
    return () => document.documentElement.removeAttribute('data-theme');
  }, [theme, scoped]);

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
      <ThemeWrapper theme={theme} scoped={context.viewMode === 'docs'}>
        <Story />
      </ThemeWrapper>
      <ConfirmDialogHost />
    </MotionProvider>
  );
};

const APP_FONT_FAMILIES = new Set(['Vollkorn', 'Barlow', 'Barlow Condensed']);

const preview: Preview = {
  // The app preloads its fonts. Wait for every face fonts.css declares for the
  // app's families, so none arrives after the first paint and shifts what play
  // functions measure. A face that fails to load must not fail every story.
  loaders: [
    async () => {
      const faces = Array.from(document.fonts).filter(face =>
        APP_FONT_FAMILIES.has(face.family.replace(/["']/g, ''))
      );
      await Promise.allSettled(faces.map(face => face.load()));
    },
  ],
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
          { value: 'blue', title: 'Blue dark', icon: 'paintbrush' },
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
