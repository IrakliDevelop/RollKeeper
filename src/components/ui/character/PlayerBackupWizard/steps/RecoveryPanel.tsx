'use client';

import { PlayerBackupRecovery } from '@/components/ui/character/PlayerBackupRecovery';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { PLAYER_BACKUP_COPY as COPY } from '@/lib/playerBackup/playerBackupCopy';

import type {
  PlayerBackupWizardActions,
  PlayerBackupWizardView,
} from '../PlayerBackupWizard.types';

const TONE_VARIANT = {
  ok: 'success',
  warn: 'warning',
  info: 'secondary',
  bad: 'danger',
  none: 'neutral',
} as const;

const RECOVERY_ROW_ACTIONS = new Set([
  'restore-here',
  'restore-copy',
  'download-recovery',
]);

interface RecoveryPanelProps {
  view: PlayerBackupWizardView;
  actions: PlayerBackupWizardActions;
}

export function RecoveryPanel({ view, actions }: RecoveryPanelProps) {
  const rows = view.management.rows;

  return (
    <section
      className="flex flex-col gap-4 overflow-x-hidden"
      aria-labelledby="player-backup-recovery-title"
    >
      <div>
        <h2
          id="player-backup-recovery-title"
          className="text-heading text-xl font-semibold"
          tabIndex={-1}
        >
          {view.recovery.title}
        </h2>
        <p className="text-body mt-1 text-sm">{view.recovery.description}</p>
      </div>
      {rows.length > 0 ? (
        <div>
          <h3 className="text-heading text-base font-semibold">
            {COPY.recovery.onlineCopiesTitle}
          </h3>
          <div className="border-divider mt-3 overflow-hidden rounded-lg border">
            {rows.map(row => (
              <div
                key={row.id}
                className="border-divider flex flex-col gap-2 border-b p-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-heading text-sm font-medium">
                      {row.name}
                    </p>
                    <Badge variant={TONE_VARIANT[row.tone]}>
                      {row.statusLabel}
                    </Badge>
                  </div>
                  {row.note ? (
                    <p className="text-muted text-xs">{row.note}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {row.actions
                    .filter(action => RECOVERY_ROW_ACTIONS.has(action.action))
                    .map(action => (
                      <Button
                        key={action.action}
                        variant="outline"
                        size="sm"
                        disabled={!action.enabled || view.busy}
                        onClick={() => {
                          if (action.action === 'restore-here') {
                            actions.onRestoreHere(row.id);
                          }
                          if (action.action === 'restore-copy') {
                            actions.onRestoreCopy(row.id);
                          }
                          if (action.action === 'download-recovery') {
                            actions.onDownloadRecoveryCopy(row.id);
                          }
                        }}
                      >
                        {action.label}
                      </Button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <PlayerBackupRecovery onSaveSafetyFile={actions.onSaveSafetyFile} />
    </section>
  );
}
