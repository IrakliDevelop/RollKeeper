'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Cloud,
  Database,
  Download,
  History,
  RotateCcw,
  ShieldCheck,
  Upload,
} from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/layout/card';
import { browserRecoveryRepository } from '@/lib/browserRecoveryRepository';
import {
  buildMagicItemManifest,
  buildMagicItemWorkingCopyManifest,
  customMagicItemFromPayload,
  fingerprintMagicItemPayload,
  fingerprintMagicItemTombstone,
  magicItemPayloadFromCustomItem,
  MAGIC_ITEM_STORAGE_KEY,
  sortMagicItems,
  type MagicItemManifest,
  type MagicItemPayload,
} from '@/lib/durableDm/magicItemFamily';
import { blockerKindReferenceLabel } from '@/lib/durableDm/blockerReferenceLabel';
import { magicItemApi } from '@/lib/durableDm/magicItemApi';
import { MagicItemHttpGateway } from '@/lib/durableDm/magicItemHttpGateway';
import { MagicItemSyncService } from '@/lib/durableDm/magicItemSyncService';
import { isMagicItemClientVisible } from '@/lib/durableDm/slice11cFlags';
import { areStandaloneMigrationControlsVisible } from '@/lib/durableDm/slice11gFlags';
import {
  readMagicItemAuthorityMarker,
  writeMagicItemAuthorityMarker,
} from '@/lib/durableDm/magicItemLegacyAuthority';
import {
  captureDeviceBackup,
  initiateDeviceBackupDownload,
  type DeviceBackupV1,
  verifyDownloadedDeviceBackup,
} from '@/lib/deviceRecovery';
import {
  commitMagicItemLocalCutover,
  enrollMagicItemCloudDevice,
  markMagicItemCloudAuthority,
  readMagicItemAuthority,
  rollbackMagicItemLocalAuthority,
  type MagicItemAuthority,
} from '@/lib/indexeddb/magicItemAuthority';
import { runMagicItemIndexedDbMigration } from '@/lib/indexeddb/magicItemMigration';
import {
  IndexedDbMagicItemRepository,
  type MagicItemDocument,
  type MagicItemMutation,
} from '@/lib/indexeddb/magicItemRepository';
import {
  hasMagicItemSelection,
  readMagicItemSelection,
  selectMagicItemLibrary,
} from '@/lib/indexeddb/magicItemSelection';
import { openRollkeeperDatabase } from '@/lib/indexeddb/localDatabase';
import {
  associateWorkspaceWithLegacyCampaign,
  createBrowserDmWorkspace,
  type BrowserDmWorkspaceContext,
} from '@/lib/supabase/browserDmWorkspace';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import type { DmWorkspaceDocument } from '@/lib/indexeddb/dmWorkspaceRepository';
import type { CampaignInfo } from '@/types/campaign';
import type { CustomMagicItem } from '@/types/magicItemLibrary';
import { APP_VERSION } from '@/utils/constants';
import { useMagicItemLibraryStore } from '@/store/magicItemLibraryStore';

interface VersionMetadata {
  serverVersion: number;
  cutoverEpoch: number;
  schemaVersion: number;
  payloadFingerprint: string;
  tombstoned: boolean;
  acceptedAt: string;
}

interface VersionExport {
  serverVersion: number;
  schemaVersion: number;
  payloadFingerprint: string;
  tombstoned: boolean;
  payload: MagicItemPayload | null;
}

interface EnrollmentDocument {
  legacyId: string;
  serverVersion: number;
  schemaVersion: number;
  payloadFingerprint: string;
  tombstoned: boolean;
  payload: MagicItemPayload | null;
}

interface EnrollmentPreview {
  authority: 'legacy' | 'postgres';
  epoch?: number;
  previewFingerprint?: string;
  recordCount?: number;
  documents?: EnrollmentDocument[];
}

interface StoreDocument {
  legacyId: string;
  payload: MagicItemPayload | null;
  tombstoned: boolean;
}

interface Props {
  campaign: CampaignInfo;
}

/** The worst cloud outcome of a multi-document autosave decides the status. */
const CLOUD_OUTCOME_SEVERITY = {
  'cloud-saved': 0,
  queued: 1,
  conflict: 2,
} as const;

type CloudOutcome = keyof typeof CLOUD_OUTCOME_SEVERITY;

export interface MagicItemMutationPlan {
  upserts: string[];
  deletes: string[];
}

export type MagicItemCommitOutcome =
  | { saved: true; cloud: CloudOutcome | null }
  | { saved: false; error: string };

/** Diffs the last acknowledged baseline against the live library fingerprints. */
export function planMagicItemMutations(
  last: ReadonlyMap<string, string>,
  current: ReadonlyMap<string, string>
): MagicItemMutationPlan {
  const upserts: string[] = [];
  const deletes: string[] = [];
  for (const [legacyId, fingerprint] of current) {
    if (last.get(legacyId) !== fingerprint) upserts.push(legacyId);
  }
  for (const legacyId of last.keys()) {
    if (!current.has(legacyId)) deletes.push(legacyId);
  }
  return { upserts, deletes };
}

/**
 * Commits a plan one document at a time. The baseline advances only for a
 * mutation that is durably local (IndexedDB document plus outbox entry), so a
 * failure leaves its item pending and stops the run for the next effect pass.
 */
export async function runMagicItemMutationPlan(input: {
  plan: MagicItemMutationPlan;
  baseline: Map<string, string>;
  current: ReadonlyMap<string, string>;
  commit: (
    legacyId: string,
    operation: 'upsert' | 'delete'
  ) => Promise<MagicItemCommitOutcome>;
}): Promise<{
  outcome: CloudOutcome;
  committed: number;
  error: string | null;
}> {
  let outcome: CloudOutcome = 'cloud-saved';
  let committed = 0;
  for (const operation of ['upsert', 'delete'] as const) {
    const legacyIds =
      operation === 'upsert' ? input.plan.upserts : input.plan.deletes;
    for (const legacyId of legacyIds) {
      const result = await input.commit(legacyId, operation);
      if (!result.saved) return { outcome, committed, error: result.error };
      if (
        result.cloud &&
        CLOUD_OUTCOME_SEVERITY[result.cloud] > CLOUD_OUTCOME_SEVERITY[outcome]
      )
        outcome = result.cloud;
      if (operation === 'delete') input.baseline.delete(legacyId);
      else input.baseline.set(legacyId, input.current.get(legacyId)!);
      committed += 1;
    }
  }
  return { outcome, committed, error: null };
}

