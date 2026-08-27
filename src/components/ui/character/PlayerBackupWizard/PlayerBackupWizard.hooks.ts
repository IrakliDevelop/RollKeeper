'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthSessionMissingError } from '@supabase/supabase-js';

import { browserRecoveryRepository } from '@/lib/browserRecoveryRepository';
import {
  captureDeviceBackup,
  initiateDeviceBackupDownload,
  verifyDownloadedDeviceBackup,
  type DeviceBackupV1,
} from '@/lib/deviceRecovery';
import type { ActiveCharacterRecoveryBundle } from '@/lib/indexeddb/characterRecoveryExport';
import {
  PlayerBackupReadOnlyCoordinator,
  confirmDegradedPlayerBackupConsent,
  confirmPlayerBackupConsent,
  continuePlayerBackupLocalPreparation,
} from '@/lib/playerBackup/playerBackupCoordinator';
import { classifyDegradedEligibility } from '@/lib/playerBackup/playerBackupEligibility';
import type { PlayerBackupAuthoritySnapshot } from '@/lib/playerBackup/playerBackupRunRepository';
import { createCharacterCloudLinkRepository } from '@/lib/supabase/characterCloudLinks';
import { createSupabaseCharacterCloudGateway } from '@/lib/supabase/characterCloudGateway';
import {
  applyPlayerBackupPendingApplication,
  drainPlayerBackupRunWork,
  resolvePlayerBackupConflict,
  settlePlayerBackupOneTimeConflicts,
} from '@/lib/playerBackup/playerBackupConflictResolution';
import { listPlayerBackupConflicts } from '@/lib/playerBackup/playerBackupConflictCoordinator';
import {
  createBrowserPlayerBackupCloudPreview,
  previewPlayerBackupCloud,
} from '@/lib/playerBackup/playerBackupCloudPreview';
import {
  degradedCharacterCopy,
  mapPlayerBackupError,
  PLAYER_BACKUP_COPY as COPY,
  type PlayerBackupErrorChannel,
} from '@/lib/playerBackup/playerBackupCopy';
import {
  derivePlayerBackupRunResult,
  executePlayerBackupManualRun,
  withExistingDatabase,
} from '@/lib/playerBackup/playerBackupOnlineExecution';
import { startPlayerBackupOngoingWork } from '@/lib/playerBackup/playerBackupOngoingExecution';
import { IndexedDbAutomaticCharacterSyncRepository } from '@/lib/indexeddb/automaticCharacterSyncRepository';
import {
  hasPlayerBackupExclusiveLockCapability,
  type PlayerBackupExclusiveLockProvider,
} from '@/lib/playerBackup/playerBackupRunFence';
import {
  readPlayerBackupCapabilities,
  type PlayerBackupCapabilities,
} from '@/lib/playerBackup/playerBackupFlags';
import {
  inspectPlayerBackupCharacterCoverage,
  savePlayerBackupSafetyFiles,
  verifyFreshCurrentCharacterBundle,
} from '@/lib/playerBackup/playerBackupSafety';
import { projectCharacterBackupStatus } from '@/lib/playerBackup/playerBackupStatus';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import {
  readPlayerBackupCharacterPolicies,
  type PlayerBackupRouteIntent,
} from '@/lib/playerBackup/playerBackupDashboard';
import {
  archivePlayerBackupOnlineCopy,
  backupPlayerBackupCharacterNow,
  pausePlayerBackupCharacter,
  restorePlayerBackupCharacter,
  resumePlayerBackupCharacter,
  setPlayerBackupFutureDefault,
} from '@/lib/playerBackup/playerBackupManagement';
import { createManualCharacterCloud } from '@/lib/supabase/characterCloud';
import { downloadCharacterCloudRecovery } from '@/lib/supabase/characterCloudRecovery';
import { wakeAutomaticCharacterSyncRuntime } from '@/lib/supabase/automaticCharacterSyncRuntime';
import { usePlayerStore } from '@/store/playerStore';
import { APP_VERSION } from '@/utils/constants';

import {
  EMPTY_RECOVERY,
  EMPTY_RESULT,
  EMPTY_SAFETY,
  projectPlayerBackupManagement,
  projectPlayerBackupWizardView,
} from './PlayerBackupWizard.presentation';
import type {
  PlayerBackupCharacterRow,
  PlayerBackupWizardActions,
  PlayerBackupWizardStep,
  PlayerBackupWizardSurface,
  PlayerBackupWizardView,
} from './PlayerBackupWizard.types';

const SIGN_IN_HREF = '/account?returnTo=/player/backup';

function playerBackupAccountSwitchAlert(
  previousAccountId: string | null,
  nextAccountId: string | null
): string | null {
  return previousAccountId &&
    nextAccountId &&
    previousAccountId !== nextAccountId
    ? COPY.selection.accountChanged
    : null;
}

function mintUnusedCopyLegacyId(options: {
  conflictLegacyId: string;
  eligibleCharacterIds: readonly string[];
  isOccupied: (id: string) => boolean;
}): string {
  const reserved = new Set(options.eligibleCharacterIds);
  reserved.add(options.conflictLegacyId);
  let copyLegacyId = crypto.randomUUID();
  while (reserved.has(copyLegacyId) || options.isOccupied(copyLegacyId)) {
    copyLegacyId = crypto.randomUUID();
  }
  return copyLegacyId;
}

function publishSnapshot(
  coordinator: PlayerBackupReadOnlyCoordinator,
  setSnapshot: (
    value: ReturnType<PlayerBackupReadOnlyCoordinator['snapshot']>
  ) => void
) {
  setSnapshot(coordinator.snapshot());
}

function deriveBrowserPlayerBackupResult(options: {
  factory: IDBFactory;
  storage: Storage;
  accountId: string;
  runId: string;
}) {
  return withExistingDatabase(options.factory, database =>
    derivePlayerBackupRunResult({
      factory: options.factory,
      accountId: options.accountId,
      expectedActiveRunId: options.runId,
      links: createCharacterCloudLinkRepository(options.storage),
      repository: new IndexedDbAutomaticCharacterSyncRepository(database),
    })
  );
}

