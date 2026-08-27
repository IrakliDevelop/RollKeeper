'use client';

import { Badge } from '@/components/ui/layout/badge';
import { Button } from '@/components/ui/forms/button';
import { PLAYER_BACKUP_COPY as COPY } from '@/lib/playerBackup/playerBackupCopy';

import type {
  PlayerBackupWizardActions,
  PlayerBackupWizardView,
} from '../PlayerBackupWizard.types';

interface ResultStepProps {
  view: PlayerBackupWizardView;
  onCheckNow: () => void;
  onContinueSetup: () => void;
  onResolveConflict: PlayerBackupWizardActions['onResolveConflict'];
  onApplyPending: (legacyId: string) => void;
  onDownloadRecoveryCopy: (legacyId: string) => void;
}

const TONE_VARIANT = {
  ok: 'success',
  warn: 'warning',
  info: 'secondary',
  bad: 'danger',
  none: 'neutral',
} as const;

const TONE_BOX = {
  ok: 'border-accent-emerald-border bg-accent-emerald-bg text-accent-emerald-text',
  warn: 'border-accent-amber-border bg-accent-amber-bg text-accent-amber-text',
  info: 'border-accent-blue-border bg-accent-blue-bg text-accent-blue-text',
  bad: 'border-accent-red-border bg-accent-red-bg text-accent-red-text',
  none: 'border-divider bg-surface-secondary text-body',
} as const;

export function ResultStep({
  view,
  onCheckNow,
  onContinueSetup,
  onResolveConflict,
  onApplyPending,
  onDownloadRecoveryCopy,
}: ResultStepProps) {
  const { result } = view;

  return (
    <section
      className="flex flex-col gap-4"
      aria-labelledby="player-backup-result-title"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted mb-0.5 text-[11px] font-bold tracking-wide uppercase">
            {COPY.result.eyebrow}
          </p>
          <h3
            id="player-backup-result-title"
            className="text-heading text-lg font-semibold"
            tabIndex={-1}
          >
            {result.title}
          </h3>
        </div>
        <Button variant="outline" size="sm" onClick={onCheckNow}>
          {COPY.chrome.checkNow}
        </Button>
      </div>

      <div className={`rounded-lg border p-4 ${TONE_BOX[result.tone]}`}>
        <p className="text-sm font-semibold">{result.headline}</p>
        <p className="mt-1 text-[13px]">{result.body}</p>
      </div>

      {result.continueSetup ? (
        <Button variant="primary" onClick={onContinueSetup}>
          {COPY.result.continueSetup}
        </Button>
      ) : null}

      <div className="border-divider overflow-hidden rounded-lg border">
        {result.rows.map(row => (
          <div
            key={row.id}
            className="border-divider flex items-center justify-between gap-3 border-b p-3 last:border-b-0"
          >
            <div className="min-w-0">
              <p className="text-heading text-sm font-medium">{row.name}</p>
              <p className="text-muted text-xs">{row.note}</p>
            </div>
            <Badge variant={TONE_VARIANT[row.tone]}>{row.statusLabel}</Badge>
          </div>
        ))}
      </div>

      {result.conflicts.map(conflict => (
        <div
          key={conflict.conflictId}
          className="border-accent-amber-border bg-accent-amber-bg rounded-lg border-2 p-4"
        >
          <p className="text-accent-amber-text text-sm font-semibold">
            {COPY.conflict.title}
          </p>
          <p className="text-accent-amber-text mt-1 text-[13px]">
            {conflict.description}
          </p>
          {conflict.pendingApplication ? (
            <div className="mt-3">
              <p className="text-accent-amber-text text-[13px]">
                {COPY.conflict.pendingBody}
              </p>
              <Button
                className="mt-2"
                variant="primary"
                onClick={() => onApplyPending(conflict.legacyId)}
                disabled={view.busy}
              >
                {COPY.conflict.applyPending}
              </Button>
            </div>
          ) : (
            <div className="mt-3.5 grid gap-2.5 sm:grid-cols-3">
              {conflict.choices.map(choice => (
                <div
                  key={choice.resolution}
                  className="border-accent-amber-border bg-surface flex flex-col gap-2 rounded-lg border p-3"
                >
                  <p className="text-heading text-[13px] font-semibold">
                    {choice.label}
                  </p>
                  <p className="text-body flex-1 text-xs">{choice.body}</p>
                  <Button
                    variant="outline"
                    disabled={!choice.enabled || view.busy}
                    onClick={() =>
                      onResolveConflict(conflict.conflictId, choice.resolution)
                    }
                  >
                    {choice.label}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {result.heldAside.map(item => (
        <div
          key={item.legacyId}
          className="border-accent-blue-border bg-accent-blue-bg rounded-lg border p-4"
        >
          <p className="text-accent-blue-text text-sm font-semibold">
            {COPY.conflict.futureTitle}
          </p>
          <p className="text-accent-blue-text mt-1 text-[13px]">
            {COPY.conflict.futureDescription}
          </p>
          {item.recoveryAvailable ? (
            <Button
              className="mt-3"
              variant="outline"
              onClick={() => onDownloadRecoveryCopy(item.legacyId)}
            >
              {COPY.conflict.downloadRecovery}
            </Button>
          ) : null}
        </div>
      ))}

      <p className="text-muted text-xs">{COPY.result.resultNote}</p>
    </section>
  );
}
