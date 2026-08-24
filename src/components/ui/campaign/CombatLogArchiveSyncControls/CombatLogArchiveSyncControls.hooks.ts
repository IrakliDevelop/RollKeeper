'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { browserRecoveryRepository } from '@/lib/browserRecoveryRepository';
import {
  buildCombatLogArchiveManifest,
  buildCombatLogArchiveWorkingCopyManifest,
  combatLogArchiveFromPayload,
  combatLogArchivePayloadFrom,
  COMBAT_LOG_ARCHIVE_PERSIST_VERSION,
  fingerprintCombatLogArchivePayload,
  fingerprintCombatLogArchiveTombstone,
  type CombatLogArchiveManifest,
  type CombatLogArchivePayload,
} from '@/lib/durableDm/combatLogArchiveFamily';
import { combatLogArchiveApi } from '@/lib/durableDm/combatLogArchiveApi';
import { CombatLogArchiveHttpGateway } from '@/lib/durableDm/combatLogArchiveHttpGateway';
import { CombatLogArchiveSyncService } from '@/lib/durableDm/combatLogArchiveSyncService';
import { isCombatLogArchiveClientVisible } from '@/lib/durableDm/slice11fFlags';
import {
  readCombatLogArchiveAuthorityMarker,
  writeCombatLogArchiveAuthorityMarker,
} from '@/lib/durableDm/combatLogArchiveLegacyAuthority';
import {
  captureDeviceBackup,
  initiateDeviceBackupDownload,
  verifyDownloadedDeviceBackup,
  type DeviceBackupV1,
} from '@/lib/deviceRecovery';
import {
  commitCombatLogArchiveLocalCutover,
  enrollCombatLogArchiveCloudDevice,
  markCombatLogArchiveCloudAuthority,
  readCombatLogArchiveAuthority,
  rollbackCombatLogArchiveLocalAuthority,
  type CombatLogArchiveAuthority,
} from '@/lib/indexeddb/combatLogArchiveAuthority';
import { runCombatLogArchiveIndexedDbMigration } from '@/lib/indexeddb/combatLogArchiveMigration';
import {
  IndexedDbCombatLogArchiveRepository,
  type CombatLogArchiveDocument,
  type CombatLogArchiveMutation,
} from '@/lib/indexeddb/combatLogArchiveRepository';
import {
  hasCombatLogArchiveSelection,
  readCombatLogArchiveSelection,
  selectCombatLogArchiveFamily,
} from '@/lib/indexeddb/combatLogArchiveSelection';
import { openRollkeeperDatabase } from '@/lib/indexeddb/localDatabase';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import {
  createBrowserDmWorkspace,
  type BrowserDmWorkspaceContext,
} from '@/lib/supabase/browserDmWorkspace';
import type { DmWorkspaceDocument } from '@/lib/indexeddb/dmWorkspaceRepository';
import type { CampaignInfo } from '@/types/campaign';
import type { CombatLogState, CombatLogTombstone } from '@/types/combatLog';
import { APP_VERSION, COMBAT_LOG_STORAGE_KEY } from '@/utils/constants';
import { useCombatLogStore } from '@/store/combatLogStore';

interface StoreDocument {
  legacyId: string;
  payload: CombatLogArchivePayload | null;
  tombstoned: boolean;
}

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
  payload: CombatLogArchivePayload | null;
}

interface EnrollmentDocument {
  legacyId: string;
  serverVersion: number;
  schemaVersion: number;
  payloadFingerprint: string;
  tombstoned: boolean;
  payload: CombatLogArchivePayload | null;
}

interface EnrollmentPreview {
  authority: 'legacy' | 'postgres';
  epoch?: number;
  previewFingerprint?: string;
  recordCount?: number;
  documents?: EnrollmentDocument[];
}

/** One campaign-scoped archive, paired with its stable `archiveId` identity. */
export interface CampaignArchive {
  archiveId: string;
  archive: CombatLogState;
}

/**
 * Ruling 3: `endedAt` is what closes an archive, so the only cutover blocker a
 * DM can clear is an unfinished combat log.
 */
export const ACTIVE_COMBAT_LOG_GUIDANCE =
  "End the combat that's still being logged, then try again. Nothing else is affected.";

/** The worst cloud outcome of a multi-document autosave decides the status. */
const CLOUD_OUTCOME_SEVERITY = {
  'cloud-saved': 0,
  queued: 1,
  conflict: 2,
} as const;

type CloudOutcome = keyof typeof CLOUD_OUTCOME_SEVERITY;

export interface CombatLogArchiveMutationPlan {
  upserts: string[];
  deletes: string[];
}

export type CombatLogArchiveCommitOutcome =
  | { saved: true; cloud: CloudOutcome | null }
  | { saved: false; error: string };

/**
 * Diffs the last acknowledged baseline against the live archive fingerprints.
 * `current` carries the tombstone fingerprint for every tombstoned id, so a
 * deleted archive produces an explicit `delete` mutation instead of silently
 * dropping its document — and the acknowledged tombstone fingerprint stops the
 * next run from re-emitting it.
 */
