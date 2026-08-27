import { notFound } from 'next/navigation';

import { isPlayerBackupWizardVisible } from '@/lib/playerBackup/playerBackupFlags';

import { PlayerBackupRoute } from './PlayerBackupRoute';

export default async function PlayerBackupPage() {
  if (!isPlayerBackupWizardVisible()) notFound();
  return <PlayerBackupRoute />;
}
