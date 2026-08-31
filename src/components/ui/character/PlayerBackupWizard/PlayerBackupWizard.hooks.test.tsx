import 'fake-indexeddb/auto';

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PLAYER_BACKUP_COPY as COPY } from '@/lib/playerBackup/playerBackupCopy';
import { verifyDownloadedDeviceBackup } from '@/lib/deviceRecovery';
import { initCrossTabRosterSync } from '@/lib/crossTabRosterSync';
import {
  confirmPlayerBackupConsent,
  PlayerBackupReadOnlyCoordinator,
} from '@/lib/playerBackup/playerBackupCoordinator';
import { listPlayerBackupConflicts } from '@/lib/playerBackup/playerBackupConflictCoordinator';
import { derivePlayerBackupRunResult } from '@/lib/playerBackup/playerBackupOnlineExecution';
import { previewPlayerBackupCloud } from '@/lib/playerBackup/playerBackupCloudPreview';
import {
  PlayerBackupActiveRunPointerCorruptError,
  PlayerBackupRunReplacedError,
  readActivePlayerBackupRun,
  type PlayerBackupRunV1,
} from '@/lib/playerBackup/playerBackupRunRepository';
import { usePlayerStore, type PlayerCharacter } from '@/store/playerStore';
import { PLAYER_STORAGE_KEY } from '@/utils/constants';
import { makeCharacter } from '@/utils/__tests__/test-utils';

import { usePlayerBackupWizard } from './PlayerBackupWizard.hooks';
import type { PlayerBackupRouteIntent } from '@/lib/playerBackup/playerBackupDashboard';

const auth = vi.hoisted(() => {
  let user: { id: string; email?: string } | null = null;
  let listener:
    | ((
        event: string,
        session: { user: { id: string; email?: string } } | null
      ) => void)
    | null = null;
  return {
    getUser: vi.fn(async () => {
      await Promise.resolve();
      return { data: { user }, error: null };
    }),
    onAuthStateChange: vi.fn(
      (
        callback: (
          event: string,
          session: { user: { id: string; email?: string } } | null
        ) => void
      ) => {
        listener = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }
    ),
    emit(next: { id: string; email?: string } | null) {
      user = next;
      listener?.('SIGNED_IN', next ? { user: next } : null);
    },
    reset() {
      user = null;
      listener = null;
      this.getUser.mockClear();
      this.onAuthStateChange.mockClear();
    },
  };
});

const safety = vi.hoisted(() => {
  let deferred: {
    resolve: (value: {
      broad: { runId: string };
      currentCharacters: null;
    }) => void;
  } | null = null;
  return {
    savePlayerBackupSafetyFiles: vi.fn(
      () =>
        new Promise<{
          broad: { runId: string };
          currentCharacters: null;
        }>(resolve => {
          deferred = { resolve };
        })
    ),
    finishSave() {
      deferred?.resolve({
        broad: { runId: 'bundle-a' },
        currentCharacters: null,
      });
      deferred = null;
    },
  };
});

const conflictApis = vi.hoisted(() => ({
  resolvePlayerBackupConflict: vi.fn(),
  drainPlayerBackupRunWork: vi.fn(),
  settlePlayerBackupOneTimeConflicts: vi.fn(),
  applyPlayerBackupPendingApplication: vi.fn(),
}));

