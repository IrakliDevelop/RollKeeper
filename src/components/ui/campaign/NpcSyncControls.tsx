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
  buildNpcManifest,
  buildNpcWorkingCopyManifest,
  campaignNpcFromPayload,
  fingerprintNpcPayload,
  fingerprintNpcTombstone,
  npcPayloadFromCampaignNpc,
  NPC_STORAGE_KEY,
  sortNpcs,
  type NpcManifest,
  type NpcPayload,
} from '@/lib/durableDm/npcFamily';
import { npcApi } from '@/lib/durableDm/npcApi';
import { NpcHttpGateway } from '@/lib/durableDm/npcHttpGateway';
import { NpcSyncService } from '@/lib/durableDm/npcSyncService';
import { isNpcClientVisible } from '@/lib/durableDm/slice11dFlags';
import {
  readNpcAuthorityMarker,
  writeNpcAuthorityMarker,
} from '@/lib/durableDm/npcLegacyAuthority';
import {
  captureDeviceBackup,
  initiateDeviceBackupDownload,
  type DeviceBackupV1,
  verifyDownloadedDeviceBackup,
} from '@/lib/deviceRecovery';
import {
  commitNpcLocalCutover,
  enrollNpcCloudDevice,
  markNpcCloudAuthority,
  readNpcAuthority,
  rollbackNpcLocalAuthority,
  type NpcAuthority,
} from '@/lib/indexeddb/npcAuthority';
import { runNpcIndexedDbMigration } from '@/lib/indexeddb/npcMigration';
import {
  IndexedDbNpcRepository,
  type NpcDocument,
  type NpcMutation,
} from '@/lib/indexeddb/npcRepository';
import {
  hasNpcSelection,
  readNpcSelection,
  selectNpcFamily,
} from '@/lib/indexeddb/npcSelection';
import { openRollkeeperDatabase } from '@/lib/indexeddb/localDatabase';
import {
  createBrowserDmWorkspace,
  type BrowserDmWorkspaceContext,
} from '@/lib/supabase/browserDmWorkspace';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import type { DmWorkspaceDocument } from '@/lib/indexeddb/dmWorkspaceRepository';
import type { CampaignInfo } from '@/types/campaign';
import type { CampaignNPC } from '@/types/encounter';
import { APP_VERSION } from '@/utils/constants';
import { useNPCStore } from '@/store/npcStore';

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
  payload: NpcPayload | null;
}

