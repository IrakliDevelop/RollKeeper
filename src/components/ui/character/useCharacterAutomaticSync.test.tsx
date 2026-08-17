import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { recordAutomaticCharacterEdit } from '@/lib/supabase/automaticCharacterSyncRuntime';
import { createBrowserAutomaticCharacterSync } from '@/lib/supabase/browserAutomaticCharacterSync';
import { subscribeBrowserAutomaticCharacterAccountChanges } from '@/lib/supabase/browserAutomaticCharacterSync';
import { usePlayerStore } from '@/store/playerStore';
import type { PlayerCharacter } from '@/store/playerStore';

import {
  CharacterAutomaticSyncProvider,
  useCharacterAutomaticSync,
} from './useCharacterAutomaticSync';

vi.mock('@/lib/supabase/browserAutomaticCharacterSync', () => ({
  createBrowserAutomaticCharacterSync: vi.fn(),
  subscribeBrowserAutomaticCharacterAccountChanges: vi.fn(
    () => () => undefined
  ),
}));

function Probe() {
  const controller = useCharacterAutomaticSync();
  return (
    <>
      <span>{controller.accountLabel ?? 'none'}</span>
      <button onClick={() => controller.retry('character-a')}>retry</button>
    </>
  );
}

describe('CharacterAutomaticSyncProvider', () => {
  const original =
    process.env.NEXT_PUBLIC_SUPABASE_CHARACTER_AUTOMATIC_SYNC_ENABLED;

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    usePlayerStore.setState({ characters: [], activeCharacterId: null });
    if (original === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_CHARACTER_AUTOMATIC_SYNC_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_CHARACTER_AUTOMATIC_SYNC_ENABLED =
        original;
    }
  });

  it('owns one runtime across routed child changes and cleans it up only with the persistence root', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_CHARACTER_AUTOMATIC_SYNC_ENABLED = 'true';
    const context = automaticContext();
    vi.mocked(createBrowserAutomaticCharacterSync).mockResolvedValue(context);

    const view = render(
      <CharacterAutomaticSyncProvider>
        <Probe />
      </CharacterAutomaticSyncProvider>
    );
    expect(await screen.findByText('Synthetic account')).toBeVisible();
    view.rerender(
      <CharacterAutomaticSyncProvider>
        <div>character sheet route</div>
        <Probe />
      </CharacterAutomaticSyncProvider>
    );
    await expect(recordAutomaticCharacterEdit(character)).resolves.toBe(
      'queued'
    );
    expect(context.service.recordEdit).toHaveBeenCalledWith(character);
    expect(context.coordinator.wake).toHaveBeenCalled();
    expect(createBrowserAutomaticCharacterSync).toHaveBeenCalledOnce();

    view.unmount();
    expect(context.close).toHaveBeenCalledOnce();
  });

  it('reauthentication retry resumes auth-required work before waking the worker', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_CHARACTER_AUTOMATIC_SYNC_ENABLED = 'true';
    const context = automaticContext();
    vi.mocked(createBrowserAutomaticCharacterSync).mockResolvedValue(context);
    render(
      <CharacterAutomaticSyncProvider>
        <Probe />
      </CharacterAutomaticSyncProvider>
    );
    expect(await screen.findByText('Synthetic account')).toBeVisible();

    await act(async () =>
      screen.getByRole('button', { name: 'retry' }).click()
    );
    expect(context.repository.resumeAfterAuthentication).toHaveBeenCalledWith(
      'user:account-a'
    );
    expect(context.repository.retryNow).toHaveBeenCalledWith(
      'user:account-a',
      'character-a'
    );
    expect(context.coordinator.wake).toHaveBeenCalled();
  });

  it('queues a newly persisted future-default character while the root provider remains mounted', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_CHARACTER_AUTOMATIC_SYNC_ENABLED = 'true';
    const context = automaticContext();
    vi.mocked(createBrowserAutomaticCharacterSync).mockResolvedValue(context);
    render(
      <CharacterAutomaticSyncProvider>
        <Probe />
      </CharacterAutomaticSyncProvider>
    );
    expect(await screen.findByText('Synthetic account')).toBeVisible();

    act(() => {
      usePlayerStore.setState({
        characters: [playerCharacter()],
        activeCharacterId: 'character-a',
      });
    });
    await vi.waitFor(() =>
      expect(context.service.recordEdit).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'character-a' })
      )
    );
    expect(context.coordinator.wake).toHaveBeenCalled();
  });

  it('stops the previous account and rebuilds an isolated namespace when auth changes', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_CHARACTER_AUTOMATIC_SYNC_ENABLED = 'true';
    let accountListener: ((accountId: string | null) => void) | undefined;
    vi.mocked(
      subscribeBrowserAutomaticCharacterAccountChanges
    ).mockImplementation(listener => {
      accountListener = listener;
      return vi.fn();
    });
    const accountA = automaticContext('account-a', 'Account A');
    const accountB = automaticContext('account-b', 'Account B');
    vi.mocked(createBrowserAutomaticCharacterSync)
      .mockResolvedValueOnce(accountA)
      .mockResolvedValueOnce(accountB);
    render(
      <CharacterAutomaticSyncProvider>
        <Probe />
      </CharacterAutomaticSyncProvider>
    );
    expect(await screen.findByText('Account A')).toBeVisible();

    act(() => accountListener?.('account-a'));
    await vi.waitFor(() =>
      expect(
        accountA.repository.resumeAfterAuthentication
      ).toHaveBeenCalledWith('user:account-a')
    );

    act(() => accountListener?.('account-b'));
    expect(await screen.findByText('Account B')).toBeVisible();
    expect(accountA.close).toHaveBeenCalledOnce();
    await expect(recordAutomaticCharacterEdit(character)).resolves.toBe(
      'queued'
    );
    expect(accountA.service.recordEdit).not.toHaveBeenCalled();
    expect(accountB.service.recordEdit).toHaveBeenCalledWith(character);
  });
});

