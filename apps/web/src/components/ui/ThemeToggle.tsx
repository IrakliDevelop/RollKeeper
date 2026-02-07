'use client';

import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme, Theme } from '@/hooks/useTheme';

interface ThemeToggleProps {
  /** Show the 3-way toggle (light / system / dark) instead of simple toggle. */
  showSystemOption?: boolean;
  className?: string;
}

/**
 * A compact theme toggle button. By default cycles light → dark → light.
 * When `showSystemOption` is true, cycles light → system → dark → light.
 */
export function ThemeToggle({
  showSystemOption = false,
  className = '',
}: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const handleClick = () => {
    if (showSystemOption) {
      const order: Theme[] = ['light', 'system', 'dark'];
      const idx = order.indexOf(theme);
      setTheme(order[(idx + 1) % order.length]);
    } else {
      setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    }
  };

  const icon =
    theme === 'system' ? (
      <Monitor size={18} />
    ) : resolvedTheme === 'dark' ? (
      <Moon size={18} />
    ) : (
      <Sun size={18} />
    );

  const label =
    theme === 'system'
      ? 'Using system theme'
      : resolvedTheme === 'dark'
        ? 'Switch to light mode'
        : 'Switch to dark mode';

  return (
    <button
      onClick={handleClick}
      className={`border-divider bg-surface-raised text-muted hover:bg-surface-hover hover:text-heading focus-visible:ring-ring inline-flex items-center justify-center rounded-lg border p-2 transition-colors focus-visible:ring-2 focus-visible:outline-none ${className}`}
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}
