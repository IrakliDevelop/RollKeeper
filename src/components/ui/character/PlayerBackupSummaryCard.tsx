'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/forms/button';
import type { PlayerBackupDashboardView } from '@/lib/playerBackup/playerBackupDashboard';

const STATUS_TEXT: Record<PlayerBackupDashboardView['tone'], string> = {
  none: 'text-heading',
  warn: 'text-ember-text',
  ok: 'text-verdigris-text',
  info: 'text-heading',
};

export interface PlayerBackupSummaryCardProps {
  view: PlayerBackupDashboardView;
  liveStatus?: string | null;
}

export function PlayerBackupSummaryCard({
  view,
  liveStatus = null,
}: PlayerBackupSummaryCardProps) {
  return (
    <section className="border-divider mb-8 border-b pb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className={`type-subheading ${STATUS_TEXT[view.tone]}`}>
            {view.title}
          </h2>
          <p className="type-body text-body mt-1">{view.description}</p>
          {view.counts && view.counts.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
              {view.counts.map(count => (
                <li key={count.label} className="type-small flex gap-1">
                  <span className="text-heading font-semibold">
                    {count.value}
                  </span>{' '}
                  <span className="text-body">{count.label}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" asChild>
            <Link href={view.primary.href}>{view.primary.label}</Link>
          </Button>
          {view.secondary ? (
            <Button variant="outline" asChild>
              <Link href={view.secondary.href}>{view.secondary.label}</Link>
            </Button>
          ) : null}
        </div>
      </div>
      {liveStatus ? (
        <p className="sr-only" aria-live="polite">
          {liveStatus}
        </p>
      ) : null}
    </section>
  );
}
