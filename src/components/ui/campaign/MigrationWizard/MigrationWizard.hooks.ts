import { useCallback, useEffect, useRef, useState } from 'react';

import { browserRecoveryRepository } from '@/lib/browserRecoveryRepository';
import {
  captureDeviceBackup,
  initiateDeviceBackupDownload,
  verifyDownloadedDeviceBackup,
  type DeviceBackupV1,
} from '@/lib/deviceRecovery';
import { registeredAdapters } from '@/lib/durableDm/familyRegistry';
import { isMigrationWizardVisible } from '@/lib/durableDm/slice11gFlags';
import type {
  DurableFamilyName,
  MigrationRunContext,
} from '@/lib/durableDm/durableFamilyAdapter';
import type { DmWorkspaceDocument } from '@/lib/indexeddb/dmWorkspaceRepository';
import {
  createBrowserDmWorkspace,
  type BrowserDmWorkspaceContext,
} from '@/lib/supabase/browserDmWorkspace';
import { APP_VERSION } from '@/utils/constants';

import type {
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
  };
}
