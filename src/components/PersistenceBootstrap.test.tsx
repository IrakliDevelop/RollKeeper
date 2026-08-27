import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import { PLAYER_BACKUP_COPY as COPY } from '@/lib/playerBackup/playerBackupCopy';
import { expectPlayerBackupVocabulary } from '@/test/helpers';

const flags = vi.hoisted(() => ({ wizardVisible: false }));

vi.mock('@/lib/playerBackup/playerBackupFlags', async importOriginal => {
  const actual =
    await importOriginal<
      typeof import('@/lib/playerBackup/playerBackupFlags')
    >();
  return {
    ...actual,
    isPlayerBackupWizardVisible: () => flags.wizardVisible,
  };
});

vi.mock('@/lib/indexeddb/characterCutoverSelection', async importOriginal => {
  const actual =
    await importOriginal<
      typeof import('@/lib/indexeddb/characterCutoverSelection')
    >();
  return {
    ...actual,
    isBrowserCharacterCutoverParticipant: () => true,
    readCharacterCutoverSelection: () => ({
      version: 1,
      namespace: 'guest',
      family: 'character',
      selectedAt: 'now',
      activatedEpoch: 1,
      activatedGeneration: 'active',
    }),
  };
});

vi.mock('@/lib/indexeddb/characterPersistenceBootstrap', () => ({
  bootstrapCharacterPersistence: vi.fn(async () => ({
    state: 'RECOVERY_REQUIRED',
    authority: 'indexedDB',
  })),
}));

vi.mock('@/store/playerStore', () => {
  const usePlayerStore = Object.assign(
    vi.fn(() => []),
    {
      persist: { rehydrate: vi.fn(async () => undefined) },
    }
  );
  return { usePlayerStore };
});
vi.mock('@/store/characterStore', () => ({
  useCharacterStore: {
    persist: { rehydrate: vi.fn(async () => undefined) },
  },
}));
vi.mock('@/components/ui/character/useCharacterAutomaticSync', () => ({
  CharacterAutomaticSyncProvider: ({ children }: { children: ReactNode }) =>
    children,
}));

import { PersistenceBootstrap } from '@/components/PersistenceBootstrap';

describe('PersistenceBootstrap recovery shell', () => {
  afterEach(() => {
    cleanup();
    flags.wizardVisible = false;
  });

  it('keeps the technical flag-off recovery screen', async () => {
    flags.wizardVisible = false;
    render(
      <PersistenceBootstrap>
        <p>children</p>
      </PersistenceBootstrap>
    );
    expect(
      await screen.findByRole('heading', { name: 'Recovery required' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/has not fallen back to an older localStorage copy/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Download current character data' })
    ).toBeInTheDocument();
  });

  it('renders the friendly wizard recovery shell when the umbrella flag is on', async () => {
    flags.wizardVisible = true;
    const { container } = render(
      <PersistenceBootstrap>
        <p>children</p>
      </PersistenceBootstrap>
    );
    expect(
      await screen.findByRole('heading', { name: COPY.recovery.title })
    ).toBeInTheDocument();
    expect(screen.getByText(COPY.recovery.description)).toBeInTheDocument();
    expect(
      screen.getByLabelText(COPY.recovery.restoreFrom)
    ).toBeInTheDocument();
    expect(screen.queryByText(/localStorage/i)).not.toBeInTheDocument();
    await waitFor(() => expectPlayerBackupVocabulary(container));
  });
});
