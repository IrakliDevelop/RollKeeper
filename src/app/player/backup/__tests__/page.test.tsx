import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PLAYER_BACKUP_COPY as COPY } from '@/lib/playerBackup/playerBackupCopy';
import { expectPlayerBackupVocabulary } from '@/test/helpers';
import * as coordinator from '@/lib/playerBackup/playerBackupCoordinator';

import PlayerBackupPage from '../page';

const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock('next/navigation', async importOriginal => {
  const actual = await importOriginal<typeof import('next/navigation')>();
  return {
    ...actual,
    useRouter: () => navigation,
    useSearchParams: () => navigation.searchParams,
  };
});

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  navigation.replace.mockClear();
  navigation.push.mockClear();
  navigation.searchParams.delete('intent');
  delete process.env.NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE;
});

describe('/player/backup', () => {
  it('is a 404 while the umbrella flag is off', async () => {
    await expect(PlayerBackupPage()).rejects.toMatchObject({
      digest: 'NEXT_HTTP_ERROR_FALLBACK;404',
    });
  });

  it('renders the client wizard route instead of the placeholder when enabled', async () => {
    process.env.NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE = 'true';
    const { baseElement } = render(await PlayerBackupPage());
    expect(
      screen.queryByText(/guided setup is being introduced/i)
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole('heading', {
        name: 'Back up my characters online',
      }).length
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole('link', { name: /back to my characters/i })
    ).toHaveAttribute('href', '/player');
    expectPlayerBackupVocabulary(baseElement);
  });

  it('returns from sign-in to the backup wizard', async () => {
    process.env.NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE = 'true';
    render(await PlayerBackupPage());
    await userEvent.click(
      screen.getByRole('button', { name: COPY.account.signedOutAction })
    );
    expect(navigation.push).toHaveBeenCalledWith(
      '/account?returnTo=/player/backup'
    );
  });

  it('does not create a backup run merely by opening the route', async () => {
    process.env.NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE = 'true';
    const confirm = vi.spyOn(coordinator, 'confirmPlayerBackupConsent');
    const degraded = vi.spyOn(
      coordinator,
      'confirmDegradedPlayerBackupConsent'
    );
    render(await PlayerBackupPage());
    expect(confirm).not.toHaveBeenCalled();
    expect(degraded).not.toHaveBeenCalled();
    confirm.mockRestore();
    degraded.mockRestore();
  });

  it('does not open compact management from a stale manage intent', async () => {
    process.env.NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE = 'true';
    navigation.searchParams.set('intent', 'manage');
    render(await PlayerBackupPage());
    expect(
      screen.queryByRole('heading', { name: COPY.management.title })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: COPY.account.title })
    ).toBeInTheDocument();
  });
});
