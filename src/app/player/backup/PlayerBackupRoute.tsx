'use client';

import { useSearchParams } from 'next/navigation';

import { PlayerBackupWizard } from '@/components/ui/character/PlayerBackupWizard';
import { usePlayerBackupWizard } from '@/components/ui/character/PlayerBackupWizard/PlayerBackupWizard.hooks';
import { parsePlayerBackupRouteIntent } from '@/lib/playerBackup/playerBackupDashboard';

export function PlayerBackupRoute() {
  const searchParams = useSearchParams();
  const intent = parsePlayerBackupRouteIntent(searchParams.get('intent'));
  const { view, actions } = usePlayerBackupWizard({ intent });
  return <PlayerBackupWizard view={view} actions={actions} />;
}
