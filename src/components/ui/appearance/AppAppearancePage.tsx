'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { AppHeader } from '@/components/ui/layout/AppHeader';
import { Section } from '@/components/ui/layout/section';
import { ThemeChooser } from './ThemeChooser';
import { useTheme } from '@/hooks/useTheme';

export function AppAppearancePage() {
  const { theme, setTheme } = useTheme();
  return (
    <>
      <AppHeader
        sticky
        leading={
          <Button asChild variant="ghost" leftIcon={<ArrowLeft size={16} />}>
            <Link href="/player">Characters</Link>
          </Button>
        }
        title={<h1 className="type-subheading text-heading">App appearance</h1>}
      />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Section heading="Theme">
          <ThemeChooser
            value={theme}
            onChange={next => {
              if (next) setTheme(next);
            }}
          />
        </Section>
      </main>
    </>
  );
}
