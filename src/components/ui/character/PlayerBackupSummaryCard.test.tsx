import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PLAYER_BACKUP_COPY as COPY } from '@/lib/playerBackup/playerBackupCopy';
import { expectPlayerBackupVocabulary } from '@/test/helpers';

import {
  PLAYER_BACKUP_DASHBOARD_SCENARIOS,
  createPlayerBackupDashboardFixture,
} from './PlayerBackupSummaryCard.fixtures';
import { PlayerBackupSummaryCard } from './PlayerBackupSummaryCard';

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const EXPECTATIONS = {
  'not-started': {
    title: COPY.dashboard.notStarted.title,
    action: COPY.dashboard.notStarted.action,
    href: '/player/backup',
  },
  resumable: {
    title: COPY.dashboard.resumable.title,
    action: COPY.dashboard.resumable.action,
    href: '/player/backup',
  },
  'ongoing-complete': {
    title: COPY.dashboard.ongoing.title,
    action: COPY.dashboard.manage,
    href: '/player/backup?intent=manage',
  },
  'one-time-complete': {
    title: COPY.dashboard.oneTime.title,
    action: COPY.dashboard.manage,
    href: '/player/backup?intent=manage',
  },
  'no-characters': {
    title: COPY.dashboard.noCharacters.title,
    action: COPY.dashboard.noCharacters.action,
    href: '/player/characters/new',
  },
  unavailable: {
    title: COPY.dashboard.unavailable.title,
    action: COPY.dashboard.unavailable.action,
    href: '/player/backup?intent=recovery',
  },
} as const;

describe('PlayerBackupSummaryCard', () => {
  it.each(PLAYER_BACKUP_DASHBOARD_SCENARIOS)(
    'renders approved copy and primary action for %s',
    scenario => {
      const view = createPlayerBackupDashboardFixture(scenario);
      const { container } = render(<PlayerBackupSummaryCard view={view} />);
      const expected = EXPECTATIONS[scenario];
      expect(
        screen.getByRole('heading', { name: expected.title })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: expected.action })
      ).toHaveAttribute('href', expected.href);
      expectPlayerBackupVocabulary(container);
    }
  );

  it('groups manage and restore actions after ongoing completion', () => {
    render(
      <PlayerBackupSummaryCard
        view={createPlayerBackupDashboardFixture('ongoing-complete')}
      />
    );
    expect(
      screen.getByRole('link', { name: COPY.dashboard.manage })
    ).toHaveAttribute('href', '/player/backup?intent=manage');
    expect(
      screen.getByRole('link', { name: COPY.dashboard.restore })
    ).toHaveAttribute('href', '/player/backup?intent=recovery');
    expect(
      screen.getByText(COPY.dashboard.counts.protected)
    ).toBeInTheDocument();
    expect(screen.getByText(COPY.dashboard.counts.paused)).toBeInTheDocument();
  });
});
