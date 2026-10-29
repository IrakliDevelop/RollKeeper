'use client';

import { Sun, Moon, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
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
 * A compact theme toggle button. By default cycles light → system → dark → light.
 * When `showSystemOption` is true, cycles light → system → dark → light.
 */
export function ThemeToggle({
  showSystemOption = true,
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
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => setTheme(next)}
      className={`size-9 shrink-0 px-0 ${className}`}
      aria-label={label}
      title={label}
    >
      {icon}
    </Button>
  );
}
