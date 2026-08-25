import { useCallback, useEffect, useRef, useState } from 'react';

import { browserRecoveryRepository } from '@/lib/browserRecoveryRepository';
import {
  captureDeviceBackup,
  initiateDeviceBackupDownload,
  verifyDownloadedDeviceBackup,
  type DeviceBackupV1,
} from '@/lib/deviceRecovery';
import {
  DURABLE_FAMILY_REGISTRY,
  registeredAdapters,
} from '@/lib/durableDm/familyRegistry';
import { isMigrationWizardVisible } from '@/lib/durableDm/slice11gFlags';
import type {
  DurableFamilyName,
  MigrationRunContext,
} from '@/lib/durableDm/durableFamilyAdapter';
import type { NormalizedAuthority } from '@/lib/durableDm/familyAuthorityNormalizer';
import type { DmWorkspaceDocument } from '@/lib/indexeddb/dmWorkspaceRepository';
import {
  createBrowserDmWorkspace,
  type BrowserDmWorkspaceContext,
} from '@/lib/supabase/browserDmWorkspace';
import { APP_VERSION } from '@/utils/constants';

import type {
  FamilyRunOutcome,
  MigrationRecoveryState,
  MigrationWizardController,
} from './MigrationWizard.types';

const INITIAL_RECOVERY: MigrationRecoveryState = {
  status: 'pending',
  bundle: null,
  runId: null,
  manifestHash: null,
  verifiedAt: null,
  entryCount: 0,
  totalBytes: 0,
  error: null,
  needsEnrichment: false,
};

/**
 * Placeholder used ONLY for the brief instant between a successful discover()
 * and the mount-time recovery capture resolving. Never carries real content
 * (empty entries, empty hash) and is never what any real family selection
 * ends up checked against — the UI never offers a family step before
 * `recovery.status` is `verified` or `resumed`.
 */
const EMPTY_BACKUP: DeviceBackupV1 = {
  format: 'rollkeeper-device-backup',
  formatVersion: 1,
  appVersion: APP_VERSION,
  runId: '',
  createdAt: '',
  entries: [],
  manifestHash: '',
  validation: {
    entryCount: 0,
    totalBytes: 0,
    validJsonCount: 0,
    malformedJsonCount: 0,
    futureVersionCount: 0,
    retainedOnlyCount: 0,
  },
};

