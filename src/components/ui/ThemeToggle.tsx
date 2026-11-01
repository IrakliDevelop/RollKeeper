'use client';

import Link from 'next/link';
import { Palette } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { useTheme } from '@/hooks/useTheme';

export interface ThemeToggleProps {
  /** @deprecated Appearance now offers every theme on a dedicated page. */
  showSystemOption?: boolean;
  className?: string;
}

/** Open settings for the currently displayed app or character theme. */
export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { characterScope } = useTheme();
  const href = characterScope
    ? `/player/characters/${encodeURIComponent(characterScope.characterId)}/appearance`
    : '/player/appearance';
  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className={`size-9 shrink-0 px-0 ${className}`}
    >
      <Link href={href} aria-label="Appearance" title="Appearance">
        <Palette size={18} aria-hidden />
      </Link>
    </Button>
  );
}
