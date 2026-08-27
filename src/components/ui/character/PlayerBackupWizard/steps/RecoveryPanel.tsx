'use client';

import { Button } from '@/components/ui/forms/button';
import { PLAYER_BACKUP_COPY as COPY } from '@/lib/playerBackup/playerBackupCopy';

import type {
  PlayerBackupWizardActions,
  PlayerBackupWizardView,
} from '../PlayerBackupWizard.types';

interface RecoveryPanelProps {
  view: PlayerBackupWizardView;
  actions: PlayerBackupWizardActions;
}

export function RecoveryPanel({ view, actions }: RecoveryPanelProps) {
  return (
    <section
      className="flex flex-col gap-4"
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

      <div className="border-divider bg-surface rounded-lg border p-4">
        <h3 className="text-heading text-base font-semibold">
          {COPY.recovery.sectionTitle}
        </h3>
        <p className="text-body mt-1 text-sm">
          {COPY.recovery.sectionDescription}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={actions.onSaveSafetyFile}>
            {COPY.recovery.saveNew}
          </Button>
          <Button variant="outline" disabled>
            {COPY.recovery.restoreFrom}
          </Button>
          <Button variant="ghost" onClick={actions.onOpenRecovery}>
            {COPY.recovery.options}
          </Button>
        </div>
      </div>
    </section>
  );
}
