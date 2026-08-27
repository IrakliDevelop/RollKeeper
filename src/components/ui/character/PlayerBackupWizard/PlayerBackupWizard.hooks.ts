'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

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
  resolvePlayerBackupConflict,
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
} from '@/lib/playerBackup/playerBackupCopy';
import {
  derivePlayerBackupRunResult,
  executePlayerBackupManualRun,
} from '@/lib/playerBackup/playerBackupOnlineExecution';
import { startPlayerBackupOngoingWork } from '@/lib/playerBackup/playerBackupOngoingExecution';
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
import { createManualCharacterCloud } from '@/lib/supabase/characterCloud';
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

function publishSnapshot(
  coordinator: PlayerBackupReadOnlyCoordinator,
  setSnapshot: (
    value: ReturnType<PlayerBackupReadOnlyCoordinator['snapshot']>
  ) => void
) {
  setSnapshot(coordinator.snapshot());
}

export function usePlayerBackupWizard(): {
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
  const [surface, setSurface] = useState<PlayerBackupWizardSurface>('wizard');
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
  const [snapshot, setSnapshot] = useState(() =>
    coordinatorRef.current.snapshot()
  );
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

  const clearAccountScopedState = useCallback(
    (accountId: string | null) => {
      mutationGeneration.current += 1;
      coordinatorRef.current.changeAccount(accountId);
      publishSnapshot(coordinatorRef.current, setSnapshot);
      verifiedBroad.current = null;
      pendingCurrent.current = null;
      verifiedCurrent.current = null;
      setSafety(EMPTY_SAFETY);
      setSelectedIds(null);
      setSelectionAlert(accountId ? COPY.selection.accountChanged : null);
      announce(accountId ? COPY.selection.accountChanged : null);
      setStep('account');
      setSurface('wizard');
      setAccountError(null);
    },
    [announce]
  );

  useEffect(() => {
    const client = createSupabaseBrowserClient();
    if (!client) return undefined;
    let cancelled = false;
    const applySession = (user: { id: string; email?: string } | null) => {
      if (cancelled) return;
      const next = user ? { id: user.id, email: user.email ?? user.id } : null;
      setAccount(current => {
        if (current?.id === next?.id) return next ?? current;
        clearAccountScopedState(next?.id ?? null);
        return next;
      });
    };
    void client.auth.getUser().then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        setAccountError(mapPlayerBackupError('account', error));
        return;
      }
      applySession(data.user);
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      applySession(session?.user ?? null);
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [clearAccountScopedState]);

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
            derivePlayerBackupRunResult({
              factory: indexedDB,
              accountId,
              expectedActiveRunId: run.runId,
              links: createCharacterCloudLinkRepository(window.localStorage),
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
            setStep('result');
            announce(COPY.chrome.continueSetup);
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
      fallback: string
    ) => {
      if (!outcome) return fallback;
      if (outcome.outcome === 'protected') {
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
      if (outcome.outcome === 'offline' || outcome.outcome === 'queued') {
        return COPY.result.offlineBody;
      }
      if (outcome.outcome === 'held-aside') {
        return COPY.conflict.futureDescription;
      }
      return COPY.conflict.description;
    };
    const rows = characters.map(character => {
      const outcome = execution.outcomes[character.id];
      return {
        id: character.id,
        name: character.name,
        statusLabel: outcomeLabel(outcome, character.statusLabel),
        note: outcomeNote(outcome, character.note),
        tone:
          outcome?.outcome === 'protected'
            ? 'ok'
            : outcome?.outcome === 'offline' || outcome?.outcome === 'queued'
              ? 'info'
              : outcome
                ? 'warn'
                : character.tone,
      };
    });
    return {
      title: execution.complete
        ? COPY.result.protectedTitle
        : COPY.result.partialTitle,
      headline: execution.complete
        ? execution.mode === 'ongoing'
          ? COPY.result.ongoingComplete(execution.protected.length)
          : COPY.result.oneTimeComplete(execution.protected.length)
        : COPY.result.partialDescription(
            execution.protected.length,
            execution.needsAttention.length + execution.failed.length
          ),
      body: execution.complete
        ? execution.mode === 'ongoing'
          ? 'New characters will also be protected unless you turn backup off for them.'
          : 'Later changes stay in this browser until you back up again.'
        : 'Nothing was deleted.',
      tone: execution.complete ? 'ok' : 'warn',
      rows,
      conflicts: (snapshot.conflicts?.conflicts ?? [])
        .filter(
          conflict =>
            conflict.resolutionState === 'unresolved' ||
            pendingIds.has(conflict.legacyId)
        )
        .map(conflict => ({
          conflictId: conflict.conflictId,
          legacyId: conflict.legacyId,
          name:
            characters.find(row => row.id === conflict.legacyId)?.name ??
            conflict.legacyId,
          description: pendingIds.has(conflict.legacyId)
            ? COPY.conflict.pendingBody
            : COPY.conflict.description,
          pendingApplication: pendingIds.has(conflict.legacyId),
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
              enabled: !pendingIds.has(conflict.legacyId),
            })),
        })),
      heldAside: (snapshot.conflicts?.heldAside ?? []).map(item => ({
        legacyId: item.legacyId,
        name:
          characters.find(row => row.id === item.legacyId)?.name ??
          item.legacyId,
        recoveryAvailable: item.recoveryAvailable,
      })),
      continueSetup: Boolean(snapshot.run) && !execution.complete,
      closeSafe: Boolean(snapshot.run),
    } satisfies PlayerBackupWizardView['result'];
  }, [characters, snapshot.conflicts, snapshot.result, snapshot.run]);

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
      futureDefaultOn: snapshot.run?.mode === 'ongoing',
    }),
    recovery: EMPTY_RECOVERY,
    liveStatus,
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

  const reloadDurableEvidence = async (accountId: string, runId: string) => {
    await coordinatorRef.current.discoverRun(indexedDB);
    await coordinatorRef.current.loadResult(accountId, () =>
      derivePlayerBackupRunResult({
        factory: indexedDB,
        accountId,
        expectedActiveRunId: runId,
        links: createCharacterCloudLinkRepository(window.localStorage),
      })
    );
    await coordinatorRef.current.loadConflicts(accountId, () =>
      listPlayerBackupConflicts({
        factory: indexedDB,
        accountId,
        expectedActiveRunId: runId,
      })
    );
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
    await reloadDurableEvidence(accountId, runId);
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
      setBusy(true);
      void client.auth
        .getUser()
        .then(({ data, error }) => {
          if (error) {
            setAccountError(mapPlayerBackupError('account', error));
            announce(mapPlayerBackupError('account', error));
            return;
          }
          if (data.user) {
            const next = {
              id: data.user.id,
              email: data.user.email ?? data.user.id,
            };
            setAccount(current => {
              if (current?.id === next.id) return next;
              clearAccountScopedState(next.id);
              return next;
            });
            setAccountError(null);
          }
        })
        .finally(() => setBusy(false));
    },
    onSaveSafetyFile: () => {
      setBusy(true);
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
        verifiedBroad.current = files.broad;
        pendingCurrent.current = files.currentCharacters;
        verifiedCurrent.current = null;
        await initiateDeviceBackupDownload(
          files.broad,
          browserRecoveryRepository
        );
        setSafety(current => ({
          ...current,
          preparing: false,
          receipt: 'download-started',
          extraFileRequired: files.currentCharacters !== null,
          extraChecked: false,
        }));
      })()
        .catch(cause => {
          setSafety(current => ({
            ...current,
            preparing: false,
            receipt: 'needed',
          }));
          announce(mapPlayerBackupError('file', cause));
        })
        .finally(() => setBusy(false));
    },
    onChooseSafetyFile: file => {
      const expected = verifiedBroad.current;
      if (!expected) return;
      setBusy(true);
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
          setSafety(current => {
            const extraReady =
              !current.extraFileRequired || Boolean(verifiedCurrent.current);
            return {
              ...current,
              receipt: extraReady ? 'checked' : 'download-started',
              badgeLabel: extraReady
                ? COPY.safety.badgeChecked
                : current.badgeLabel,
              pickedFileName: file.name,
            };
          });
        })
        .catch(() => {
          setSafety(current => ({
            ...current,
            receipt: 'mismatch',
            badgeLabel: COPY.safety.badgeMismatch,
            pickedFileName: file.name,
          }));
          announce(COPY.safety.mismatchTitle);
        })
        .finally(() => setBusy(false));
    },
    onSaveCurrentCharacterFile: () => {
      const extra = pendingCurrent.current;
      if (!extra) return;
      setBusy(true);
      void initiateDeviceBackupDownload(extra.bundle, browserRecoveryRepository)
        .catch(cause =>
          announce(mapPlayerBackupError('current-character', cause))
        )
        .finally(() => setBusy(false));
    },
    onChooseCurrentCharacterFile: file => {
      const extra = pendingCurrent.current;
      if (!extra || !account) return;
      setBusy(true);
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
            namespace: `user:${account.id}` as const,
            receipts: browserRecoveryRepository,
          });
          verifiedCurrent.current = extra;
          setSafety(current => {
            const broadReady = Boolean(
              verifiedBroad.current && current.pickedFileName
            );
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
        })
        .catch(() => {
          setSafety(current => ({
            ...current,
            extraChecked: false,
            extraPickedFileName: file.name,
            receipt: 'mismatch',
            badgeLabel: COPY.safety.badgeMismatch,
          }));
          announce(COPY.safety.mismatchTitle);
        })
        .finally(() => setBusy(false));
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
            announce(COPY.errors.online);
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
        publishSnapshot(coordinatorRef.current, setSnapshot);
        setStep('result');
        try {
          await executeConfirmedRun(accountId, runId, generation);
        } catch (cause) {
          if (generation !== mutationGeneration.current) return;
          announce(mapPlayerBackupError('online', cause));
          publishSnapshot(coordinatorRef.current, setSnapshot);
        }
      })()
        .catch(cause => {
          if (generation !== mutationGeneration.current) return;
          announce(mapPlayerBackupError('online', cause));
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
      announce(COPY.chrome.continueSetup);
      void executeConfirmedRun(accountId, run.runId, generation)
        .catch(cause => {
          if (generation !== mutationGeneration.current) return;
          announce(mapPlayerBackupError('local', cause));
        })
        .finally(() => {
          if (generation === mutationGeneration.current) setBusy(false);
        });
    },
    onCheckNow: () => {
      const accountId = account?.id;
      if (!accountId) return;
      setBusy(true);
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
        publishSnapshot(coordinatorRef.current, setSnapshot);
      })()
        .catch(cause => announce(mapPlayerBackupError('online', cause)))
        .finally(() => setBusy(false));
    },
    onResolveConflict: (conflictId, resolution) => {
      const run = snapshot.run;
      const accountId = account?.id;
      const locks = navigator.locks as
        | PlayerBackupExclusiveLockProvider
        | undefined;
      const client = createSupabaseBrowserClient();
      if (
        !run ||
        !accountId ||
        !client ||
        !hasPlayerBackupExclusiveLockCapability(locks)
      ) {
        return;
      }
      setBusy(true);
      void resolvePlayerBackupConflict({
        factory: indexedDB,
        locks,
        accountId,
        expectedActiveRunId: run.runId,
        conflictId,
        resolution,
        characters: {
          get: id => usePlayerStore.getState().getCharacterById(id) ?? null,
        },
        gateway: createSupabaseCharacterCloudGateway(
          client as unknown as Parameters<
            typeof createSupabaseCharacterCloudGateway
          >[0]
        ),
        generateMutationId: () => crypto.randomUUID(),
        now: () => new Date().toISOString(),
      })
        .then(() => reloadDurableEvidence(accountId, run.runId))
        .catch(cause => announce(mapPlayerBackupError('online', cause)))
        .finally(() => setBusy(false));
    },
    onApplyPending: legacyId => {
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
      setBusy(true);
      void applyPlayerBackupPendingApplication({
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
          if (application.kind === 'replace') {
            store.replaceCloudRecoveredCharacter(payload);
          } else {
            store.addCloudRecoveredCharacter(payload);
          }
        },
      })
        .then(() => reloadDurableEvidence(accountId, run.runId))
        .catch(cause => announce(mapPlayerBackupError('online', cause)))
        .finally(() => setBusy(false));
    },
    onProtectMore: () => {
      setSurface('wizard');
      setStep('selection');
    },
    onOpenRecovery: () => setSurface('recovery'),
    onOpenManage: () => setSurface('manage'),
    onDownloadRecoveryCopy: () => undefined,
  };

  return { view, actions };
}
