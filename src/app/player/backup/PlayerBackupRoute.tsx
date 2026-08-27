'use client';

import { PlayerBackupWizard } from '@/components/ui/character/PlayerBackupWizard';
import { usePlayerBackupWizard } from '@/components/ui/character/PlayerBackupWizard/PlayerBackupWizard.hooks';

export function PlayerBackupRoute() {
  const { view, actions } = usePlayerBackupWizard();
  return <PlayerBackupWizard view={view} actions={actions} />;
}