interface EnrollmentDocument {
  legacyId: string;
  serverVersion: number;
  schemaVersion: number;
  payloadFingerprint: string;
  tombstoned: boolean;
  payload: NpcPayload | null;
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
  payload: NpcPayload | null;
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

export interface NpcMutationPlan {
  upserts: string[];
  deletes: string[];
}

export type NpcCommitOutcome =
  | { saved: true; cloud: CloudOutcome | null }
  | { saved: false; error: string };

/** Diffs the last acknowledged baseline against the live NPC fingerprints. */
export function planNpcMutations(
  last: ReadonlyMap<string, string>,
  current: ReadonlyMap<string, string>
): NpcMutationPlan {
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
 * failure leaves its NPC pending and stops the run for the next effect pass.
 */
export async function runNpcMutationPlan(input: {
  plan: NpcMutationPlan;
  baseline: Map<string, string>;
  current: ReadonlyMap<string, string>;
  commit: (
    legacyId: string,
    operation: 'upsert' | 'delete'
  ) => Promise<NpcCommitOutcome>;
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
    ? 'This NPC was deleted in the cloud; restore it from version history instead.'
    : 'Local IndexedDB transaction failed';
}

function currentRawEnvelope() {
  return localStorage.getItem(NPC_STORAGE_KEY) ?? '';
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

function hideNpcs(campaignCode: string) {
  useNPCStore.setState(state => {
    const { [campaignCode]: hidden, ...rest } = state.npcsByCampaign;
    void hidden;
    return { npcsByCampaign: rest };
  });
}

function applyNpcDocuments(campaignCode: string, documents: StoreDocument[]) {
  useNPCStore.setState(state => ({
    npcsByCampaign: {
      ...state.npcsByCampaign,
      [campaignCode]: sortNpcs(
        documents
          .filter(document => document.payload && !document.tombstoned)
          .map(document =>
            campaignNpcFromPayload(
              campaignCode,
              document.legacyId,
              document.payload!
            )
          )
      ),
    },
  }));
}

function storeDocumentsFromLocal(documents: NpcDocument[]) {
  return documents.map(document => ({
    legacyId: document.legacyId,
    payload: document.payload,
    tombstoned: document.operation === 'delete',
  }));
}

export function NpcSyncControls({ campaign }: Props) {
  const npcs = useNPCStore(state => state.npcsByCampaign[campaign.code]);
  const [context, setContext] = useState<BrowserDmWorkspaceContext | null>(
    null
  );
  const [scope, setScope] = useState<{
    accountId: string;
    campaignId: string;
  } | null>(null);
  const [workspaces, setWorkspaces] = useState<DmWorkspaceDocument[]>([]);
  const [workspace, setWorkspace] = useState<DmWorkspaceDocument | null>(null);
  const [manifest, setManifest] = useState<NpcManifest | null>(null);
  const [recovery, setRecovery] = useState<DeviceBackupV1 | null>(null);
  const [recoveryVerified, setRecoveryVerified] = useState(false);
  const [npcsSelected, setNpcsSelected] = useState(false);
  const [preparedGeneration, setPreparedGeneration] = useState<string | null>(
    null
  );
  const [authority, setAuthority] = useState<NpcAuthority | null>(null);
  const [historyLegacyId, setHistoryLegacyId] = useState<string | null>(
    npcs?.[0]?.id ?? null
  );
  const [versions, setVersions] = useState<VersionMetadata[]>([]);
  const [comparison, setComparison] = useState<string | null>(null);
  const [enrollmentPreview, setEnrollmentPreview] =
    useState<EnrollmentPreview | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lastFingerprints = useRef<Map<string, string> | null>(null);
  // Autosave runs are serialized: two overlapping runs could interleave their
  // acknowledgements and rewind a document fingerprint to an older value.
  const autosaveChain = useRef<Promise<void>>(Promise.resolve());
  const rollbackMutationId = useRef<string | null>(null);
  const recoveryInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const marker = readNpcAuthorityMarker(localStorage, campaign.code);
    if (!marker?.namespace || marker.authority === 'legacy_restored') return;
    let cancelled = false;
    const client = createSupabaseBrowserClient();
    if (!client) return;
    const hide = () => {
      setScope(null);
      setAuthority(null);
      hideNpcs(campaign.code);
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
          readNpcAuthority(database, marker.namespace!, marker.campaignId),
          new IndexedDbNpcRepository(database).listDocuments(
            marker.namespace!,
            marker.campaignId
          ),
        ]);
        if (cancelled) return;
        if (localAuthority.authority === 'localStorage') {
          hide();
          return;
        }
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
            'The initialized NPC namespace has no matching owner workspace on this device.'
          );
          return;
        }
        const live = documents.filter(
          document => document.operation !== 'delete'
        );
        for (const document of live) {
          const fingerprint = document.payload
            ? await fingerprintNpcPayload(document.payload)
            : null;
          if (fingerprint !== document.contentFingerprint) {
            setError(
              'Local NPC documents failed fingerprint verification; use history recovery.'
            );
            return;
          }
        }
        applyNpcDocuments(campaign.code, storeDocumentsFromLocal(documents));
        lastFingerprints.current = new Map(
          live.map(document => [document.legacyId, document.contentFingerprint])
        );
        setContext(restoredContext);
        setWorkspaces(restoredWorkspaces);
        setWorkspace(restoredWorkspace);
        setScope({ accountId, campaignId: marker.campaignId });
        setAuthority(localAuthority);
        setStatus('NPCs loaded from the verified local IndexedDB generation.');
      } finally {
        database.close();
      }
    };
    void client.auth
      .getSession()
      .then(result => hydrate(result.data.session?.user.id ?? null))
      .catch(cause =>
        setError(
          cause instanceof Error
            ? cause.message
            : 'Local account verification failed'
        )
      );
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      void hydrate(session?.user.id ?? null).catch(cause =>
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
      current && npcs?.some(npc => npc.id === current)
        ? current
        : (npcs?.[0]?.id ?? null)
    );
  }, [npcs]);

  useEffect(() => {
    if (busy || !authority || authority.authority === 'localStorage' || !scope)
      return;
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      const byId = new Map<string, CampaignNPC>();
      const current = new Map<string, string>();
      for (const npc of npcs ?? []) {
        byId.set(npc.id, npc);
        current.set(
          npc.id,
          await fingerprintNpcPayload(npcPayloadFromCampaignNpc(npc))
        );
      }
      if (cancelled) return;
      const baseline = lastFingerprints.current;
      if (baseline === null) {
        lastFingerprints.current = current;
        return;
      }
      const plan = planNpcMutations(baseline, current);
      if (plan.upserts.length === 0 && plan.deletes.length === 0) return;
      const namespace = `user:${scope.accountId}` as const;
      const database = await openRollkeeperDatabase();
      try {
        const repository = new IndexedDbNpcRepository(database);
        const service =
          authority.authority === 'postgres'
            ? new NpcSyncService({
                enabled: true,
                repository,
                gateway: new NpcHttpGateway(),
              })
            : null;
        const updatedAt = new Date().toISOString();
        const result = await runNpcMutationPlan({
          plan,
          baseline,
          current,
          commit: async (legacyId, operation) => {
            const document = await repository.getDocument(namespace, legacyId);
            const replaceable =
              Boolean(document) && document!.operation !== 'delete';
            const removing = operation === 'delete';
            const mutation: NpcMutation = {
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
                : npcPayloadFromCampaignNpc(byId.get(legacyId)!),
              schemaVersion: 4,
              localRevision: (document?.localRevision ?? 0) + 1,
              baseServerVersion: removing
                ? (document?.baseServerVersion ?? 0)
                : replaceable
                  ? document!.baseServerVersion
                  : 0,
              contentFingerprint: removing
                ? await fingerprintNpcTombstone(legacyId)
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
        setError(cause instanceof Error ? cause.message : 'NPC save failed');
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
  }, [authority, busy, npcs, campaign.code, scope]);

  if (!isNpcClientVisible()) return null;

  const discover = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = context ?? (await createBrowserDmWorkspace());
      if (!next) throw new Error('Sign in to the owner account first.');
      setContext(next);
      setWorkspaces((await next.discover()).filter(item => item.cloudId));
      setStatus(
        'Owner workspaces discovered. No family was selected or changed.'
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
    setWorkspace(selected);
    setScope({ accountId: context.accountId, campaignId: selected.cloudId });
    setAuthority({ authority: 'localStorage', epoch: 0 });
    setStatus(
      'Workspace chosen. Device enrollment and authority are unchanged.'
    );
  };

  const preview = async () => {
    setBusy(true);
    setError(null);
    try {
      const sourceManifest = await buildNpcManifest({
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
          const documents = await new IndexedDbNpcRepository(
            database
          ).listDocuments(`user:${context.accountId}`, workspace.cloudId);
          nextManifest = await buildNpcWorkingCopyManifest({
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
      setNpcsSelected(false);
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
      setNpcsSelected(false);
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
          `Recovery file verified. Select only the NPCs for ${campaign.name}? This does not cut over local or cloud authority.`
        )
      ) {
        setNpcsSelected(false);
        setStatus(
          'Recovery file verified; family selection was cancelled and cutover remains blocked.'
        );
        return;
      }
      selectNpcFamily(localStorage, {
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
      setNpcsSelected(true);
      setStatus(
        'Recovery file verified and NPCs selected. LocalStorage remains authoritative.'
      );
    } catch (cause) {
      setRecoveryVerified(false);
      setNpcsSelected(false);
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
        !hasNpcSelection(
          localStorage,
          `user:${context.accountId}`,
          workspace.cloudId
        )
      ) {
        throw new Error(
          'Verify the downloaded recovery and explicitly select the family first.'
        );
      }
      const selection = readNpcSelection(
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
      const runId = `npc-${crypto.randomUUID()}`;
      const result = await runNpcIndexedDbMigration({
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
            ? 'Unresolved candidates block only the NPC family; legacy behavior remains active.'
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
        `Confirm exact manifest ${manifest.fingerprint.slice(0, 12)} and cut only the NPC family to IndexedDB?`
      )
    )
      return;
    const namespace = `user:${context.accountId}` as const;
    const campaignId = workspace.cloudId;
    const database = await openRollkeeperDatabase();
    try {
      const current = await buildNpcManifest({
        campaignCode: campaign.code,
        rawEnvelope: currentRawEnvelope(),
      });
      if (current.fingerprint !== manifest.fingerprint)
        throw new Error('Manifest changed; preview again.');
      const updatedAt = new Date().toISOString();
      const next = await commitNpcLocalCutover(database, {
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
          family: 'npc',
          cutoverEpoch: 1,
          operation: record.tombstoned ? 'delete' : 'create',
          payload: record.payload,
          schemaVersion: 4,
          localRevision: 1,
          baseServerVersion: 0,
          contentFingerprint: record.payloadFingerprint,
          updatedAt,
          deletedAt: record.tombstoned ? updatedAt : null,
        })),
      });
      setAuthority(next);
      writeNpcAuthorityMarker(localStorage, campaign.code, {
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
        'Stage, revalidate, and atomically activate only the NPC family in Postgres?'
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
          const documents = await new IndexedDbNpcRepository(
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
      const deviceKey = `rollkeeper:npc-device:${context.accountId}:${campaignId}`;
      let deviceId = localStorage.getItem(deviceKey);
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem(deviceKey, deviceId);
      }
      const begun = await npcApi<{ runId: string }>({
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
      await npcApi({
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
      const activated = await npcApi<{ epoch: number }>({
        action: 'confirm-cutover',
        mutationId: crypto.randomUUID(),
        runId: begun.runId,
        manifestFingerprint: manifest.fingerprint,
        expectedEpoch: Math.max(0, authority.epoch - 1),
      });
      const database = await openRollkeeperDatabase();
      try {
        const next = await markNpcCloudAuthority(database, {
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
        writeNpcAuthorityMarker(localStorage, campaign.code, {
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
      const next = await npcApi<EnrollmentPreview>({
        action: 'preview-enrollment',
        campaignId: workspace.cloudId,
      });
      setEnrollmentPreview(next);
      setStatus(
        next.authority === 'postgres'
          ? 'Cloud enrollment preview loaded. This device remains unenrolled.'
          : 'The selected NPC family is not cloud-authoritative.'
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
      const local = await buildNpcManifest({
        campaignCode: campaign.code,
        rawEnvelope: currentRawEnvelope(),
      });
      if (
        !window.confirm(
          `Enroll this device from exact cloud preview ${enrollmentPreview.previewFingerprint.slice(0, 12)}? The local candidate is preserved and is never uploaded automatically.`
        )
      )
        return;
      const namespace = `user:${context.accountId}` as const;
      const campaignId = workspace.cloudId;
      const deviceKey = `rollkeeper:npc-device:${context.accountId}:${campaignId}`;
      const deviceId = localStorage.getItem(deviceKey) ?? crypto.randomUUID();
      localStorage.setItem(deviceKey, deviceId);
      await npcApi({
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
        const next = await enrollNpcCloudDevice(database, {
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
        await context.remember(workspace);
        writeNpcAuthorityMarker(localStorage, campaign.code, {
          version: 1,
          authority: 'postgres',
          epoch: next.epoch,
          campaignId,
          namespace,
        });
        setStatus(
          'Device explicitly enrolled and hydrated into its isolated IndexedDB namespace.'
        );
      } finally {
        database.close();
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Device enrollment failed'
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
      setError('Cloud preview epoch does not match this device authority.');
      return;
    }
    const documents = enrollmentPreview.documents;
    const cutoverEpoch = enrollmentPreview.epoch;
    if (
      !window.confirm(
        `Apply the exact cloud generation of ${documents.length} records to this enrolled device? Unresolved local work blocks hydration.`
      )
    )
      return;
    const namespace = `user:${context.accountId}` as const;
    const campaignId = workspace.cloudId;
    setBusy(true);
    setError(null);
    const database = await openRollkeeperDatabase();
    try {
      const repository = new IndexedDbNpcRepository(database);
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
      applyNpcDocuments(campaign.code, documents);
      lastFingerprints.current = new Map(
        documents
          .filter(document => !document.tombstoned)
          .map(document => [document.legacyId, document.payloadFingerprint])
      );
      setStatus(
        `Device hydrated from the exact cloud generation of ${documents.length} records.`
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
      const result = await npcApi<{ versions: VersionMetadata[] }>({
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
      const value = await npcApi({
        action: 'export-version',
        campaignId: workspace.cloudId,
        legacyId: historyLegacyId,
        serverVersion,
      });
      downloadJson(`npc-${historyLegacyId}-v${serverVersion}.json`, value);
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
      const result = await npcApi<{ identical: boolean }>({
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
      const restored = await npcApi<{
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
      const exact = await npcApi<VersionExport>({
        action: 'export-version',
        campaignId,
        legacyId: historyLegacyId,
        serverVersion: restored.serverVersion,
      });
      const database = await openRollkeeperDatabase();
      try {
        const repository = new IndexedDbNpcRepository(database);
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
        applyNpcDocuments(campaign.code, storeDocumentsFromLocal(documents));
        lastFingerprints.current = new Map(
          documents
            .filter(document => document.operation !== 'delete')
            .map(document => [document.legacyId, document.contentFingerprint])
        );
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
      const current = await npcApi<EnrollmentPreview>({
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
          'Rollback requires the exact current Postgres generation of these NPCs.'
        );
      rollbackMutationId.current ??= crypto.randomUUID();
      const result = await npcApi<{
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
        const local = await rollbackNpcLocalAuthority(database, {
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
      writeNpcAuthorityMarker(localStorage, campaign.code, {
        version: 1,
        authority: 'legacy_restored',
        epoch: result.epoch,
        campaignId,
        namespace,
      });
      applyNpcDocuments(
        campaign.code,
        result.currentGeneration.documents ?? []
      );
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
        `Remove only ${context.accountLabel}'s local namespace from this device? Cloud and every preserved source remain intact.`
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const namespace = `user:${context.accountId}` as const;
      const database = await openRollkeeperDatabase();
      try {
        const repository = new IndexedDbNpcRepository(database);
        const unresolved = (
          await repository.listOutbox(namespace, workspace.cloudId)
        ).some(
          entry =>
            entry.state !== 'acknowledged' && entry.state !== 'superseded'
        );
        const lossConfirmed =
          !unresolved ||
          window.confirm(
            'Unresolved device-only work will become inaccessible on this device. Confirm the described loss risk?'
          );
        if (!lossConfirmed) return;
        if (authority.authority === 'postgres') {
          const deviceId = localStorage.getItem(
            `rollkeeper:npc-device:${context.accountId}:${workspace.cloudId}`
          );
          if (!deviceId)
            throw new Error(
              'The exact enrolled device identity is unavailable.'
            );
          await npcApi({
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
        hideNpcs(campaign.code);
        lastFingerprints.current = null;
        setScope(null);
        setAuthority(null);
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

  return (
    <Card padding="lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud size={20} /> NPC cloud sync
        </CardTitle>
        <CardDescription>
          Default-off owner workflow. Login, navigation, discovery, and first
          use never enroll or change authority. NPCs are DM-private; players
          never receive a projection.
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
                  Enroll this device
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
                  aria-label="Downloaded NPC recovery file"
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
                disabled={!recoveryVerified || !npcsSelected}
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
                Activate cloud family
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
                  Remove this account from this device
                </Button>
              </>
            )}
          </div>
        )}
        {authority?.authority === 'postgres' && npcs && npcs.length > 0 && (
          <SelectField
            label="NPC for version history"
            value={historyLegacyId ?? undefined}
            onValueChange={setHistoryLegacyId}
          >
            {npcs.map(npc => (
              <SelectItem key={npc.id} value={npc.id}>
                {npc.name}
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
                {blocker.kind}: {blocker.detail}
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
            Player view: not applicable · NPCs are DM-private
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
