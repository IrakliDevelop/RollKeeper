import 'fake-indexeddb/auto';

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PLAYER_BACKUP_COPY as COPY } from '@/lib/playerBackup/playerBackupCopy';
import { PlayerBackupReadOnlyCoordinator } from '@/lib/playerBackup/playerBackupCoordinator';
import type { PlayerBackupRunV1 } from '@/lib/playerBackup/playerBackupRunRepository';

import { usePlayerBackupWizard } from './PlayerBackupWizard.hooks';

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

function Probe() {
  const { view, actions } = usePlayerBackupWizard();
  return (
    <div>
      <span data-testid="alert">{view.selection.alert ?? ''}</span>
      <span data-testid="signed-in">{String(view.account.signedIn)}</span>
      <span data-testid="receipt">{view.safety.receipt}</span>
      <span data-testid="action-error">{view.actionError ?? ''}</span>
      <span data-testid="continue">{String(view.result.continueSetup)}</span>
      <button type="button" onClick={actions.onSaveSafetyFile}>
        save-safety
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
      <button type="button" onClick={() => actions.onApplyPending('hero-a')}>
        apply-pending
      </button>
      <button type="button" onClick={actions.onCheckNow}>
        check-now
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
});

async function signIn(id: string, email: string) {
  auth.emit({ id, email });
  render(<Probe />);
  await waitFor(() => {
    expect(screen.getByTestId('signed-in')).toHaveTextContent('true');
  });
}

describe('usePlayerBackupWizard', () => {
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
      expect(screen.getByTestId('continue')).toHaveTextContent('true');
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
      expect(screen.getByTestId('continue')).toHaveTextContent('true');
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
      expect(screen.getByTestId('continue')).toHaveTextContent('true');
    });
    loadResult.mockClear();
    loadConflicts.mockClear();
    await user.click(screen.getByRole('button', { name: 'check-now' }));
    await waitFor(() => {
      expect(loadResult).toHaveBeenCalled();
      expect(loadConflicts).toHaveBeenCalled();
    });
  });
});
