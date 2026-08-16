import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CharacterCloudBackupControls } from './CharacterCloudBackupControls';
import type { ManualCharacterCloudContext } from '@/lib/supabase/characterCloud';

const localCharacter = {
  id: 'legacy-a',
  name: 'Aria',
  race: 'Elf',
  class: 'Wizard',
  level: 4,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-02T00:00:00.000Z'),
  lastPlayed: new Date('2024-01-03T00:00:00.000Z'),
  characterData: { id: 'legacy-a', name: 'Aria' },
  tags: [],
  isArchived: false,
};

const cloudRow = {
  id: 'cloud-a',
  legacy_client_id: 'legacy-a',
  name: 'Aria',
  payload: localCharacter,
  schema_version: 1,
  client_revision: 1,
  server_version: 1,
  deleted_at: null,
  created_at: '2026-08-16T00:00:00.000Z',
  updated_at: '2026-08-16T00:00:00.000Z',
};

function enabledEnvironment() {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_AUTH_ENABLED', 'true');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_CHARACTER_BACKUP_ENABLED', 'true');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'public-test-key');
}

function cloudContext(): ManualCharacterCloudContext {
  return {
    getAccount: vi.fn().mockResolvedValue({
      id: 'user-a',
      email: 'owner@example.com',
    }),
    service: {
      backup: vi.fn().mockResolvedValue({
        status: 'verified',
        row: cloudRow,
        fingerprint: 'fingerprint',
      }),
      verify: vi.fn().mockResolvedValue({
        status: 'verified',
        row: cloudRow,
        fingerprint: 'fingerprint',
      }),
      list: vi.fn().mockResolvedValue([cloudRow]),
      archive: vi.fn().mockResolvedValue({
        serverVersion: 2,
        deletedAt: '2026-08-16T01:00:00.000Z',
      }),
      restoreCloudArchive: vi.fn().mockResolvedValue({
        serverVersion: 2,
        deletedAt: null,
      }),
      prepareRestore: vi.fn().mockResolvedValue({
        plan: {
          kind: 'restore-original',
          character: localCharacter,
          attachCloudLink: true,
          reason: null,
        },
        recovery: {
          format: 'rollkeeper-character-cloud-recovery',
          formatVersion: 1,
          downloadedAt: '2026-08-16T00:00:00.000Z',
          cloud: {
            id: 'cloud-a',
            legacyId: 'legacy-a',
            schemaVersion: 1,
            serverVersion: 1,
            deletedAt: null,
          },
          payload: localCharacter,
        },
        link: {
          accountId: 'user-a',
          legacyId: 'legacy-a',
          cloudId: 'cloud-a',
          serverVersion: 1,
          contentFingerprint: 'fingerprint',
        },
      }),
      attachLink: vi.fn(),
    },
  } as unknown as ManualCharacterCloudContext;
}

describe('CharacterCloudBackupControls', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('renders nothing and makes zero character calls while disabled', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_CHARACTER_BACKUP_ENABLED', 'false');
    const cloud = cloudContext();

    const { container } = render(
      <CharacterCloudBackupControls
        characters={[localCharacter]}
        onAddCharacter={vi.fn()}
        cloud={cloud}
      />
    );

    expect(container).toBeEmptyDOMElement();
    expect(cloud.service.list).not.toHaveBeenCalled();
    expect(cloud.service.backup).not.toHaveBeenCalled();
  });

  it('uploads only the explicitly selected guest character after target-account confirmation', async () => {
    enabledEnvironment();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const cloud = cloudContext();

    render(
      <CharacterCloudBackupControls
        characters={[localCharacter]}
        onAddCharacter={vi.fn()}
        cloud={cloud}
      />
    );
    expect(cloud.service.list).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Back up Aria now' }));

    await waitFor(() => expect(cloud.service.backup).toHaveBeenCalledTimes(1));
    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining('owner@example.com')
    );
    expect(cloud.service.backup).toHaveBeenCalledWith(
      localCharacter,
      { id: 'user-a', email: 'owner@example.com' },
      { guestSelected: true, confirmedTargetAccountId: 'user-a' }
    );
    expect(
      screen.getByText(/refetched and fingerprint-verified/i)
    ).toBeVisible();
  });

  it('loads cloud rows only on demand and exposes every manual recovery action', async () => {
    enabledEnvironment();
    const cloud = cloudContext();

    render(
      <CharacterCloudBackupControls
        characters={[localCharacter]}
        onAddCharacter={vi.fn().mockReturnValue(true)}
        cloud={cloud}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Load cloud backups' }));

    await waitFor(() => expect(cloud.service.list).toHaveBeenCalledTimes(1));
    expect(
      screen.getByRole('button', { name: 'Verify Aria cloud copy' })
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Restore Aria' })).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Restore Aria as copy' })
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Archive Aria cloud copy' })
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Download Aria recovery' })
    ).toBeVisible();
  });
});