export function useMigrationWizard(
  campaignCode: string
): MigrationWizardController {
  const visible = isMigrationWizardVisible();

  const [runId, setRunId] = useState<string>(() => crypto.randomUUID());
  const [ownerContext, setOwnerContext] =
    useState<BrowserDmWorkspaceContext | null>(null);
  const [workspace, setWorkspace] = useState<DmWorkspaceDocument | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [recovery, setRecovery] =
    useState<MigrationRecoveryState>(INITIAL_RECOVERY);
  const [anyCutoverCommitted, setAnyCutoverCommitted] = useState(false);

  // Exactly one open `rollkeeper-local` database handle for the whole run
  // (spec R10 / brief). React's own cleanup-on-dependency-change semantics
  // close the PREVIOUS context automatically the instant `ownerContext` is
  // replaced by a new one (including on unmount, where this is the only
  // place `.close()` is ever called) — no manual bookkeeping needed here.
  useEffect(
    () => () => {
      ownerContext?.close();
    },
    [ownerContext]
  );

  // Tracks whether THIS component instance is still mounted, for the one
  // window the effect above cannot cover: `discover()`'s own in-flight
  // `createBrowserDmWorkspace()` call. If the component unmounts while that
  // call is pending, `setOwnerContext(next)` becomes a no-op on an unmounted
  // tree — the cleanup effect above never sees `next` (it never entered
  // state), so its `rollkeeper-local` handle would otherwise leak for the
  // life of the tab (the exact hazard R10 warns about for
  // `versionchange`). Guarded below by closing it directly instead.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Step 0: fresh, read-only owner-workspace discovery. Writes nothing —
  // `list()` and `discover()` on `BrowserDmWorkspaceContext` are both
  // read-only (spec R2a). Every explicit click of "Find my campaigns" opens
  // its own context; the effect above closes whatever context preceded it.
  const discover = useCallback(async () => {
    setDiscovering(true);
    setDiscoveryError(null);
    try {
      const next = await createBrowserDmWorkspace();
      if (!mountedRef.current) {
        // Never stored in state, so the close-on-change effect above will
        // never see it — close it directly rather than leak the handle.
        next?.close();
        return;
      }
      setOwnerContext(next);
      if (!next) {
        setWorkspace(null);
        setDiscoveryError(
          'Sign in to the owner account before migrating this campaign.'
        );
        return;
      }
      const remembered = await next.list();
      const targetLegacyId = `legacy:${campaignCode}`;
      const found =
        remembered.find(
          item => item.legacyId === targetLegacyId && item.cloudId
        ) ?? null;
      if (mountedRef.current) setWorkspace(found);
    } catch (cause) {
      if (mountedRef.current) {
        setDiscoveryError(
          cause instanceof Error ? cause.message : 'Workspace discovery failed.'
        );
      }
    } finally {
      if (mountedRef.current) setDiscovering(false);
    }
  }, [campaignCode]);

  // Step 1 resume detection (spec R4), on mount and whenever the campaign
  // changes: re-capture the browser backup with a throwaway run id, hash it,
  // and look for an existing VERIFIED receipt for exactly this content. A
  // receipt with no per-entry vector (predates Task 3) is never resumed on
  // as-is (R10 note in the brief) — it stays pending, offering enrichment
  // instead.
  useEffect(() => {
    let cancelled = false;
    async function run() {
      const throwawayRunId = crypto.randomUUID();
      const bundle = await captureDeviceBackup(window.localStorage, {
        appVersion: APP_VERSION,
        runId: throwawayRunId,
        timestamp: new Date().toISOString(),
      });
      if (cancelled) return;
      const receipt =
        await browserRecoveryRepository.readVerifiedDownloadReceipt(
          bundle.manifestHash
        );
      if (cancelled) return;

      if (receipt && receipt.entries && receipt.entries.length > 0) {
        setRunId(receipt.runId);
        setRecovery({
          status: 'resumed',
          bundle: { ...bundle, runId: receipt.runId },
          runId: receipt.runId,
          manifestHash: receipt.manifestHash,
          verifiedAt: receipt.verifiedAt ?? null,
          entryCount: receipt.entries.length,
          totalBytes: bundle.validation.totalBytes,
          error: null,
          needsEnrichment: false,
        });
        return;
      }

      setRunId(throwawayRunId);
      setRecovery({
        status: 'pending',
        bundle,
        runId: throwawayRunId,
        manifestHash: bundle.manifestHash,
        verifiedAt: receipt?.verifiedAt ?? null,
        entryCount: 0,
        totalBytes: bundle.validation.totalBytes,
        error: null,
        // A verified receipt exists for this content but predates the entry
        // vector: offer enrichment instead of a plain download prompt.
        needsEnrichment: Boolean(receipt),
      });
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [campaignCode]);

  const downloadBundle = useCallback(async () => {
    if (!recovery.bundle) return;
    await initiateDeviceBackupDownload(
      recovery.bundle,
      browserRecoveryRepository
    );
  }, [recovery.bundle]);

  const selectBundleFile = useCallback(
    async (file: File) => {
      if (!recovery.bundle) return;
      try {
        const text = await file.text();
        const verified = await verifyDownloadedDeviceBackup(
          text,
          recovery.bundle,
          browserRecoveryRepository
        );
        setRecovery(current => ({
          ...current,
          status: 'verified',
          bundle: verified,
          manifestHash: verified.manifestHash,
          verifiedAt: new Date().toISOString(),
          entryCount: verified.entries.length,
          totalBytes: verified.validation.totalBytes,
          error: null,
        }));
      } catch (cause) {
        setRecovery(current => ({
          ...current,
          status: 'stale',
          error:
            cause instanceof Error
              ? cause.message
              : 'That file does not match this browser. Download a fresh one and pick that up instead.',
        }));
      }
    },
    [recovery.bundle]
  );

  const enrichLegacyReceipt = useCallback(async () => {
    if (!recovery.bundle) return;
    try {
      await browserRecoveryRepository.enrichVerifiedDownloadReceiptEntries(
        recovery.bundle.manifestHash,
        recovery.bundle.entries
      );
      const receipt =
        await browserRecoveryRepository.readVerifiedDownloadReceipt(
          recovery.bundle.manifestHash
        );
      if (receipt?.entries) {
        setRunId(receipt.runId);
        setRecovery(current => ({
          ...current,
          status: 'resumed',
          runId: receipt.runId,
          verifiedAt: receipt.verifiedAt ?? null,
          entryCount: receipt.entries!.length,
          error: null,
          needsEnrichment: false,
        }));
      }
    } catch (cause) {
      setRecovery(current => ({
        ...current,
        error:
          cause instanceof Error
            ? cause.message
            : "Could not check this browser's backup.",
      }));
    }
  }, [recovery.bundle]);

  // ---------------------------------------------------------------------
  // Spec R10: the run's ONE idempotent `remember(workspace)`. Memoized on
  // the in-flight PROMISE (never a boolean set after the await, which would
  // let two families started together both see "not done yet" and both
  // call `remember`), keyed by account + workspace + run id (never cleared
  // on a dependency-change effect, which runs after render and could still
  // let a cutover started in the same tick as a campaign switch read the
  // previous run's resolved promise), and a rejection clears the memo so
  // the next family retries instead of cutting over on a workspace this run
  // never actually recorded.
  // ---------------------------------------------------------------------
  const rememberRef = useRef<{ key: string; promise: Promise<void> } | null>(
    null
  );
  const rememberKey =
    ownerContext && workspace
      ? `${ownerContext.accountId}|${workspace.localId}|${runId}`
      : null;

  const ensureWorkspaceRemembered = useCallback(async () => {
    if (!ownerContext || !workspace || !rememberKey)
      throw new Error('Sign in to the owner account first.');
    if (rememberRef.current?.key !== rememberKey) {
      const context = ownerContext;
      const target = workspace;
      rememberRef.current = {
        key: rememberKey,
        promise: context.remember(target).catch(cause => {
          if (rememberRef.current?.key === rememberKey)
            rememberRef.current = null;
          throw cause;
        }),
      };
    }
    return rememberRef.current.promise;
  }, [ownerContext, workspace, rememberKey]);

  const contextFor = useCallback(
    (family: DurableFamilyName): MigrationRunContext | null => {
      // Every family currently receives an identical `MigrationRunContext`;
      // `family` is part of the public signature for Task 15's per-family
      // callers but is not otherwise read here.
      void family;
      // Deliberately gated on ownerContext + workspace ONLY, matching
      // rememberKey's own dependency — not on recovery.bundle, whose async
      // mount-time capture would otherwise make this transiently null right
      // after a successful discover() and destabilize every caller that
      // reasonably expects a context as soon as a workspace is found. The
      // real recovery-readiness gate (verified/resumed) belongs to the UI
      // that decides whether to OFFER a family step, not to this builder.
      if (!ownerContext || !workspace) return null;
      return {
        accountId: ownerContext.accountId,
        campaignId: workspace.cloudId ?? '',
        campaignCode,
        workspace,
        recovery: recovery.bundle
          ? { ...recovery.bundle, runId }
          : { ...EMPTY_BACKUP, runId },
        ensureWorkspaceRemembered,
      };
    },
    [
      ownerContext,
      workspace,
      recovery.bundle,
      campaignCode,
      runId,
      ensureWorkspaceRemembered,
    ]
  );

  const migrate = useCallback(
    async (family: DurableFamilyName) => {
      const adapter = registeredAdapters().find(
        candidate => candidate.family === family
      );
      if (!adapter) throw new Error(`Unknown data category: ${family}`);
      const context = contextFor(family);
      if (!context)
        throw new Error('Workspace discovery has not completed yet.');
      await adapter.selectFamily(context);
      const prepared = await adapter.prepareIndexedDb(context);
      await adapter.commitLocalCutover(context, {
        generation: prepared.generation,
        manifest: prepared.manifest,
      });
    },
    [contextFor]
  );

  // Derived (never stored): true when any REGISTERED family's normalized
  // authority is indexedDB or postgres. Only attempted once discovery has
  // resolved a real workspace — before that there is no campaignId to ask
  // any adapter about, and a disabled or never-migrated family's own
  // `readAuthority` already reports `legacy` on its own.
  useEffect(() => {
    if (!ownerContext || !workspace?.cloudId) {
      setAnyCutoverCommitted(false);
      return;
    }
    let cancelled = false;
    async function check() {
      const results = await Promise.allSettled(
        registeredAdapters().map(adapter =>
          adapter.readAuthority({
            accountId: ownerContext!.accountId,
            campaignId: workspace!.cloudId as string,
            campaignCode,
          })
        )
      );
      if (cancelled) return;
      setAnyCutoverCommitted(
        results.some(
          result =>
            result.status === 'fulfilled' &&
            (result.value.state === 'indexedDB' ||
              result.value.state === 'postgres')
        )
      );
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, [ownerContext, workspace, campaignCode]);

  // ---------------------------------------------------------------------
  // Task 15: per-family step navigation and orchestration.
  // ---------------------------------------------------------------------

  // -1 = intro (steps 0/1, unchanged). 0..registry.length-1 = one registry
  // entry (registered or planned) in fixed order. Rail rows are not
  // clickable (settled decision) — the only way to move `stepIndex` is
  // Back/Continue/Skip, all of which funnel through `goBack`/`goContinue`
  // below (Skip is a distinctly-labelled alias for `goContinue`: spec R11
  // requires it write nothing, and `goContinue` itself never writes
  // anything either — the DM's typed-confirmation click is the only write
  // path).
  const [stepIndex, setStepIndex] = useState(-1);
  useEffect(() => {
    setStepIndex(-1);
  }, [campaignCode]);

  const canContinue =
    recovery.status === 'verified' || recovery.status === 'resumed';

  const goContinue = useCallback(() => {
    setStepIndex(current =>
      Math.min(current + 1, DURABLE_FAMILY_REGISTRY.length - 1)
    );
  }, []);
  const goBack = useCallback(() => {
    setStepIndex(current => Math.max(current - 1, -1));
  }, []);

  const [familyAuthorities, setFamilyAuthorities] = useState<
    Partial<Record<DurableFamilyName, NormalizedAuthority>>
  >({});

  const adapterFor = useCallback(
    (family: DurableFamilyName) =>
      registeredAdapters().find(candidate => candidate.family === family) ??
      null,
    []
  );

  const refreshFamilyAuthority = useCallback(
    async (family: DurableFamilyName) => {
      const adapter = adapterFor(family);
      if (!adapter || !ownerContext || !workspace?.cloudId) return null;
      const authority = await adapter.readAuthority({
        accountId: ownerContext.accountId,
        campaignId: workspace.cloudId,
        campaignCode,
      });
      setFamilyAuthorities(current => ({ ...current, [family]: authority }));
      return authority;
    },
    [adapterFor, ownerContext, workspace, campaignCode]
  );

  // Spec R3: any captured-key hash change invalidates the run's one
  // verified receipt. A pure read-and-compare — never writes anything, and
  // never records an "expected transition" exception (the migration engine
  // stays the arbiter of acceptable source drift, not the wizard). Called
  // once when a family step is entered and, again, immediately before each
  // of `selectFamily`, `commitLocalCutover` and `activateCloud` below.
  const checkFamilyDrift = useCallback(async (): Promise<string | null> => {
    if (!recovery.bundle || !recovery.manifestHash) return null;
    const fresh = await captureDeviceBackup(window.localStorage, {
      appVersion: APP_VERSION,
      runId,
      timestamp: new Date().toISOString(),
    });
    if (fresh.manifestHash === recovery.manifestHash) return null;
    const before = new Map(
      recovery.bundle.entries.map(entry => [entry.key, entry])
    );
    const after = new Map(fresh.entries.map(entry => [entry.key, entry]));
    const keys = new Set<string>([...before.keys(), ...after.keys()]);
    for (const key of keys) {
      const beforeEntry = before.get(key);
      const afterEntry = after.get(key);
      if (
        !beforeEntry ||
        !afterEntry ||
        beforeEntry.sha256 !== afterEntry.sha256 ||
        beforeEntry.byteCount !== afterEntry.byteCount
      ) {
        return key;
      }
    }
    // Unreachable in practice: a differing manifestHash is a deterministic
    // digest over exactly these per-key fields, so the loop above always
    // finds the changed key first. Kept only so the function has a total,
    // typed return.
    return 'this browser’s data';
  }, [recovery.bundle, recovery.manifestHash, runId]);

  const runFamily = useCallback(
    async (family: DurableFamilyName): Promise<FamilyRunOutcome> => {
      const adapter = adapterFor(family);
      const context = contextFor(family);
      if (!adapter || !context) {
        return {
          outcome: 'error',
          message: 'Workspace discovery has not completed yet.',
        };
      }
      try {
        const driftBeforeSelect = await checkFamilyDrift();
        if (driftBeforeSelect)
          return { outcome: 'drift', changedKey: driftBeforeSelect };

        await adapter.selectFamily(context);
        const prepared = await adapter.prepareIndexedDb(context);

        const driftBeforeCommit = await checkFamilyDrift();
        if (driftBeforeCommit)
          return { outcome: 'drift', changedKey: driftBeforeCommit };

        await adapter.commitLocalCutover(context, {
          generation: prepared.generation,
          manifest: prepared.manifest,
        });
        await refreshFamilyAuthority(family);

        const driftBeforeActivate = await checkFamilyDrift();
        if (driftBeforeActivate)
          return { outcome: 'drift', changedKey: driftBeforeActivate };

        const activation = await adapter.activateCloud(
          context,
          prepared.manifest
        );
        if (activation.status === 'conflict') {
          // Failure never reverses progress (spec, failure semantics
          // section): the family stays at whatever authority
          // `commitLocalCutover` already committed it to above. `rollback`
          // is never called here.
          return { outcome: 'cloudFailure', reason: activation.reason };
        }
        await refreshFamilyAuthority(family);
        return { outcome: 'success' };
      } catch (cause) {
        return {
          outcome: 'error',
          message:
            cause instanceof Error
              ? cause.message
              : 'This data category could not be moved.',
        };
      }
    },
    [adapterFor, contextFor, checkFamilyDrift, refreshFamilyAuthority]
  );

  const repairFamily = useCallback(
    async (family: DurableFamilyName) => {
      const adapter = adapterFor(family);
      if (!adapter || !ownerContext || !workspace?.cloudId) {
        return {
          ok: false,
          message: "This browser's record could not be fixed.",
        };
      }
      try {
        // `repairAuthority` REFUSES by rejecting rather than resolving to a
        // lying "fixed" state (durableFamilyAdapter.ts) — a caller must
        // never treat a rejection as anything other than "still
        // inconsistent, still blocked".
        await adapter.repairAuthority({
          accountId: ownerContext.accountId,
          campaignId: workspace.cloudId,
          campaignCode,
        });
        await refreshFamilyAuthority(family);
        return { ok: true, message: "This browser's record was fixed." };
      } catch (cause) {
        return {
          ok: false,
          message: `This browser's record could not be fixed: ${
            cause instanceof Error ? cause.message : 'an unknown error'
          }`,
        };
      }
    },
    [adapterFor, ownerContext, workspace, campaignCode, refreshFamilyAuthority]
  );

  const registeredCount = registeredAdapters().length;
  const routedCount = Object.values(familyAuthorities).filter(
    authority => authority?.state === 'postgres'
  ).length;

  return {
    visible,
    campaignCode,
    runId,
    discovering,
    discoveryError,
    workspace,
    accountId: ownerContext?.accountId ?? null,
    discover,
    recovery,
    downloadBundle,
    selectBundleFile,
    enrichLegacyReceipt,
    ensureWorkspaceRemembered,
    contextFor,
    migrate,
    anyCutoverCommitted,
    stepIndex,
    canContinue,
    goContinue,
    goBack,
    registeredCount,
    routedCount,
    familyAuthorities,
    adapterFor,
    refreshFamilyAuthority,
    checkFamilyDrift,
    runFamily,
    repairFamily,
  };
}
