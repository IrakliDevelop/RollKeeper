import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';

import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { ThemeContext, type ResolvedTheme, type Theme } from '@/hooks/useTheme';

function renderToggle(
  theme: Theme,
  resolvedTheme: ResolvedTheme,
  showSystemOption = false
) {
  const setTheme = vi.fn();
  render(
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      <ThemeToggle showSystemOption={showSystemOption} />
    </ThemeContext.Provider>
  );
  return { setTheme, button: screen.getByRole('button') };
}

describe('ThemeToggle', () => {
  afterEach(cleanup);

  it.each([
    ['light', 'light', 'dark', 'Switch to dark mode'],
    ['dark', 'dark', 'light', 'Switch to light mode'],
    ['system', 'dark', 'light', 'Switch to light mode'],
    ['system', 'light', 'dark', 'Switch to dark mode'],
  ] as const)(
    'toggles %s (showing %s) to %s',
    (theme, resolved, next, label) => {
      const { setTheme, button } = renderToggle(theme, resolved);

      expect(button).toHaveAccessibleName(label);
      expect(button).toHaveAttribute('title', label);
      fireEvent.click(button);
      expect(setTheme).toHaveBeenCalledWith(next);
    }
  );

  it.each([
    ['light', 'light', 'system', 'Use system theme'],
    ['system', 'light', 'dark', 'Switch to dark mode'],
    ['system', 'dark', 'dark', 'Switch to dark mode'],
    ['dark', 'dark', 'light', 'Switch to light mode'],
  ] as const)(
    'with the system option, cycles %s (showing %s) to %s',
    (theme, resolved, next, label) => {
      const { setTheme, button } = renderToggle(theme, resolved, true);

      expect(button).toHaveAccessibleName(label);
      fireEvent.click(button);
      expect(setTheme).toHaveBeenCalledWith(next);
    }
  );
});

it('defaults to the persisted three-state cycle and the shared ghost control', () => {
  const setTheme = vi.fn();
  render(
    <ThemeContext.Provider
      value={{ theme: 'light', resolvedTheme: 'light', setTheme }}
    >
      <ThemeToggle />
    </ThemeContext.Provider>
  );
  const button = screen.getByRole('button', { name: 'Use system theme' });
  expect(button).toHaveAttribute('data-variant', 'ghost');
  fireEvent.click(button);
  expect(setTheme).toHaveBeenCalledWith('system');
  cleanup();
});
