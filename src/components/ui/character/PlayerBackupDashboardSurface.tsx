'use client';

import { PlayerBackupSummaryCard } from './PlayerBackupSummaryCard';
import { usePlayerBackupDashboard } from './usePlayerBackupDashboard';

export function PlayerBackupDashboardSurface() {
  const { view, liveStatus } = usePlayerBackupDashboard();
  return <PlayerBackupSummaryCard view={view} liveStatus={liveStatus} />;
}
