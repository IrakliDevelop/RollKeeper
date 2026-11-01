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
  ok: 'border-verdigris-border bg-verdigris-bg text-verdigris-text',
  warn: 'border-ember-border bg-ember-bg text-ember-text',
  info: 'border-divider bg-surface-secondary text-heading',
  bad: 'border-blood-border bg-blood-bg text-blood-text',
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
          <p className="text-muted mb-0.5 text-[11px] font-bold">
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

      <div className={`rounded-md border p-4 ${TONE_BOX[result.tone]}`}>
        <p className="text-sm font-semibold">{result.headline}</p>
        <p className="mt-1 text-[13px]">{result.body}</p>
      </div>

      {result.continueSetup ? (
        <Button variant="secondary" onClick={onContinueSetup}>
          {COPY.result.continueSetup}
        </Button>
      ) : null}

      <div className="border-divider divide-divider divide-y border-y">
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
          className="border-ember-border bg-ember-bg rounded-md border-2 p-4"
        >
          <p className="text-ember-text text-sm font-semibold">
            {COPY.conflict.title}
          </p>
          <p className="text-ember-text mt-1 text-[13px]">
            {conflict.description}
          </p>
          {conflict.pendingApplication ? (
            <div className="mt-3">
              <p className="text-ember-text text-[13px]">
                {COPY.conflict.pendingBody}
              </p>
              <Button
                className="mt-2"
                variant="secondary"
                onClick={() => onApplyPending(conflict.applicationLegacyId)}
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
                  className="border-ember-border bg-surface flex flex-col gap-2 rounded-md border p-3"
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
        <div key={item.legacyId} className="border-divider border-b py-4">
          <p className="text-heading text-sm font-semibold">
            {COPY.conflict.futureTitle}
          </p>
          <p className="text-heading mt-1 text-[13px]">
            {COPY.conflict.futureDescription}
          </p>
          {item.recoveryAvailable ? (
            <Button
              className="mt-3"
              variant="outline"
              disabled={!item.downloadEnabled}
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
