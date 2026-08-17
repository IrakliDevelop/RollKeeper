import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AutomaticCharacterSyncController } from './useCharacterAutomaticSync';
import { CharacterAutomaticSyncControls } from './CharacterAutomaticSyncControls';

const characters = [
  {
    id: 'character-a',
    name: 'Aster',
    createdAt: '2026-01-01T00:00:00.000Z',
    characterData: { id: 'character-a', name: 'Aster', revision: 1 },
  },
];

function controller(
  status: AutomaticCharacterSyncController['statuses'][string] = 'local-only'
): AutomaticCharacterSyncController {
  return {
    accountLabel: 'Synthetic account',
    indexedDbPrimary: true,
    statuses: { 'character-a': status },
    busy: null,
    error: null,
    preview: null,
    refresh: vi.fn(async () => undefined),
    enable: vi.fn(async () => undefined),
    disable: vi.fn(async () => undefined),
    retry: vi.fn(async () => undefined),
    previewAccountEnable: vi.fn(async () => ({
      previewId: 'preview-a',
      namespace: 'user:account-a' as const,
      eligible: [
        {
          id: 'character-a',
          name: 'Aster',
          createdAt: characters[0].createdAt,
        },
      ],
      createdAt: '2026-02-01T00:00:00.000Z',
    })),
    confirmAccountEnable: vi.fn(async () => undefined),
    cancelPreview: vi.fn(),
    resolveConflict: vi.fn(async () => undefined),
    downloadQuarantine: vi.fn(async () => undefined),
  };
}

describe('CharacterAutomaticSyncControls', () => {
  const original =
    process.env.NEXT_PUBLIC_SUPABASE_CHARACTER_AUTOMATIC_SYNC_ENABLED;

  afterEach(() => {
    cleanup();
    if (original === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_CHARACTER_AUTOMATIC_SYNC_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_CHARACTER_AUTOMATIC_SYNC_ENABLED =
        original;
    }
  });

  it('renders nothing while the independent deployment flag is disabled', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_CHARACTER_AUTOMATIC_SYNC_ENABLED;
    const { container } = render(
      <CharacterAutomaticSyncControls
        characters={characters}
        controller={controller()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('clearly separates automatic sync and shows truthful local-only selection controls', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_CHARACTER_AUTOMATIC_SYNC_ENABLED = 'true';
    const actions = controller();
    render(
      <CharacterAutomaticSyncControls
        characters={characters}
        controller={actions}
      />
    );

    expect(
      screen.getByRole('heading', { name: 'Automatic character sync' })
    ).toBeVisible();
    expect(screen.getByText('Cloud: local only')).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: 'Enable automatic sync for Aster' })
    );
    await waitFor(() =>
      expect(actions.enable).toHaveBeenCalledWith(characters[0])
    );
  });

  it('shows account-wide eligibility before a separate confirmation', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_CHARACTER_AUTOMATIC_SYNC_ENABLED = 'true';
    const actions = controller();
    render(
      <CharacterAutomaticSyncControls
        characters={characters}
        controller={actions}
      />
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Preview enable all eligible characters',
      })
    );
    expect(await screen.findByText('1 eligible character')).toBeVisible();
    expect(actions.confirmAccountEnable).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Confirm current and future automatic sync',
      })
    );
    await waitFor(() =>
      expect(actions.confirmAccountEnable).toHaveBeenCalledOnce()
    );
  });

  it.each([
    ['queued', 'Cloud: queued'],
    ['syncing', 'Cloud: syncing'],
    ['synced', 'Cloud: synced'],
    ['offline', 'Cloud: offline'],
    ['auth-required', 'Cloud: sign-in required'],
    ['failed', 'Cloud: failed'],
  ] as const)('exposes the %s status accessibly', (status, label) => {
    process.env.NEXT_PUBLIC_SUPABASE_CHARACTER_AUTOMATIC_SYNC_ENABLED = 'true';
    render(
      <CharacterAutomaticSyncControls
        characters={characters}
        controller={controller(status)}
      />
    );
    expect(screen.getByText(label)).toBeVisible();
  });

  it('offers all explicit conflict actions and quarantine export', () => {
    process.env.NEXT_PUBLIC_SUPABASE_CHARACTER_AUTOMATIC_SYNC_ENABLED = 'true';
    const conflict = controller('conflict');
    const { rerender } = render(
      <CharacterAutomaticSyncControls
        characters={characters}
        controller={conflict}
      />
    );
    expect(screen.getByText('Cloud: conflict')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Keep my Aster' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use cloud Aster' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Keep both Aster versions' })
    );
    expect(conflict.resolveConflict).toHaveBeenCalledTimes(3);

    const quarantined = controller('quarantined');
    rerender(
      <CharacterAutomaticSyncControls
        characters={characters}
        controller={quarantined}
      />
    );
    expect(screen.getByText('Cloud: quarantined')).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Download quarantined Aster candidate',
      })
    );
    expect(quarantined.downloadQuarantine).toHaveBeenCalledWith('character-a');
  });
});
