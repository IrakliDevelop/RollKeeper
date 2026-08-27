'use client';

import { UserRound } from 'lucide-react';

import { Badge } from '@/components/ui/layout/badge';
import { Button } from '@/components/ui/forms/button';
import { PLAYER_BACKUP_COPY as COPY } from '@/lib/playerBackup/playerBackupCopy';

import type { PlayerBackupWizardView } from '../PlayerBackupWizard.types';

interface AccountStepProps {
  view: PlayerBackupWizardView;
  onSignIn: () => void;
  onCheckAccount: () => void;
}

export function AccountStep({
  view,
  onSignIn,
  onCheckAccount,
}: AccountStepProps) {
  return (
    <section
      className="flex flex-col gap-4"
      aria-labelledby="player-backup-account-title"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-muted mb-0.5 text-[11px] font-bold tracking-wide uppercase lg:block">
            <span className="lg:hidden">{view.compactStepLabel}</span>
            <span className="hidden lg:inline">{COPY.account.eyebrow}</span>
          </p>
          <h3
            id="player-backup-account-title"
            className="text-heading text-lg font-semibold"
            tabIndex={-1}
          >
            {COPY.account.title}
          </h3>
        </div>
        <Badge variant="neutral">{COPY.chrome.readsOnly}</Badge>
      </div>

      <p className="text-body text-sm">{COPY.account.description}</p>

      <div className="border-divider bg-surface flex items-center justify-between gap-3 rounded-lg border p-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <UserRound
            size={18}
            className={
              view.account.signedIn
                ? 'text-accent-emerald-text shrink-0'
                : 'text-muted shrink-0'
            }
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-heading text-sm font-medium">
              {view.account.statusLine}
            </p>
            <p className="text-muted mt-0.5 text-[13px]">
              {view.account.statusDetail}
            </p>
          </div>
        </div>
        <Button
          variant={view.account.signedIn ? 'outline' : 'primary'}
          onClick={view.account.signedIn ? onCheckAccount : onSignIn}
        >
          {view.account.actionLabel}
        </Button>
      </div>

      {view.account.error ? (
        <div
          role="alert"
          tabIndex={-1}
          className="border-accent-red-border bg-accent-red-bg rounded-lg border p-3.5"
        >
          <p className="text-accent-red-text text-[13px]">
            {view.account.error}
          </p>
        </div>
      ) : null}

      <div className="border-accent-emerald-border bg-accent-emerald-bg flex items-start gap-2.5 rounded-lg border p-3">
        <p className="text-accent-emerald-text text-[13px]">
          {COPY.account.stayPlayable}
        </p>
      </div>
    </section>
  );
}
