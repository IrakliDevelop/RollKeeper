'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/forms/button';
import { Section } from '@/components/ui/layout/section';
import { ThemeChooser } from './ThemeChooser';
import { parseThemePreference } from '@/utils/themePreference';
import type { Theme } from '@/types/theme';

export function CharacterAppearance({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (theme: Theme | undefined) => void;
}) {
  return (
    <Section heading="Appearance" contentClassName="space-y-6">
      <ThemeChooser
        character
        value={parseThemePreference(value)}
        onChange={onChange}
      />
      <Button asChild variant="link">
        <Link href="/player/appearance">App appearance</Link>
      </Button>
    </Section>
  );
}