export function usePlayerBackupWizard(
  options: {
    intent?: PlayerBackupRouteIntent | null;
  } = {}
): {
  view: PlayerBackupWizardView;
  actions: PlayerBackupWizardActions;
} {
  const router = useRouter();
  const coordinatorRef = useRef(new PlayerBackupReadOnlyCoordinator());
  const [account, setAccount] = useState<{
    id: string;
    email: string;
  } | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [step, setStep] = useState<PlayerBackupWizardStep>('account');
  const [surface, setSurface] = useState<PlayerBackupWizardSurface>(() =>
    options.intent === 'manage'
      ? 'manage'
      : options.intent === 'recovery'
        ? 'recovery'
        : 'wizard'
  );
  const [busy, setBusy] = useState(false);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [safety, setSafety] =
    useState<PlayerBackupWizardView['safety']>(EMPTY_SAFETY);
  const roster = usePlayerStore(state => state.characters);
  const lockAvailable = hasPlayerBackupExclusiveLockCapability(
    typeof navigator === 'undefined' ? null : navigator.locks
  );
  const capabilities: PlayerBackupCapabilities = useMemo(
    () => readPlayerBackupCapabilities(lockAvailable),
    [lockAvailable]
  );
  const [ongoingChecked, setOngoingChecked] = useState(() =>
    readPlayerBackupCapabilities(lockAvailable).modes.includes('ongoing')
  );
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string> | null>(
    null
  );
  const [selectionAlert, setSelectionAlert] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState(() =>
    coordinatorRef.current.snapshot()
  );
  const [policies, setPolicies] = useState<Record<string, 'on' | 'off'>>({});
  const verifiedBroad = useRef<DeviceBackupV1 | null>(null);
  const pendingCurrent = useRef<ActiveCharacterRecoveryBundle | null>(null);
  const verifiedCurrent = useRef<ActiveCharacterRecoveryBundle | null>(null);
  const mutationGeneration = useRef(0);
  const liveStatusRef = useRef<string | null>(null);

  const announce = useCallback((message: string | null) => {
    if (liveStatusRef.current === message) return;
    liveStatusRef.current = message;
    setLiveStatus(message);
  }, []);

  const reportError = useCallback(
    (channel: PlayerBackupErrorChannel, cause: unknown) => {
      const message = mapPlayerBackupError(channel, cause);
      setActionError(message);
      announce(message);
    },
    [announce]
  );

  const clearAccountScopedState = useCallback(
    (previousAccountId: string | null, nextAccountId: string | null) => {
      mutationGeneration.current += 1;
      coordinatorRef.current.changeAccount(nextAccountId);
      publishSnapshot(coordinatorRef.current, setSnapshot);
      setPolicies({});
      verifiedBroad.current = null;
      pendingCurrent.current = null;
      verifiedCurrent.current = null;
      setSafety(EMPTY_SAFETY);
      setSelectedIds(null);
      const alert = playerBackupAccountSwitchAlert(
        previousAccountId,
        nextAccountId
      );
      setSelectionAlert(alert);
      announce(alert);
      setActionError(null);
      setStep('account');
      setSurface('wizard');
      setAccountError(null);
    },
    [announce]
  );

  const applyAccountSession = useCallback(
    (user: { id: string; email?: string } | null) => {
      const next = user ? { id: user.id, email: user.email ?? user.id } : null;
      setAccount(current => {
        if (current?.id === next?.id) return next ?? current;
        clearAccountScopedState(current?.id ?? null, next?.id ?? null);
        return next;
      });
    },
    [clearAccountScopedState]
  );

  useEffect(() => {
    const client = createSupabaseBrowserClient();
    if (!client) return undefined;
    let cancelled = false;
    void client.auth.getUser().then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        if (isAuthSessionMissingError(error)) {
          setAccountError(null);
          applyAccountSession(null);
          return;
        }
        setAccountError(mapPlayerBackupError('account', error));
        return;
      }
      setAccountError(null);
      applyAccountSession(data.user);
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) applyAccountSession(session?.user ?? null);
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [applyAccountSession]);

  useEffect(() => {
    const coordinator = coordinatorRef.current;
    const accountId = account?.id;
    if (!accountId) return undefined;
    let cancelled = false;
    void (async () => {
      try {
        await coordinator.discoverRun(
          typeof indexedDB === 'undefined' ? null : indexedDB
        );
        if (cancelled) return;
        if (typeof indexedDB !== 'undefined') {
          const nextPolicies = await readPlayerBackupCharacterPolicies({
            factory: indexedDB,
            accountId,
            characterIds: usePlayerStore
              .getState()
              .characters.map(item => item.id),
          });
          if (cancelled) return;
          setPolicies(nextPolicies);
        }
        const preview = createBrowserPlayerBackupCloudPreview({
          manualRead: capabilities.calls.manualRead,
          automaticRead: capabilities.calls.automaticRead,
        });
        if (preview) {
          await coordinator.loadCloud(accountId, () =>
            previewPlayerBackupCloud({
              auth: preview.auth,
              gateway: preview.gateway,
              localCharacters: usePlayerStore.getState().characters,
            })
          );
        }
        const run = coordinator.snapshot().run;
        if (run) {
          await coordinator.loadResult(accountId, () =>
            deriveBrowserPlayerBackupResult({
              factory: indexedDB,
              storage: window.localStorage,
              accountId,
              runId: run.runId,
            })
          );
          await coordinator.loadConflicts(accountId, () =>
            listPlayerBackupConflicts({
              factory: indexedDB,
              accountId,
              expectedActiveRunId: run.runId,
            })
          );
          if (!cancelled) {
            if (options.intent === 'manage') setSurface('manage');
            else if (options.intent === 'recovery') setSurface('recovery');
            else {
              setStep('result');
              announce(COPY.chrome.continueSetup);
            }
          }
        }
      } catch (cause) {
        if (!cancelled) {
          setAccountError(mapPlayerBackupError('account', cause));
        }
      } finally {
        if (!cancelled) publishSnapshot(coordinator, setSnapshot);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    account?.id,
    announce,
    capabilities.calls.automaticRead,
    capabilities.calls.manualRead,
    options.intent,
  ]);

  const characters: PlayerBackupCharacterRow[] = useMemo(() => {
    const previewById = new Map(
      snapshot.cloud.characters.map(character => [
        character.legacyId,
        character,
      ])
    );
    const links =
      typeof window === 'undefined'
        ? null
        : createCharacterCloudLinkRepository(window.localStorage);
    const previewReady =
      Boolean(account) &&
      snapshot.cloud.accountId === account?.id &&
      !snapshot.cloud.loading;
    const degraded = capabilities.setup === 'degraded-manual';
    const classified = new Map(
      degraded && account && links && previewReady
        ? classifyDegradedEligibility({
            preview: {
              account: { id: account.id, email: account.email },
              characters: snapshot.cloud.characters,
              onlineOnly: [],
            },
            links,
          }).characters.map(character => [character.legacyId, character])
        : []
    );
    return roster.map(character => {
      const preview = previewById.get(character.id);
      const verdict = classified.get(character.id);
      const contestedReason = verdict
        ? verdict.eligible
          ? null
          : verdict.reason === 'link-mismatch'
            ? 'different'
            : verdict.reason === 'newer' ||
                verdict.reason === 'different' ||
                verdict.reason === 'removed' ||
                verdict.reason === 'unavailable' ||
                verdict.reason === 'future'
              ? verdict.reason
              : 'different'
        : degraded &&
            preview &&
            preview.state !== 'missing' &&
            preview.state !== 'identical'
          ? preview.state === 'future'
            ? 'future'
            : preview.state === 'unavailable'
              ? 'unavailable'
              : preview.state === 'removed'
                ? 'removed'
                : preview.state === 'newer'
                  ? 'newer'
                  : 'different'
          : null;
      const copy = contestedReason
        ? degradedCharacterCopy(contestedReason)
        : null;
      const eligible = copy || (degraded && !previewReady) ? false : true;
      const selected =
        selectedIds === null
          ? eligible
          : eligible && selectedIds.has(character.id);
      const status = projectCharacterBackupStatus({
        acknowledged: preview?.state === 'identical',
        preference: policies[character.id] ?? null,
        explicitlyPaused:
          snapshot.run?.mode === 'ongoing' && policies[character.id] === 'off',
        conflict: preview?.state === 'different' || preview?.state === 'newer',
        heldAside: preview?.state === 'future',
        offline: preview?.state === 'unavailable',
      });
      return {
        id: character.id,
        name: character.name,
        archived: character.isArchived,
        eligible,
        selected,
        statusLabel: copy?.status ?? status.label,
        note: copy?.description ?? character.class,
        tone: copy ? 'warn' : preview?.state === 'identical' ? 'ok' : 'none',
      };
    });
  }, [
    account,
    capabilities.setup,
    roster,
    selectedIds,
    snapshot.cloud.accountId,
    snapshot.cloud.characters,
    snapshot.cloud.loading,
    policies,
    snapshot.run?.mode,
  ]);

  const selectedCount = characters.filter(
    character => character.selected
  ).length;

  const result = useMemo(() => {
    const execution = snapshot.result;
    if (!execution) {
      return snapshot.run
        ? {
            ...EMPTY_RESULT,
            title: COPY.result.continueSetup,
            headline: COPY.result.continueSetup,
            body: COPY.result.continueSetupBody,
            continueSetup: true,
            closeSafe: true,
          }
        : EMPTY_RESULT;
    }
    const pendingIds = new Set(
      Object.entries(execution.outcomes)
        .filter(([, value]) => value.reason === 'roster-application-pending')
        .map(([legacyId]) => legacyId)
    );
    const outcomeLabel = (
      outcome: (typeof execution.outcomes)[string] | undefined,
      fallback: string,
      legacyId: string
    ) => {
      if (!outcome) return fallback;
      if (outcome.outcome === 'protected') {
        if (execution.mode === 'ongoing' && policies[legacyId] === 'off') {
          return COPY.selection.paused;
        }
        return execution.mode === 'ongoing'
          ? 'Protected'
          : COPY.selection.oneTimeProtected;
      }
      if (outcome.outcome === 'queued' || outcome.outcome === 'offline') {
        return 'Waiting';
      }
      if (outcome.outcome === 'held-aside') {
        return 'Needs a newer version';
      }
      return 'Needs attention';
    };
    const outcomeNote = (
      outcome: (typeof execution.outcomes)[string] | undefined,
      fallback: string
    ) => {
      if (!outcome) return fallback;
      if (outcome.reason === 'roster-application-pending') {
        return COPY.conflict.pendingBody;
      }
      if (outcome.outcome === 'protected') {
        return execution.mode === 'ongoing'
          ? 'Read back from your account and matches this browser'
          : 'One online copy saved and checked. Later changes stay here.';
      }
      if (outcome.outcome === 'offline') {
        return COPY.result.offlineBody;
      }
      if (outcome.outcome === 'queued') return COPY.result.backingUpBody;
      if (outcome.outcome === 'held-aside') {
        return COPY.conflict.futureDescription;
      }
      return COPY.conflict.description;
    };
    const rows = characters.map(character => {
      const outcome = execution.outcomes[character.id];
      const paused =
        outcome?.outcome === 'protected' &&
        execution.mode === 'ongoing' &&
        policies[character.id] === 'off';
      return {
        id: character.id,
        name: character.name,
        statusLabel: outcomeLabel(outcome, character.statusLabel, character.id),
        note: outcomeNote(outcome, character.note),
        tone: paused
          ? 'info'
          : outcome?.outcome === 'protected'
            ? 'ok'
            : outcome?.outcome === 'offline' || outcome?.outcome === 'queued'
              ? 'info'
              : outcome
                ? 'warn'
                : character.tone,
      };
    });
    const attentionCount =
      execution.needsAttention.length +
      execution.failed.length +
      execution.authRequired.length +
      execution.heldAside.length;
    const backingUp =
      execution.queued.length + execution.pending.length > 0 &&
      attentionCount === 0 &&
      execution.offline.length === 0;
    const waitingForConnection =
      execution.offline.length > 0 && attentionCount === 0;
    return {
      title: execution.complete
        ? COPY.result.protectedTitle
        : waitingForConnection
          ? COPY.result.offlineTitle
          : backingUp
            ? COPY.result.backingUpTitle
            : COPY.result.partialTitle,
      headline: execution.complete
        ? execution.mode === 'ongoing'
          ? COPY.result.ongoingComplete(execution.protected.length)
          : COPY.result.oneTimeComplete(execution.protected.length)
        : waitingForConnection
          ? COPY.result.offlineHeadline
          : backingUp
            ? COPY.result.backingUpHeadline(
                execution.queued.length + execution.pending.length
              )
            : COPY.result.partialDescription(
                execution.protected.length,
                attentionCount
              ),
      body: execution.complete
        ? execution.mode === 'ongoing'
          ? 'New characters will also be protected unless you turn backup off for them.'
          : 'Later changes stay in this browser until you back up again.'
        : waitingForConnection
          ? COPY.result.offlineBody
          : backingUp
            ? COPY.result.backingUpBody
            : 'Nothing was deleted.',
      tone: execution.complete ? 'ok' : backingUp ? 'info' : 'warn',
      rows,
      conflicts: (snapshot.conflicts?.conflicts ?? [])
        .filter(
          conflict =>
            conflict.resolutionState === 'unresolved' ||
            conflict.pendingApplicationLegacyId !== null ||
            pendingIds.has(conflict.legacyId)
        )
        .map(conflict => {
          const pendingApplication =
            conflict.pendingApplicationLegacyId !== null ||
            pendingIds.has(conflict.legacyId);
          return {
            conflictId: conflict.conflictId,
            legacyId: conflict.legacyId,
            applicationLegacyId:
              conflict.pendingApplicationLegacyId ?? conflict.legacyId,
            name:
              characters.find(row => row.id === conflict.legacyId)?.name ??
              conflict.legacyId,
            description: pendingApplication
              ? COPY.conflict.pendingBody
              : COPY.conflict.description,
            pendingApplication,
            choices: conflict.allowedResolutions
              .filter(resolution => resolution !== 'restore-online')
              .map(resolution => ({
                resolution,
                label:
                  resolution === 'keep-mine'
                    ? COPY.conflict.keepMine
                    : resolution === 'use-cloud'
                      ? COPY.conflict.useOnline
                      : COPY.conflict.keepBoth,
                body:
                  resolution === 'keep-mine'
                    ? COPY.conflict.keepMineBody
                    : resolution === 'use-cloud'
                      ? COPY.conflict.useOnlineBody
                      : COPY.conflict.keepBothBody,
                enabled: !pendingApplication,
              })),
          };
        }),
      heldAside: (snapshot.conflicts?.heldAside ?? []).map(item => ({
        legacyId: item.legacyId,
        name:
          characters.find(row => row.id === item.legacyId)?.name ??
          item.legacyId,
        recoveryAvailable: item.recoveryAvailable,
        downloadEnabled: item.recoveryAvailable,
      })),
      continueSetup:
        Boolean(snapshot.run) &&
        execution.pending.length > 0 &&
        pendingIds.size === 0,
      closeSafe: Boolean(snapshot.run),
    } satisfies PlayerBackupWizardView['result'];
  }, [characters, policies, snapshot.conflicts, snapshot.result, snapshot.run]);

  const view = projectPlayerBackupWizardView({
    surface,
    step,
    account: {
      signedIn: Boolean(account),
      email: account?.email ?? null,
      error: accountError,
    },
    capabilities,
    characters,
    safety,
    selection: {
      ongoingChecked,
      alert: selectionAlert,
      selectedCount,
    },
    result,
    management: projectPlayerBackupManagement({
      characters,
      result,
      futureDefaultOn: snapshot.run?.futureDefault === 'on',
      futureDefaultEnabled: capabilities.calls.automaticMutation,
      manualMutation: capabilities.calls.manualMutation,
      automaticMutation: capabilities.calls.automaticMutation,
    }),
    recovery: EMPTY_RECOVERY,
    liveStatus,
    actionError,
    busy,
  });

  const gatewayFromBrowser = () => {
    const client = createSupabaseBrowserClient();
    if (!client) return null;
    return createSupabaseCharacterCloudGateway(
      client as unknown as Parameters<
        typeof createSupabaseCharacterCloudGateway
      >[0]
    );
  };

  const reloadDurableEvidence = async (
    accountId: string,
    runId: string,
    generation: number
  ) => {
    await coordinatorRef.current.discoverRun(indexedDB);
    if (generation !== mutationGeneration.current) return;
    await coordinatorRef.current.loadResult(accountId, () =>
      deriveBrowserPlayerBackupResult({
        factory: indexedDB,
        storage: window.localStorage,
        accountId,
        runId,
      })
    );
    if (generation !== mutationGeneration.current) return;
    await coordinatorRef.current.loadConflicts(accountId, () =>
      listPlayerBackupConflicts({
        factory: indexedDB,
        accountId,
        expectedActiveRunId: runId,
      })
    );
    if (generation !== mutationGeneration.current) return;
    const nextPolicies = await readPlayerBackupCharacterPolicies({
      factory: indexedDB,
      accountId,
      characterIds: usePlayerStore.getState().characters.map(item => item.id),
    });
    if (generation !== mutationGeneration.current) return;
    setPolicies(nextPolicies);
    publishSnapshot(coordinatorRef.current, setSnapshot);
  };

  const executeConfirmedRun = async (
    accountId: string,
    runId: string,
    generation: number
  ) => {
    const locks = navigator.locks as
      | PlayerBackupExclusiveLockProvider
      | undefined;
    if (!hasPlayerBackupExclusiveLockCapability(locks)) return;
    if (capabilities.setup !== 'degraded-manual') {
      await continuePlayerBackupLocalPreparation({
        factory: indexedDB,
        storage: window.localStorage,
        locks,
        receipts: browserRecoveryRepository,
        accountId,
        appVersion: APP_VERSION,
        ownerId: accountId,
        now: () => new Date().toISOString(),
        nowMs: () => Date.now(),
      });
    }
    if (generation !== mutationGeneration.current) return;
    const run = coordinatorRef.current.snapshot().run;
    if (!run || run.runId !== runId) return;
    const gateway = gatewayFromBrowser();
    const charactersSource = {
      get: (id: string) =>
        usePlayerStore.getState().getCharacterById(id) ?? null,
    };
    if (run.mode === 'one-time') {
      const manual = createManualCharacterCloud(window.localStorage);
      if (!manual || !gateway) return;
      await executePlayerBackupManualRun({
        factory: indexedDB,
        locks,
        accountId,
        expectedActiveRunId: runId,
        service: manual.service,
        links: createCharacterCloudLinkRepository(window.localStorage),
        gateway,
        characters: charactersSource,
        generateCloudId: () => crypto.randomUUID(),
        generateMutationId: () => crypto.randomUUID(),
        now: () => new Date().toISOString(),
      });
    } else if (gateway) {
      await startPlayerBackupOngoingWork({
        factory: indexedDB,
        locks,
        accountId,
        expectedActiveRunId: runId,
        gateway,
        characters: charactersSource,
        generateCloudId: () => crypto.randomUUID(),
        generateMutationId: () => crypto.randomUUID(),
        now: () => new Date().toISOString(),
      });
    }
    if (generation !== mutationGeneration.current) return;
    await reloadDurableEvidence(accountId, runId, generation);
  };

  const actions: PlayerBackupWizardActions = {
    onClose: () => router.replace('/player'),
    onBack: () => {
      if (surface !== 'wizard') {
        setSurface('wizard');
        return;
      }
      setStep(current =>
        current === 'result'
          ? 'selection'
          : current === 'selection'
            ? 'safety'
            : 'account'
      );
    },
    onNext: () => {
      setStep(current =>
        current === 'account'
          ? 'safety'
          : current === 'safety'
            ? 'selection'
            : current === 'selection'
              ? 'selection'
              : 'result'
      );
    },
    onSignIn: () => router.push(SIGN_IN_HREF),
    onCheckAccount: () => {
      const client = createSupabaseBrowserClient();
      if (!client) return;
      const generation = mutationGeneration.current;
      setBusy(true);
      setActionError(null);
      void client.auth
        .getUser()
        .then(({ data, error }) => {
          if (generation !== mutationGeneration.current) return;
          if (error) {
            if (isAuthSessionMissingError(error)) {
              setAccountError(null);
              applyAccountSession(null);
              announce(null);
              return;
            }
            setAccountError(mapPlayerBackupError('account', error));
            announce(mapPlayerBackupError('account', error));
            return;
          }
          applyAccountSession(data.user);
          setAccountError(null);
          announce(null);
        })
        .finally(() => {
          if (generation === mutationGeneration.current) setBusy(false);
        });
    },
    onSaveSafetyFile: () => {
      const generation = mutationGeneration.current;
      setBusy(true);
      setActionError(null);
      setSafety(current => ({ ...current, preparing: true }));
      const namespace = (account ? `user:${account.id}` : 'guest') as
        | 'guest'
        | `user:${string}`;
      void (async () => {
        let files: {
          broad: DeviceBackupV1;
          currentCharacters: ActiveCharacterRecoveryBundle | null;
        };
        try {
          files = await savePlayerBackupSafetyFiles({
            factory: indexedDB,
            storage: window.localStorage,
            namespace,
            appVersion: APP_VERSION,
            runId: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
          });
        } catch {
          files = {
            broad: await captureDeviceBackup(window.localStorage, {
              appVersion: APP_VERSION,
              runId: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
            }),
            currentCharacters: null,
          };
        }
        if (generation !== mutationGeneration.current) return;
        verifiedBroad.current = files.broad;
        pendingCurrent.current = files.currentCharacters;
        verifiedCurrent.current = null;
        await initiateDeviceBackupDownload(
          files.broad,
          browserRecoveryRepository
        );
        if (generation !== mutationGeneration.current) return;
        setSafety(current => ({
          ...current,
          preparing: false,
          receipt: 'download-started',
          extraFileRequired: files.currentCharacters !== null,
          extraChecked: false,
        }));
      })()
        .catch(cause => {
          if (generation !== mutationGeneration.current) return;
          setSafety(current => ({
            ...current,
            preparing: false,
            receipt: 'needed',
          }));
          reportError('file', cause);
        })
        .finally(() => {
          if (generation === mutationGeneration.current) setBusy(false);
        });
    },
    onChooseSafetyFile: file => {
      const expected = verifiedBroad.current;
      if (!expected) return;
      const generation = mutationGeneration.current;
      setBusy(true);
      setActionError(null);
      void file
        .text()
        .then(text =>
          verifyDownloadedDeviceBackup(
            text,
            expected,
            browserRecoveryRepository
          )
        )
        .then(() => {
          if (generation !== mutationGeneration.current) return;
          const extraReady =
            !safety.extraFileRequired || Boolean(verifiedCurrent.current);
          setSafety(current => {
            return {
              ...current,
              receipt: extraReady ? 'checked' : 'download-started',
              badgeLabel: extraReady
                ? COPY.safety.badgeChecked
                : current.badgeLabel,
              pickedFileName: file.name,
            };
          });
          announce(
            extraReady ? COPY.safety.verifiedTitle : COPY.safety.downloadStarted
          );
        })
        .catch(() => {
          if (generation !== mutationGeneration.current) return;
          setSafety(current => ({
            ...current,
            receipt: 'mismatch',
            badgeLabel: COPY.safety.badgeMismatch,
            pickedFileName: file.name,
          }));
          announce(COPY.safety.mismatchTitle);
        })
        .finally(() => {
          if (generation === mutationGeneration.current) setBusy(false);
        });
    },
    onSaveCurrentCharacterFile: () => {
      const extra = pendingCurrent.current;
      if (!extra) return;
      const generation = mutationGeneration.current;
      setBusy(true);
      setActionError(null);
      void initiateDeviceBackupDownload(extra.bundle, browserRecoveryRepository)
        .catch(cause => {
          if (generation !== mutationGeneration.current) return;
          reportError('current-character', cause);
        })
        .finally(() => {
          if (generation === mutationGeneration.current) setBusy(false);
        });
    },
    onChooseCurrentCharacterFile: file => {
      const extra = pendingCurrent.current;
      const accountId = account?.id;
      if (!extra || !accountId) return;
      const generation = mutationGeneration.current;
      setBusy(true);
      setActionError(null);
      void file
        .text()
        .then(async text => {
          await verifyDownloadedDeviceBackup(
            text,
            extra.bundle,
            browserRecoveryRepository
          );
          await verifyFreshCurrentCharacterBundle({
            expected: extra,
            factory: indexedDB,
            namespace: `user:${accountId}` as const,
            receipts: browserRecoveryRepository,
          });
          if (generation !== mutationGeneration.current) return;
          verifiedCurrent.current = extra;
          const broadReady = Boolean(
            verifiedBroad.current && safety.pickedFileName
          );
          setSafety(current => {
            return {
              ...current,
              extraChecked: true,
              extraPickedFileName: file.name,
              receipt: broadReady ? 'checked' : current.receipt,
              badgeLabel: broadReady
                ? COPY.safety.badgeChecked
                : current.badgeLabel,
            };
          });
          announce(
            broadReady ? COPY.safety.verifiedTitle : COPY.safety.downloadStarted
          );
        })
        .catch(() => {
          if (generation !== mutationGeneration.current) return;
          setSafety(current => ({
            ...current,
            extraChecked: false,
            extraPickedFileName: file.name,
            receipt: 'mismatch',
            badgeLabel: COPY.safety.badgeMismatch,
          }));
          announce(COPY.safety.mismatchTitle);
        })
        .finally(() => {
          if (generation === mutationGeneration.current) setBusy(false);
        });
    },
    onToggleCharacter: id => {
      setSelectedIds(() => {
        const next = new Set(
          (
            selectedIds ??
            new Set(characters.filter(row => row.eligible).map(row => row.id))
          ).values()
        );
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    onSelectAll: () =>
      setSelectedIds(
        new Set(characters.filter(row => row.eligible).map(row => row.id))
      ),
    onClearAll: () => setSelectedIds(new Set()),
    onToggleOngoing: checked => setOngoingChecked(checked),
    onConfirm: () => {
      const bundle = verifiedBroad.current;
      const accountId = account?.id;
      const locks = navigator.locks as
        | PlayerBackupExclusiveLockProvider
        | undefined;
      if (
        !bundle ||
        !accountId ||
        !hasPlayerBackupExclusiveLockCapability(locks)
      ) {
        return;
      }
      const selected = characters
        .filter(character => character.selected)
        .map(character => character.id);
      const eligible = characters
        .filter(character => character.eligible)
        .map(character => character.id);
      const cleared = eligible.filter(id => !selected.includes(id));
      if (selected.length === 0) return;
      const generation = mutationGeneration.current;
      setBusy(true);
      setActionError(null);
      announce(COPY.result.backingUpTitle);
      void (async () => {
        const namespace = `user:${accountId}` as const;
        let authority: PlayerBackupAuthoritySnapshot = {
          kind: 'legacy',
          namespace,
          family: 'character',
        };
        try {
          const coverage = await inspectPlayerBackupCharacterCoverage({
            factory: indexedDB,
            storage: window.localStorage,
            namespace,
          });
          authority = {
            kind: 'indexedDB',
            namespace: coverage.authority.namespace,
            family: 'character',
            generation: coverage.authority.generation,
            epoch: coverage.authority.epoch,
          };
        } catch {
          // Confirmation still records the run; preparation uses the legacy path.
        }
        const runId = crypto.randomUUID();
        const consent = {
          factory: indexedDB,
          storage: window.localStorage,
          locks,
          receipts: browserRecoveryRepository,
          accountId,
          expectedActiveRunId: snapshot.run?.runId ?? null,
          runId,
          eligibleCharacterIds: eligible,
          selectedCharacterIds: selected,
          clearedCharacterIds: cleared,
          broadSafetyBundle: bundle,
          ...(verifiedCurrent.current
            ? { currentCharacterSafetyBundle: verifiedCurrent.current }
            : {}),
          authority,
          confirmedAt: new Date().toISOString(),
        };
        if (capabilities.setup === 'degraded-manual') {
          const preview = createBrowserPlayerBackupCloudPreview({
            manualRead: capabilities.calls.manualRead,
            automaticRead: false,
          });
          if (!preview) {
            reportError('online', null);
            return;
          }
          await confirmDegradedPlayerBackupConsent({
            ...consent,
            preview: () =>
              previewPlayerBackupCloud({
                auth: preview.auth,
                gateway: preview.gateway,
                localCharacters: usePlayerStore.getState().characters,
              }),
            links: createCharacterCloudLinkRepository(window.localStorage),
          });
        } else {
          await confirmPlayerBackupConsent({
            ...consent,
            mode: view.selection.ongoingChecked ? 'ongoing' : 'one-time',
          });
        }
        if (generation !== mutationGeneration.current) return;
        await coordinatorRef.current.discoverRun(indexedDB);
        if (generation !== mutationGeneration.current) return;
        publishSnapshot(coordinatorRef.current, setSnapshot);
        setStep('result');
        try {
          await executeConfirmedRun(accountId, runId, generation);
        } catch (cause) {
          if (generation !== mutationGeneration.current) return;
          reportError('online', cause);
          publishSnapshot(coordinatorRef.current, setSnapshot);
        }
      })()
        .catch(cause => {
          if (generation !== mutationGeneration.current) return;
          reportError('online', cause);
        })
        .finally(() => {
          if (generation === mutationGeneration.current) setBusy(false);
        });
    },
    onContinueSetup: () => {
      const run = snapshot.run;
      const accountId = account?.id;
      const locks = navigator.locks as
        | PlayerBackupExclusiveLockProvider
        | undefined;
      if (
        !run ||
        !accountId ||
        !hasPlayerBackupExclusiveLockCapability(locks)
      ) {
        return;
      }
      const generation = mutationGeneration.current;
      setBusy(true);
      setActionError(null);
      announce(COPY.chrome.continueSetup);
      void executeConfirmedRun(accountId, run.runId, generation)
        .catch(cause => {
          if (generation !== mutationGeneration.current) return;
          reportError('local', cause);
        })
        .finally(() => {
          if (generation === mutationGeneration.current) setBusy(false);
        });
    },
    onCheckNow: () => {
      const accountId = account?.id;
      if (!accountId) return;
      const generation = mutationGeneration.current;
      setBusy(true);
      setActionError(null);
      const preview = createBrowserPlayerBackupCloudPreview({
        manualRead: capabilities.calls.manualRead,
        automaticRead: capabilities.calls.automaticRead,
      });
      void (async () => {
        if (preview) {
          await coordinatorRef.current.loadCloud(accountId, () =>
            previewPlayerBackupCloud({
              auth: preview.auth,
              gateway: preview.gateway,
              localCharacters: usePlayerStore.getState().characters,
            })
          );
        }
        if (generation !== mutationGeneration.current) return;
        await coordinatorRef.current.discoverRun(indexedDB);
        if (generation !== mutationGeneration.current) return;
        const run = coordinatorRef.current.snapshot().run;
        if (run) {
          await reloadDurableEvidence(accountId, run.runId, generation);
          return;
        }
        publishSnapshot(coordinatorRef.current, setSnapshot);
      })()
        .catch(cause => {
          if (generation !== mutationGeneration.current) return;
          reportError('online', cause);
        })
        .finally(() => {
          if (generation === mutationGeneration.current) setBusy(false);
        });
    },
    onResolveConflict: (conflictId, resolution) => {
      const run = snapshot.run;
      const accountId = account?.id;
      const locks = navigator.locks as
        | PlayerBackupExclusiveLockProvider
        | undefined;
      const gateway = gatewayFromBrowser();
      if (
        !run ||
        !accountId ||
        !gateway ||
        !hasPlayerBackupExclusiveLockCapability(locks)
      ) {
        return;
      }
      const generation = mutationGeneration.current;
      setBusy(true);
      setActionError(null);
      void (async () => {
        const conflictLegacyId =
          snapshot.conflicts?.conflicts.find(
            conflict => conflict.conflictId === conflictId
          )?.legacyId ?? conflictId;
        const outcome = await resolvePlayerBackupConflict({
          factory: indexedDB,
          locks,
          accountId,
          expectedActiveRunId: run.runId,
          conflictId,
          resolution,
          ...(resolution === 'keep-both'
            ? {
                copyLegacyId: mintUnusedCopyLegacyId({
                  conflictLegacyId,
                  eligibleCharacterIds: run.eligibleCharacterIds,
                  isOccupied: id =>
                    Boolean(usePlayerStore.getState().getCharacterById(id)),
                }),
              }
            : {}),
          characters: {
            get: id => usePlayerStore.getState().getCharacterById(id) ?? null,
          },
          gateway,
          generateMutationId: () => crypto.randomUUID(),
          now: () => new Date().toISOString(),
        });
        if (generation !== mutationGeneration.current) return;
        if (outcome.status === 'refused') {
          reportError('online', outcome.reason);
          return;
        }
        if (outcome.status === 'resolved' && outcome.workQueued) {
          await drainPlayerBackupRunWork({
            factory: indexedDB,
            locks,
            accountId,
            expectedActiveRunId: run.runId,
            gateway,
          });
        }
        if (generation !== mutationGeneration.current) return;
        if (
          run.mode === 'one-time' &&
          (outcome.status === 'resolved' || outcome.status === 'restored')
        ) {
          await settlePlayerBackupOneTimeConflicts({
            factory: indexedDB,
            locks,
            accountId,
            expectedActiveRunId: run.runId,
            gateway,
            links: createCharacterCloudLinkRepository(window.localStorage),
            now: () => new Date().toISOString(),
          });
        }
        if (generation !== mutationGeneration.current) return;
        await reloadDurableEvidence(accountId, run.runId, generation);
      })()
        .catch(cause => {
          if (generation !== mutationGeneration.current) return;
          reportError('online', cause);
        })
        .finally(() => {
          if (generation === mutationGeneration.current) setBusy(false);
        });
    },
    onApplyPending: legacyId => {
      const run = snapshot.run;
      const accountId = account?.id;
      const locks = navigator.locks as
        | PlayerBackupExclusiveLockProvider
        | undefined;
      const gateway = run?.mode === 'one-time' ? gatewayFromBrowser() : null;
      if (
        !run ||
        !accountId ||
        !hasPlayerBackupExclusiveLockCapability(locks) ||
        (run.mode === 'one-time' && !gateway)
      ) {
        return;
      }
      const generation = mutationGeneration.current;
      setBusy(true);
      setActionError(null);
      void (async () => {
        await applyPlayerBackupPendingApplication({
          factory: indexedDB,
          locks,
          accountId,
          expectedActiveRunId: run.runId,
          legacyId,
          write: application => {
            const store = usePlayerStore.getState();
            const payload = application.payload as unknown as Parameters<
              typeof store.addCloudRecoveredCharacter
            >[0];
            const accepted =
              application.kind === 'replace'
                ? store.replaceCloudRecoveredCharacter(payload)
                : store.addCloudRecoveredCharacter(payload);
            if (!accepted) {
              throw new Error('Roster write was not accepted');
            }
          },
        });
        if (generation !== mutationGeneration.current) return;
        if (run.mode === 'one-time') {
          await settlePlayerBackupOneTimeConflicts({
            factory: indexedDB,
            locks,
            accountId,
            expectedActiveRunId: run.runId,
            gateway: gateway!,
            links: createCharacterCloudLinkRepository(window.localStorage),
            now: () => new Date().toISOString(),
          });
        }
        if (generation !== mutationGeneration.current) return;
        await reloadDurableEvidence(accountId, run.runId, generation);
      })()
        .catch(cause => {
          if (generation !== mutationGeneration.current) return;
          reportError('online', cause);
        })
        .finally(() => {
          if (generation === mutationGeneration.current) setBusy(false);
        });
    },
    onProtectMore: () => {
      setSurface('wizard');
      setStep('selection');
    },
    onOpenRecovery: () => setSurface('recovery'),
    onOpenManage: () => setSurface('manage'),
    onDownloadRecoveryCopy: legacyId => {
      const cloud = createManualCharacterCloud(window.localStorage);
      const row = snapshot.cloud.characters.find(
        character => character.legacyId === legacyId
      )?.row;
      if (!cloud || !row) {
        reportError('online', new Error('recovery-unavailable'));
        return;
      }
      downloadCharacterCloudRecovery(cloud.service.recoveryFor(row));
    },
    onPauseCharacter: legacyId => {
      const run = snapshot.run;
      const accountId = account?.id;
      const locks = navigator.locks as
        | PlayerBackupExclusiveLockProvider
        | undefined;
      if (!run || !accountId) return;
      const generation = mutationGeneration.current;
      setBusy(true);
      setActionError(null);
      void pausePlayerBackupCharacter({
        factory: indexedDB,
        locks,
        accountId,
        expectedActiveRunId: run.runId,
        legacyId,
      })
        .then(async () => {
          if (generation !== mutationGeneration.current) return;
          announce(COPY.management.pauseSuccess);
          await reloadDurableEvidence(accountId, run.runId, generation);
        })
        .catch(cause => {
          if (generation !== mutationGeneration.current) return;
          reportError('online', cause);
        })
        .finally(() => {
          if (generation === mutationGeneration.current) setBusy(false);
        });
    },
    onResumeCharacter: legacyId => {
      const run = snapshot.run;
      const accountId = account?.id;
      const locks = navigator.locks as
        | PlayerBackupExclusiveLockProvider
        | undefined;
      if (!run || !accountId) return;
      const generation = mutationGeneration.current;
      setBusy(true);
      setActionError(null);
      void resumePlayerBackupCharacter({
        factory: indexedDB,
        locks,
        accountId,
        expectedActiveRunId: run.runId,
        legacyId,
        wake: () => wakeAutomaticCharacterSyncRuntime(),
      })
        .then(async () => {
          if (generation !== mutationGeneration.current) return;
          announce(COPY.management.resumeSuccess);
          await reloadDurableEvidence(accountId, run.runId, generation);
        })
        .catch(cause => {
          if (generation !== mutationGeneration.current) return;
          reportError('online', cause);
        })
        .finally(() => {
          if (generation === mutationGeneration.current) setBusy(false);
        });
    },
    onBackupNow: legacyId => {
      const run = snapshot.run;
      const accountId = account?.id;
      const locks = navigator.locks as
        | PlayerBackupExclusiveLockProvider
        | undefined;
      const cloud = createManualCharacterCloud(window.localStorage);
      const character = usePlayerStore
        .getState()
        .characters.find(item => item.id === legacyId);
      if (!run || !accountId || !cloud || !character) return;
      const generation = mutationGeneration.current;
      setBusy(true);
      setActionError(null);
      void backupPlayerBackupCharacterNow({
        factory: indexedDB,
        locks,
        accountId,
        expectedActiveRunId: run.runId,
        character,
        service: cloud.service,
      })
        .then(async () => {
          if (generation !== mutationGeneration.current) return;
          await reloadDurableEvidence(accountId, run.runId, generation);
        })
        .catch(cause => {
          if (generation !== mutationGeneration.current) return;
          reportError('online', cause);
        })
        .finally(() => {
          if (generation === mutationGeneration.current) setBusy(false);
        });
    },
    onRestoreHere: legacyId => {
      const run = snapshot.run;
      const accountId = account?.id;
      const locks = navigator.locks as
        | PlayerBackupExclusiveLockProvider
        | undefined;
      const cloud = createManualCharacterCloud(window.localStorage);
      const cloudId = snapshot.cloud.characters.find(
        character => character.legacyId === legacyId
      )?.row?.id;
      if (!run || !accountId || !cloud || !cloudId) return;
      const generation = mutationGeneration.current;
      setBusy(true);
      setActionError(null);
      void restorePlayerBackupCharacter({
        factory: indexedDB,
        locks,
        accountId,
        expectedActiveRunId: run.runId,
        cloudId,
        localCharacters: usePlayerStore.getState().characters,
        mode: 'original',
        service: cloud.service,
      })
        .then(async prepared => {
          if (generation !== mutationGeneration.current) return;
          if (!prepared.plan.character) return;
          const store = usePlayerStore.getState();
          store.replaceCloudRecoveredCharacter(
            prepared.plan.character as unknown as Parameters<
              typeof store.replaceCloudRecoveredCharacter
            >[0]
          );
          cloud.service.attachLink(prepared.link);
          await reloadDurableEvidence(accountId, run.runId, generation);
        })
        .catch(cause => {
          if (generation !== mutationGeneration.current) return;
          reportError('online', cause);
        })
        .finally(() => {
          if (generation === mutationGeneration.current) setBusy(false);
        });
    },
    onRestoreCopy: legacyId => {
      const run = snapshot.run;
      const accountId = account?.id;
      const locks = navigator.locks as
        | PlayerBackupExclusiveLockProvider
        | undefined;
      const cloud = createManualCharacterCloud(window.localStorage);
      const cloudId = snapshot.cloud.characters.find(
        character => character.legacyId === legacyId
      )?.row?.id;
      if (!run || !accountId || !cloud || !cloudId) return;
      const generation = mutationGeneration.current;
      setBusy(true);
      setActionError(null);
      void restorePlayerBackupCharacter({
        factory: indexedDB,
        locks,
        accountId,
        expectedActiveRunId: run.runId,
        cloudId,
        localCharacters: usePlayerStore.getState().characters,
        mode: 'copy',
        service: cloud.service,
      })
        .then(async prepared => {
          if (generation !== mutationGeneration.current) return;
          if (!prepared.plan.character) return;
          const store = usePlayerStore.getState();
          store.addCloudRecoveredCharacter(
            prepared.plan.character as unknown as Parameters<
              typeof store.addCloudRecoveredCharacter
            >[0]
          );
          cloud.service.attachLink(prepared.link);
          await reloadDurableEvidence(accountId, run.runId, generation);
        })
        .catch(cause => {
          if (generation !== mutationGeneration.current) return;
          reportError('online', cause);
        })
        .finally(() => {
          if (generation === mutationGeneration.current) setBusy(false);
        });
    },
    onRemoveOnlineCopy: legacyId => {
      const run = snapshot.run;
      const accountId = account?.id;
      const locks = navigator.locks as
        | PlayerBackupExclusiveLockProvider
        | undefined;
      const cloud = createManualCharacterCloud(window.localStorage);
      const row = snapshot.cloud.characters.find(
        character => character.legacyId === legacyId
      )?.row;
      if (!run || !accountId || !cloud || !row) return;
      const generation = mutationGeneration.current;
      setBusy(true);
      setActionError(null);
      void archivePlayerBackupOnlineCopy({
        factory: indexedDB,
        locks,
        accountId,
        expectedActiveRunId: run.runId,
        cloudId: row.id,
        expectedServerVersion: row.server_version,
        service: cloud.service,
      })
        .then(async () => {
          if (generation !== mutationGeneration.current) return;
          announce(COPY.management.removeSuccess);
          await reloadDurableEvidence(accountId, run.runId, generation);
        })
        .catch(cause => {
          if (generation !== mutationGeneration.current) return;
          reportError('online', cause);
        })
        .finally(() => {
          if (generation === mutationGeneration.current) setBusy(false);
        });
    },
    onToggleFutureDefault: enabled => {
      const run = snapshot.run;
      const accountId = account?.id;
      const locks = navigator.locks as
        | PlayerBackupExclusiveLockProvider
        | undefined;
      if (!run || !accountId) return;
      const generation = mutationGeneration.current;
      setBusy(true);
      setActionError(null);
      void setPlayerBackupFutureDefault({
        factory: indexedDB,
        locks,
        accountId,
        expectedActiveRunId: run.runId,
        futureDefault: enabled ? 'on' : 'off',
        at: new Date().toISOString(),
      })
        .then(async () => {
          if (generation !== mutationGeneration.current) return;
          await reloadDurableEvidence(accountId, run.runId, generation);
        })
        .catch(cause => {
          if (generation !== mutationGeneration.current) return;
          reportError('online', cause);
        })
        .finally(() => {
          if (generation === mutationGeneration.current) setBusy(false);
        });
    },
  };

  return { view, actions };
}
