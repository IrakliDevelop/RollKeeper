'use client';

import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme, type Theme } from '@/hooks/useTheme';

export interface ThemeToggleProps {
  /** Show the 3-way toggle (light / system / dark) instead of simple toggle. */
  showSystemOption?: boolean;
  className?: string;
}

const SIMPLE_CYCLE: Theme[] = ['light', 'dark'];
const SYSTEM_CYCLE: Theme[] = ['light', 'system', 'dark'];

/** Names what a tap does: the theme it switches to. */
const NEXT_THEME_LABEL: Record<Theme, string> = {
  light: 'Switch to light mode',
  dark: 'Switch to dark mode',
  system: 'Use system theme',
};

/**
 * A compact theme toggle button. By default toggles light ↔ dark.
 * When `showSystemOption` is true, cycles light → system → dark → light.
 */
export function ThemeToggle({
  showSystemOption = false,
  className = '',
}: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const cycle = showSystemOption ? SYSTEM_CYCLE : SIMPLE_CYCLE;
  const current =
    showSystemOption || theme !== 'system' ? theme : resolvedTheme;
  const next = cycle[(cycle.indexOf(current) + 1) % cycle.length];
  const label = NEXT_THEME_LABEL[next];

  const icon =
    theme === 'system' ? (
      <Monitor size={18} />
    ) : resolvedTheme === 'dark' ? (
      <Moon size={18} />
    ) : (
      <Sun size={18} />
    );

  return (
    <button
      onClick={() => setTheme(next)}
      className={`border-divider bg-surface-raised text-muted hover:bg-surface-hover hover:text-heading focus-visible:ring-ring inline-flex items-center justify-center rounded-lg border p-2 transition-colors focus-visible:ring-2 focus-visible:outline-none ${className}`}
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}
