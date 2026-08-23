'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { browserRecoveryRepository } from '@/lib/browserRecoveryRepository';
import {
  buildEncounterManifest,
  buildEncounterWorkingCopyManifest,
  encounterFromPayload,
  encounterPayloadFromEncounter,
  ENCOUNTER_PERSIST_VERSION,
  fingerprintEncounterPayload,
  fingerprintEncounterTombstone,
  sortEncounters,
  type EncounterManifest,
  type EncounterPayload,
} from '@/lib/durableDm/encounterFamily';
import { encounterApi } from '@/lib/durableDm/encounterApi';
import { EncounterHttpGateway } from '@/lib/durableDm/encounterHttpGateway';
import { EncounterSyncService } from '@/lib/durableDm/encounterSyncService';
import { isEncounterClientVisible } from '@/lib/durableDm/slice11eFlags';
import {
  readEncounterAuthorityMarker,
  writeEncounterAuthorityMarker,
} from '@/lib/durableDm/encounterLegacyAuthority';
import {
  captureDeviceBackup,
  initiateDeviceBackupDownload,
  type DeviceBackupV1,
  verifyDownloadedDeviceBackup,
} from '@/lib/deviceRecovery';
import {
  commitEncounterLocalCutover,
  enrollEncounterCloudDevice,
  markEncounterCloudAuthority,
  readEncounterAuthority,
  rollbackEncounterLocalAuthority,
  type EncounterAuthority,
} from '@/lib/indexeddb/encounterAuthority';
import { runEncounterIndexedDbMigration } from '@/lib/indexeddb/encounterMigration';
import {
  IndexedDbEncounterRepository,
  type EncounterDocument,
  type EncounterMutation,
} from '@/lib/indexeddb/encounterRepository';
import {
  hasEncounterSelection,
  readEncounterSelection,
  selectEncounterFamily,
} from '@/lib/indexeddb/encounterSelection';
import { openRollkeeperDatabase } from '@/lib/indexeddb/localDatabase';
import {
  createBrowserDmWorkspace,
  type BrowserDmWorkspaceContext,
} from '@/lib/supabase/browserDmWorkspace';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import type { DmWorkspaceDocument } from '@/lib/indexeddb/dmWorkspaceRepository';
import type { CampaignInfo } from '@/types/campaign';
import type { Encounter } from '@/types/encounter';
import { APP_VERSION, ENCOUNTER_STORAGE_KEY } from '@/utils/constants';
import {
  useEncounterStore,
  type EncounterDeletionTombstone,
} from '@/store/encounterStore';

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
  payload: EncounterPayload | null;
}

interface EnrollmentDocument {
  legacyId: string;
  serverVersion: number;
  schemaVersion: number;
  payloadFingerprint: string;
  tombstoned: boolean;
  payload: EncounterPayload | null;
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
  payload: EncounterPayload | null;
  tombstoned: boolean;
}

/**
 * Ruling 1b: `isActive` blocks cutover only. Autosave keeps committing while
 * combat runs, because the legacy key is frozen for a routed campaign.
 */
export const ACTIVE_ENCOUNTER_GUIDANCE =
  'End the active combat before cutting over; unresolved candidates block only the encounter family.';

/** The worst cloud outcome of a multi-document autosave decides the status. */
const CLOUD_OUTCOME_SEVERITY = {
  'cloud-saved': 0,
  queued: 1,
  conflict: 2,
} as const;

type CloudOutcome = keyof typeof CLOUD_OUTCOME_SEVERITY;

export interface EncounterMutationPlan {
  upserts: string[];
  deletes: string[];
}

export type EncounterCommitOutcome =
  | { saved: true; cloud: CloudOutcome | null }
  | { saved: false; error: string };

/**
 * Diffs the last acknowledged baseline against the live encounter fingerprints.
 * `current` carries the tombstone fingerprint for every tombstoned id, so a
 * deleted encounter produces an explicit `delete` mutation instead of silently
 * dropping its document — and the acknowledged tombstone fingerprint stops the
 * next run from re-emitting it.
 */
