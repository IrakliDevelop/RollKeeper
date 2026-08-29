'use client';

import { PlayerBackupRecovery } from '@/components/ui/character/PlayerBackupRecovery';

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
      <PlayerBackupRecovery onSaveSafetyFile={actions.onSaveSafetyFile} />
    </section>
  );
}