const character = {
  id: 'character-a',
  name: 'Aster',
  createdAt: '2026-02-01T00:00:00.000Z',
};

function playerCharacter(): PlayerCharacter {
  return {
    id: 'character-a',
    name: 'Aster',
    race: 'Human',
    class: 'Fighter',
    level: 1,
    createdAt: new Date('2026-02-02T00:00:00.000Z'),
    updatedAt: new Date('2026-02-02T00:00:00.000Z'),
    lastPlayed: new Date('2026-02-02T00:00:00.000Z'),
    characterData: {
      id: 'character-a',
      name: 'Aster',
      revision: 1,
    } as PlayerCharacter['characterData'],
    tags: [],
    isArchived: false,
  };
}

function automaticContext(
  accountId = 'account-a',
  accountLabel = 'Synthetic account'
) {
  return {
    accountId,
    accountLabel,
    indexedDbPrimary: true,
    repository: {
      retryNow: vi.fn(async () => undefined),
      resumeAfterAuthentication: vi.fn(async () => undefined),
      listConflicts: vi.fn(async () => []),
      listQuarantine: vi.fn(async () => []),
    },
    preferences: {},
    service: {
      recordEdit: vi.fn(async () => 'queued' as const),
      recordDelete: vi.fn(async () => 'queued' as const),
      enableCharacter: vi.fn(),
      disableCharacter: vi.fn(),
      previewAccountEnable: vi.fn(),
      confirmAccountEnable: vi.fn(),
    },
    conflicts: { resolve: vi.fn() },
    coordinator: {
      start: vi.fn(async () => undefined),
      stop: vi.fn(),
      wake: vi.fn(async () => undefined),
      manualRefresh: vi.fn(async () => undefined),
    },
    statuses: vi.fn(async () => ({ 'character-a': 'auth-required' as const })),
    documents: vi.fn(async () => []),
    close: vi.fn(),
  } as unknown as NonNullable<
    Awaited<ReturnType<typeof createBrowserAutomaticCharacterSync>>
  >;
}