export function planCombatLogArchiveMutations(
  last: ReadonlyMap<string, string>,
  current: ReadonlyMap<string, string>,
  tombstoned: ReadonlySet<string>
): CombatLogArchiveMutationPlan {
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
 * failure leaves its archive pending and stops the run for the next effect
 * pass.
 */
export async function runCombatLogArchiveMutationPlan(input: {
  plan: CombatLogArchiveMutationPlan;
  baseline: Map<string, string>;
  current: ReadonlyMap<string, string>;
  commit: (
    legacyId: string,
    operation: 'upsert' | 'delete'
  ) => Promise<CombatLogArchiveCommitOutcome>;
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
    ? 'This combat log was deleted from your account. Use Earlier versions to bring it back.'
    : "This device couldn't save that change. Try again.";
}

/**
 * The shared recovery helpers raise developer-facing messages. The card is for
 * DMs, so they are translated here rather than changed at the source (they are
 * shared with other families).
 */
function recoveryFailureMessage(cause: unknown) {
  const detail = cause instanceof Error ? cause.message : '';
  if (detail.includes('does not match the current preview'))
    return "That's an older safety copy. Download a fresh one and try again.";
  if (detail.includes('checksum mismatch'))
    return "That file doesn't match the one you downloaded. Please download a fresh copy.";
  return 'Something is wrong with that safety copy. Download a fresh one and try again.';
}

function currentRawEnvelope() {
  return localStorage.getItem(COMBAT_LOG_STORAGE_KEY) ?? '';
}

/** One enrolled device identity per account and campaign, kept for removal. */
function deviceKeyFor(accountId: string, campaignId: string) {
  return `rollkeeper:combat-log-archive-device:${accountId}:${campaignId}`;
}

function combatLogCount(count: number) {
  return count === 1 ? '1 combat log' : `${count} combat logs`;
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
  tombstone: CombatLogTombstone | undefined,
  campaignCode: string
) {
  return tombstone?.beforeImage?.campaignCode === campaignCode;
}

/**
 * Ruling 9: only this campaign's archives and its tombstones leave the store.
 * Other campaigns, unscoped archives, `activeArchiveId` (device-local) and
 * `lastAdmissionError` (session state) are never read, cleared, or reordered.
 */
function hideCombatLogArchives(campaignCode: string) {
  useCombatLogStore.setState(state => ({
    encounters: Object.fromEntries(
      Object.entries(state.encounters).filter(
        ([, archive]) => archive.campaignCode !== campaignCode
      )
    ),
    combatLogTombstones: Object.fromEntries(
      Object.entries(state.combatLogTombstones).filter(
        ([, tombstone]) => !isCampaignTombstone(tombstone, campaignCode)
      )
    ),
  }));
}

function applyCombatLogArchiveDocuments(
  campaignCode: string,
  documents: StoreDocument[]
) {
  useCombatLogStore.setState(state => ({
    // Ruling 6: `encounters` is a record keyed by `archiveId`, so hydration
    // rebuilds the campaign's keys rather than sorting an array.
    encounters: {
      ...Object.fromEntries(
        Object.entries(state.encounters).filter(
          ([, archive]) => archive.campaignCode !== campaignCode
        )
      ),
      ...Object.fromEntries(
        documents
          .filter(document => document.payload && !document.tombstoned)
          .map(document => [
            document.legacyId,
            combatLogArchiveFromPayload(
              campaignCode,
              document.legacyId,
              document.payload!
            ),
          ])
      ),
    },
    combatLogTombstones: Object.fromEntries(
      Object.entries(state.combatLogTombstones).filter(
        ([, tombstone]) => !isCampaignTombstone(tombstone, campaignCode)
      )
    ),
  }));
}

/**
 * Fingerprints keyed by archive object identity. Every combat log store action
 * that writes `state.encounters` (`startArchive`, `endArchive`, `logEvent`,
 * `pruneOldArchives`, `clearArchive`, and the v1→v2 migration) spreads a fresh
 * `CombatLogState` for the record it touches and re-uses every other record by
 * reference, so an untouched archive is a cache hit: appending one event no
 * longer re-canonicalizes and re-hashes the campaign's other archives (each
 * legal up to 262,144 canonical bytes of event history), and an edit in a
 * *different* campaign — which changes the identity of the whole `encounters`
 * record and therefore re-runs this campaign's pass — costs nothing.
 *
 * Only the records held in `state.encounters` may be used as keys.
 * `getArchivesForEncounter` returns fresh `{ archiveId, ...archive }` spreads
 * on every call, so keying on those would miss every single time.
 */
const combatLogArchiveFingerprints = new WeakMap<CombatLogState, string>();

async function fingerprintArchive(archive: CombatLogState) {
  const cached = combatLogArchiveFingerprints.get(archive);
  if (cached !== undefined) return cached;
  const fingerprint = await fingerprintCombatLogArchivePayload(
    combatLogArchivePayloadFrom(archive)
  );
  combatLogArchiveFingerprints.set(archive, fingerprint);
  return fingerprint;
}

/** Identity of the exact local generation a hydration pass consumed. */
function authorityGeneration(
  accountId: string,
  campaignId: string,
  next: CombatLogArchiveAuthority
) {
  return `${accountId}:${campaignId}:${next.authority}:${next.epoch}`;
}

function storeDocumentsFromLocal(documents: CombatLogArchiveDocument[]) {
  return documents.map(document => ({
    legacyId: document.legacyId,
    payload: document.payload,
    tombstoned: document.operation === 'delete',
  }));
}

/**
 * Owns the combat log archive family's hydration and autosave for one campaign.
 * It is mounted once per `/dm/campaign/[code]/*` route group by
 * `CombatLogArchiveSyncProvider`, so every route that writes the combat log
 * store shares a single owner; the visible card only reads the returned
 * controller.
 */
export function useCombatLogArchiveSyncController(
  campaign: CampaignInfo | undefined
) {
  // The route layout mounts this owner before dmStore hydrates, so `campaign`
  // can be undefined. `campaignCode` is undefined exactly when it is, and
  // every effect and handler below early-returns on it.
  const campaignCode = campaign?.code;
  const campaignName = campaign?.name ?? '';
  const allArchives = useCombatLogStore(state => state.encounters);
  const allTombstones = useCombatLogStore(state => state.combatLogTombstones);
  const archives = useMemo<CampaignArchive[]>(
    () =>
      campaignCode
        ? Object.entries(allArchives)
            .filter(([, archive]) => archive.campaignCode === campaignCode)
            // The record value is passed through by identity so it stays a
            // usable WeakMap key; never a `{ archiveId, ...archive }` spread.
            .map(([archiveId, archive]) => ({ archiveId, archive }))
        : [],
    [allArchives, campaignCode]
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
  const [manifest, setManifest] = useState<CombatLogArchiveManifest | null>(
    null
  );
  const [recovery, setRecovery] = useState<DeviceBackupV1 | null>(null);
  const [recoveryVerified, setRecoveryVerified] = useState(false);
  const [archivesSelected, setArchivesSelected] = useState(false);
  const [preparedGeneration, setPreparedGeneration] = useState<string | null>(
    null
  );
  const [authority, setAuthority] = useState<CombatLogArchiveAuthority | null>(
    null
  );
  const [historyLegacyId, setHistoryLegacyId] = useState<string | null>(
    archives[0]?.archiveId ?? null
  );
  const [versions, setVersions] = useState<VersionMetadata[]>([]);
  const [comparison, setComparison] = useState<string | null>(null);
  const [enrollmentPreview, setEnrollmentPreview] =
    useState<EnrollmentPreview | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Autosave is armed only once the store provably holds this device's routed
  // generation. `authority && scope` is not enough: a hydration that stopped
  // partway — and device enrollment — leave both set while the store still
  // shows the frozen legacy copy or the un-uploaded local candidate.
  const [hydrated, setHydrated] = useState(false);
  const lastFingerprints = useRef<Map<string, string> | null>(null);
  // The exact local generation the store was hydrated from, so a repeated
  // Supabase auth event cannot re-run hydration over newer local work.
  const hydrationSignature = useRef<string | null>(null);
  // Autosave runs are serialized: two overlapping runs could interleave their
  // acknowledgements and rewind a document fingerprint to an older value.
  const autosaveChain = useRef<Promise<void>>(Promise.resolve());
  // Rollback is retried with the same mutation id so a repeated attempt after a
  // network failure replays the server's receipt instead of moving the epoch a
  // second time.
  const rollbackMutationId = useRef<string | null>(null);
  const recoveryInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // The default-off guarantee is also enforced by
    // readCombatLogArchiveAuthorityMarker (zero storage reads while the flag is
    // off); this explicit return is belt-and-braces for the route-level owner,
    // and writeCombatLogArchiveAuthorityMarker has no guard of its own.
    if (!isCombatLogArchiveClientVisible() || !campaignCode) return;
    const marker = readCombatLogArchiveAuthorityMarker(
      localStorage,
      campaignCode
    );
    if (!marker || marker.authority === 'localStorage') return;
    let cancelled = false;
    const client = createSupabaseBrowserClient();
    if (!client) return;
    const hide = () => {
      setScope(null);
      setAuthority(null);
      setHydrated(false);
      hydrationSignature.current = null;
      hideCombatLogArchives(campaignCode);
    };
    const hydrate = async (accountId: string | null) => {
      if (cancelled) return;
      if (!accountId || marker.accountId !== accountId) {
        hide();
        return;
      }
      const namespace = `user:${accountId}` as const;
      const database = await openRollkeeperDatabase();
      try {
        const [localAuthority, documents] = await Promise.all([
          readCombatLogArchiveAuthority(database, namespace, marker.campaignId),
          new IndexedDbCombatLogArchiveRepository(database).listDocuments(
            namespace,
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
        // Everything below this line runs while the store still holds the
        // *previous* generation. Disarming first is what makes publishing the
        // authority early safe: a re-hydration (a newer local epoch written by
        // another tab, an enrolment, a restore) would otherwise commit a render
        // in which `authority` is the new generation, `hydrated` is still true
        // from the last pass, and `archives` is still the pre-hydration store.
        // The autosave effect would chain a run closing over those stale
        // archives behind this pending hydrate; hydrate then resets
        // `lastFingerprints` to the new documents, and the run — resolving on
        // the next microtask, ahead of React's re-render, so its `cancelled`
        // flag is still false — would diff stale current against fresh baseline
        // and write the superseded content back over what was just hydrated.
        setHydrated(false);
        // Which store owns this device is already decided, so it is published
        // before the workspace restore and the integrity check below: a device
        // whose hydration then stops must still describe itself honestly to the
        // DM. Publishing it can never arm autosave — `hydrated` does that, and
        // it stays false until the store provably holds this generation.
        setScope({ accountId, campaignId: marker.campaignId });
        setAuthority(localAuthority);
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
            "This device isn't set up for that account yet. Choose your campaign again."
          );
          return;
        }
        const live = documents.filter(
          document => document.operation !== 'delete'
        );
        for (const document of live) {
          const fingerprint = document.payload
            ? await fingerprintCombatLogArchivePayload(document.payload)
            : null;
          if (fingerprint !== document.contentFingerprint) {
            setError(
              'The combat logs saved on this device look damaged. Use Earlier versions to restore one.'
            );
            return;
          }
        }
        applyCombatLogArchiveDocuments(
          campaignCode,
          storeDocumentsFromLocal(documents)
        );
        lastFingerprints.current = new Map(
          live.map(document => [document.legacyId, document.contentFingerprint])
        );
        setContext(restoredContext);
        setWorkspaces(restoredWorkspaces);
        setWorkspace(restoredWorkspace);
        hydrationSignature.current = authorityGeneration(
          accountId,
          marker.campaignId,
          localAuthority
        );
        setHydrated(true);
        setStatus('Your combat logs are loaded from this device.');
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
            : "Couldn't check who is signed in. Try again."
        )
      );
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      void queueHydrate(session?.user.id ?? null).catch(cause =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Couldn't load your combat logs from this device."
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

  // Keeps the "earlier versions" selection pointing at an archive that still
  // exists, so a deleted or hydrated-away archive cannot leave history stuck on
  // a legacy id this campaign no longer holds.
  useEffect(() => {
    setHistoryLegacyId(current =>
      current && archives.some(entry => entry.archiveId === current)
        ? current
        : (archives[0]?.archiveId ?? null)
    );
  }, [archives]);

  useEffect(() => {
    // The default-off guarantee is also enforced by
    // readCombatLogArchiveAuthorityMarker (zero storage reads while the flag is
    // off); this explicit return is belt-and-braces for the route-level owner.
    if (!isCombatLogArchiveClientVisible() || !campaignCode) return;
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
      const byId = new Map<string, CombatLogState>();
      const current = new Map<string, string>();
      for (const { archiveId, archive } of archives) {
        byId.set(archiveId, archive);
        // Ruling 3: an archive that is still open is committed like any other
        // edit; only cutover is blocked.
        current.set(archiveId, await fingerprintArchive(archive));
      }
      const tombstoned = new Set<string>();
      for (const [legacyId, tombstone] of Object.entries(allTombstones)) {
        if (!isCampaignTombstone(tombstone, campaignCode)) continue;
        if (current.has(legacyId)) continue;
        tombstoned.add(legacyId);
        current.set(
          legacyId,
          await fingerprintCombatLogArchiveTombstone(legacyId)
        );
      }
      if (cancelled) return;
      const baseline = lastFingerprints.current;
      if (baseline === null) {
        lastFingerprints.current = current;
        return;
      }
      const plan = planCombatLogArchiveMutations(baseline, current, tombstoned);
      if (plan.upserts.length === 0 && plan.deletes.length === 0) return;
      const namespace = `user:${scope.accountId}` as const;
      const database = await openRollkeeperDatabase();
      try {
        const repository = new IndexedDbCombatLogArchiveRepository(database);
        const service =
          authority.authority === 'postgres'
            ? new CombatLogArchiveSyncService({
                enabled: true,
                repository,
                gateway: new CombatLogArchiveHttpGateway(),
              })
            : null;
        const updatedAt = new Date().toISOString();
        const result = await runCombatLogArchiveMutationPlan({
          plan,
          baseline,
          current,
          commit: async (legacyId, operation) => {
            const document = await repository.getDocument(namespace, legacyId);
            const replaceable =
              Boolean(document) && document!.operation !== 'delete';
            const removing = operation === 'delete';
            const mutation: CombatLogArchiveMutation = {
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
                : combatLogArchivePayloadFrom(byId.get(legacyId)!),
              schemaVersion: COMBAT_LOG_ARCHIVE_PERSIST_VERSION,
              localRevision: (document?.localRevision ?? 0) + 1,
              baseServerVersion: removing
                ? (document?.baseServerVersion ?? 0)
                : replaceable
                  ? document!.baseServerVersion
                  : 0,
              contentFingerprint: removing
                ? await fingerprintCombatLogArchiveTombstone(legacyId)
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
              ? 'Saved on this device. Not backed up to your account yet.'
              : result.outcome === 'cloud-saved'
                ? 'Saved on this device and backed up to your account.'
                : result.outcome === 'conflict'
                  ? 'Saved on this device. Another device changed this combat log, so it was not backed up.'
                  : 'Saved on this device. It will be backed up when you are back online.'
          );
        if (result.error) setError(result.error);
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Couldn't save that change."
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
  }, [authority, busy, archives, allTombstones, campaignCode, hydrated, scope]);

  const discover = async () => {
    if (!campaignCode) return;
    setBusy(true);
    setError(null);
    try {
      const next = context ?? (await createBrowserDmWorkspace());
      if (!next) throw new Error('Sign in to your account first.');
      setContext(next);
      setWorkspaces((await next.discover()).filter(item => item.cloudId));
      setStatus('Found your campaigns. Nothing has changed yet.');
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Couldn't find your campaigns."
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
    setStatus('Campaign picked. Nothing has changed on this device yet.');
  };

  const preview = async () => {
    if (!campaignCode) return;
    setBusy(true);
    setError(null);
    try {
      const sourceManifest = await buildCombatLogArchiveManifest({
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
          const documents = await new IndexedDbCombatLogArchiveRepository(
            database
          ).listDocuments(`user:${context.accountId}`, workspace.cloudId);
          nextManifest = await buildCombatLogArchiveWorkingCopyManifest({
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
      setArchivesSelected(false);
      setPreparedGeneration(null);
      setStatus('Here is what would be backed up. Nothing has changed yet.');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn't check what would be backed up."
      );
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
      setArchivesSelected(false);
      setStatus(
        'Your safety copy is downloading. Open that file here to continue.'
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn't download the safety copy."
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
          `Safety copy checked. Continue with the combat logs for ${campaignName}? Nothing is moved or backed up yet.`
        )
      ) {
        setArchivesSelected(false);
        setStatus('Safety copy checked. Nothing was changed.');
        return;
      }
      selectCombatLogArchiveFamily(localStorage, {
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
      setArchivesSelected(true);
      setStatus(
        'Safety copy checked. Your combat logs are still stored the usual way for now.'
      );
    } catch (cause) {
      setRecoveryVerified(false);
      setArchivesSelected(false);
      setError(recoveryFailureMessage(cause));
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
        !hasCombatLogArchiveSelection(
          localStorage,
          `user:${context.accountId}`,
          workspace.cloudId
        )
      ) {
        throw new Error('Download the safety copy and open it here first.');
      }
      const selection = readCombatLogArchiveSelection(
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
          "That's an older safety copy. Download a fresh one and try again."
        );
      }
      const runId = `combat-log-archive-${crypto.randomUUID()}`;
      const result = await runCombatLogArchiveIndexedDbMigration({
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
            blocker => blocker.kind === 'active-combat-log'
          )
            ? ACTIVE_COMBAT_LOG_GUIDANCE
            : result.manifest.blockers.length > 0
              ? 'Some combat logs need attention first. Nothing has changed.'
              : 'This device is not ready yet. Try again.'
        );
      }
      setPreparedGeneration(result.generation);
      setStatus(
        'This device is ready. One more confirmation and it will be switched over.'
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn't get this device ready."
      );
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
        `Switch this device over to the new way of storing combat logs? Your safety copy is already saved. Reference: ${manifest.fingerprint.slice(0, 12)}`
      )
    )
      return;
    const namespace = `user:${context.accountId}` as const;
    const campaignId = workspace.cloudId;
    const database = await openRollkeeperDatabase();
    try {
      const current = await buildCombatLogArchiveManifest({
        campaignCode,
        rawEnvelope: currentRawEnvelope(),
      });
      if (current.fingerprint !== manifest.fingerprint)
        throw new Error(
          'Your combat logs changed since the last check. Choose "See what will be backed up" again.'
        );
      // Only the cloud-enrollment paths persisted the chosen workspace, so a
      // device that merely *discovered* one had no workspace_identity document
      // and could not hydrate after a reload: hydrate() looks the campaign up
      // by cloudId, bailed out, and left the store on the frozen legacy key
      // with every later edit silently uncommitted. Local cutover must stand
      // alone, with no cloud activation. Remembering before the cutover means a
      // failure here leaves legacy authority untouched.
      await context.remember(workspace);
      const updatedAt = new Date().toISOString();
      const next = await commitCombatLogArchiveLocalCutover(database, {
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
          family: 'combat_log_archive' as const,
          cutoverEpoch: 1,
          operation: record.tombstoned
            ? ('delete' as const)
            : ('create' as const),
          payload: record.payload,
          schemaVersion: COMBAT_LOG_ARCHIVE_PERSIST_VERSION,
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
      // The store already holds exactly the archives this cutover captured.
      setHydrated(true);
      writeCombatLogArchiveAuthorityMarker(localStorage, {
        version: 1,
        campaignCode,
        authority: 'indexedDB',
        epoch: next.epoch,
        accountId: context.accountId,
        campaignId,
      });
      lastFingerprints.current = new Map(
        manifest.records
          .filter(record => !record.tombstoned)
          .map(record => [record.legacyId, record.payloadFingerprint])
      );
      setStatus('Saved on this device. Not backed up to your account yet.');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn't switch this device over."
      );
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
      !window.confirm('Turn on backup to your account for these combat logs?')
    )
      return;
    const namespace = `user:${context.accountId}` as const;
    const campaignId = workspace.cloudId;
    setBusy(true);
    try {
      const assertWorkingCopyUnchanged = async () => {
        const database = await openRollkeeperDatabase();
        try {
          const documents = await new IndexedDbCombatLogArchiveRepository(
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
              'Your combat logs changed since the last check. Choose "See what will be backed up" again.'
            );
        } finally {
          database.close();
        }
      };
      await assertWorkingCopyUnchanged();
      const deviceKey = deviceKeyFor(context.accountId, campaignId);
      let deviceId = localStorage.getItem(deviceKey);
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem(deviceKey, deviceId);
      }
      const begun = await combatLogArchiveApi<{ runId: string }>({
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
      await combatLogArchiveApi({
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
      // Re-checked after staging: the DM may have logged another turn while the
      // upload was in flight, and only an unchanged working copy may be cut over.
      await assertWorkingCopyUnchanged();
      const activated = await combatLogArchiveApi<{ epoch: number }>({
        action: 'confirm-cutover',
        mutationId: crypto.randomUUID(),
        runId: begun.runId,
        manifestFingerprint: manifest.fingerprint,
        expectedEpoch: Math.max(0, authority.epoch - 1),
      });
      const database = await openRollkeeperDatabase();
      try {
        const next = await markCombatLogArchiveCloudAuthority(database, {
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
        // The store already holds exactly this generation — cloud activation
        // uploads the working copy rather than replacing it — so the signature
        // moves with the authority and `hydrated` is deliberately untouched.
        hydrationSignature.current = authorityGeneration(
          context.accountId,
          campaignId,
          next
        );
        writeCombatLogArchiveAuthorityMarker(localStorage, {
          version: 1,
          campaignCode,
          authority: 'postgres',
          epoch: next.epoch,
          accountId: context.accountId,
          campaignId,
        });
      } finally {
        database.close();
      }
      setStatus('Saved on this device and backed up to your account.');
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Couldn't turn on backup."
      );
      setStatus(
        'Saved on this device. Backup was not turned on, so nothing changed in your account.'
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
      const next = await combatLogArchiveApi<EnrollmentPreview>({
        action: 'preview-enrollment',
        campaignId: workspace.cloudId,
      });
      setEnrollmentPreview(next);
      setStatus(
        next.authority === 'postgres'
          ? 'Found a backup in your account. This device has not been added yet.'
          : 'Nothing is backed up in your account for this campaign yet.'
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Couldn't check your account."
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
      const local = await buildCombatLogArchiveManifest({
        campaignCode,
        rawEnvelope: currentRawEnvelope(),
      });
      if (
        !window.confirm(
          `Add this device to your account's backup? What is on this device is kept and is never uploaded on its own. Reference: ${enrollmentPreview.previewFingerprint.slice(0, 12)}`
        )
      )
        return;
      const namespace = `user:${context.accountId}` as const;
      const campaignId = workspace.cloudId;
      const deviceKey = deviceKeyFor(context.accountId, campaignId);
      const deviceId = localStorage.getItem(deviceKey) ?? crypto.randomUUID();
      localStorage.setItem(deviceKey, deviceId);
      await combatLogArchiveApi({
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
        const next = await enrollCombatLogArchiveCloudDevice(database, {
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
        // Belt-and-braces: `enrollCombatLogArchiveCloudDevice` refuses to run
        // unless this device is still on localStorage authority, and no arming
        // path can coexist with that, so `hydrated` is already false here. The
        // line matches the reference and states the invariant the enrollment
        // confirm promises — the local candidate is never uploaded on its own,
        // and the DM must apply the account's copy first.
        setHydrated(false);
        hydrationSignature.current = authorityGeneration(
          context.accountId,
          campaignId,
          next
        );
        await context.remember(workspace);
        writeCombatLogArchiveAuthorityMarker(localStorage, {
          version: 1,
          campaignCode,
          authority: 'postgres',
          epoch: next.epoch,
          accountId: context.accountId,
          campaignId,
        });
        setStatus(
          'This device was added to your account. Choose "Use the copy from your account" when you are ready.'
        );
      } finally {
        database.close();
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Couldn't add this device."
      );
    } finally {
      setBusy(false);
    }
  };

  const applyExactCloudVersion = async () => {
    // Step 5 audit — every early exit on this hydrating path, and whether it
    // can leave the store showing something other than what IndexedDB holds:
    //  1. no campaign code           → nothing read or written; store untouched.
    //  2. missing context/workspace/
    //     authority/preview          → nothing read or written; store untouched.
    //  3. epoch moved on             → nothing written; the DM is sent back to
    //                                  "Check this device". Store untouched.
    //  4. confirm declined           → nothing written; store untouched.
    //  5. `continue` in the loop      → NOT a return. See the comment there.
    //  6. throw → catch               → IndexedDB may hold part of the accepted
    //                                  generation while the store still shows
    //                                  the local candidate. Arming here would
    //                                  upload that candidate over the account's
    //                                  copy, so it stays disarmed; the recovery
    //                                  is to press the button again, or reload,
    //                                  where hydrate() rebuilds the store from
    //                                  IndexedDB and arms.
    // Nothing separates the store write from `setHydrated(true)` below, so
    // there is no window in which the store is hydrated and autosave is not.
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
      setError(
        'Your account has a newer copy. Choose "Check this device" again.'
      );
      return;
    }
    const documents = enrollmentPreview.documents;
    const cutoverEpoch = enrollmentPreview.epoch;
    if (
      !window.confirm(
        `Load ${combatLogCount(documents.length)} from your account onto this device? Work on this device that has not been backed up will stop this.`
      )
    )
      return;
    const namespace = `user:${context.accountId}` as const;
    const campaignId = workspace.cloudId;
    setBusy(true);
    setError(null);
    const database = await openRollkeeperDatabase();
    try {
      const repository = new IndexedDbCombatLogArchiveRepository(database);
      const acceptedAt = new Date().toISOString();
      for (const document of documents) {
        const current = await repository.getDocument(
          namespace,
          document.legacyId
        );
        if (
          current?.baseServerVersion === document.serverVersion &&
          current.contentFingerprint === document.payloadFingerprint
        ) {
          // Skip the redundant write, never the hydration below. A
          // function-level return here is the PR #267 Critical:
          // `enrollCombatLogArchiveCloudDevice` writes every document with
          // exactly this preview's serverVersion and payloadFingerprint, so
          // this condition is unconditionally true immediately after
          // enrollment — the DM would see a success status while `hydrated`
          // stayed false, the store kept showing the local candidate, and the
          // legacy key stayed frozen with every later edit written nowhere.
          continue;
        }
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
      applyCombatLogArchiveDocuments(campaignCode, documents);
      lastFingerprints.current = new Map(
        documents
          .filter(document => !document.tombstoned)
          .map(document => [document.legacyId, document.payloadFingerprint])
      );
      // The store now matches the enrolled generation, so autosave is armed.
      // `hydrationSignature` is deliberately not written: this path does not
      // consume a local generation, and claiming one would suppress the next
      // genuine hydration.
      setHydrated(true);
      setStatus(
        `Loaded ${combatLogCount(documents.length)} from your account.`
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn't load from your account."
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
      const result = await combatLogArchiveApi<{ versions: VersionMetadata[] }>(
        {
          action: 'history',
          campaignId: workspace.cloudId,
          legacyId: historyLegacyId,
        }
      );
      setVersions(result.versions);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn't load earlier versions."
      );
    }
  };

  const exportVersion = async (serverVersion: number) => {
    if (!campaignCode) return;
    if (!workspace?.cloudId || !historyLegacyId) return;
    setError(null);
    try {
      const value = await combatLogArchiveApi({
        action: 'export-version',
        campaignId: workspace.cloudId,
        legacyId: historyLegacyId,
        serverVersion,
      });
      downloadJson(
        `combat-log-${historyLegacyId}-v${serverVersion}.json`,
        value
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn't download that version."
      );
    }
  };

  const compareLatestVersions = async () => {
    if (!campaignCode) return;
    if (!workspace?.cloudId || !historyLegacyId || versions.length < 2) return;
    setError(null);
    try {
      const result = await combatLogArchiveApi<{ identical: boolean }>({
        action: 'compare-versions',
        campaignId: workspace.cloudId,
        legacyId: historyLegacyId,
        leftVersion: versions[1].serverVersion,
        rightVersion: versions[0].serverVersion,
      });
      setComparison(
        result.identical
          ? 'These two versions are exactly the same.'
          : 'These two versions are different. Download each one to see what changed.'
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn't compare those versions."
      );
    }
  };

  const restoreVersion = async (sourceVersion: number) => {
    // Step 5 audit — every early exit on this hydrating path:
    //  1. no campaign code            → nothing read or written.
    //  2. missing context/workspace/
    //     history id/authority/
    //     versions                    → nothing read or written.
    //  3. confirm declined            → nothing written.
    //  4. throw → catch                → the restored version may already be in
    //                                   IndexedDB while the store still shows
    //                                   the previous content. Arming would push
    //                                   that stale content back over the version
    //                                   just restored, so it stays disarmed; a
    //                                   retry or a reload re-hydrates and arms.
    // The store write, the baseline reset, and `setHydrated(true)` are adjacent
    // and synchronous, so no exit sits between them.
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
        `Restore version ${sourceVersion}? It is added as a new version, and every earlier version is kept.`
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const namespace = `user:${context.accountId}` as const;
      const campaignId = workspace.cloudId;
      const restored = await combatLogArchiveApi<{
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
      const exact = await combatLogArchiveApi<VersionExport>({
        action: 'export-version',
        campaignId,
        legacyId: historyLegacyId,
        serverVersion: restored.serverVersion,
      });
      const database = await openRollkeeperDatabase();
      try {
        const repository = new IndexedDbCombatLogArchiveRepository(database);
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
        applyCombatLogArchiveDocuments(
          campaignCode,
          storeDocumentsFromLocal(documents)
        );
        lastFingerprints.current = new Map(
          documents
            .filter(document => document.operation !== 'delete')
            .map(document => [document.legacyId, document.contentFingerprint])
        );
        // A restore rewrites the store from IndexedDB, so like hydrate,
        // activateLocal and applyExactCloudVersion it must arm autosave: on an
        // enrolled-but-unapplied device the legacy key is frozen, so a disarmed
        // edit would live only in memory and vanish on reload.
        setHydrated(true);
      } finally {
        database.close();
      }
      setStatus(
        `Restored. Saved to your account as version ${restored.serverVersion}.`
      );
      await loadHistory();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn't restore that version."
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
        'Stop backing these combat logs up to your account? Everything already backed up is kept.'
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const namespace = `user:${context.accountId}` as const;
      const campaignId = workspace.cloudId;
      const current = await combatLogArchiveApi<EnrollmentPreview>({
        action: 'preview-enrollment',
        campaignId,
      });
      if (
        current.authority !== 'postgres' ||
        !current.previewFingerprint ||
        !current.documents ||
        current.recordCount === undefined
      )
        throw new Error("Couldn't read the copy in your account. Try again.");
      rollbackMutationId.current ??= crypto.randomUUID();
      const result = await combatLogArchiveApi<{
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
        const local = await rollbackCombatLogArchiveLocalAuthority(database, {
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
      writeCombatLogArchiveAuthorityMarker(localStorage, {
        version: 1,
        campaignCode,
        // Ruling 3: this family's marker has no `legacy_restored` value —
        // rollback restores the legacy key, which is `localStorage` authority.
        authority: 'localStorage',
        epoch: result.epoch,
        accountId: context.accountId,
        campaignId,
      });
      applyCombatLogArchiveDocuments(
        campaignCode,
        result.currentGeneration.documents ?? []
      );
      // The legacy key is authoritative again but this mount has not re-read
      // it, so nothing may be committed until the page is reloaded.
      setHydrated(false);
      hydrationSignature.current = null;
      rollbackMutationId.current = null;
      setStatus(
        'Backup is off and everything was kept. Reload the page to keep working on this device.'
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Couldn't stop the backup."
      );
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
        `Remove ${context.accountLabel}'s combat logs from this device? Your account keeps everything.`
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const namespace = `user:${context.accountId}` as const;
      const database = await openRollkeeperDatabase();
      try {
        const repository = new IndexedDbCombatLogArchiveRepository(database);
        const unresolved = (
          await repository.listOutbox(namespace, workspace.cloudId)
        ).some(
          entry =>
            entry.state !== 'acknowledged' && entry.state !== 'superseded'
        );
        const lossConfirmed =
          !unresolved ||
          window.confirm(
            'Some changes on this device have not been backed up yet and will be lost. Continue?'
          );
        if (!lossConfirmed) return;
        if (authority.authority === 'postgres') {
          const deviceId = localStorage.getItem(
            deviceKeyFor(context.accountId, workspace.cloudId)
          );
          if (!deviceId)
            throw new Error(
              'The exact enrolled device identity is unavailable.'
            );
          await combatLogArchiveApi({
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
        hideCombatLogArchives(campaignCode);
        lastFingerprints.current = null;
        hydrationSignature.current = null;
        setScope(null);
        setAuthority(null);
        // This campaign's archives were just removed by hideCombatLogArchives;
        // an armed autosave would read that emptiness as a deletion and destroy
        // every document the account still holds. `setScope(null)` alone would
        // disarm the gate, so the three lines are one disarm rather than three.
        setHydrated(false);
        setStatus('Removed from this device. Your account keeps everything.');
      } finally {
        database.close();
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn't remove this account's data."
      );
    } finally {
      setBusy(false);
    }
  };

  const deleteArchive = (archiveId: string) => {
    if (!campaignCode) return;
    if (
      !window.confirm(
        'Delete this combat log? It stays in your account history if backup is on.'
      )
    )
      return;
    useCombatLogStore.getState().clearArchive(archiveId);
    setStatus('Combat log deleted.');
  };

  return {
    archives,
    authority,
    busy,
    archivesSelected,
    campaignCode,
    comparison,
    context,
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
    deleteArchive,
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

export type CombatLogArchiveSyncController = ReturnType<
  typeof useCombatLogArchiveSyncController
>;
