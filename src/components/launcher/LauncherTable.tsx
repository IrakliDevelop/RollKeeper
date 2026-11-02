'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { cardVariants } from '@/components/ui/primitives/variants';
import { cn } from '@/utils/cn';
import { InitiativeGlimpse, SheetGlimpse } from './DoorPreviews';
import {
  ContinueLink,
  KeyholeMark,
  LAUNCHER_LINE,
  SmallLinks,
} from './LauncherParts';

function Door({
  href,
  title,
  line,
  children,
}: {
  href: string;
  title: string;
  line: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        cardVariants({ variant: 'interactive', padding: 'lg' }),
        'flex flex-col gap-5'
      )}
    >
      <span className="flex flex-col gap-1">
        <span className="type-heading text-heading">{title}</span>
        <span className="type-small text-muted">{line}</span>
      </span>
      <div className="mt-auto">{children}</div>
    </Link>
  );
}

/** A faint hex battle-map grid under the whole page: the table the doors sit on. */
function TableGrid() {
  return (
    <svg
      aria-hidden="true"
      className="text-divider pointer-events-none absolute inset-0 -z-10 size-full opacity-60"
    >
      <defs>
        {/* Pointy-top hexes, 30 units to a corner; the tile repeats every row pair. */}
        <pattern
          id="launcher-hex"
          width="51.96"
          height="90"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M25.98 0L51.96 15v30L25.98 60 0 45V15zM25.98 60v30"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#launcher-hex)" />
    </svg>
  );
}

/** Launcher A: the felt table with two doors and a glimpse of each. */
export function LauncherTable() {
  return (
    <div className="bg-surface relative isolate flex min-h-dvh flex-col">
      <TableGrid />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-10 px-4 py-12 sm:px-6">
        <header className="flex flex-col items-center gap-4 text-center">
          <KeyholeMark className="size-14" />
          <h1 className="type-display text-heading">RollKeeper</h1>
          <p className="type-body text-body max-w-[32em]">{LAUNCHER_LINE}</p>
          <ContinueLink />
        </header>
        <div className="grid gap-4 md:grid-cols-2">
          <Door
            href="/player"
            title="Characters"
            line="Your sheets, with or without a DM"
          >
            <SheetGlimpse />
          </Door>
          <Door
            href="/dm"
            title="Campaigns"
            line="Encounters, NPCs and your players' hit points"
          >
            <InitiativeGlimpse />
          </Door>
        </div>
        <SmallLinks />
      </main>
    </div>
  );
}
