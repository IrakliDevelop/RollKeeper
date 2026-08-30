'use client';

import { PlayerBackupSummaryCard } from './PlayerBackupSummaryCard';
import { usePlayerBackupDashboard } from './usePlayerBackupDashboard';

export function PlayerBackupDashboardSurface() {
  const { view, liveStatus, ready } = usePlayerBackupDashboard();
  if (!ready) return null;
  return <PlayerBackupSummaryCard view={view} liveStatus={liveStatus} />;
}
