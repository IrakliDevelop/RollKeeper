import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PLAYER_BACKUP_COPY as COPY } from '@/lib/playerBackup/playerBackupCopy';

import { PlayerBackupDashboardSurface } from './PlayerBackupDashboardSurface';

const dashboardState = vi.hoisted(() => ({
  current: {
    ready: false,
    liveStatus: null,
    view: {
      scenario: 'not-started' as const,
      tone: 'none' as const,
      title: 'Protect your characters',
      description: 'Not loaded yet',
      counts: null,
      primary: {
        kind: 'setup' as const,
        label: 'Back up my characters online',
        href: '/player/backup',
      },
      secondary: null,
    },
  },
}));

vi.mock('./usePlayerBackupDashboard', () => ({
  usePlayerBackupDashboard: () => dashboardState.current,
}));

afterEach(cleanup);

describe('PlayerBackupDashboardSurface', () => {
  it('does not offer setup while durable account state is still loading', () => {
    render(<PlayerBackupDashboardSurface />);

    expect(
      screen.queryByRole('heading', { name: COPY.dashboard.notStarted.title })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: COPY.dashboard.notStarted.action })
    ).not.toBeInTheDocument();
  });
});
