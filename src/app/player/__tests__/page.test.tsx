import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PLAYER_BACKUP_COPY as COPY } from '@/lib/playerBackup/playerBackupCopy';
import { expectCloudProductVocabulary } from '@/test/helpers';
import { expectPlayerBackupVocabulary } from '@/test/helpers';
import * as coordinator from '@/lib/playerBackup/playerBackupCoordinator';

import PlayerDashboardPage from '../page';

const originalWizard = process.env.NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE;

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  if (originalWizard === undefined) {
    delete process.env.NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE;
  } else {
    process.env.NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE = originalWizard;
  }
});

describe('PlayerDashboardPage', () => {
  it('renders without a Next app router when account sign-in is disabled', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_AUTH_ENABLED;
    delete process.env.NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE;
    const { container } = render(<PlayerDashboardPage />);
    await screen.findByRole('heading', { name: /player dashboard/i });
    expect(
      screen.queryByRole('button', { name: 'Sign in' })
    ).not.toBeInTheDocument();
    expectCloudProductVocabulary(container);
  });

  it('renders the "Full browser recovery" heading with R17-clean product vocabulary', async () => {
    delete process.env.NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE;
    const { container } = render(<PlayerDashboardPage />);
    await screen.findByRole('heading', { name: /full browser recovery/i });
    expectCloudProductVocabulary(container);
    expect(
      screen.getByRole('button', { name: /join campaign/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^import$/i })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: /new character/i }).length
    ).toBeGreaterThan(0);
  });

  it('does not construct a player-backup coordinator when the wizard flag is off', () => {
    delete process.env.NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE;
    const ctor = vi.spyOn(coordinator, 'PlayerBackupReadOnlyCoordinator');
    render(<PlayerDashboardPage />);
    expect(ctor).not.toHaveBeenCalled();
    ctor.mockRestore();
  });

  it('hides legacy backup surfaces when the wizard flag is on', async () => {
    process.env.NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE = 'true';
    const { container } = render(<PlayerDashboardPage />);
    expect(
      screen.queryByRole('heading', { name: /full browser recovery/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /export all/i })
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole('heading', {
        name: COPY.dashboard.noCharacters.title,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /join campaign/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^import$/i })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: /new character/i }).length
    ).toBeGreaterThan(0);
    expectPlayerBackupVocabulary(container);
  });
});