function commitFailureMessage(reason: 'guest' | 'failed' | 'tombstoned') {
  return reason === 'tombstoned'
    ? 'This item was deleted in the cloud; restore it from version history instead.'
    : 'Local IndexedDB transaction failed';
}

function currentRawEnvelope() {
  return localStorage.getItem(MAGIC_ITEM_STORAGE_KEY) ?? '';
}

function downloadJson(filename: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function hideMagicItems(campaignCode: string) {
  useMagicItemLibraryStore.setState(state => {
    const { [campaignCode]: hidden, ...rest } = state.itemsByCampaign;
    void hidden;
    return { itemsByCampaign: rest };
  });
}

function applyMagicItemDocuments(
  campaignCode: string,
  documents: StoreDocument[]
) {
  useMagicItemLibraryStore.setState(state => ({
    itemsByCampaign: {
      ...state.itemsByCampaign,
      [campaignCode]: sortMagicItems(
        documents
          .filter(document => document.payload && !document.tombstoned)
          .map(document =>
            customMagicItemFromPayload(
              campaignCode,
              document.legacyId,
              document.payload!
            )
          )
      ),
    },
  }));
}

/**
 * Fingerprints keyed by item object identity. `updateItem`
 * (`src/store/magicItemLibraryStore.ts`) rebuilds only the item it touches, so
 * every untouched item in the campaign is a cache hit. Backported from the
 * encounter family.
 */
const magicItemFingerprints = new WeakMap<CustomMagicItem, string>();

async function fingerprintMagicItem(item: CustomMagicItem) {
  const cached = magicItemFingerprints.get(item);
  if (cached !== undefined) return cached;
  const fingerprint = await fingerprintMagicItemPayload(
    magicItemPayloadFromCustomItem(item)
  );
  magicItemFingerprints.set(item, fingerprint);
  return fingerprint;
}

/** Identity of the exact local generation a hydration pass consumed. */
function authorityGeneration(
  accountId: string,
  campaignId: string,
  next: MagicItemAuthority
) {
  return `${accountId}:${campaignId}:${next.authority}:${next.epoch}`;
}

function storeDocumentsFromLocal(documents: MagicItemDocument[]) {
  return documents.map(document => ({
    legacyId: document.legacyId,
    payload: document.payload,
    tombstoned: document.operation === 'delete',
  }));
}

export function MagicItemSyncControls({ campaign }: Props) {
  const items = useMagicItemLibraryStore(
    state => state.itemsByCampaign[campaign.code]
  );
  const [context, setContext] = useState<BrowserDmWorkspaceContext | null>(
    null
  );
  const [scope, setScope] = useState<{
    accountId: string;
    campaignId: string;
  } | null>(null);
  const [workspaces, setWorkspaces] = useState<DmWorkspaceDocument[]>([]);
  const [workspace, setWorkspace] = useState<DmWorkspaceDocument | null>(null);
  const [manifest, setManifest] = useState<MagicItemManifest | null>(null);
  const [recovery, setRecovery] = useState<DeviceBackupV1 | null>(null);
  const [recoveryVerified, setRecoveryVerified] = useState(false);
  const [librarySelected, setLibrarySelected] = useState(false);
  const [preparedGeneration, setPreparedGeneration] = useState<string | null>(
    null
  );
  const [authority, setAuthority] = useState<MagicItemAuthority | null>(null);
  const [historyLegacyId, setHistoryLegacyId] = useState<string | null>(
    items?.[0]?.id ?? null
  );
  const [versions, setVersions] = useState<VersionMetadata[]>([]);
  const [comparison, setComparison] = useState<string | null>(null);
  const [enrollmentPreview, setEnrollmentPreview] =
    useState<EnrollmentPreview | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Autosave is armed only once the store provably holds this device's routed
  // generation. `authority && scope` is not enough: device enrollment sets both
  // while the store still shows the un-uploaded local candidate.
  const [hydrated, setHydrated] = useState(false);
  const lastFingerprints = useRef<Map<string, string> | null>(null);
  // The exact local generation the store was hydrated from, so a repeated
  // Supabase auth event cannot re-run hydration over newer local work.
  const hydrationSignature = useRef<string | null>(null);
  // Autosave runs are serialized: two overlapping runs could interleave their
  // acknowledgements and rewind a document fingerprint to an older value.
  const autosaveChain = useRef<Promise<void>>(Promise.resolve());
  const rollbackMutationId = useRef<string | null>(null);
  const recoveryInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const marker = readMagicItemAuthorityMarker(localStorage, campaign.code);
    if (!marker?.namespace || marker.authority === 'legacy_restored') return;
    let cancelled = false;
    const client = createSupabaseBrowserClient();
    if (!client) return;
    const hide = () => {
      setScope(null);
      setAuthority(null);
      setHydrated(false);
      hydrationSignature.current = null;
      hideMagicItems(campaign.code);
    };
    const hydrate = async (accountId: string | null) => {
      if (cancelled) return;
      if (!accountId || marker.namespace !== `user:${accountId}`) {
        hide();
        return;
      }
      const database = await openRollkeeperDatabase();
      try {
        const [localAuthority, documents] = await Promise.all([
          readMagicItemAuthority(
            database,
            marker.namespace!,
            marker.campaignId
          ),
          new IndexedDbMagicItemRepository(database).listDocuments(
            marker.namespace!,
            marker.campaignId
          ),
        ]);
        if (cancelled) return;
        if (localAuthority.authority === 'localStorage') {
          hide();
          return;
        }
        // `onAuthStateChange` fires on TOKEN_REFRESHED (hourly, and whenever a
        // hidden tab's token expired) with the same account and the same local
        // generation. Re-running the pass below would replace the store with
        // the pre-edit documents and reset the baseline underneath an
        // in-flight autosave run, losing the edit everywhere at once — the
        // legacy key is frozen for a routed campaign. A genuine account,
        // campaign, or authority/epoch change still changes this signature and
        // still hydrates.
        if (
          hydrationSignature.current ===
          authorityGeneration(accountId, marker.campaignId, localAuthority)
        )
          return;
        const restoredContext = await createBrowserDmWorkspace();
        if (cancelled) {
          restoredContext?.close();
          return;
        }
        const restoredWorkspaces = restoredContext
          ? await restoredContext.list()
          : [];
        const restoredWorkspace = restoredWorkspaces.find(
          item => item.cloudId === marker.campaignId
        );
        if (
          !restoredContext ||
          restoredContext.accountId !== accountId ||
          !restoredWorkspace
        ) {
          restoredContext?.close();
          setError(
            'The initialized magic item namespace has no matching owner workspace on this browser.'
          );
          return;
        }
        const live = documents.filter(
          document => document.operation !== 'delete'
        );
        for (const document of live) {
          const fingerprint = document.payload
            ? await fingerprintMagicItemPayload(document.payload)
            : null;
          if (fingerprint !== document.contentFingerprint) {
            setError(
              'Local magic item library failed fingerprint verification; use history recovery.'
            );
            return;
          }
        }
        applyMagicItemDocuments(
          campaign.code,
          storeDocumentsFromLocal(documents)
        );
        lastFingerprints.current = new Map(
          live.map(document => [document.legacyId, document.contentFingerprint])
        );
        setContext(restoredContext);
        setWorkspaces(restoredWorkspaces);
        setWorkspace(restoredWorkspace);
        setScope({ accountId, campaignId: marker.campaignId });
        setAuthority(localAuthority);
        hydrationSignature.current = authorityGeneration(
          accountId,
          marker.campaignId,
          localAuthority
        );
        setHydrated(true);
        setStatus(
          'Magic item library loaded from the verified local IndexedDB generation.'
        );
      } finally {
        database.close();
      }
    };
    // Hydration shares the autosave chain, so it can never interleave with an
    // in-flight run that has already captured its fingerprints.
    const queueHydrate = (accountId: string | null) => {
      const queued = autosaveChain.current.then(() => hydrate(accountId));
      autosaveChain.current = queued.catch(() => undefined);
      return queued;
    };
    void client.auth
      .getSession()
      .then(result => queueHydrate(result.data.session?.user.id ?? null))
      .catch(cause =>
        setError(
          cause instanceof Error
            ? cause.message
            : 'Local account verification failed'
        )
      );
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      void queueHydrate(session?.user.id ?? null).catch(cause =>
        setError(
          cause instanceof Error ? cause.message : 'Local hydration failed'
        )
      );
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [campaign.code]);

  useEffect(
    () => () => {
      context?.close();
    },
    [context]
  );

  useEffect(() => {
    setHistoryLegacyId(current =>
      current && items?.some(item => item.id === current)
        ? current
        : (items?.[0]?.id ?? null)
    );
  }, [items]);

  useEffect(() => {
    if (
      busy ||
      !hydrated ||
      !authority ||
      authority.authority === 'localStorage' ||
      !scope
    )
      return;
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      const byId = new Map<string, CustomMagicItem>();
      const current = new Map<string, string>();
      for (const item of items ?? []) {
        byId.set(item.id, item);
        current.set(item.id, await fingerprintMagicItem(item));
      }
      if (cancelled) return;
      const baseline = lastFingerprints.current;
      if (baseline === null) {
        lastFingerprints.current = current;
        return;
      }
      const plan = planMagicItemMutations(baseline, current);
      if (plan.upserts.length === 0 && plan.deletes.length === 0) return;
      const namespace = `user:${scope.accountId}` as const;
      const database = await openRollkeeperDatabase();
      try {
        const repository = new IndexedDbMagicItemRepository(database);
        const service =
          authority.authority === 'postgres'
            ? new MagicItemSyncService({
                enabled: true,
                repository,
                gateway: new MagicItemHttpGateway(),
              })
            : null;
        const updatedAt = new Date().toISOString();
        const result = await runMagicItemMutationPlan({
          plan,
          baseline,
          current,
          commit: async (legacyId, operation) => {
            const document = await repository.getDocument(namespace, legacyId);
            const replaceable =
              Boolean(document) && document!.operation !== 'delete';
            const removing = operation === 'delete';
            const mutation: MagicItemMutation = {
              namespace,
              campaignId: scope.campaignId,
              legacyId,
              cutoverEpoch: authority.epoch,
              operation: removing
                ? 'delete'
                : replaceable
                  ? 'replace'
                  : 'create',
              payload: removing
                ? null
                : magicItemPayloadFromCustomItem(byId.get(legacyId)!),
              schemaVersion: 1,
              localRevision: (document?.localRevision ?? 0) + 1,
              baseServerVersion: removing
                ? (document?.baseServerVersion ?? 0)
                : replaceable
                  ? document!.baseServerVersion
                  : 0,
              contentFingerprint: removing
                ? await fingerprintMagicItemTombstone(legacyId)
                : current.get(legacyId)!,
              updatedAt,
            };
            if (!service) {
              const local = await repository.commit(mutation);
              if (!local.saved)
                return {
                  saved: false,
                  error: commitFailureMessage(local.reason),
                };
              await repository.pause(mutation.namespace, mutation.campaignId);
              return { saved: true, cloud: null };
            }
            const cloud = await service.commit(mutation);
            if (cloud.status === 'local-failed')
              return {
                saved: false,
                error: commitFailureMessage(cloud.reason),
              };
            return { saved: true, cloud: cloud.status as CloudOutcome };
          },
        });
        if (result.committed > 0)
          setStatus(
            !service
              ? 'Local: saved · Cloud: not active · Player view: not applicable'
              : result.outcome === 'cloud-saved'
                ? 'Local: saved · Cloud: saved · Player view: not applicable'
                : result.outcome === 'conflict'
                  ? 'Local: saved · Cloud: conflict · Player view: not applicable'
                  : 'Local: saved · Cloud: queued · Player view: not applicable'
          );
        if (result.error) setError(result.error);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Magic item library save failed'
        );
      } finally {
        database.close();
      }
    };
    autosaveChain.current = autosaveChain.current
      .then(run)
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [authority, busy, items, campaign.code, hydrated, scope]);

  if (!isMagicItemClientVisible()) return null;

  const discover = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = context ?? (await createBrowserDmWorkspace());
      if (!next) throw new Error('Sign in to the owner account first.');
      setContext(next);
      setWorkspaces((await next.discover()).filter(item => item.cloudId));
      setStatus(
        'Owner workspaces discovered. No data category was selected or changed.'
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Workspace discovery failed'
      );
    } finally {
      setBusy(false);
    }
  };

  const choose = async (selected: DmWorkspaceDocument) => {
    if (!context || !selected.cloudId) return;
    setWorkspace(associateWorkspaceWithLegacyCampaign(selected, campaign.code));
    setScope({ accountId: context.accountId, campaignId: selected.cloudId });
    setAuthority({ authority: 'localStorage', epoch: 0 });
    setStatus(
      'Workspace chosen. Browser enrollment and authority are unchanged.'
    );
  };

  const preview = async () => {
    setBusy(true);
    setError(null);
    try {
      const sourceManifest = await buildMagicItemManifest({
        campaignCode: campaign.code,
        rawEnvelope: currentRawEnvelope(),
      });
      let nextManifest = sourceManifest;
      if (
        context &&
        workspace?.cloudId &&
        authority &&
        authority.authority !== 'localStorage' &&
        sourceManifest.blockers.length === 0
      ) {
        const database = await openRollkeeperDatabase();
        try {
          const documents = await new IndexedDbMagicItemRepository(
            database
          ).listDocuments(`user:${context.accountId}`, workspace.cloudId);
          nextManifest = await buildMagicItemWorkingCopyManifest({
            source: sourceManifest,
            documents: documents.map(document => ({
              legacyId: document.legacyId,
              payload: document.payload,
              schemaVersion: document.schemaVersion,
              tombstoned: document.operation === 'delete',
            })),
          });
        } finally {
          database.close();
        }
      }
      const nextRecovery = await captureDeviceBackup(localStorage, {
        appVersion: APP_VERSION,
        runId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      });
      setManifest(nextManifest);
      setRecovery(nextRecovery);
      setRecoveryVerified(false);
      setLibrarySelected(false);
      setPreparedGeneration(null);
      setStatus(
        'Exact preview created. No authority or storage pointer changed.'
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Preview failed');
    } finally {
      setBusy(false);
    }
  };

  const downloadRecovery = async () => {
    if (!recovery) return;
    setError(null);
    try {
      await initiateDeviceBackupDownload(recovery, browserRecoveryRepository);
      setRecoveryVerified(false);
      setLibrarySelected(false);
      setStatus(
        'Recovery download initiated. Reopen that file here before selection.'
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Recovery download failed'
      );
    }
  };

  const verifyRecoveryAndSelect = async (file: File) => {
    if (!context || !workspace?.cloudId || !recovery || !manifest) return;
    setBusy(true);
    setError(null);
    try {
      await verifyDownloadedDeviceBackup(
        await file.text(),
        recovery,
        browserRecoveryRepository
      );
      setRecoveryVerified(true);
      if (
        !window.confirm(
          `Recovery file verified. Select only the magic item library for ${campaign.name}? This does not cut over local or cloud authority.`
        )
      ) {
        setLibrarySelected(false);
        setStatus(
          'Recovery file verified; data category selection was cancelled and cutover remains blocked.'
        );
        return;
      }
      selectMagicItemLibrary(localStorage, {
        namespace: `user:${context.accountId}`,
        campaignId: workspace.cloudId,
        confirmed: true,
        recovery: {
          runId: recovery.runId,
          manifestHash: recovery.manifestHash,
          createdAt: recovery.createdAt,
        },
        now: () => new Date().toISOString(),
      });
      setLibrarySelected(true);
      setStatus(
        'Recovery file verified and magic item library selected. LocalStorage remains authoritative.'
      );
    } catch (cause) {
      setRecoveryVerified(false);
      setLibrarySelected(false);
      setError(
        cause instanceof Error
          ? cause.message
          : 'Recovery file verification failed'
      );
    } finally {
      setBusy(false);
      if (recoveryInput.current) recoveryInput.current.value = '';
    }
  };

  const prepare = async () => {
    if (!context || !workspace?.cloudId || !recovery) return;
    setBusy(true);
    try {
      if (
        !hasMagicItemSelection(
          localStorage,
          `user:${context.accountId}`,
          workspace.cloudId
        )
      ) {
        throw new Error(
          'Verify the downloaded recovery and explicitly select the data category first.'
        );
      }
      const selection = readMagicItemSelection(
        localStorage,
        `user:${context.accountId}`,
        workspace.cloudId
      );
      if (
        !recoveryVerified ||
        !selection ||
        selection.recovery.runId !== recovery.runId ||
        selection.recovery.manifestHash !== recovery.manifestHash
      ) {
        throw new Error(
          'The current preview requires its exact downloaded recovery file to be verified.'
        );
      }
      const runId = `magic-item-${crypto.randomUUID()}`;
      const result = await runMagicItemIndexedDbMigration({
        factory: indexedDB,
        storage: localStorage,
        namespace: `user:${context.accountId}`,
        campaignId: workspace.cloudId,
        campaignCode: campaign.code,
        runId,
        ownerId: crypto.randomUUID(),
        now: () => new Date().toISOString(),
        nowMs: () => Date.now(),
        requiredRecoveryManifestHash: recovery.manifestHash,
        recoveryGate: {
          hasDownloadReceipt: manifestHash =>
            browserRecoveryRepository.hasVerifiedDownloadReceipt(manifestHash),
        },
      });
      setManifest(result.manifest);
      if (result.state !== 'CUTOVER_READY') {
        throw new Error(
          result.manifest.blockers.length > 0
            ? 'Unresolved candidates block only the magic item library; legacy behavior remains active.'
            : 'Local IndexedDB preparation did not satisfy every safety gate.'
        );
      }
      setPreparedGeneration(result.generation);
      setStatus(
        'IndexedDB preparation validated and reopened. Final confirmation is still required.'
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Preparation failed');
    } finally {
      setBusy(false);
    }
  };

  const activateLocal = async () => {
    if (!context || !workspace?.cloudId || !manifest || !preparedGeneration)
      return;
    if (manifest.blockers.length > 0) return;
    if (
      !window.confirm(
        `Confirm exact manifest ${manifest.fingerprint.slice(0, 12)} and cut only the magic item library to IndexedDB?`
      )
    )
      return;
    const namespace = `user:${context.accountId}` as const;
    const campaignId = workspace.cloudId;
    const database = await openRollkeeperDatabase();
    try {
      const current = await buildMagicItemManifest({
        campaignCode: campaign.code,
        rawEnvelope: currentRawEnvelope(),
      });
      if (current.fingerprint !== manifest.fingerprint)
        throw new Error('Manifest changed; preview again.');
      // Only the cloud-enrollment paths persisted the chosen workspace, so a
      // device that merely *discovered* one had no workspace_identity document
      // and could not hydrate after a reload: hydrate() looks the campaign up
      // by cloudId, bailed out, and left the store on the frozen legacy key
      // with every later edit silently uncommitted. Local cutover must stand
      // alone, with no cloud activation. Remembering before the cutover means a
      // failure here leaves legacy authority untouched.
      await context.remember(workspace);
      const updatedAt = new Date().toISOString();
      const next = await commitMagicItemLocalCutover(database, {
        namespace,
        campaignId,
        generation: preparedGeneration,
        confirmed: true,
        gates: {
          recoveryReceipt: true,
          sourceManifestUnchanged: true,
          captureVerifiedAfterReopen: true,
          manifestConfirmed: true,
          noConflicts: true,
          noQuarantine: true,
          parity: true,
          journalEmpty: true,
        },
        now: () => new Date().toISOString(),
        initialDocuments: manifest.records.map(record => ({
          namespace,
          campaignId,
          legacyId: record.legacyId,
          family: 'magic_item',
          cutoverEpoch: 1,
          operation: record.tombstoned ? 'delete' : 'create',
          payload: record.payload,
          schemaVersion: 1,
          localRevision: 1,
          baseServerVersion: 0,
          contentFingerprint: record.payloadFingerprint,
          updatedAt,
          deletedAt: record.tombstoned ? updatedAt : null,
        })),
      });
      setAuthority(next);
      hydrationSignature.current = authorityGeneration(
        context.accountId,
        campaignId,
        next
      );
      // The store already holds exactly the items this cutover captured.
      setHydrated(true);
      writeMagicItemAuthorityMarker(localStorage, campaign.code, {
        version: 1,
        authority: 'indexedDB',
        epoch: next.epoch,
        campaignId,
        namespace,
      });
      lastFingerprints.current = new Map(
        manifest.records
          .filter(record => !record.tombstoned)
          .map(record => [record.legacyId, record.payloadFingerprint])
      );
      setStatus(
        `Local: saved · IndexedDB authority epoch ${next.epoch} · Cloud: inactive`
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Local cutover failed');
    } finally {
      database.close();
    }
  };

  const activateCloud = async () => {
    if (
      !context ||
      !workspace?.cloudId ||
      !manifest ||
      !recovery ||
      authority?.authority !== 'indexedDB'
    )
      return;
    if (
      !window.confirm(
        'Stage, revalidate, and atomically activate only the magic item library in Postgres?'
      )
    )
      return;
    const namespace = `user:${context.accountId}` as const;
    const campaignId = workspace.cloudId;
    setBusy(true);
    try {
      const assertWorkingCopyUnchanged = async () => {
        const database = await openRollkeeperDatabase();
        try {
          const documents = await new IndexedDbMagicItemRepository(
            database
          ).listDocuments(namespace, campaignId);
          const actual = new Map(
            documents.map(document => [
              document.legacyId,
              document.contentFingerprint,
            ])
          );
          const changed =
            actual.size !== manifest.records.length ||
            manifest.records.some(
              record =>
                actual.get(record.legacyId) !== record.payloadFingerprint
            );
          if (changed)
            throw new Error(
              'IndexedDB working copy changed; preview the exact manifest again.'
            );
        } finally {
          database.close();
        }
      };
      await assertWorkingCopyUnchanged();
      const deviceKey = `rollkeeper:magic-item-device:${context.accountId}:${campaignId}`;
      let deviceId = localStorage.getItem(deviceKey);
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem(deviceKey, deviceId);
      }
      const begun = await magicItemApi<{ runId: string }>({
        action: 'begin-staging',
        mutationId: crypto.randomUUID(),
        campaignId,
        deviceId,
        expectedEpoch: Math.max(0, authority.epoch - 1),
        manifestFingerprint: manifest.fingerprint,
        recoveryManifestHash: recovery.manifestHash,
        recoveryReceiptHash: recovery.manifestHash,
        recordCount: manifest.recordCount,
        totalBytes: manifest.totalBytes,
      });
      await magicItemApi({
        action: 'stage-items',
        mutationId: crypto.randomUUID(),
        runId: begun.runId,
        items: manifest.records.map(record => ({
          legacyId: record.legacyId,
          schemaVersion: record.schemaVersion,
          payload: record.payload,
          payloadFingerprint: record.payloadFingerprint,
          tombstoned: record.tombstoned,
        })),
      });
      await assertWorkingCopyUnchanged();
      const activated = await magicItemApi<{ epoch: number }>({
        action: 'confirm-cutover',
        mutationId: crypto.randomUUID(),
        runId: begun.runId,
        manifestFingerprint: manifest.fingerprint,
        expectedEpoch: Math.max(0, authority.epoch - 1),
      });
      const database = await openRollkeeperDatabase();
      try {
        const next = await markMagicItemCloudAuthority(database, {
          namespace,
          campaignId,
          expectedLocalEpoch: authority.epoch,
          cloudEpoch: activated.epoch,
          now: () => new Date().toISOString(),
          acceptedVersions: manifest.records.map(record => ({
            legacyId: record.legacyId,
            serverVersion: 1,
            payloadFingerprint: record.payloadFingerprint,
          })),
        });
        setAuthority(next);
        hydrationSignature.current = authorityGeneration(
          context.accountId,
          campaignId,
          next
        );
        writeMagicItemAuthorityMarker(localStorage, campaign.code, {
          version: 1,
          authority: 'postgres',
          epoch: next.epoch,
          campaignId,
          namespace,
        });
      } finally {
        database.close();
      }
      setStatus('Local: saved · Cloud: saved · Player view: not applicable');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Cloud staging failed');
      setStatus(
        'Local: saved · Cloud: staging failed · IndexedDB authority retained'
      );
    } finally {
      setBusy(false);
    }
  };

  const previewEnrollment = async () => {
    if (!workspace?.cloudId) return;
    setBusy(true);
    setError(null);
    try {
      const next = await magicItemApi<EnrollmentPreview>({
        action: 'preview-enrollment',
        campaignId: workspace.cloudId,
      });
      setEnrollmentPreview(next);
      setStatus(
        next.authority === 'postgres'
          ? 'Cloud enrollment preview loaded. This browser remains unenrolled.'
          : 'The selected magic item library is not cloud-authoritative.'
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Enrollment preview failed'
      );
    } finally {
      setBusy(false);
    }
  };

  const enrollDevice = async () => {
    if (
      !context ||
      !workspace?.cloudId ||
      enrollmentPreview?.authority !== 'postgres' ||
      !enrollmentPreview.previewFingerprint ||
      !enrollmentPreview.documents ||
      enrollmentPreview.epoch === undefined
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const local = await buildMagicItemManifest({
        campaignCode: campaign.code,
        rawEnvelope: currentRawEnvelope(),
      });
      if (
        !window.confirm(
          `Enroll this browser from exact cloud preview ${enrollmentPreview.previewFingerprint.slice(0, 12)}? The local candidate is preserved and is never uploaded automatically.`
        )
      )
        return;
      const namespace = `user:${context.accountId}` as const;
      const campaignId = workspace.cloudId;
      const deviceKey = `rollkeeper:magic-item-device:${context.accountId}:${campaignId}`;
      const deviceId = localStorage.getItem(deviceKey) ?? crypto.randomUUID();
      localStorage.setItem(deviceKey, deviceId);
      await magicItemApi({
        action: 'enroll-device',
        mutationId: crypto.randomUUID(),
        campaignId,
        deviceId,
        expectedEpoch: enrollmentPreview.epoch,
        previewFingerprint: enrollmentPreview.previewFingerprint,
        legacyCandidateFingerprint: local.rawCandidates[0]?.fingerprint ?? null,
      });
      const database = await openRollkeeperDatabase();
      try {
        const next = await enrollMagicItemCloudDevice(database, {
          namespace,
          campaignId,
          campaignCode: campaign.code,
          deviceId,
          epoch: enrollmentPreview.epoch,
          confirmed: true,
          previewFingerprint: enrollmentPreview.previewFingerprint,
          documents: enrollmentPreview.documents.map(document => ({
            legacyId: document.legacyId,
            payload: document.payload ?? null,
            payloadFingerprint: document.payloadFingerprint,
            tombstoned: document.tombstoned === true,
            schemaVersion: document.schemaVersion,
            serverVersion: document.serverVersion,
          })),
          localCandidate: local.rawCandidates[0]
            ? {
                rawValue: local.rawCandidates[0].rawValue,
                fingerprint: local.rawCandidates[0].fingerprint,
              }
            : null,
          preserveDivergentCandidate: true,
          now: () => new Date().toISOString(),
        });
        setAuthority(next);
        // The enrolled device holds the cloud documents in IndexedDB while the
        // store still shows the local candidate, so autosave stays disarmed
        // until the DM applies the exact cloud generation. The confirm above
        // promises that candidate is never uploaded automatically.
        // The enroll control only renders on a `localStorage` authority, which
        // no arming path leaves behind, so this disarm is belt-and-braces for a
        // flag that is already false.
        setHydrated(false);
        hydrationSignature.current = authorityGeneration(
          context.accountId,
          campaignId,
          next
        );
        await context.remember(workspace);
        writeMagicItemAuthorityMarker(localStorage, campaign.code, {
          version: 1,
          authority: 'postgres',
          epoch: next.epoch,
          campaignId,
          namespace,
        });
        setStatus(
          'Browser explicitly enrolled and hydrated into its isolated IndexedDB namespace.'
        );
      } finally {
        database.close();
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Browser enrollment failed'
      );
    } finally {
      setBusy(false);
    }
  };

  const applyExactCloudVersion = async () => {
    if (
      !context ||
      !workspace?.cloudId ||
      authority?.authority !== 'postgres' ||
      enrollmentPreview?.authority !== 'postgres' ||
      !enrollmentPreview.documents ||
      enrollmentPreview.epoch === undefined
    )
      return;
    if (enrollmentPreview.epoch !== authority.epoch) {
      setError('Cloud preview epoch does not match this browser authority.');
      return;
    }
    const documents = enrollmentPreview.documents;
    const cutoverEpoch = enrollmentPreview.epoch;
    if (
      !window.confirm(
        `Apply the exact cloud generation of ${documents.length} records to this enrolled browser? Unresolved local work blocks hydration.`
      )
    )
      return;
    const namespace = `user:${context.accountId}` as const;
    const campaignId = workspace.cloudId;
    setBusy(true);
    setError(null);
    const database = await openRollkeeperDatabase();
    try {
      const repository = new IndexedDbMagicItemRepository(database);
      const acceptedAt = new Date().toISOString();
      for (const document of documents) {
        const current = await repository.getDocument(
          namespace,
          document.legacyId
        );
        if (
          current?.baseServerVersion === document.serverVersion &&
          current.contentFingerprint === document.payloadFingerprint
        )
          continue;
        await repository.applyAcceptedCloudVersion({
          namespace,
          campaignId,
          legacyId: document.legacyId,
          cutoverEpoch,
          serverVersion: document.serverVersion,
          schemaVersion: document.schemaVersion,
          payload: document.payload ?? null,
          payloadFingerprint: document.payloadFingerprint,
          tombstoned: document.tombstoned === true,
          acceptedAt,
        });
      }
      await context.remember(workspace);
      applyMagicItemDocuments(campaign.code, documents);
      // The store now matches the enrolled generation, so autosave is armed.
      setHydrated(true);
      lastFingerprints.current = new Map(
        documents
          .filter(document => !document.tombstoned)
          .map(document => [document.legacyId, document.payloadFingerprint])
      );
      setStatus(
        `Browser hydrated from the exact cloud generation of ${documents.length} records.`
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Cloud hydration failed'
      );
    } finally {
      database.close();
      setBusy(false);
    }
  };

  const loadHistory = async () => {
    if (!workspace?.cloudId || !historyLegacyId) return;
    setError(null);
    try {
      const result = await magicItemApi<{ versions: VersionMetadata[] }>({
        action: 'history',
        campaignId: workspace.cloudId,
        legacyId: historyLegacyId,
      });
      setVersions(result.versions);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'History load failed');
    }
  };

  const exportVersion = async (serverVersion: number) => {
    if (!workspace?.cloudId || !historyLegacyId) return;
    setError(null);
    try {
      const value = await magicItemApi({
        action: 'export-version',
        campaignId: workspace.cloudId,
        legacyId: historyLegacyId,
        serverVersion,
      });
      downloadJson(
        `magic-item-${historyLegacyId}-v${serverVersion}.json`,
        value
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Version export failed'
      );
    }
  };

  const compareLatestVersions = async () => {
    if (!workspace?.cloudId || !historyLegacyId || versions.length < 2) return;
    setError(null);
    try {
      const result = await magicItemApi<{ identical: boolean }>({
        action: 'compare-versions',
        campaignId: workspace.cloudId,
        legacyId: historyLegacyId,
        leftVersion: versions[1].serverVersion,
        rightVersion: versions[0].serverVersion,
      });
      setComparison(
        result.identical
          ? 'The selected versions are byte-identical.'
          : 'The selected versions differ. Export each exact version to inspect payloads.'
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Version comparison failed'
      );
    }
  };

  const restoreVersion = async (sourceVersion: number) => {
    if (
      !context ||
      !workspace?.cloudId ||
      !historyLegacyId ||
      authority?.authority !== 'postgres' ||
      versions.length === 0
    )
      return;
    if (
      !window.confirm(
        `Restore version ${sourceVersion} as a new higher version? Immutable history will not be changed.`
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const namespace = `user:${context.accountId}` as const;
      const campaignId = workspace.cloudId;
      const restored = await magicItemApi<{
        serverVersion: number;
        cutoverEpoch: number;
        payloadFingerprint: string;
      }>({
        action: 'restore-version',
        mutationId: crypto.randomUUID(),
        campaignId,
        expectedEpoch: authority.epoch,
        legacyId: historyLegacyId,
        sourceVersion,
        expectedServerVersion: versions[0].serverVersion,
      });
      const exact = await magicItemApi<VersionExport>({
        action: 'export-version',
        campaignId,
        legacyId: historyLegacyId,
        serverVersion: restored.serverVersion,
      });
      const database = await openRollkeeperDatabase();
      try {
        const repository = new IndexedDbMagicItemRepository(database);
        await repository.applyAcceptedCloudVersion({
          namespace,
          campaignId,
          legacyId: historyLegacyId,
          cutoverEpoch: restored.cutoverEpoch,
          serverVersion: exact.serverVersion,
          schemaVersion: exact.schemaVersion,
          payload: exact.payload,
          payloadFingerprint: exact.payloadFingerprint,
          tombstoned: exact.tombstoned,
          acceptedAt: new Date().toISOString(),
        });
        const documents = await repository.listDocuments(namespace, campaignId);
        applyMagicItemDocuments(
          campaign.code,
          storeDocumentsFromLocal(documents)
        );
        lastFingerprints.current = new Map(
          documents
            .filter(document => document.operation !== 'delete')
            .map(document => [document.legacyId, document.contentFingerprint])
        );
        // A restore rewrites the store from IndexedDB, so like hydrate,
        // activateLocal, and applyExactCloudVersion it must arm autosave: on an
        // enrolled-but-unapplied device the legacy key is frozen, so a
        // disarmed edit would live only in memory and vanish on reload.
        setHydrated(true);
      } finally {
        database.close();
      }
      setStatus(
        `Cloud: saved as version ${restored.serverVersion} · Player view: not applicable`
      );
      await loadHistory();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Version restore failed'
      );
    } finally {
      setBusy(false);
    }
  };

  const rollback = async () => {
    if (!context || !workspace?.cloudId || authority?.authority !== 'postgres')
      return;
    if (
      !window.confirm(
        'Verified rollback creates a new epoch and preserves every Postgres and history source. Continue?'
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const namespace = `user:${context.accountId}` as const;
      const campaignId = workspace.cloudId;
      const current = await magicItemApi<EnrollmentPreview>({
        action: 'preview-enrollment',
        campaignId,
      });
      if (
        current.authority !== 'postgres' ||
        !current.previewFingerprint ||
        !current.documents ||
        current.recordCount === undefined
      )
        throw new Error(
          'Rollback requires the exact current Postgres generation of this library.'
        );
      rollbackMutationId.current ??= crypto.randomUUID();
      const result = await magicItemApi<{
        epoch: number;
        currentGeneration: EnrollmentPreview;
      }>({
        action: 'rollback',
        mutationId: rollbackMutationId.current,
        campaignId,
        expectedEpoch: authority.epoch,
        previewFingerprint: current.previewFingerprint,
        currentGeneration: {
          recordCount: current.recordCount,
          documents: current.documents.map(document => ({
            legacyId: document.legacyId,
            serverVersion: document.serverVersion,
            schemaVersion: document.schemaVersion,
            payloadFingerprint: document.payloadFingerprint,
            tombstoned: document.tombstoned,
          })),
        },
      });
      const database = await openRollkeeperDatabase();
      try {
        const local = await rollbackMagicItemLocalAuthority(database, {
          namespace,
          campaignId,
          expectedEpoch: authority.epoch,
          generation: authority.generation,
          confirmed: true,
          currentGenerationVerified: true,
          now: () => new Date().toISOString(),
        });
        setAuthority(local);
      } finally {
        database.close();
      }
      writeMagicItemAuthorityMarker(localStorage, campaign.code, {
        version: 1,
        authority: 'legacy_restored',
        epoch: result.epoch,
        campaignId,
        namespace,
      });
      applyMagicItemDocuments(
        campaign.code,
        result.currentGeneration.documents ?? []
      );
      setHydrated(false);
      hydrationSignature.current = null;
      rollbackMutationId.current = null;
      setStatus(
        'Rollback accepted through a new epoch; sources were preserved. Reload to use the verified legacy generation.'
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Rollback failed');
    } finally {
      setBusy(false);
    }
  };

  const removeAccountFromDevice = async () => {
    if (
      !context ||
      !workspace?.cloudId ||
      !authority ||
      authority.authority === 'localStorage'
    )
      return;
    if (
      !window.confirm(
        `Remove only ${context.accountLabel}'s local namespace from this browser? Cloud and every preserved source remain intact.`
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const namespace = `user:${context.accountId}` as const;
      const database = await openRollkeeperDatabase();
      try {
        const repository = new IndexedDbMagicItemRepository(database);
        const unresolved = (
          await repository.listOutbox(namespace, workspace.cloudId)
        ).some(
          entry =>
            entry.state !== 'acknowledged' && entry.state !== 'superseded'
        );
        const lossConfirmed =
          !unresolved ||
          window.confirm(
            'Unresolved browser-only work will become inaccessible on this browser. Confirm the described loss risk?'
          );
        if (!lossConfirmed) return;
        if (authority.authority === 'postgres') {
          const deviceId = localStorage.getItem(
            `rollkeeper:magic-item-device:${context.accountId}:${workspace.cloudId}`
          );
          if (!deviceId)
            throw new Error(
              'The exact enrolled browser identity is unavailable.'
            );
          await magicItemApi({
            action: 'remove-device',
            mutationId: crypto.randomUUID(),
            campaignId: workspace.cloudId,
            deviceId,
            expectedEpoch: authority.epoch,
          });
        }
        await repository.removeAccountFromDevice(namespace, {
          confirmed: true,
          lossConfirmed,
        });
        hideMagicItems(campaign.code);
        lastFingerprints.current = null;
        hydrationSignature.current = null;
        setScope(null);
        setAuthority(null);
        setHydrated(false);
        setStatus(
          'Only the selected account namespace was hidden; cloud, history, legacy, conflicts, and outboxes were preserved.'
        );
      } finally {
        database.close();
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Account removal failed'
      );
    } finally {
      setBusy(false);
    }
  };

  if (!areStandaloneMigrationControlsVisible()) return null;

  return (
    <Card padding="lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud size={20} /> Magic item library cloud sync
        </CardTitle>
        <CardDescription>
          Default-off owner workflow. Login, navigation, discovery, and first
          use never enroll or change authority. The library is DM-private;
          players never receive a projection.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!context && (
          <Button variant="outline" onClick={discover} loading={busy}>
            Find owner workspaces
          </Button>
        )}
        {context && !workspace && (
          <div className="space-y-2">
            <p className="text-body text-sm">
              Explicitly choose the owner-verified workspace for this local
              campaign.
            </p>
            {workspaces.map(item => (
              <Button
                key={item.localId}
                variant="outline"
                size="sm"
                onClick={() => choose(item)}
              >
                Select {item.name} ({item.displayCode})
              </Button>
            ))}
          </div>
        )}
        {workspace && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              leftIcon={<Database size={16} />}
              onClick={preview}
              loading={busy}
            >
              Preview exact manifest
            </Button>
            <Button
              variant="outline"
              onClick={previewEnrollment}
              loading={busy}
            >
              Preview cloud enrollment
            </Button>
            {enrollmentPreview?.authority === 'postgres' &&
              authority?.authority === 'localStorage' && (
                <Button variant="warning" onClick={enrollDevice}>
                  Enroll this browser
                </Button>
              )}
            {enrollmentPreview?.authority === 'postgres' &&
              authority?.authority === 'postgres' && (
                <Button
                  variant="warning"
                  onClick={applyExactCloudVersion}
                  loading={busy}
                >
                  Apply exact cloud version
                </Button>
              )}
            {manifest && recovery && (
              <Button
                variant="warning"
                leftIcon={<Download size={16} />}
                onClick={downloadRecovery}
              >
                Download recovery file
              </Button>
            )}
            {manifest && recovery && (
              <>
                <Button
                  variant="outline"
                  leftIcon={<Upload size={16} />}
                  onClick={() => recoveryInput.current?.click()}
                  disabled={busy}
                >
                  Verify recovery file and select
                </Button>
                <input
                  ref={recoveryInput}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  aria-label="Downloaded magic item recovery file"
                  onChange={event => {
                    const file = event.target.files?.[0];
                    if (file) void verifyRecoveryAndSelect(file);
                  }}
                />
              </>
            )}
            {recovery && (
              <Button
                variant="outline"
                onClick={prepare}
                loading={busy}
                disabled={!recoveryVerified || !librarySelected}
              >
                Prepare IndexedDB
              </Button>
            )}
            {manifest &&
              preparedGeneration &&
              manifest.blockers.length === 0 &&
              authority?.authority === 'localStorage' && (
                <Button
                  variant="warning"
                  leftIcon={<ShieldCheck size={16} />}
                  onClick={activateLocal}
                >
                  Confirm local cutover
                </Button>
              )}
            {authority?.authority === 'indexedDB' && (
              <Button variant="primary" onClick={activateCloud} loading={busy}>
                Turn on cloud sync
              </Button>
            )}
            {authority?.authority === 'postgres' && (
              <>
                <Button
                  variant="outline"
                  leftIcon={<History size={16} />}
                  onClick={loadHistory}
                >
                  Version history
                </Button>
                <Button
                  variant="outline"
                  leftIcon={<RotateCcw size={16} />}
                  onClick={rollback}
                >
                  Verified rollback
                </Button>
                <Button variant="danger" onClick={removeAccountFromDevice}>
                  Remove this account from this browser
                </Button>
              </>
            )}
          </div>
        )}
        {authority?.authority === 'postgres' && items && items.length > 0 && (
          <SelectField
            label="Item for version history"
            value={historyLegacyId ?? undefined}
            onValueChange={setHistoryLegacyId}
          >
            {items.map(item => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectField>
        )}
        {manifest && (
          <div className="bg-surface-secondary rounded-lg p-3 text-sm">
            <p className="text-heading font-medium">
              Manifest {manifest.fingerprint.slice(0, 12)}
            </p>
            <p className="text-body">
              {manifest.recordCount} records · {manifest.totalBytes} bytes ·{' '}
              {manifest.blockers.length} blockers
            </p>
            {manifest.blockers.map(blocker => (
              <p
                role="alert"
                className="text-accent-red-text"
                key={`${blocker.kind}:${blocker.legacyId ?? ''}:${blocker.detail}`}
              >
                {blockerKindReferenceLabel(blocker.kind)}: {blocker.detail}
              </p>
            ))}
          </div>
        )}
        {versions.length > 0 && (
          <div className="space-y-2">
            {versions.length > 1 && (
              <Button
                size="sm"
                variant="outline"
                onClick={compareLatestVersions}
              >
                Compare latest versions
              </Button>
            )}
            {comparison && <p className="text-body text-sm">{comparison}</p>}
            {versions.map(version => (
              <div
                className="border-divider flex items-center justify-between rounded-lg border p-2"
                key={version.serverVersion}
              >
                <span className="text-body text-sm">
                  Version {version.serverVersion} · epoch {version.cutoverEpoch}{' '}
                  ·{' '}
                  {version.tombstoned
                    ? 'tombstone'
                    : version.payloadFingerprint.slice(0, 10)}
                </span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => exportVersion(version.serverVersion)}
                  >
                    Export exact version
                  </Button>
                  {version.serverVersion !== versions[0].serverVersion && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => restoreVersion(version.serverVersion)}
                    >
                      Restore as new version
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {authority?.authority === 'postgres' && (
          <p role="status" className="text-muted text-sm">
            Player view: not applicable · the magic item library is DM-private
          </p>
        )}
        {status && (
          <p role="status" className="text-body text-sm">
            {status}
          </p>
        )}
        {error && (
          <p role="alert" className="text-accent-red-text text-sm">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
