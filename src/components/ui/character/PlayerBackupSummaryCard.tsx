'use client';

import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { Card } from '@/components/ui/layout/card';
import type { PlayerBackupDashboardView } from '@/lib/playerBackup/playerBackupDashboard';

const TONE_CLASS: Record<
  PlayerBackupDashboardView['tone'],
  { card: string; icon: string; iconWrap: string; title: string; body: string }
> = {
  none: {
    card: 'border-divider bg-surface',
    icon: 'text-muted',
    iconWrap: 'bg-surface-secondary',
    title: 'text-heading',
    body: 'text-body',
  },
  warn: {
    card: 'border-accent-amber-border bg-accent-amber-bg',
    icon: 'text-accent-amber-text',
    iconWrap: 'bg-accent-amber-bg',
    title: 'text-accent-amber-text',
    body: 'text-accent-amber-text',
  },
  ok: {
    card: 'border-accent-emerald-border bg-accent-emerald-bg',
    icon: 'text-accent-emerald-text',
    iconWrap: 'bg-accent-emerald-bg',
    title: 'text-accent-emerald-text',
    body: 'text-accent-emerald-text',
  },
  info: {
    card: 'border-accent-blue-border bg-accent-blue-bg',
    icon: 'text-accent-blue-text',
    iconWrap: 'bg-accent-blue-bg',
    title: 'text-accent-blue-text',
    body: 'text-accent-blue-text',
  },
};

export interface PlayerBackupSummaryCardProps {
  view: PlayerBackupDashboardView;
  liveStatus?: string | null;
}

export function PlayerBackupSummaryCard({
  view,
  liveStatus = null,
}: PlayerBackupSummaryCardProps) {
  const tone = TONE_CLASS[view.tone];

  return (
    <Card className={`mb-8 border-2 p-5 shadow-md ${tone.card}`} padding="none">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3.5">
          <span
            className={`inline-flex size-10 shrink-0 items-center justify-center rounded-full ${tone.iconWrap}`}
            aria-hidden="true"
          >
            <ShieldCheck className={`size-5 ${tone.icon}`} />
          </span>
          <div className="min-w-0">
            <h2 className={`text-[17px] font-bold ${tone.title}`}>
              {view.title}
            </h2>
            <p className={`mt-1 text-sm ${tone.body}`}>{view.description}</p>
            {view.counts && view.counts.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2.5">
                {view.counts.map(count => (
                  <Badge
                    key={count.label}
                    variant="outline"
                    className="gap-1.5 rounded-full px-3 py-0.5"
                  >
                    <span className="text-heading text-sm font-bold">
                      {count.value}
                    </span>
                    <span className="text-body text-xs">{count.label}</span>
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="primary" size="md" asChild>
            <Link href={view.primary.href}>{view.primary.label}</Link>
          </Button>
          {view.secondary ? (
            <Button variant="outline" size="md" asChild>
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
    </Card>
  );
}