export function planEncounterMutations(
  last: ReadonlyMap<string, string>,
  current: ReadonlyMap<string, string>,
  tombstoned: ReadonlySet<string>
): EncounterMutationPlan {
  const upserts: string[] = [];
  const deletes: string[] = [];
  for (const [legacyId, fingerprint] of current) {
    if (tombstoned.has(legacyId)) {
      // An id tombstoned before this device ever committed it has no document
      // to delete, so only a baseline-known record becomes a delete mutation.
      if (last.has(legacyId) && last.get(legacyId) !== fingerprint)
        deletes.push(legacyId);
      continue;
    }
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
 * failure leaves its encounter pending and stops the run for the next effect
 * pass.
 */
export async function runEncounterMutationPlan(input: {
  plan: EncounterMutationPlan;
  baseline: Map<string, string>;
  current: ReadonlyMap<string, string>;
  commit: (
    legacyId: string,
    operation: 'upsert' | 'delete'
  ) => Promise<EncounterCommitOutcome>;
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
      const fingerprint = input.current.get(legacyId);
      if (fingerprint === undefined) input.baseline.delete(legacyId);
      else input.baseline.set(legacyId, fingerprint);
      committed += 1;
    }
  }
  return { outcome, committed, error: null };
}

function commitFailureMessage(reason: 'guest' | 'failed' | 'tombstoned') {
  return reason === 'tombstoned'
    ? 'This encounter was deleted in the cloud; restore it from version history instead.'
    : 'Local IndexedDB transaction failed';
}

function currentRawEnvelope() {
  return localStorage.getItem(ENCOUNTER_STORAGE_KEY) ?? '';
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

function isCampaignTombstone(
  tombstone: EncounterDeletionTombstone | undefined,
  campaignCode: string
) {
  return tombstone?.beforeImage?.campaignCode === campaignCode;
}

/**
 * Rulings 2 and 3: only this campaign's encounters and its tombstones leave the
 * store. Other campaigns, unscoped encounters, `combatConfig`, and
 * `activeEncounterId` are never read, cleared, or reordered.
 */
function hideEncounters(campaignCode: string) {
  useEncounterStore.setState(state => ({
    encounters: state.encounters.filter(
      encounter => encounter.campaignCode !== campaignCode
    ),
    encounterTombstones: Object.fromEntries(
      Object.entries(state.encounterTombstones).filter(
        ([, tombstone]) => !isCampaignTombstone(tombstone, campaignCode)
      )
    ),
  }));
}

function applyEncounterDocuments(
  campaignCode: string,
  documents: StoreDocument[]
) {
  useEncounterStore.setState(state => ({
    encounters: [
      ...state.encounters.filter(
        encounter => encounter.campaignCode !== campaignCode
      ),
      // Ruling 9: hydration applies `sortEncounters`; array position alone
      // never produces a document mutation.
      ...sortEncounters(
        documents
          .filter(document => document.payload && !document.tombstoned)
          .map(document =>
            encounterFromPayload(
              campaignCode,
              document.legacyId,
              document.payload!
            )
          )
      ),
    ],
    encounterTombstones: Object.fromEntries(
      Object.entries(state.encounterTombstones).filter(
        ([, tombstone]) => !isCampaignTombstone(tombstone, campaignCode)
      )
    ),
  }));
}

/**
 * Fingerprints keyed by encounter object identity. `updateEncounterById`
 * (`src/store/encounterStore.ts`) rebuilds only the encounter it touches, so
 * every untouched record is a cache hit: a damage click no longer
 * re-canonicalizes and re-hashes the campaign's other encounters (each legal up
 * to 262,144 canonical bytes of entity stat blocks), and an edit in a
 * *different* campaign — which changes the global `encounters` array identity
 * and therefore re-runs this campaign's pass — costs nothing.
 * Deliberate divergence from the 11D NPC template, whose slice is already
 * campaign-scoped and whose records are small; backporting it is a recorded
 * follow-up.
 */
const encounterFingerprints = new WeakMap<Encounter, string>();

async function fingerprintEncounter(encounter: Encounter) {
  const cached = encounterFingerprints.get(encounter);
  if (cached !== undefined) return cached;
  const fingerprint = await fingerprintEncounterPayload(
    encounterPayloadFromEncounter(encounter)
  );
  encounterFingerprints.set(encounter, fingerprint);
  return fingerprint;
}

/** Identity of the exact local generation a hydration pass consumed. */
function authorityGeneration(
  accountId: string,
  campaignId: string,
  next: EncounterAuthority
) {
  return `${accountId}:${campaignId}:${next.authority}:${next.epoch}`;
}

function storeDocumentsFromLocal(documents: EncounterDocument[]) {
  return documents.map(document => ({
    legacyId: document.legacyId,
    payload: document.payload,
    tombstoned: document.operation === 'delete',
  }));
}

/**
 * Owns the encounter family's hydration and autosave for one campaign. It is
 * mounted once per `/dm/campaign/[code]/*` route group by
 * `EncounterSyncProvider`, so every route that writes the encounter store
 * shares a single owner; the visible card only reads the returned controller.
 */
export function useEncounterSyncController(campaign: CampaignInfo | undefined) {
  // The route layout mounts this owner before dmStore hydrates, so `campaign`
  // can be undefined. `campaignCode` is undefined exactly when it is, and
  // every effect and handler below early-returns on it.
  const campaignCode = campaign?.code;
  const campaignName = campaign?.name ?? '';
  const allEncounters = useEncounterStore(state => state.encounters);
  const allTombstones = useEncounterStore(state => state.encounterTombstones);
  const encounters = useMemo(
    () =>
      campaignCode
        ? allEncounters.filter(
            encounter => encounter.campaignCode === campaignCode
          )
        : [],
    [allEncounters, campaignCode]
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
  const [manifest, setManifest] = useState<EncounterManifest | null>(null);
  const [recovery, setRecovery] = useState<DeviceBackupV1 | null>(null);
  const [recoveryVerified, setRecoveryVerified] = useState(false);
  const [encountersSelected, setEncountersSelected] = useState(false);
  const [preparedGeneration, setPreparedGeneration] = useState<string | null>(
    null
  );
  const [authority, setAuthority] = useState<EncounterAuthority | null>(null);
  const [historyLegacyId, setHistoryLegacyId] = useState<string | null>(
    encounters[0]?.id ?? null
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
    // The default-off guarantee is also enforced by
    // readEncounterAuthorityMarker (zero storage reads while the flag is off);
    // this explicit return is belt-and-braces for the route-level owner, and
    // writeEncounterAuthorityMarker has no guard of its own.
    if (!isEncounterClientVisible() || !campaignCode) return;
    const marker = readEncounterAuthorityMarker(localStorage, campaignCode);
    if (!marker?.namespace || marker.authority === 'legacy_restored') return;
    let cancelled = false;
    const client = createSupabaseBrowserClient();
    if (!client) return;
    const hide = () => {
      setScope(null);
      setAuthority(null);
      setHydrated(false);
      hydrationSignature.current = null;
      hideEncounters(campaignCode);
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
          readEncounterAuthority(
            database,
            marker.namespace!,
            marker.campaignId
          ),
          new IndexedDbEncounterRepository(database).listDocuments(
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
        // still hydrates. (Divergence from the 11D template; backport
        // recorded as a follow-up.)
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
            'The initialized encounter namespace has no matching owner workspace on this device.'
          );
          return;
        }
        const live = documents.filter(
          document => document.operation !== 'delete'
        );
        for (const document of live) {
          const fingerprint = document.payload
            ? await fingerprintEncounterPayload(document.payload)
            : null;
          if (fingerprint !== document.contentFingerprint) {
            setError(
              'Local encounter documents failed fingerprint verification; use history recovery.'
            );
            return;
          }
        }
        applyEncounterDocuments(
          campaignCode,
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
          'Encounters loaded from the verified local IndexedDB generation.'
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
  }, [campaignCode]);

  useEffect(
    () => () => {
      context?.close();
    },
    [context]
  );

  useEffect(() => {
    setHistoryLegacyId(current =>
      current && encounters.some(encounter => encounter.id === current)
        ? current
        : (encounters[0]?.id ?? null)
    );
  }, [encounters]);

  useEffect(() => {
    // The default-off guarantee is also enforced by
    // readEncounterAuthorityMarker (zero storage reads while the flag is off);
    // this explicit return is belt-and-braces for the route-level owner.
    if (!isEncounterClientVisible() || !campaignCode) return;
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
      const byId = new Map<string, Encounter>();
      const current = new Map<string, string>();
      for (const encounter of encounters) {
        byId.set(encounter.id, encounter);
        // Ruling 1b: an encounter in active combat is committed like any
        // other edit; only cutover is blocked.
        current.set(encounter.id, await fingerprintEncounter(encounter));
      }
      const tombstoned = new Set<string>();
      for (const [legacyId, tombstone] of Object.entries(allTombstones)) {
        if (!isCampaignTombstone(tombstone, campaignCode)) continue;
        if (current.has(legacyId)) continue;
        tombstoned.add(legacyId);
        current.set(legacyId, await fingerprintEncounterTombstone(legacyId));
      }
      if (cancelled) return;
      const baseline = lastFingerprints.current;
      if (baseline === null) {
        lastFingerprints.current = current;
        return;
      }
      const plan = planEncounterMutations(baseline, current, tombstoned);
      if (plan.upserts.length === 0 && plan.deletes.length === 0) return;
      const namespace = `user:${scope.accountId}` as const;
      const database = await openRollkeeperDatabase();
      try {
        const repository = new IndexedDbEncounterRepository(database);
        const service =
          authority.authority === 'postgres'
            ? new EncounterSyncService({
                enabled: true,
                repository,
                gateway: new EncounterHttpGateway(),
              })
            : null;
        const updatedAt = new Date().toISOString();
        const result = await runEncounterMutationPlan({
          plan,
          baseline,
          current,
          commit: async (legacyId, operation) => {
            const document = await repository.getDocument(namespace, legacyId);
            const replaceable =
              Boolean(document) && document!.operation !== 'delete';
            const removing = operation === 'delete';
            const mutation: EncounterMutation = {
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
                : encounterPayloadFromEncounter(byId.get(legacyId)!),
              schemaVersion: ENCOUNTER_PERSIST_VERSION,
              localRevision: (document?.localRevision ?? 0) + 1,
              baseServerVersion: removing
                ? (document?.baseServerVersion ?? 0)
                : replaceable
                  ? document!.baseServerVersion
                  : 0,
              contentFingerprint: removing
                ? await fingerprintEncounterTombstone(legacyId)
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
          cause instanceof Error ? cause.message : 'Encounter save failed'
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
  }, [
    authority,
    busy,
    encounters,
    allTombstones,
    campaignCode,
    hydrated,
    scope,
  ]);

  const discover = async () => {
    if (!campaignCode) return;
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
    if (!campaignCode) return;
    if (!context || !selected.cloudId) return;
    setWorkspace(selected);
    setScope({ accountId: context.accountId, campaignId: selected.cloudId });
    setAuthority({ authority: 'localStorage', epoch: 0 });
    setStatus(
      'Workspace chosen. Device enrollment and authority are unchanged.'
    );
  };

  const preview = async () => {
    if (!campaignCode) return;
    setBusy(true);
    setError(null);
    try {
      const sourceManifest = await buildEncounterManifest({
        campaignCode,
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
          const documents = await new IndexedDbEncounterRepository(
            database
          ).listDocuments(`user:${context.accountId}`, workspace.cloudId);
          nextManifest = await buildEncounterWorkingCopyManifest({
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
      setEncountersSelected(false);
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
    if (!campaignCode) return;
    if (!recovery) return;
    setError(null);
    try {
      await initiateDeviceBackupDownload(recovery, browserRecoveryRepository);
      setRecoveryVerified(false);
      setEncountersSelected(false);
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
    if (!campaignCode) return;
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
          `Recovery file verified. Select only the encounters for ${campaignName}? This does not cut over local or cloud authority.`
        )
      ) {
        setEncountersSelected(false);
        setStatus(
          'Recovery file verified; family selection was cancelled and cutover remains blocked.'
        );
        return;
      }
      selectEncounterFamily(localStorage, {
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
      setEncountersSelected(true);
      setStatus(
        'Recovery file verified and encounters selected. LocalStorage remains authoritative.'
      );
    } catch (cause) {
      setRecoveryVerified(false);
      setEncountersSelected(false);
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
    if (!campaignCode) return;
    if (!context || !workspace?.cloudId || !recovery) return;
    setBusy(true);
    try {
      if (
        !hasEncounterSelection(
          localStorage,
          `user:${context.accountId}`,
          workspace.cloudId
        )
      ) {
        throw new Error(
          'Verify the downloaded recovery and explicitly select the family first.'
        );
      }
      const selection = readEncounterSelection(
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
      const runId = `encounter-${crypto.randomUUID()}`;
      const result = await runEncounterIndexedDbMigration({
        factory: indexedDB,
        storage: localStorage,
        namespace: `user:${context.accountId}`,
        campaignId: workspace.cloudId,
        campaignCode,
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
          result.manifest.blockers.some(
            blocker => blocker.kind === 'active-encounter'
          )
            ? ACTIVE_ENCOUNTER_GUIDANCE
            : result.manifest.blockers.length > 0
              ? 'Unresolved candidates block only the encounter family; legacy behavior remains active.'
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
    if (!campaignCode) return;
    if (!context || !workspace?.cloudId || !manifest || !preparedGeneration)
      return;
    if (manifest.blockers.length > 0) return;
    if (
      !window.confirm(
        `Confirm exact manifest ${manifest.fingerprint.slice(0, 12)} and cut only the encounter family to IndexedDB?`
      )
    )
      return;
    const namespace = `user:${context.accountId}` as const;
    const campaignId = workspace.cloudId;
    const database = await openRollkeeperDatabase();
    try {
      const current = await buildEncounterManifest({
        campaignCode,
        rawEnvelope: currentRawEnvelope(),
      });
      if (current.fingerprint !== manifest.fingerprint)
        throw new Error('Manifest changed; preview again.');
      const updatedAt = new Date().toISOString();
      const next = await commitEncounterLocalCutover(database, {
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
          family: 'encounter_definition' as const,
          cutoverEpoch: 1,
          operation: record.tombstoned
            ? ('delete' as const)
            : ('create' as const),
          payload: record.payload,
          schemaVersion: ENCOUNTER_PERSIST_VERSION,
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
      // The store already holds exactly the encounters this cutover captured.
      setHydrated(true);
      writeEncounterAuthorityMarker(localStorage, campaignCode, {
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
    if (!campaignCode) return;
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
        'Stage, revalidate, and atomically activate only the encounter family in Postgres?'
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
          const documents = await new IndexedDbEncounterRepository(
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
      const deviceKey = `rollkeeper:encounter-device:${context.accountId}:${campaignId}`;
      let deviceId = localStorage.getItem(deviceKey);
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem(deviceKey, deviceId);
      }
      const begun = await encounterApi<{ runId: string }>({
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
      await encounterApi({
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
      const activated = await encounterApi<{ epoch: number }>({
        action: 'confirm-cutover',
        mutationId: crypto.randomUUID(),
        runId: begun.runId,
        manifestFingerprint: manifest.fingerprint,
        expectedEpoch: Math.max(0, authority.epoch - 1),
      });
      const database = await openRollkeeperDatabase();
      try {
        const next = await markEncounterCloudAuthority(database, {
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
        writeEncounterAuthorityMarker(localStorage, campaignCode, {
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
    if (!campaignCode) return;
    if (!workspace?.cloudId) return;
    setBusy(true);
    setError(null);
    try {
      const next = await encounterApi<EnrollmentPreview>({
        action: 'preview-enrollment',
        campaignId: workspace.cloudId,
      });
      setEnrollmentPreview(next);
      setStatus(
        next.authority === 'postgres'
          ? 'Cloud enrollment preview loaded. This device remains unenrolled.'
          : 'The selected encounter family is not cloud-authoritative.'
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
    if (!campaignCode) return;
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
      const local = await buildEncounterManifest({
        campaignCode,
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
      const deviceKey = `rollkeeper:encounter-device:${context.accountId}:${campaignId}`;
      const deviceId = localStorage.getItem(deviceKey) ?? crypto.randomUUID();
      localStorage.setItem(deviceKey, deviceId);
      await encounterApi({
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
        const next = await enrollEncounterCloudDevice(database, {
          namespace,
          campaignId,
          campaignCode,
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
        setHydrated(false);
        hydrationSignature.current = authorityGeneration(
          context.accountId,
          campaignId,
          next
        );
        await context.remember(workspace);
        writeEncounterAuthorityMarker(localStorage, campaignCode, {
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
    if (!campaignCode) return;
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
      const repository = new IndexedDbEncounterRepository(database);
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
      applyEncounterDocuments(campaignCode, documents);
      // The store now matches the enrolled generation, so autosave is armed.
      setHydrated(true);
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
    if (!campaignCode) return;
    if (!workspace?.cloudId || !historyLegacyId) return;
    setError(null);
    try {
      const result = await encounterApi<{ versions: VersionMetadata[] }>({
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
    if (!campaignCode) return;
    if (!workspace?.cloudId || !historyLegacyId) return;
    setError(null);
    try {
      const value = await encounterApi({
        action: 'export-version',
        campaignId: workspace.cloudId,
        legacyId: historyLegacyId,
        serverVersion,
      });
      downloadJson(
        `encounter-${historyLegacyId}-v${serverVersion}.json`,
        value
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Version export failed'
      );
    }
  };

  const compareLatestVersions = async () => {
    if (!campaignCode) return;
    if (!workspace?.cloudId || !historyLegacyId || versions.length < 2) return;
    setError(null);
    try {
      const result = await encounterApi<{ identical: boolean }>({
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
    if (!campaignCode) return;
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
      const restored = await encounterApi<{
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
      const exact = await encounterApi<VersionExport>({
        action: 'export-version',
        campaignId,
        legacyId: historyLegacyId,
        serverVersion: restored.serverVersion,
      });
      const database = await openRollkeeperDatabase();
      try {
        const repository = new IndexedDbEncounterRepository(database);
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
        applyEncounterDocuments(
          campaignCode,
          storeDocumentsFromLocal(documents)
        );
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
    if (!campaignCode) return;
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
      const current = await encounterApi<EnrollmentPreview>({
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
          'Rollback requires the exact current Postgres generation of these encounters.'
        );
      rollbackMutationId.current ??= crypto.randomUUID();
      const result = await encounterApi<{
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
        const local = await rollbackEncounterLocalAuthority(database, {
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
      writeEncounterAuthorityMarker(localStorage, campaignCode, {
        version: 1,
        authority: 'legacy_restored',
        epoch: result.epoch,
        campaignId,
        namespace,
      });
      applyEncounterDocuments(
        campaignCode,
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
    if (!campaignCode) return;
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
        const repository = new IndexedDbEncounterRepository(database);
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
            `rollkeeper:encounter-device:${context.accountId}:${workspace.cloudId}`
          );
          if (!deviceId)
            throw new Error(
              'The exact enrolled device identity is unavailable.'
            );
          await encounterApi({
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
        hideEncounters(campaignCode);
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
  return {
    authority,
    busy,
    campaignCode,
    comparison,
    context,
    encounters,
    encountersSelected,
    enrollmentPreview,
    error,
    historyLegacyId,
    manifest,
    preparedGeneration,
    recovery,
    recoveryInput,
    recoveryVerified,
    status,
    versions,
    workspace,
    workspaces,
    activateCloud,
    activateLocal,
    applyExactCloudVersion,
    choose,
    compareLatestVersions,
    discover,
    downloadRecovery,
    enrollDevice,
    exportVersion,
    loadHistory,
    prepare,
    preview,
    previewEnrollment,
    removeAccountFromDevice,
    restoreVersion,
    rollback,
    setHistoryLegacyId,
    verifyRecoveryAndSelect,
  };
}

export type EncounterSyncController = ReturnType<
  typeof useEncounterSyncController
>;
