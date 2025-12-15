import type { Preview, Decorator } from '@storybook/nextjs-vite';
import React, { useEffect, type ReactNode } from 'react';
import '../src/app/globals.css';

// Theme wrapper component (must be PascalCase to use hooks)
function ThemeWrapper({
  theme,
  children,
}: {
  theme: string;
  children: ReactNode;
}) {
  useEffect(() => {
    // Apply theme to the document root for CSS variables
    document.documentElement.setAttribute('data-theme', theme);
    // Also set background color for the story container
    document.body.style.backgroundColor =
      theme === 'dark' ? '#0f172a' : '#ffffff';
    document.body.style.color = theme === 'dark' ? '#f1f5f9' : '#1e293b';
  }, [theme]);

  return (
    <div
      data-theme={theme}
      style={{
        padding: '1rem',
        minHeight: '100vh',
        backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
        color: theme === 'dark' ? '#f1f5f9' : '#1e293b',
      }}
    >
      {children}
    </div>
  );
}

// Theme decorator that applies data-theme attribute based on toolbar selection
const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme || 'light';

  return (
    <ThemeWrapper theme={theme}>
      <Story />
    </ThemeWrapper>
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
