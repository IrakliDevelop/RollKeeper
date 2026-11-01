import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { ThemeContext } from '@/hooks/useTheme';

afterEach(cleanup);
it.each([null, { characterId: 'hero/one', theme: 'blue' as const }])(
  'opens appearance settings for the active scope %j',
  characterScope => {
    const setTheme = vi.fn();
    render(
      <ThemeContext.Provider
        value={{
          theme: 'dark',
          resolvedTheme: 'blue',
          characterScope,
          setTheme,
        }}
      >
        <ThemeToggle />
      </ThemeContext.Provider>
    );
    const link = screen.getByRole('link', { name: 'Appearance' });
    expect(link).toHaveAttribute(
      'href',
      characterScope
        ? '/player/characters/hero%2Fone/appearance'
        : '/player/appearance'
    );
    expect(link).toHaveAttribute('data-variant', 'ghost');
    expect(setTheme).not.toHaveBeenCalled();
  }
);
