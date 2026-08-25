import { browserRecoveryRepository } from '@/lib/browserRecoveryRepository';
import {
  buildEncounterManifest,
  buildEncounterWorkingCopyManifest,
  encounterFromPayload,
  ENCOUNTER_PERSIST_VERSION,
  sortEncounters,
  type EncounterManifest,
  type EncounterPayload,
} from '@/lib/durableDm/encounterFamily';
import { encounterApi } from '@/lib/durableDm/encounterApi';
import { isEncounterClientVisible } from '@/lib/durableDm/slice11eFlags';
import {
  readEncounterAuthorityMarker,
  writeEncounterAuthorityMarker,
} from '@/lib/durableDm/encounterLegacyAuthority';
import {
  commitEncounterLocalCutover,
  markEncounterCloudAuthority,
  readEncounterAuthority,
  rollbackEncounterLocalAuthority,
} from '@/lib/indexeddb/encounterAuthority';
import { runEncounterIndexedDbMigration } from '@/lib/indexeddb/encounterMigration';
import {
  IndexedDbEncounterRepository,
  type EncounterOutboxEntry,
} from '@/lib/indexeddb/encounterRepository';
import { selectEncounterFamily } from '@/lib/indexeddb/encounterSelection';
import {
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import { IndexedDbDmWorkspaceRepository } from '@/lib/indexeddb/dmWorkspaceRepository';
import { ENCOUNTER_STORAGE_KEY } from '@/utils/constants';
// `useEncounterStore` is imported at CALL TIME inside `rollback` below, not at
// module scope, mirroring `npcAdapter.ts`'s own rationale (which itself
// mirrors `campaignSettingsAdapter.ts`'s): this is a client Zustand store,
// and a module-scope import here would pull a persist-backed client store
// into the lib layer. No server importer exists today, but Task 13's adapter
// registry is exactly the kind of module a server component could import, so
// a static import would become a live SSR hazard the moment that happens.
//
// This adapter also never imports `EncounterSyncProvider`,
// `useEncounterSyncContext`, or anything from `EncounterSyncControls.hooks.ts`
// — mirroring `npcAdapter.ts`'s equivalent note: a mounted owner exists for
// this family only inside the campaign route-group layout, and the wizard
// runs on a route where that layout is not mounted (spec R2a). Every
// read/write below goes straight through the family's own library modules,
// exactly as the other five adapters already do, never through the
// route-scoped owner or its React context.

import { decideAuthorityRepair } from '../authorityRepair';
import {
  normalizeFamilyAuthority,
  toAuthorityPointerView,
  type AuthorityMarkerView,
} from '../familyAuthorityNormalizer';
import { runResumableCloudActivation } from '../resumableCloudActivation';
import type {
  DurableFamilyAdapter,
  FamilyManifestHandle,
  FamilyVerification,
} from '../durableFamilyAdapter';
import {
  cloudPreviewAtExpectedEpoch,
  deviceIdFor,
  verifyPostgresGenerationParity,
  verifyPreparedGeneration,
} from './shared';

interface EncounterEnrollmentDocument {
  legacyId: string;
  serverVersion: number;
  schemaVersion: number;
  payloadFingerprint: string;
  tombstoned: boolean;
  payload: EncounterPayload | null;
}

/**
 * `encounter_definition`'s `preview_encounter_device_enrollment` RPC already
 * returns the multi-document shape `runResumableCloudActivation` expects
 * natively (`recordCount` plus a `documents` array) — like `magic_item` and
 * `npc` and unlike `campaign_settings`/`calendar`, whose single-record RPC
 * returns one flat document at the top level. `shared.ts`'s
 * `normalizeFlatEnrollmentPreview` (ruling R8.2) is therefore NOT used here.
 */
interface EncounterEnrollmentPreview {
  authority: 'legacy' | 'postgres';
  epoch?: number;
  previewFingerprint?: string;
  recordCount?: number;
  documents?: EncounterEnrollmentDocument[];
}

// Ruling R9.2: name the behavioural number instead of a bare `.slice(0, 12)`.
const FINGERPRINT_DISPLAY_LENGTH = 12;

function currentRawEnvelope() {
  return localStorage.getItem(ENCOUNTER_STORAGE_KEY) ?? '';
}

function toManifestHandle(
  manifest: EncounterManifest
): FamilyManifestHandle<EncounterManifest> {
  return {
    family: 'encounter_definition',
    fingerprint: manifest.fingerprint,
    recordCount: manifest.recordCount,
    totalBytes: manifest.totalBytes,
    blockers: manifest.blockers,
    records: manifest.records.map(record => ({
      legacyId: record.legacyId,
      schemaVersion: record.schemaVersion,
      byteCount: record.byteCount,
      payloadFingerprint: record.payloadFingerprint,
      tombstoned: record.tombstoned,
      // `encounter_definition` has no typed cross-family references
      // (`ENCOUNTER_FAMILY_INVENTORY.typedCrossFamilyReferences: []`) —
      // `npcSourceId`/`monsterSourceId`/`avatarUrl` are value-copy
      // provenance (`ENCOUNTER_FAMILY_INVENTORY.retainedValueCopies`), not a
      // manifest reference this adapter validates or rewrites.
      references: [],
    })),
    native: manifest,
  };
}

export const encounterAdapter: DurableFamilyAdapter<EncounterManifest> = {
  family: 'encounter_definition',
  label: 'Encounters',

  isVisible() {
    return isEncounterClientVisible();
  },

  async previewManifest(context) {
    const sourceManifest = await buildEncounterManifest({
      campaignCode: context.campaignCode,
      rawEnvelope: currentRawEnvelope(),
    });
    let nextManifest = sourceManifest;
    const authority = await this.readAuthority(context);
    if (authority.state !== 'legacy' && sourceManifest.blockers.length === 0) {
      const database = await openRollkeeperDatabase();
      try {
        // Divergence from `calendarAdapter.ts`/`campaignSettingsAdapter.ts`,
        // mirrored from `npcAdapter.ts`/`magicItemAdapter.ts`:
        // `EncounterSyncControls.hooks.ts`'s own `preview()` (`:730-764`)
        // builds the working-copy manifest straight from `listDocuments()`
        // with NO per-document fingerprint re-verification against
        // `document.contentFingerprint` — unlike the single-record cards,
        // which re-fingerprint the ONE document and throw if it disagrees.
        // `buildEncounterWorkingCopyManifest` still recomputes each
        // document's `payloadFingerprint` from its own payload, it just
        // never compares that recomputed value against the stored
        // `contentFingerprint`. Mirrored exactly: no extra guard is added
        // here.
        const documents = await new IndexedDbEncounterRepository(
          database
        ).listDocuments(`user:${context.accountId}`, context.campaignId);
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
    // Brief's "active-encounter blocker" divergence: `sourceManifest`'s
    // blockers already include `active-encounter` whenever a live encounter
    // in this campaign has `isActive: true` (`buildEncounterManifest`,
    // `encounterFamily.ts`). This handle carries that blocker VERBATIM —
    // never filtered, softened, or turned into a retry — exactly as every
    // other blocker is reported. The wizard decides what to do about it; this
    // adapter never ends combat and never skips the encounter.
    return toManifestHandle(nextManifest);
  },

  confirmation(context, manifest) {
    // Spec R12: a structured contract, never a copy of the card's prose.
    const familyLabel = 'Encounters';
    return {
      familyLabel,
      campaignLabel: `${context.campaignCode}`,
      manifestFingerprint: manifest.fingerprint,
      requiredPhrase: `migrate ${familyLabel.toLowerCase()} ${context.campaignCode} ${manifest.fingerprint.slice(0, FINGERPRINT_DISPLAY_LENGTH)}`,
    };
  },

  async selectFamily(context) {
    const verified = await browserRecoveryRepository.hasVerifiedDownloadReceipt(
      context.recovery.manifestHash
    );
    if (!verified)
      throw new Error(
        'A verified safety-copy download is required for this run before Encounters can be selected.'
      );
    selectEncounterFamily(localStorage, {
      namespace: `user:${context.accountId}`,
      campaignId: context.campaignId,
      confirmed: true,
      recovery: {
        runId: context.recovery.runId,
        manifestHash: context.recovery.manifestHash,
        createdAt: context.recovery.createdAt,
      },
      now: () => new Date().toISOString(),
    });
  },

  async prepareIndexedDb(context) {
    const runId = `encounter-${crypto.randomUUID()}`;
    const result = await runEncounterIndexedDbMigration({
      factory: indexedDB,
      storage: localStorage,
      namespace: `user:${context.accountId}`,
      campaignId: context.campaignId,
      campaignCode: context.campaignCode,
      runId,
      ownerId: crypto.randomUUID(),
      now: () => new Date().toISOString(),
      nowMs: () => Date.now(),
      requiredRecoveryManifestHash: context.recovery.manifestHash,
      // Matches `EncounterSyncControls.hooks.ts`'s own `prepare()`
      // (`:894-897`): the stricter verified-receipt gate, not the bare
      // `hasDownloadReceipt`.
      recoveryGate: {
        hasDownloadReceipt: manifestHash =>
          browserRecoveryRepository.hasVerifiedDownloadReceipt(manifestHash),
      },
    });
    // Brief: an active encounter blocks cutover here (a non-empty
    // `manifest.blockers` keeps `result.state` at `'BLOCKED'`, never
    // `'CUTOVER_READY'`), but never blocks autosave and never ends combat —
    // nothing in this method, or anywhere else in this adapter, writes to
    // `isActive` or the live encounter itself. It also never retries: the
    // caller sees a rejected promise and decides what happens next.
    if (result.state !== 'CUTOVER_READY') {
      throw new Error(
        result.manifest.blockers.length > 0
          ? 'Unresolved candidates block only Encounters; legacy behavior remains active.'
          : 'Local IndexedDB preparation did not satisfy every safety gate.'
      );
    }
    return {
      state: result.state,
      generation: result.generation,
      manifest: toManifestHandle(result.manifest),
    };
  },

  async commitLocalCutover(context, input) {
    const namespace = `user:${context.accountId}` as const;
    // Spec R3's `sourceManifestUnchanged` gate: re-derives the manifest from
    // the CURRENT legacy envelope immediately before cutover and refuses if
    // it drifted since `prepareIndexedDb` captured it
    // (`EncounterSyncControls.hooks.ts:941-948`).
    const currentSourceManifest = await buildEncounterManifest({
      campaignCode: context.campaignCode,
      rawEnvelope: currentRawEnvelope(),
    });
    if (currentSourceManifest.fingerprint !== input.manifest.fingerprint)
      throw new Error(
        'Your encounters changed since you prepared this browser. Preview the migration again.'
      );
    // Spec R10. Ordered before the cutover so a failure here leaves legacy
    // authority untouched, and asserted afterwards so a caller that passes a
    // no-op cannot cut over into an unhydratable state.
    await context.ensureWorkspaceRemembered();
    const database = await openRollkeeperDatabase();
    try {
      const identity = await new IndexedDbDmWorkspaceRepository(database).get(
        namespace,
        context.workspace.localId
      );
      if (!identity || identity.cloudId !== context.campaignId)
        throw new Error(
          'This browser has no owner workspace recorded for the campaign, so the migration cannot continue.'
        );
      const updatedAt = new Date().toISOString();
      const next = await commitEncounterLocalCutover(database, {
        namespace,
        campaignId: context.campaignId,
        generation: input.generation,
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
        // Plural, and always an array: `encounter_definition` is a
        // multi-record family (`initialDocuments`, not `initialDocument`),
        // one entry per manifest record, exactly as
        // `EncounterSyncControls.hooks.ts:974-990` builds them.
        initialDocuments: input.manifest.native.records.map(record => ({
          namespace,
          campaignId: context.campaignId,
          legacyId: record.legacyId,
          family: 'encounter_definition',
          cutoverEpoch: 1,
          operation: record.tombstoned ? 'delete' : 'create',
          payload: record.payload,
          schemaVersion: ENCOUNTER_PERSIST_VERSION,
          localRevision: 1,
          baseServerVersion: 0,
          contentFingerprint: record.payloadFingerprint,
          updatedAt,
          deletedAt: record.tombstoned ? updatedAt : null,
        })),
      });
      writeEncounterAuthorityMarker(localStorage, context.campaignCode, {
        version: 1,
        authority: 'indexedDB',
        epoch: next.epoch,
        campaignId: context.campaignId,
        namespace,
      });
      return { epoch: next.epoch };
    } finally {
      database.close();
    }
  },

  async activateCloud(context, manifest) {
    // The local epoch is read fresh and reconciled, never carried in from an
    // earlier step: see `campaignSettingsAdapter.ts`'s equivalent comment.
    const local = await this.readAuthority(context);
    if (local.state !== 'indexedDB')
      throw new Error(
        'This browser is not ready to back this data category up yet.'
      );
    const localEpoch = local.epoch;

    const result = await runResumableCloudActivation({
      // `IndexedDbEncounterRepository.listDocuments` — `encounter_definition`
      // is a multi-record family, so every document in the set is compared,
      // not a single `getDocument` keyed by campaign code.
      assertWorkingCopyUnchanged: async () => {
        const database = await openRollkeeperDatabase();
        try {
          const documents = await new IndexedDbEncounterRepository(
            database
          ).listDocuments(`user:${context.accountId}`, context.campaignId);
          const actual = new Map(
            documents.map(document => [
              document.legacyId,
              {
                contentFingerprint: document.contentFingerprint,
                schemaVersion: document.schemaVersion,
              },
            ])
          );
          // The count plus per-legacyId `contentFingerprint` comparison
          // mirrors `EncounterSyncControls.hooks.ts:1052-1057` exactly. The
          // `schemaVersion` clause has NO card counterpart — the card checks
          // only `contentFingerprint` — and is adapter-only, declared in the
          // harness's card-parity doc comment (matching the precedent set by
          // `calendarAdapter.ts`'s, `magicItemAdapter.ts`'s and
          // `npcAdapter.ts`'s identical divergence).
          const changed =
            actual.size !== manifest.records.length ||
            manifest.records.some(record => {
              const current = actual.get(record.legacyId);
              return (
                current === undefined ||
                current.contentFingerprint !== record.payloadFingerprint ||
                current.schemaVersion !== record.schemaVersion
              );
            });
          if (changed)
            throw new Error(
              'Your encounters changed since the last check. Preview the migration again.'
            );
        } finally {
          database.close();
        }
      },
      gateway: {
        previewEnrollment: async () => {
          const preview = await encounterApi<EncounterEnrollmentPreview>({
            action: 'preview-enrollment',
            campaignId: context.campaignId,
          });
          if (preview.authority !== 'postgres') return { authority: 'legacy' };
          return {
            authority: 'postgres',
            epoch: preview.epoch,
            previewFingerprint: preview.previewFingerprint,
            recordCount: preview.recordCount,
            documents: (preview.documents ?? []).map(document => ({
              legacyId: document.legacyId,
              serverVersion: document.serverVersion,
              schemaVersion: document.schemaVersion,
              payloadFingerprint: document.payloadFingerprint,
              tombstoned: document.tombstoned,
            })),
          };
        },
        beginStaging: input =>
          encounterApi({
            action: 'begin-staging',
            mutationId: input.mutationId,
            campaignId: context.campaignId,
            deviceId: input.deviceId,
            expectedEpoch: input.expectedEpoch,
            manifestFingerprint: input.manifestFingerprint,
            recoveryManifestHash: input.recoveryManifestHash,
            recoveryReceiptHash: input.recoveryManifestHash,
            recordCount: input.recordCount,
            totalBytes: input.totalBytes,
          }),
        stageItems: input =>
          encounterApi({
            action: 'stage-items',
            mutationId: input.mutationId,
            runId: input.runId,
            items: input.items,
          }),
        confirmCutover: input =>
          encounterApi({
            action: 'confirm-cutover',
            mutationId: input.mutationId,
            runId: input.runId,
            manifestFingerprint: input.manifestFingerprint,
            expectedEpoch: input.expectedEpoch,
          }),
      },
      family: 'encounter_definition',
      recoveryRunId: context.recovery.runId,
      campaignId: context.campaignId,
      manifestFingerprint: manifest.fingerprint,
      records: manifest.records,
      expectedEpoch: Math.max(0, localEpoch - 1),
      request: {
        deviceId: deviceIdFor(
          'encounter',
          context.accountId,
          context.campaignId
        ),
        recoveryManifestHash: context.recovery.manifestHash,
        recordCount: manifest.recordCount,
        totalBytes: manifest.totalBytes,
        // The exact staged item bodies the card sends
        // (`EncounterSyncControls.hooks.ts:1089-1095`), built from
        // `manifest.native.records`.
        items: manifest.native.records.map(record => ({
          legacyId: record.legacyId,
          schemaVersion: record.schemaVersion,
          payload: record.payload,
          payloadFingerprint: record.payloadFingerprint,
          tombstoned: record.tombstoned,
        })),
      },
    });

    if (result.status === 'conflict')
      return { status: 'conflict', reason: result.reason };

    // The local half. Without it the account is Postgres-authoritative while
    // this device still believes it owns the family locally.
    const database = await openRollkeeperDatabase();
    try {
      const next = await markEncounterCloudAuthority(database, {
        namespace: `user:${context.accountId}`,
        campaignId: context.campaignId,
        expectedLocalEpoch: localEpoch,
        cloudEpoch: result.epoch,
        now: () => new Date().toISOString(),
        // Plural: `encounter_definition` is a multi-record family and its
        // option is the `acceptedVersions` array, not `acceptedVersion`.
        // Unlike the card (which hardcodes `serverVersion: 1` for every
        // record, `EncounterSyncControls.hooks.ts:1113-1117`), this reads
        // the value the server actually confirmed — a KNOWN, declared
        // card/adapter divergence (`describeCardParity`'s Minor item 6
        // comment applies here too).
        acceptedVersions: result.acceptedVersions.map(version => ({
          legacyId: version.legacyId,
          serverVersion: version.serverVersion,
          payloadFingerprint: version.payloadFingerprint,
        })),
      });
      writeEncounterAuthorityMarker(localStorage, context.campaignCode, {
        version: 1,
        authority: 'postgres',
        epoch: next.epoch,
        campaignId: context.campaignId,
        namespace: `user:${context.accountId}`,
      });
      return { status: result.status, epoch: next.epoch };
    } finally {
      database.close();
    }
  },

  async verifyCloud(context) {
    const namespace = `user:${context.accountId}` as const;
    const authority = await this.readAuthority(context);
    const authorityAgrees = authority.state !== 'inconsistent';
    const cloudAuthority: FamilyVerification['cloudAuthority'] =
      authority.state === 'postgres' ? 'postgres' : 'legacy';

    const database = await openRollkeeperDatabase();
    let documents;
    let outboxEntries: EncounterOutboxEntry[];
    let conflicts: {
      namespace?: string;
      campaignId?: string;
      family?: string;
      resolutionState?: string;
    }[];
    try {
      const repository = new IndexedDbEncounterRepository(database);
      [documents, outboxEntries] = await Promise.all([
        repository.listDocuments(namespace, context.campaignId),
        repository.listOutbox(namespace, context.campaignId),
      ]);
      const transaction = database.transaction('conflicts', 'readonly');
      conflicts = (await requestResult(
        transaction.objectStore('conflicts').getAll()
      )) as typeof conflicts;
      await transactionComplete(transaction);
    } finally {
      database.close();
    }

    const outboxEmpty = outboxEntries.every(
      entry => entry.state === 'acknowledged' || entry.state === 'superseded'
    );
    const conflictCount = conflicts.filter(
      conflict =>
        conflict.namespace === namespace &&
        conflict.campaignId === context.campaignId &&
        conflict.family === 'encounter_definition' &&
        conflict.resolutionState === 'unresolved'
    ).length;

    let documentsMatch = false;
    let tombstonesMatch = false;
    let recordCount = 0;
    // Task 16 fix round 1, Important 2: R8's "at the EXPECTED epoch"
    // condition, previously never checked here.
    let epochMatches = false;
    // Final fix wave, F2: the parity block used to be gated on
    // `documents.length > 0` as well. `epochMatches`, `documentsMatch` and
    // `tombstonesMatch` are assigned NOWHERE else, so a legitimately empty
    // data category -- a campaign with no records of this kind, migrated
    // perfectly -- could never be verified, and "All campaign data is
    // synced" was permanently unreachable for that campaign. R8's
    // conditions are genuinely satisfied there: the empty multiset matches
    // the empty multiset. The comparison below already discriminates
    // correctly at zero -- `documents.length === cloudDocuments.length`
    // fails if the cloud holds records this browser does not.
    if (cloudAuthority === 'postgres') {
      const preview = await encounterApi<EncounterEnrollmentPreview>({
        action: 'preview-enrollment',
        campaignId: context.campaignId,
      });
      epochMatches = cloudPreviewAtExpectedEpoch(preview, authority.epoch);
      const cloudDocuments =
        preview.authority === 'postgres' ? (preview.documents ?? []) : [];
      const cloudByLegacyId = new Map(
        cloudDocuments.map(document => [document.legacyId, document])
      );
      recordCount =
        preview.authority === 'postgres'
          ? (preview.recordCount ?? cloudDocuments.length)
          : 0;
      documentsMatch =
        preview.authority === 'postgres' &&
        documents.length === cloudDocuments.length &&
        documents.every(document => {
          const cloud = cloudByLegacyId.get(document.legacyId);
          return (
            cloud !== undefined &&
            cloud.payloadFingerprint === document.contentFingerprint &&
            cloud.schemaVersion === document.schemaVersion
          );
        });
      tombstonesMatch = documents.every(document => {
        const cloud = cloudByLegacyId.get(document.legacyId);
        return (
          cloud !== undefined &&
          cloud.tombstoned === (document.operation === 'delete')
        );
      });
    }

    const verified =
      authorityAgrees &&
      cloudAuthority === 'postgres' &&
      epochMatches &&
      documentsMatch &&
      tombstonesMatch &&
      outboxEmpty &&
      conflictCount === 0;

    return {
      authorityAgrees,
      cloudAuthority,
      epoch: authority.epoch,
      recordCount,
      documentsMatch,
      tombstonesMatch,
      outboxEmpty,
      conflictCount,
      verified,
    };
  },

  async readAuthority(context) {
    // Carried forward from `campaignSettingsAdapter.ts`/`npcAdapter.ts`: the
    // marker readers return `null` when the family's client flag is off, so
    // this must short-circuit here and never call the normalizer for a
    // flag-off family. Routed through `this.isVisible()` so the conformance
    // suite can pin this guard generically.
    if (!this.isVisible())
      return {
        state: 'legacy',
        epoch: 0,
        campaignId: null,
        accountId: null,
        rolledBack: false,
      };
    const namespace = `user:${context.accountId}` as const;
    const database = await openRollkeeperDatabase();
    let pointer;
    try {
      pointer = await readEncounterAuthority(
        database,
        namespace,
        context.campaignId
      );
    } finally {
      database.close();
    }
    // Marker dialect (brief): `readEncounterAuthorityMarker` is an ordinary
    // key, keyed only by campaign code — no `accountId` component, unlike
    // some other families' marker keys.
    const rawMarker = readEncounterAuthorityMarker(
      localStorage,
      context.campaignCode
    );
    const marker: AuthorityMarkerView | null = rawMarker
      ? {
          authority: rawMarker.authority,
          epoch: rawMarker.epoch,
          campaignId: rawMarker.campaignId,
        }
      : null;
    return normalizeFamilyAuthority({
      marker,
      pointer: toAuthorityPointerView(pointer),
      accountId: context.accountId,
      campaignId: context.campaignId,
    });
  },

  async repairAuthority(context) {
    const authority = await this.readAuthority(context);
    if (authority.state !== 'inconsistent') return authority;

    const namespace = `user:${context.accountId}` as const;
    const database = await openRollkeeperDatabase();
    let rawPointer;
    try {
      rawPointer = await readEncounterAuthority(
        database,
        namespace,
        context.campaignId
      );
    } finally {
      database.close();
    }

    const decision = await decideAuthorityRepair({
      reason: authority.reason,
      observed: authority.observed,
      evidence: {
        async verifyIndexedDbGeneration() {
          // Not redundant with `decideAuthorityRepair`'s own branch selection:
          // TypeScript's control-flow narrowing on `rawPointer` (a closured `let`)
          // is what lets `rawPointer.generation` below type-check at all — remove
          // this guard and the file fails to compile (verified in task-13b's
          // mutation pass). It also re-confirms, from a FRESH read, that the
          // pointer this evidence call is about to trust still says `indexedDB`.
          if (rawPointer.authority !== 'indexedDB') return false;
          const evidenceDatabase = await openRollkeeperDatabase();
          try {
            const preparedOk = await verifyPreparedGeneration(
              evidenceDatabase,
              'encounter_definition',
              namespace,
              context.campaignId,
              rawPointer.generation
            );
            if (!preparedOk) return false;
            // Fix round 1, item 1: `documents.length > 0` collapsed to
            // "the store is non-empty" — `contentFingerprint` is typed
            // non-nullable, so the `.every()` clause was vacuously true and
            // caught nothing. Compare against the source manifest instead:
            // every record it expects must have a corresponding document,
            // which also fixes item 6 (an empty family's manifest has no
            // records, so `.every()` on `[]` is vacuously true and repair
            // is not fail-closed on legitimately-empty data).
            const sourceManifest = await buildEncounterManifest({
              campaignCode: context.campaignCode,
              rawEnvelope: currentRawEnvelope(),
            });
            if (sourceManifest.blockers.length > 0) return false;
            const documents = await new IndexedDbEncounterRepository(
              evidenceDatabase
            ).listDocuments(namespace, context.campaignId);
            const presentLegacyIds = new Set(
              documents.map(document => document.legacyId)
            );
            return sourceManifest.records.every(record =>
              presentLegacyIds.has(record.legacyId)
            );
          } finally {
            evidenceDatabase.close();
          }
        },
        async verifyPostgresParity() {
          // No `rawPointer.authority !== 'postgres'` guard here (fix
          // round 1, item 4; fix round 2, item 3 tightened this comment
          // after an inaccurate parenthetical was flagged): it is
          // unnecessary, not merely untested. The one verified invariant
          // that makes it safe: every transition AWAY from `postgres`
          // also bumps the epoch — `rollbackEncounterLocalAuthority` writes
          // `expectedEpoch + 1`. `verifyPostgresGenerationParity` below
          // already requires `preview.epoch === rawPointer.epoch`, so any
          // transition away from `postgres` also changes the epoch, and
          // the epoch check blocks it — the authority itself never needs a
          // second look.
          const preview = await encounterApi<EncounterEnrollmentPreview>({
            action: 'preview-enrollment',
            campaignId: context.campaignId,
          });
          const normalizedPreview =
            preview.authority === 'postgres'
              ? {
                  authority: 'postgres' as const,
                  epoch: preview.epoch,
                  previewFingerprint: preview.previewFingerprint,
                  recordCount: preview.recordCount,
                  documents: (preview.documents ?? []).map(document => ({
                    legacyId: document.legacyId,
                    serverVersion: document.serverVersion,
                    schemaVersion: document.schemaVersion,
                    payloadFingerprint: document.payloadFingerprint,
                    tombstoned: document.tombstoned,
                  })),
                }
              : { authority: 'legacy' as const };
          const evidenceDatabase = await openRollkeeperDatabase();
          try {
            const documents = await new IndexedDbEncounterRepository(
              evidenceDatabase
            ).listDocuments(namespace, context.campaignId);
            const localDocuments = documents.map(document => ({
              legacyId: document.legacyId,
              payloadFingerprint: document.contentFingerprint,
              schemaVersion: document.schemaVersion,
              tombstoned: document.operation === 'delete',
            }));
            return verifyPostgresGenerationParity(
              normalizedPreview,
              rawPointer.epoch,
              localDocuments
            );
          } finally {
            evidenceDatabase.close();
          }
        },
      },
    });

    if (decision.action === 'block')
      throw new Error(
        `This browser's encounter migration record disagrees with the server and could not be safely repaired. ${decision.reason}`
      );

    // Fix round 1, item 5: `rawPointer.epoch` (the SECOND, later read every
    // evidence check above verified against), never `decision.epoch`
    // (`observed.pointer.epoch` from the FIRST read inside
    // `this.readAuthority(context)`) — closes the read-skew window a
    // concurrent cutover could otherwise land in.
    writeEncounterAuthorityMarker(localStorage, context.campaignCode, {
      version: 1,
      authority: decision.authority,
      epoch: rawPointer.epoch,
      campaignId: context.campaignId,
      namespace,
    });

    return this.readAuthority(context);
  },

  async rollback(context) {
    const namespace = `user:${context.accountId}` as const;
    const database = await openRollkeeperDatabase();
    let localAuthority;
    try {
      localAuthority = await readEncounterAuthority(
        database,
        namespace,
        context.campaignId
      );
    } finally {
      database.close();
    }
    if (localAuthority.authority !== 'postgres')
      throw new Error(
        'This browser is not ready to roll back this data category yet.'
      );

    // No separate `projection-status` call: like `magic_item` and `npc`,
    // `encounter_definition` has no player projection at all
    // (`ENCOUNTER_FAMILY_INVENTORY.projection: 'not-applicable'`), and
    // `EncounterSyncControls.hooks.ts`'s own `rollback()` (`:1510-1596`)
    // checks only the current Postgres generation, never a projection
    // journal.
    const current = await encounterApi<EncounterEnrollmentPreview>({
      action: 'preview-enrollment',
      campaignId: context.campaignId,
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

    const result = await encounterApi<{
      epoch: number;
      currentGeneration: EncounterEnrollmentPreview;
    }>({
      action: 'rollback',
      mutationId: crypto.randomUUID(),
      campaignId: context.campaignId,
      expectedEpoch: localAuthority.epoch,
      // Divergence from `campaignSettingsAdapter.ts`/`calendarAdapter.ts`,
      // mirrored from `npcAdapter.ts`/`magicItemAdapter.ts`: this field is
      // named `previewFingerprint` on the wire
      // (`EncounterSyncControls.hooks.ts:1545`), not `manifestFingerprint` —
      // the single-record cards use the latter name for the identical value.
      // Mirrored exactly so the rollback request body matches the card
      // byte-for-byte.
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

    const rollbackDatabase = await openRollkeeperDatabase();
    try {
      // No `projectionJournalReconciled` field: `rollbackEncounterLocalAuthority`'s
      // options type has none (unlike its campaign_settings/calendar
      // siblings), matching the family's not-applicable projection.
      await rollbackEncounterLocalAuthority(rollbackDatabase, {
        namespace,
        campaignId: context.campaignId,
        expectedEpoch: localAuthority.epoch,
        generation: localAuthority.generation,
        confirmed: true,
        currentGenerationVerified: true,
        now: () => new Date().toISOString(),
      });
    } finally {
      rollbackDatabase.close();
    }
    // `EncounterSyncControls.hooks.ts:1572-1582` writes the marker BEFORE
    // restoring the legacy store — ORDER IS LOAD-BEARING, same reasoning as
    // `campaignSettingsAdapter.ts`'s equivalent comment.
    writeEncounterAuthorityMarker(localStorage, context.campaignCode, {
      version: 1,
      authority: 'legacy_restored',
      epoch: result.epoch,
      campaignId: context.campaignId,
      namespace,
    });
    // Divergence from `calendarAdapter.ts`: like `campaignSettingsAdapter.ts`,
    // `magicItemAdapter.ts` and `npcAdapter.ts`, the encounter card's restore
    // is UNCONDITIONAL (`EncounterSyncControls.hooks.ts:1579-1582`:
    // `applyEncounterDocuments(campaignCode, result.currentGeneration.documents ?? [])`)
    // — always called, defaulting to an empty list, never gated behind an
    // `if (payload)` check the way `CalendarSyncControls.tsx` gates its
    // single document. Mirrored here: no conditional guard.
    //
    // `encounters` is a FLAT, cross-campaign array (unlike `npc`'s
    // per-campaign-keyed record), so the restore must filter by
    // `campaignCode` on both the encounters array AND the tombstones map —
    // exactly mirroring `applyEncounterDocuments`/`hideEncounters` in
    // `EncounterSyncControls.hooks.ts` — or a rollback for one campaign
    // would clobber every other campaign's encounters in the same store.
    const { useEncounterStore } = await import('@/store/encounterStore');
    const documents = result.currentGeneration.documents ?? [];
    useEncounterStore.setState(state => ({
      encounters: [
        ...state.encounters.filter(
          encounter => encounter.campaignCode !== context.campaignCode
        ),
        ...sortEncounters(
          documents
            .filter(document => document.payload && !document.tombstoned)
            .map(document =>
              encounterFromPayload(
                context.campaignCode,
                document.legacyId,
                document.payload!
              )
            )
        ),
      ],
      encounterTombstones: Object.fromEntries(
        Object.entries(state.encounterTombstones).filter(
          ([, tombstone]) =>
            tombstone?.beforeImage?.campaignCode !== context.campaignCode
        )
      ),
    }));
    return { epoch: result.epoch };
  },
} satisfies DurableFamilyAdapter<EncounterManifest>;