const coordinatorApis = vi.hoisted(() => ({
  confirmPlayerBackupConsent: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock('@/lib/supabase/browser', () => ({
  createSupabaseBrowserClient: () => ({ auth }),
}));

vi.mock('@/lib/supabase/authConfig', () => ({
  isAuthEnabled: () => true,
  getPublicAuthConfig: () => ({
    url: 'http://localhost',
    publishableKey: 'test',
  }),
}));

vi.mock('@/lib/playerBackup/playerBackupSafety', async importOriginal => {
  const actual =
    await importOriginal<
      typeof import('@/lib/playerBackup/playerBackupSafety')
    >();
  return {
    ...actual,
    savePlayerBackupSafetyFiles: safety.savePlayerBackupSafetyFiles,
  };
});

vi.mock('@/lib/playerBackup/playerBackupCoordinator', async importOriginal => {
  const actual =
    await importOriginal<
      typeof import('@/lib/playerBackup/playerBackupCoordinator')
    >();
  return {
    ...actual,
    confirmPlayerBackupConsent: coordinatorApis.confirmPlayerBackupConsent,
  };
});

vi.mock('@/lib/deviceRecovery', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/deviceRecovery')>();
  return {
    ...actual,
    captureDeviceBackup: vi.fn(),
    initiateDeviceBackupDownload: vi.fn(async () => undefined),
    verifyDownloadedDeviceBackup: vi.fn(),
  };
});

vi.mock(
  '@/lib/playerBackup/playerBackupConflictResolution',
  async importOriginal => {
    const actual =
      await importOriginal<
        typeof import('@/lib/playerBackup/playerBackupConflictResolution')
      >();
    return {
      ...actual,
      resolvePlayerBackupConflict: conflictApis.resolvePlayerBackupConflict,
      drainPlayerBackupRunWork: conflictApis.drainPlayerBackupRunWork,
      settlePlayerBackupOneTimeConflicts:
        conflictApis.settlePlayerBackupOneTimeConflicts,
      applyPlayerBackupPendingApplication:
        conflictApis.applyPlayerBackupPendingApplication,
    };
  }
);

const restoreApis = vi.hoisted(() => ({
  restorePlayerBackupCharacter: vi.fn(),
  restorePlayerBackupCharacterWithoutRun: vi.fn(),
}));

vi.mock('@/lib/playerBackup/playerBackupManagement', async importOriginal => {
  const actual =
    await importOriginal<
      typeof import('@/lib/playerBackup/playerBackupManagement')
    >();
  return {
    ...actual,
    restorePlayerBackupCharacter: restoreApis.restorePlayerBackupCharacter,
    restorePlayerBackupCharacterWithoutRun:
      restoreApis.restorePlayerBackupCharacterWithoutRun,
  };
});

vi.mock('@/lib/playerBackup/playerBackupCloudPreview', async importOriginal => {
  const actual =
    await importOriginal<
      typeof import('@/lib/playerBackup/playerBackupCloudPreview')
    >();
  return {
    ...actual,
    previewPlayerBackupCloud: vi.fn(async () => ({
      account: { id: 'acc-a', email: 'a@example.com' },
      characters: [],
      onlineOnly: [],
    })),
    createBrowserPlayerBackupCloudPreview: vi.fn(() => ({
      auth,
      gateway: { list: async () => [] },
    })),
  };
});

vi.mock(
  '@/lib/playerBackup/playerBackupOnlineExecution',
  async importOriginal => {
    const actual =
      await importOriginal<
        typeof import('@/lib/playerBackup/playerBackupOnlineExecution')
      >();
    return {
      ...actual,
      withExistingDatabase: vi.fn(
        async (
          _factory: IDBFactory,
          task: (database: IDBDatabase) => Promise<unknown>
        ) => task({} as IDBDatabase)
      ),
      derivePlayerBackupRunResult: vi.fn(async () => ({
        runId: 'run-1',
        accountId: 'acc-a',
        mode: 'one-time',
        executionPath: 'integrated',
        protected: [],
        queued: [],
        offline: [],
        authRequired: [],
        needsAttention: [],
        heldAside: [],
        failed: [],
        pending: [],
        outcomes: {},
        complete: false,
      })),
    };
  }
);

const FAKE_RUN = vi.hoisted(
  (): PlayerBackupRunV1 => ({
    version: 1,
    runId: 'run-1',
    accountId: 'acc-a',
    namespace: 'user:acc-a',
    mode: 'one-time',
    eligibleCharacterIds: ['hero-a'],
    selectedCharacterIds: ['hero-a'],
    clearedCharacterIds: [],
    futureDefault: 'off',
    broadSafetyReceipt: {
      runId: 'safety',
      manifestHash: 'hash',
      createdAt: 'now',
      protectedEntryDigest: 'digest',
    },
    authority: {
      kind: 'legacy',
      namespace: 'user:acc-a',
      family: 'character',
    },
    confirmedAt: 'now',
    stage: 'local-ready',
    characterCheckpoints: {},
    executionPath: 'integrated',
  })
);

vi.mock(
  '@/lib/playerBackup/playerBackupRunRepository',
  async importOriginal => {
    const actual =
      await importOriginal<
        typeof import('@/lib/playerBackup/playerBackupRunRepository')
      >();
    return {
      ...actual,
      readActivePlayerBackupRun: vi.fn(async ({ accountId }) =>
        accountId === 'acc-a'
          ? {
              ...FAKE_RUN,
              accountId,
              namespace: `user:${accountId}`,
            }
          : null
      ),
    };
  }
);

vi.mock(
  '@/lib/playerBackup/playerBackupConflictCoordinator',
  async importOriginal => {
    const actual =
      await importOriginal<
        typeof import('@/lib/playerBackup/playerBackupConflictCoordinator')
      >();
    return {
      ...actual,
      listPlayerBackupConflicts: vi.fn(async () => ({
        accountId: 'acc-a',
        runId: 'run-1',
        conflicts: [
          {
            conflictId: 'conflict-1',
            legacyId: 'hero-a',
            pendingApplicationLegacyId: null,
            mutationId: 'mutation-1',
            comparison: 'different',
            archived: false,
            originPlayerBackupRunId: 'run-1',
            detectedAt: 'now',
            resolutionState: 'unresolved',
            allowedResolutions: ['keep-mine', 'use-cloud', 'keep-both'],
          },
        ],
        heldAside: [],
      })),
    };
  }
);

function decodedOnlineOnly(options: {
  id: string;
  legacyId: string;
  name: string;
  deletedAt?: string | null;
  status?: 'supported' | 'quarantined';
}) {
  const row = {
    id: options.id,
    legacy_client_id: options.legacyId,
    name: options.name,
    payload: { id: options.legacyId, name: options.name },
    schema_version: 1,
    client_revision: 1,
    server_version: 1,
    deleted_at: options.deletedAt ?? null,
    created_at: '2026-08-26T00:00:00.000Z',
    updated_at: '2026-08-26T00:00:00.000Z',
  };
  return {
    status: options.status ?? ('supported' as const),
    row,
    rawPayload: row.payload,
    localCharacter: {
      id: options.legacyId,
      name: options.name,
      characterData: { id: options.legacyId, name: options.name },
    },
    contentFingerprint: 'fp',
    quarantineReason: null,
  };
}

function CloudRestoreProbe({
  intent,
}: {
  intent?: PlayerBackupRouteIntent | null;
}) {
  const { view, actions } = usePlayerBackupWizard({ intent });
  return (
    <div>
      <span data-testid="surface">{view.surface}</span>
      <span data-testid="step">{view.step}</span>
      <span data-testid="signed-in">{String(view.account.signedIn)}</span>
      <span data-testid="recovery-title">{view.recovery.title}</span>
      <span data-testid="action-error">{view.actionError ?? ''}</span>
      <ul data-testid="management-rows">
        {view.management.rows.map(row => (
          <li key={row.id}>
            <span data-testid={`row-${row.id}-name`}>{row.name}</span>
            {row.actions.map(action => (
              <button
                key={action.action}
                type="button"
                data-testid={`row-${row.id}-${action.action}`}
                disabled={!action.enabled || view.busy}
                onClick={() => {
                  if (action.action === 'restore-here') {
                    actions.onRestoreHere(row.id);
                  }
                  if (action.action === 'restore-copy') {
                    actions.onRestoreCopy(row.id);
                  }
                }}
              >
                {action.label}
              </button>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Probe() {
  const { view, actions } = usePlayerBackupWizard();
  return (
    <div>
      <span data-testid="alert">{view.selection.alert ?? ''}</span>
      <span data-testid="signed-in">{String(view.account.signedIn)}</span>
      <span data-testid="account-error">{view.account.error ?? ''}</span>
      <span data-testid="receipt">{view.safety.receipt}</span>
      <span data-testid="live-status">{view.liveStatus ?? ''}</span>
      <span data-testid="action-error">{view.actionError ?? ''}</span>
      <span data-testid="continue">{String(view.result.continueSetup)}</span>
      <span data-testid="run-ready">{String(view.result.closeSafe)}</span>
      <span data-testid="apply-id">
        {view.result.conflicts[0]?.applicationLegacyId ?? ''}
      </span>
      <span data-testid="result-title">{view.result.title}</span>
      <span data-testid="result-headline">{view.result.headline}</span>
      <span data-testid="result-row-status">
        {view.result.rows[0]?.statusLabel ?? ''}
      </span>
      <span data-testid="surface">{view.surface}</span>
      <span data-testid="step">{view.step}</span>
      <button type="button" onClick={actions.onSaveSafetyFile}>
        save-safety
      </button>
      <button
        type="button"
        onClick={() =>
          actions.onChooseSafetyFile(
            new File(['{}'], 'rollkeeper-device-backup.json', {
              type: 'application/json',
            })
          )
        }
      >
        choose-safety
      </button>
      <button
        type="button"
        onClick={() => actions.onResolveConflict('conflict-1', 'keep-both')}
      >
        resolve-both
      </button>
      <button
        type="button"
        onClick={() => actions.onResolveConflict('conflict-1', 'keep-mine')}
      >
        resolve-mine
      </button>
      <button
        type="button"
        onClick={() =>
          actions.onApplyPending(
            view.result.conflicts[0]?.applicationLegacyId ?? 'hero-a'
          )
        }
      >
        apply-pending
      </button>
      <button type="button" onClick={actions.onCheckNow}>
        check-now
      </button>
      <button type="button" onClick={actions.onNext}>
        next
      </button>
      <button type="button" onClick={actions.onConfirm}>
        confirm
      </button>
    </div>
  );
}

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  auth.reset();
  vi.clearAllMocks();
});

beforeEach(() => {
  process.env.NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE = 'true';
  process.env.NEXT_PUBLIC_SUPABASE_CHARACTER_BACKUP_ENABLED = 'true';
  process.env.NEXT_PUBLIC_CHARACTER_INDEXEDDB_CUTOVER_ENABLED = 'true';
  process.env.NEXT_PUBLIC_SUPABASE_CHARACTER_AUTOMATIC_SYNC_ENABLED = 'true';
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: { request: vi.fn() },
  });
  vi.mocked(readActivePlayerBackupRun).mockImplementation(
    async ({ accountId }) =>
      accountId === 'acc-a'
        ? {
            ...FAKE_RUN,
            accountId,
            namespace: `user:${accountId}`,
          }
        : null
  );
  coordinatorApis.confirmPlayerBackupConsent.mockReset();
  restoreApis.restorePlayerBackupCharacter.mockReset();
  restoreApis.restorePlayerBackupCharacterWithoutRun.mockReset();
  restoreApis.restorePlayerBackupCharacter.mockResolvedValue({
    plan: { kind: 'attach-link', character: null, attachCloudLink: false },
    link: {},
  });
  restoreApis.restorePlayerBackupCharacterWithoutRun.mockResolvedValue({
    plan: { kind: 'attach-link', character: null, attachCloudLink: false },
    link: {},
  });
  usePlayerStore.setState({ characters: [], characterTombstones: {} });
});

async function signIn(id: string, email: string) {
  auth.emit({ id, email });
  render(<Probe />);
  await waitFor(() => {
    expect(screen.getByTestId('signed-in')).toHaveTextContent('true');
  });
}

describe('usePlayerBackupWizard', () => {
  it('treats a missing auth session as signed out instead of an error', async () => {
    auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: Object.assign(new Error('Auth session missing!'), {
        name: 'AuthSessionMissingError',
        __isAuthError: true,
        status: 400,
      }) as never,
    });

    render(<Probe />);

    await waitFor(() => expect(auth.getUser).toHaveBeenCalled());
    expect(screen.getByTestId('signed-in')).toHaveTextContent('false');
    expect(screen.getByTestId('account-error')).toHaveTextContent('');
  });

  it('does not treat the first sign-in as an account change', async () => {
    await signIn('acc-a', 'a@example.com');
    expect(screen.getByTestId('alert')).toHaveTextContent('');
  });

  it('announces an account change only when switching between signed-in accounts', async () => {
    await signIn('acc-a', 'a@example.com');
    auth.emit({ id: 'acc-b', email: 'b@example.com' });
    await waitFor(() => {
      expect(screen.getByTestId('alert')).toHaveTextContent(
        COPY.selection.accountChanged
      );
    });
  });

  it('discards a safety-file save that finishes after the account changed', async () => {
    const user = userEvent.setup();
    await signIn('acc-a', 'a@example.com');
    await user.click(screen.getByRole('button', { name: 'save-safety' }));
    await waitFor(() => {
      expect(safety.savePlayerBackupSafetyFiles).toHaveBeenCalled();
    });
    auth.emit({ id: 'acc-b', email: 'b@example.com' });
    await waitFor(() => {
      expect(screen.getByTestId('receipt')).toHaveTextContent('needed');
    });
    safety.finishSave();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId('receipt')).toHaveTextContent('needed');
    expect(screen.getByTestId('receipt')).not.toHaveTextContent(
      'download-started'
    );
  });

  it('replaces a stale safety mismatch announcement after verification', async () => {
    const user = userEvent.setup();
    await signIn('acc-a', 'a@example.com');
    await user.click(screen.getByRole('button', { name: 'save-safety' }));
    await waitFor(() => {
      expect(safety.savePlayerBackupSafetyFiles).toHaveBeenCalled();
    });
    safety.finishSave();
    await waitFor(() => {
      expect(screen.getByTestId('receipt')).toHaveTextContent(
        'download-started'
      );
    });

    vi.mocked(verifyDownloadedDeviceBackup).mockRejectedValueOnce(
      new Error('mismatch')
    );
    await user.click(screen.getByRole('button', { name: 'choose-safety' }));
    await waitFor(() => {
      expect(screen.getByTestId('live-status')).toHaveTextContent(
        COPY.safety.mismatchTitle
      );
    });

    vi.mocked(verifyDownloadedDeviceBackup).mockResolvedValueOnce({} as never);
    await user.click(screen.getByRole('button', { name: 'choose-safety' }));
    await waitFor(() => {
      expect(screen.getByTestId('receipt')).toHaveTextContent('checked');
      expect(screen.getByTestId('live-status')).toHaveTextContent(
        COPY.safety.verifiedTitle
      );
    });
  });

  it('supplies a copy id and drains then settles a one-time keep-both resolution', async () => {
    const user = userEvent.setup();
    conflictApis.resolvePlayerBackupConflict.mockResolvedValue({
      status: 'resolved',
      resolution: 'keep-both',
      apply: null,
      workQueued: true,
    });
    conflictApis.drainPlayerBackupRunWork.mockResolvedValue(['synced']);
    conflictApis.settlePlayerBackupOneTimeConflicts.mockResolvedValue({
      settled: ['hero-a'],
      pending: [],
    });
    await signIn('acc-a', 'a@example.com');
    await waitFor(() => {
      expect(screen.getByTestId('run-ready')).toHaveTextContent('true');
    });
    await user.click(screen.getByRole('button', { name: 'resolve-both' }));
    await waitFor(() => {
      expect(conflictApis.resolvePlayerBackupConflict).toHaveBeenCalled();
    });
    expect(conflictApis.resolvePlayerBackupConflict).toHaveBeenCalledWith(
      expect.objectContaining({
        resolution: 'keep-both',
        copyLegacyId: expect.any(String),
      })
    );
    const copyLegacyId = conflictApis.resolvePlayerBackupConflict.mock
      .calls[0]?.[0]?.copyLegacyId as string;
    expect(copyLegacyId).not.toBe('hero-a');
    await waitFor(() => {
      expect(conflictApis.drainPlayerBackupRunWork).toHaveBeenCalled();
      expect(
        conflictApis.settlePlayerBackupOneTimeConflicts
      ).toHaveBeenCalled();
    });
  });

  it('does not acknowledge a rejected roster write', async () => {
    const user = userEvent.setup();
    let acknowledged = false;
    conflictApis.applyPlayerBackupPendingApplication.mockImplementation(
      async ({ write }) => {
        await write({
          kind: 'replace',
          legacyId: 'missing-hero',
          payload: { id: 'missing-hero', name: 'Ghost' },
          contentFingerprint: 'fp',
        });
        acknowledged = true;
        return true;
      }
    );
    await signIn('acc-a', 'a@example.com');
    await waitFor(() => {
      expect(screen.getByTestId('run-ready')).toHaveTextContent('true');
    });
    await user.click(screen.getByRole('button', { name: 'apply-pending' }));
    await waitFor(() => {
      expect(
        conflictApis.applyPlayerBackupPendingApplication
      ).toHaveBeenCalled();
    });
    expect(acknowledged).toBe(false);
    expect(screen.getByTestId('action-error')).toHaveTextContent(
      COPY.errors.online
    );
  });

  it('applies a keep-both target id and settles the one-time run afterwards', async () => {
    const user = userEvent.setup();
    vi.mocked(derivePlayerBackupRunResult).mockResolvedValueOnce({
      runId: 'run-1',
      accountId: 'acc-a',
      mode: 'one-time',
      executionPath: 'integrated',
      protected: [],
      queued: [],
      offline: [],
      authRequired: [],
      needsAttention: [],
      heldAside: [],
      failed: [],
      pending: ['hero-a'],
      outcomes: {
        'hero-a': {
          outcome: 'pending',
          reason: 'roster-application-pending',
        },
      },
      complete: false,
    });
    vi.mocked(listPlayerBackupConflicts).mockResolvedValueOnce({
      accountId: 'acc-a',
      runId: 'run-1',
      conflicts: [
        {
          conflictId: 'conflict-1',
          legacyId: 'hero-a',
          pendingApplicationLegacyId: 'hero-copy',
          mutationId: 'mutation-1',
          comparison: 'different',
          archived: false,
          originPlayerBackupRunId: 'run-1',
          detectedAt: 'now',
          resolutionState: 'resolved',
          allowedResolutions: [],
          localCandidate: null,
          cloudCandidate: {} as never,
        },
      ],
      heldAside: [],
    });
    conflictApis.applyPlayerBackupPendingApplication.mockResolvedValueOnce(
      true
    );
    conflictApis.settlePlayerBackupOneTimeConflicts.mockResolvedValueOnce({
      settled: ['hero-a'],
      pending: [],
    });

    await signIn('acc-a', 'a@example.com');
    await waitFor(() => {
      expect(screen.getByTestId('apply-id')).toHaveTextContent('hero-copy');
    });
    await user.click(screen.getByRole('button', { name: 'apply-pending' }));

    await waitFor(() => {
      expect(
        conflictApis.applyPlayerBackupPendingApplication
      ).toHaveBeenCalledWith(
        expect.objectContaining({ legacyId: 'hero-copy' })
      );
      expect(
        conflictApis.settlePlayerBackupOneTimeConflicts
      ).toHaveBeenCalled();
    });
  });

  it('projects durable queued work as backing up instead of attention', async () => {
    vi.mocked(derivePlayerBackupRunResult).mockResolvedValueOnce({
      runId: 'run-1',
      accountId: 'acc-a',
      mode: 'ongoing',
      executionPath: 'integrated',
      protected: [],
      queued: ['hero-a'],
      offline: [],
      authRequired: [],
      needsAttention: [],
      heldAside: [],
      failed: [],
      pending: [],
      outcomes: {
        'hero-a': { outcome: 'queued', reason: null },
      },
      complete: false,
    });

    await signIn('acc-a', 'a@example.com');

    await waitFor(() => {
      expect(screen.getByTestId('result-title')).toHaveTextContent(
        COPY.result.backingUpTitle
      );
      expect(screen.getByTestId('result-headline')).toHaveTextContent(
        COPY.result.backingUpHeadline(1)
      );
      expect(screen.getByTestId('continue')).toHaveTextContent('false');
    });
  });

  it('reloads durable run results and conflicts when checking now', async () => {
    const user = userEvent.setup();
    const loadResult = vi.spyOn(
      PlayerBackupReadOnlyCoordinator.prototype,
      'loadResult'
    );
    const loadConflicts = vi.spyOn(
      PlayerBackupReadOnlyCoordinator.prototype,
      'loadConflicts'
    );
    await signIn('acc-a', 'a@example.com');
    await waitFor(() => {
      expect(screen.getByTestId('run-ready')).toHaveTextContent('true');
    });
    loadResult.mockClear();
    loadConflicts.mockClear();
    await user.click(screen.getByRole('button', { name: 'check-now' }));
    await waitFor(() => {
      expect(loadResult).toHaveBeenCalled();
      expect(loadConflicts).toHaveBeenCalled();
    });
    expect(
      vi.mocked(derivePlayerBackupRunResult).mock.calls.at(-1)?.[0].repository
    ).toBeDefined();
  });

  it('reloads the winning run when another tab replaces confirmation', async () => {
    const user = userEvent.setup();
    let activeRun: PlayerBackupRunV1 | null = null;
    const winningRun = {
      ...FAKE_RUN,
      runId: 'run-winning',
      mode: 'ongoing' as const,
    };
    vi.mocked(readActivePlayerBackupRun).mockImplementation(
      async () => activeRun
    );
    vi.mocked(verifyDownloadedDeviceBackup).mockResolvedValue({
      format: 'rollkeeper-device-backup',
      formatVersion: 1,
      appVersion: 'test',
      runId: 'safety',
      createdAt: 'now',
      entries: [],
      manifestHash: 'hash',
      validation: {
        entryCount: 0,
        totalBytes: 0,
        validJsonCount: 0,
        malformedJsonCount: 0,
        futureVersionCount: 0,
        retainedOnlyCount: 0,
      },
    });
    vi.mocked(confirmPlayerBackupConsent).mockImplementation(async () => {
      activeRun = winningRun;
      throw new PlayerBackupRunReplacedError();
    });
    vi.mocked(listPlayerBackupConflicts).mockRejectedValueOnce(
      new Error('winning run is still preparing')
    );
    usePlayerStore.setState({
      characters: [
        {
          id: 'hero-a',
          name: 'Hero A',
          class: 'Fighter',
        } as never,
      ],
    });

    await signIn('acc-a', 'a@example.com');
    await user.click(screen.getByRole('button', { name: 'next' }));
    await user.click(screen.getByRole('button', { name: 'save-safety' }));
    await waitFor(() => {
      expect(safety.savePlayerBackupSafetyFiles).toHaveBeenCalled();
    });
    safety.finishSave();
    await waitFor(() => {
      expect(screen.getByTestId('receipt')).toHaveTextContent(
        'download-started'
      );
    });
    await user.click(screen.getByRole('button', { name: 'choose-safety' }));
    await waitFor(() => {
      expect(screen.getByTestId('receipt')).toHaveTextContent('checked');
    });
    await user.click(screen.getByRole('button', { name: 'next' }));
    await user.click(screen.getByRole('button', { name: 'confirm' }));

    await waitFor(() => {
      expect(screen.getByTestId('step')).toHaveTextContent('result');
      expect(screen.getByTestId('action-error')).toHaveTextContent('');
    });
    expect(confirmPlayerBackupConsent).toHaveBeenCalledTimes(1);
    expect(readActivePlayerBackupRun).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'acc-a' })
    );
  });

  it('keeps stale manage intent on setup until durable evidence exists', async () => {
    function ManageProbe() {
      const { view } = usePlayerBackupWizard({ intent: 'manage' });
      return (
        <div>
          <span data-testid="surface">{view.surface}</span>
          <span data-testid="signed-in">{String(view.account.signedIn)}</span>
        </div>
      );
    }
    render(<ManageProbe />);
    await waitFor(() => expect(auth.getUser).toHaveBeenCalled());
    expect(screen.getByTestId('signed-in')).toHaveTextContent('false');
    expect(screen.getByTestId('surface')).toHaveTextContent('wizard');
  });

  it('keeps an unfinished durable run on its result surface', async () => {
    vi.mocked(listPlayerBackupConflicts).mockResolvedValueOnce({
      accountId: 'acc-a',
      runId: 'run-1',
      conflicts: [],
      heldAside: [],
    });
    function ManageProbe() {
      const { view } = usePlayerBackupWizard({ intent: 'manage' });
      return (
        <div>
          <span data-testid="surface">{view.surface}</span>
          <span data-testid="step">{view.step}</span>
        </div>
      );
    }
    auth.emit({ id: 'acc-a', email: 'a@example.com' });
    render(<ManageProbe />);
    await waitFor(() => {
      expect(screen.getByTestId('step')).toHaveTextContent('result');
    });
    expect(screen.getByTestId('surface')).toHaveTextContent('wizard');
  });

  it('exposes restore actions for online-only copies on the recovery surface without a local run', async () => {
    vi.mocked(readActivePlayerBackupRun).mockResolvedValue(null);
    vi.mocked(previewPlayerBackupCloud).mockResolvedValue({
      account: { id: 'acc-a', email: 'a@example.com' },
      characters: [],
      onlineOnly: [
        decodedOnlineOnly({
          id: 'cloud-nyx',
          legacyId: 'nyx',
          name: 'Nyx Emberveil',
        }),
      ],
    });
    auth.emit({ id: 'acc-a', email: 'a@example.com' });
    render(<CloudRestoreProbe intent="recovery" />);
    await waitFor(() => {
      expect(screen.getByTestId('surface')).toHaveTextContent('recovery');
      expect(screen.getByTestId('row-nyx-restore-here')).toBeEnabled();
    });
    expect(screen.getByTestId('row-nyx-name')).toHaveTextContent(
      'Nyx Emberveil'
    );
    expect(screen.getByTestId('row-nyx-restore-here')).toBeEnabled();
    expect(screen.getByTestId('row-nyx-restore-copy')).toBeEnabled();
  });

  it('honors manage intent for recoverable online-only copies without a local run', async () => {
    vi.mocked(readActivePlayerBackupRun).mockResolvedValue(null);
    vi.mocked(previewPlayerBackupCloud).mockResolvedValue({
      account: { id: 'acc-a', email: 'a@example.com' },
      characters: [],
      onlineOnly: [
        decodedOnlineOnly({
          id: 'cloud-nyx',
          legacyId: 'nyx',
          name: 'Nyx Emberveil',
        }),
      ],
    });
    auth.emit({ id: 'acc-a', email: 'a@example.com' });
    render(<CloudRestoreProbe intent="manage" />);
    await waitFor(() => {
      expect(screen.getByTestId('surface')).toHaveTextContent('manage');
    });
    expect(screen.getByTestId('row-nyx-restore-here')).toBeEnabled();
    expect(screen.getByTestId('row-nyx-remove')).toBeDisabled();
  });

  it('routes a no-run differing same-ID cloud row onto recovery and manage', async () => {
    vi.mocked(readActivePlayerBackupRun).mockResolvedValue(null);
    const local = {
      id: 'hero-a',
      name: 'Local Diverged',
      race: 'Elf',
      class: 'Wizard',
      level: 4,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
      lastPlayed: new Date('2024-01-03T00:00:00.000Z'),
      characterData: { id: 'hero-a', name: 'Local Diverged' },
      tags: [],
      isArchived: false,
    };
    usePlayerStore.setState({
      characters: [local as unknown as PlayerCharacter],
    });
    const decoded = decodedOnlineOnly({
      id: 'cloud-hero',
      legacyId: 'hero-a',
      name: 'Aria',
    });
    vi.mocked(previewPlayerBackupCloud).mockResolvedValue({
      account: { id: 'acc-a', email: 'a@example.com' },
      characters: [
        {
          legacyId: 'hero-a',
          name: 'Aria',
          state: 'different',
          row: decoded.row,
          decoded,
        },
      ],
      onlineOnly: [],
    });
    auth.emit({ id: 'acc-a', email: 'a@example.com' });
    const { unmount } = render(<CloudRestoreProbe intent="recovery" />);
    await waitFor(() => {
      expect(screen.getByTestId('row-hero-a-restore-here')).toBeEnabled();
    });
    expect(screen.getByTestId('surface')).toHaveTextContent('recovery');
    unmount();
    render(<CloudRestoreProbe intent="manage" />);
    await waitFor(() => {
      expect(screen.getByTestId('surface')).toHaveTextContent('manage');
    });
    expect(screen.getByTestId('row-hero-a-restore-copy')).toBeEnabled();
  });

  it('clears the previous account cloud restore rows before showing the next account', async () => {
    vi.mocked(readActivePlayerBackupRun).mockResolvedValue(null);
    vi.mocked(previewPlayerBackupCloud).mockImplementation(async options => {
      const id = (await options.auth.getUser()).data.user?.id;
      if (id === 'acc-a') {
        return {
          account: { id: 'acc-a', email: 'a@example.com' },
          characters: [],
          onlineOnly: [
            decodedOnlineOnly({
              id: 'cloud-a',
              legacyId: 'nyx',
              name: 'Nyx Emberveil',
            }),
          ],
        };
      }
      return {
        account: { id: 'acc-b', email: 'b@example.com' },
        characters: [],
        onlineOnly: [
          decodedOnlineOnly({
            id: 'cloud-b',
            legacyId: 'bramble',
            name: 'Bramblewick Sable',
          }),
        ],
      };
    });
    auth.emit({ id: 'acc-a', email: 'a@example.com' });
    render(<CloudRestoreProbe intent="recovery" />);
    await waitFor(() => {
      expect(screen.getByTestId('row-nyx-name')).toHaveTextContent(
        'Nyx Emberveil'
      );
    });
    auth.emit({ id: 'acc-b', email: 'b@example.com' });
    await waitFor(() => {
      expect(screen.queryByTestId('row-nyx-name')).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByTestId('row-bramble-name')).toHaveTextContent(
        'Bramblewick Sable'
      );
    });
  });

  it('keeps future and unavailable cloud rows from offering restore', async () => {
    vi.mocked(readActivePlayerBackupRun).mockResolvedValue(null);
    const future = decodedOnlineOnly({
      id: 'cloud-future',
      legacyId: 'future-hero',
      name: 'Future Hero',
      status: 'quarantined',
    });
    vi.mocked(previewPlayerBackupCloud).mockResolvedValue({
      account: { id: 'acc-a', email: 'a@example.com' },
      characters: [],
      onlineOnly: [future],
    });
    auth.emit({ id: 'acc-a', email: 'a@example.com' });
    render(<CloudRestoreProbe intent="recovery" />);
    await waitFor(() => {
      expect(screen.getByTestId('row-future-hero-name')).toHaveTextContent(
        'Future Hero'
      );
    });
    expect(screen.getByTestId('row-future-hero-restore-here')).toBeDisabled();
    expect(screen.getByTestId('row-future-hero-restore-copy')).toBeDisabled();
  });

  it('honors manage intent after durable protection exists', async () => {
    vi.mocked(derivePlayerBackupRunResult).mockResolvedValueOnce({
      runId: 'run-1',
      accountId: 'acc-a',
      mode: 'one-time',
      executionPath: 'integrated',
      protected: ['hero-a'],
      queued: [],
      offline: [],
      authRequired: [],
      needsAttention: [],
      heldAside: [],
      failed: [],
      pending: [],
      outcomes: {
        'hero-a': { outcome: 'protected', reason: null },
      },
      complete: true,
    });
    function ManageProbe() {
      const { view } = usePlayerBackupWizard({ intent: 'manage' });
      return <span data-testid="surface">{view.surface}</span>;
    }
    auth.emit({ id: 'acc-a', email: 'a@example.com' });
    render(<ManageProbe />);
    await waitFor(() => {
      expect(screen.getByTestId('surface')).toHaveTextContent('manage');
    });
  });

  it('restores a no-run online copy under its original ID and reloads cloud preview', async () => {
    vi.mocked(readActivePlayerBackupRun).mockResolvedValue(null);
    vi.mocked(previewPlayerBackupCloud).mockResolvedValue({
      account: { id: 'acc-a', email: 'a@example.com' },
      characters: [],
      onlineOnly: [
        decodedOnlineOnly({
          id: 'cloud-nyx',
          legacyId: 'nyx',
          name: 'Nyx Emberveil',
        }),
      ],
    });
    restoreApis.restorePlayerBackupCharacterWithoutRun.mockImplementation(
      async options => {
        const character = {
          id: 'nyx',
          name: 'Nyx Emberveil',
          characterData: { id: 'nyx', name: 'Nyx Emberveil' },
        };
        expect(options.add(character)).toBe(true);
        return {
          plan: {
            kind: 'restore-original',
            character,
            attachCloudLink: false,
            reason: null,
          },
          link: {},
        };
      }
    );
    auth.emit({ id: 'acc-a', email: 'a@example.com' });
    render(<CloudRestoreProbe intent="recovery" />);
    await waitFor(() => {
      expect(screen.getByTestId('row-nyx-restore-here')).toBeEnabled();
    });
    const previewCalls = vi.mocked(previewPlayerBackupCloud).mock.calls.length;
    await userEvent.click(screen.getByTestId('row-nyx-restore-here'));
    await waitFor(() => {
      expect(
        usePlayerStore
          .getState()
          .characters.some(character => character.id === 'nyx')
      ).toBe(true);
    });
    expect(restoreApis.restorePlayerBackupCharacter).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(
        vi.mocked(previewPlayerBackupCloud).mock.calls.length
      ).toBeGreaterThan(previewCalls);
    });
    expect(derivePlayerBackupRunResult).not.toHaveBeenCalled();
  });

  it('uses the fenced restore whenever a valid local run exists', async () => {
    vi.mocked(previewPlayerBackupCloud).mockResolvedValue({
      account: { id: 'acc-a', email: 'a@example.com' },
      characters: [],
      onlineOnly: [
        decodedOnlineOnly({
          id: 'cloud-nyx',
          legacyId: 'nyx',
          name: 'Nyx Emberveil',
        }),
      ],
    });
    auth.emit({ id: 'acc-a', email: 'a@example.com' });
    render(<CloudRestoreProbe intent="recovery" />);
    await waitFor(() => {
      expect(screen.getByTestId('row-nyx-restore-here')).toBeEnabled();
    });
    await userEvent.click(screen.getByTestId('row-nyx-restore-here'));
    await waitFor(() => {
      expect(restoreApis.restorePlayerBackupCharacter).toHaveBeenCalledOnce();
    });
    expect(
      restoreApis.restorePlayerBackupCharacter.mock.calls[0][0]
    ).toMatchObject({ expectedActiveRunId: 'run-1', cloudId: 'cloud-nyx' });
    expect(
      restoreApis.restorePlayerBackupCharacterWithoutRun
    ).not.toHaveBeenCalled();
  });

  it('retries only through the fenced restore after a valid-present pointer', async () => {
    vi.mocked(readActivePlayerBackupRun).mockResolvedValue(null);
    vi.mocked(previewPlayerBackupCloud).mockResolvedValue({
      account: { id: 'acc-a', email: 'a@example.com' },
      characters: [],
      onlineOnly: [
        decodedOnlineOnly({
          id: 'cloud-nyx',
          legacyId: 'nyx',
          name: 'Nyx Emberveil',
        }),
      ],
    });
    restoreApis.restorePlayerBackupCharacterWithoutRun.mockImplementation(
      async () => {
        vi.mocked(readActivePlayerBackupRun).mockResolvedValue({
          ...FAKE_RUN,
          accountId: 'acc-a',
          namespace: 'user:acc-a',
        });
        throw new PlayerBackupRunReplacedError();
      }
    );
    auth.emit({ id: 'acc-a', email: 'a@example.com' });
    render(<CloudRestoreProbe intent="recovery" />);
    await waitFor(() => {
      expect(screen.getByTestId('row-nyx-restore-here')).toBeEnabled();
    });
    await userEvent.click(screen.getByTestId('row-nyx-restore-here'));
    await waitFor(() => {
      expect(restoreApis.restorePlayerBackupCharacter).toHaveBeenCalledOnce();
    });
    expect(
      restoreApis.restorePlayerBackupCharacterWithoutRun
    ).toHaveBeenCalledOnce();
    expect(
      restoreApis.restorePlayerBackupCharacter.mock.calls[0][0]
    ).toMatchObject({ expectedActiveRunId: 'run-1' });
  });

  it('fails closed into recovery on a corrupt pointer without a fenced retry', async () => {
    vi.mocked(readActivePlayerBackupRun).mockResolvedValue(null);
    vi.mocked(previewPlayerBackupCloud).mockResolvedValue({
      account: { id: 'acc-a', email: 'a@example.com' },
      characters: [],
      onlineOnly: [
        decodedOnlineOnly({
          id: 'cloud-nyx',
          legacyId: 'nyx',
          name: 'Nyx Emberveil',
        }),
      ],
    });
    restoreApis.restorePlayerBackupCharacterWithoutRun.mockRejectedValue(
      new PlayerBackupActiveRunPointerCorruptError()
    );
    auth.emit({ id: 'acc-a', email: 'a@example.com' });
    render(<CloudRestoreProbe intent="manage" />);
    await waitFor(() => {
      expect(screen.getByTestId('surface')).toHaveTextContent('manage');
    });
    await userEvent.click(screen.getByTestId('row-nyx-restore-here'));
    await waitFor(() => {
      expect(screen.getByTestId('surface')).toHaveTextContent('recovery');
    });
    expect(screen.getByTestId('action-error')).toHaveTextContent(
      COPY.errors.online
    );
    expect(restoreApis.restorePlayerBackupCharacter).not.toHaveBeenCalled();
    expect(usePlayerStore.getState().characters).toEqual([]);
  });

  it('tombstones a rolled-back restore so a sibling tab does not keep the other account’s character', async () => {
    vi.mocked(readActivePlayerBackupRun).mockResolvedValue(null);
    vi.mocked(previewPlayerBackupCloud).mockResolvedValue({
      account: { id: 'acc-a', email: 'a@example.com' },
      characters: [],
      onlineOnly: [
        decodedOnlineOnly({
          id: 'cloud-nyx',
          legacyId: 'nyx',
          name: 'Nyx Emberveil',
        }),
      ],
    });
    let characters: PlayerCharacter[] = [];
    let characterTombstones: Record<
      string,
      { id: string; deletedAt: number; beforeImage: PlayerCharacter }
    > = {};
    const sibling = {
      getState: () => ({ characters, characterTombstones }),
      setState: (partial: {
        characters: PlayerCharacter[];
        characterTombstones: typeof characterTombstones;
      }) => {
        characters = partial.characters;
        characterTombstones = partial.characterTombstones;
      },
    };
    const stop = initCrossTabRosterSync(sibling);
    const broadcast = () => {
      const state = usePlayerStore.getState();
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: PLAYER_STORAGE_KEY,
          newValue: JSON.stringify({
            state: {
              characters: state.characters,
              characterTombstones: state.characterTombstones,
            },
            version: 1,
          }),
          storageArea: window.localStorage,
        })
      );
    };
    restoreApis.restorePlayerBackupCharacterWithoutRun.mockImplementation(
      async options => {
        const character: PlayerCharacter = {
          id: 'nyx',
          name: 'Nyx Emberveil',
          race: 'Tiefling',
          class: 'Warlock',
          level: 5,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-02T00:00:00.000Z'),
          lastPlayed: new Date('2026-01-03T00:00:00.000Z'),
          characterData: makeCharacter({ id: 'nyx', name: 'Nyx Emberveil' }),
          tags: [],
          isArchived: false,
        };
        expect(options.add(character)).toBe(true);
        broadcast();
        expect(characters.map(entry => entry.id)).toContain('nyx');
        options.remove('nyx');
        await options.persistRoster();
        broadcast();
        expect(characters.map(entry => entry.id)).not.toContain('nyx');
        throw new Error('account-switched');
      }
    );
    auth.emit({ id: 'acc-a', email: 'a@example.com' });
    render(<CloudRestoreProbe intent="recovery" />);
    await waitFor(() => {
      expect(screen.getByTestId('row-nyx-restore-here')).toBeEnabled();
    });
    await userEvent.click(screen.getByTestId('row-nyx-restore-here'));
    await waitFor(() => {
      expect(
        restoreApis.restorePlayerBackupCharacterWithoutRun
      ).toHaveBeenCalledOnce();
    });
    expect(characters.map(entry => entry.id)).not.toContain('nyx');
    stop();
  });
});
