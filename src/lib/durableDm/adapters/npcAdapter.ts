import { browserRecoveryRepository } from '@/lib/browserRecoveryRepository';
import {
  buildNpcManifest,
  buildNpcWorkingCopyManifest,
  campaignNpcFromPayload,
  NPC_PERSIST_VERSION,
  NPC_STORAGE_KEY,
  sortNpcs,
  type NpcManifest,
  type NpcPayload,
} from '@/lib/durableDm/npcFamily';
import { npcApi } from '@/lib/durableDm/npcApi';
import { isNpcClientVisible } from '@/lib/durableDm/slice11dFlags';
import {
  readNpcAuthorityMarker,
  writeNpcAuthorityMarker,
} from '@/lib/durableDm/npcLegacyAuthority';
import {
  commitNpcLocalCutover,
  markNpcCloudAuthority,
  readNpcAuthority,
  rollbackNpcLocalAuthority,
} from '@/lib/indexeddb/npcAuthority';
import { runNpcIndexedDbMigration } from '@/lib/indexeddb/npcMigration';
import {
  IndexedDbNpcRepository,
  type NpcOutboxEntry,
} from '@/lib/indexeddb/npcRepository';
import { selectNpcFamily } from '@/lib/indexeddb/npcSelection';
import {
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import { IndexedDbDmWorkspaceRepository } from '@/lib/indexeddb/dmWorkspaceRepository';
// `useNPCStore` is imported at CALL TIME inside `rollback` below, not at
// module scope, mirroring `magicItemAdapter.ts`'s own rationale (which
// itself mirrors `campaignSettingsAdapter.ts`'s): this is a client Zustand
// store, and a module-scope import here would pull a persist-backed client
// store into the lib layer. No server importer exists today, but Task 13's
// adapter registry is exactly the kind of module a server component could
// import, so a static import would become a live SSR hazard the moment that
// happens.
//
// This adapter also never imports `NpcSyncProvider`, `useNpcSyncContext`, or
// anything from `NpcSyncControls.hooks.ts` — the brief's divergence note: a
// mounted owner exists for this family only inside the campaign route-group
// layout, and the wizard runs on a route where that layout is not mounted
// (spec R2a). Every read/write below goes straight through the family's own
// library modules, exactly as the other five adapters already do, never
// through the route-scoped owner or its React context.

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
  deviceIdFor,
  verifyPostgresGenerationParity,
  verifyPreparedGeneration,
} from './shared';

interface NpcEnrollmentDocument {
  legacyId: string;
  serverVersion: number;
  schemaVersion: number;
  payloadFingerprint: string;
  tombstoned: boolean;
  payload: NpcPayload | null;
}

/**
 * `npc`'s `preview_npc_device_enrollment` RPC already returns the
 * multi-document shape `runResumableCloudActivation` expects natively
 * (`recordCount` plus a `documents` array) — like `magic_item` and unlike
 * `campaign_settings`/`calendar`, whose single-record RPC returns one flat
 * document at the top level. `shared.ts`'s `normalizeFlatEnrollmentPreview`
 * (ruling R8.2) is therefore NOT used here.
 */
interface NpcEnrollmentPreview {
  authority: 'legacy' | 'postgres';
  epoch?: number;
  previewFingerprint?: string;
  recordCount?: number;
  documents?: NpcEnrollmentDocument[];
}

// Ruling R9.2: name the behavioural number instead of a bare `.slice(0, 12)`.
const FINGERPRINT_DISPLAY_LENGTH = 12;

function currentRawEnvelope() {
  return localStorage.getItem(NPC_STORAGE_KEY) ?? '';
}

function toManifestHandle(
  manifest: NpcManifest
): FamilyManifestHandle<NpcManifest> {
  return {
    family: 'npc',
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
      // `npc` has no typed cross-family references
      // (`NPC_FAMILY_INVENTORY.typedCrossFamilyReferences: []`). The brief's
      // divergence note: `campaign_settings.dmDashboardUi.npcCollapsedGroupNames`
      // points at NPC group NAMES, not at a manifest record, and it is not a
      // typed cross-family reference this family's own manifest carries —
      // this adapter migrates NPC documents only and never reads, rewrites
      // or validates that campaign_settings field.
      references: [],
    })),
    native: manifest,
  };
}

export const npcAdapter: DurableFamilyAdapter<NpcManifest> = {
  family: 'npc',
  label: 'NPCs',

  isVisible() {
    return isNpcClientVisible();
  },

  async previewManifest(context) {
    const sourceManifest = await buildNpcManifest({
      campaignCode: context.campaignCode,
      rawEnvelope: currentRawEnvelope(),
    });
    let nextManifest = sourceManifest;
    const authority = await this.readAuthority(context);
    if (authority.state !== 'legacy' && sourceManifest.blockers.length === 0) {
      const database = await openRollkeeperDatabase();
      try {
        // Divergence from `calendarAdapter.ts`/`campaignSettingsAdapter.ts`,
        // mirrored from `magicItemAdapter.ts`: `NpcSyncControls.hooks.ts`'s
        // own `preview()` (`:622-675`) builds the working-copy manifest
        // straight from `listDocuments()` with NO per-document fingerprint
        // re-verification against `document.contentFingerprint` — unlike the
        // single-record cards, which re-fingerprint the ONE document and
        // throw if it disagrees. `buildNpcWorkingCopyManifest` still
        // recomputes each document's `payloadFingerprint` from its own
        // payload, it just never compares that recomputed value against the
        // stored `contentFingerprint`. Mirrored exactly: no extra guard is
        // added here.
        const documents = await new IndexedDbNpcRepository(
          database
        ).listDocuments(`user:${context.accountId}`, context.campaignId);
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
    return toManifestHandle(nextManifest);
  },

  confirmation(context, manifest) {
    // Spec R12: a structured contract, never a copy of the card's prose.
    const familyLabel = 'NPCs';
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
        'A verified safety-copy download is required for this run before NPCs can be selected.'
      );
    selectNpcFamily(localStorage, {
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
    const runId = `npc-${crypto.randomUUID()}`;
    const result = await runNpcIndexedDbMigration({
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
      // Matches `NpcSyncControls.hooks.ts`'s own `prepare()` (`:790-793`):
      // the stricter verified-receipt gate, not the bare
      // `hasDownloadReceipt`.
      recoveryGate: {
        hasDownloadReceipt: manifestHash =>
          browserRecoveryRepository.hasVerifiedDownloadReceipt(manifestHash),
      },
    });
    if (result.state !== 'CUTOVER_READY') {
      throw new Error(
        result.manifest.blockers.length > 0
          ? 'Unresolved candidates block only NPCs; legacy behavior remains active.'
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
    // (`NpcSyncControls.hooks.ts:829-834`).
    const currentSourceManifest = await buildNpcManifest({
      campaignCode: context.campaignCode,
      rawEnvelope: currentRawEnvelope(),
    });
    if (currentSourceManifest.fingerprint !== input.manifest.fingerprint)
      throw new Error(
        'Your NPC roster changed since you prepared this browser. Preview the migration again.'
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
      const next = await commitNpcLocalCutover(database, {
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
        // Plural, and always an array: `npc` is a multi-record family
        // (`initialDocuments`, not `initialDocument`), one entry per manifest
        // record, exactly as `NpcSyncControls.hooks.ts:860-874` builds them.
        // `schemaVersion: NPC_PERSIST_VERSION` mirrors the card's own
        // hardcoded literal `4` (`:868`), not `record.schemaVersion`.
        initialDocuments: input.manifest.native.records.map(record => ({
          namespace,
          campaignId: context.campaignId,
          legacyId: record.legacyId,
          family: 'npc',
          cutoverEpoch: 1,
          operation: record.tombstoned ? 'delete' : 'create',
          payload: record.payload,
          schemaVersion: NPC_PERSIST_VERSION,
          localRevision: 1,
          baseServerVersion: 0,
          contentFingerprint: record.payloadFingerprint,
          updatedAt,
          deletedAt: record.tombstoned ? updatedAt : null,
        })),
      });
      writeNpcAuthorityMarker(localStorage, context.campaignCode, {
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
      // `IndexedDbNpcRepository.listDocuments` — npc is a multi-record
      // family, so every document in the set is compared, not a single
      // `getDocument` keyed by campaign code.
      assertWorkingCopyUnchanged: async () => {
        const database = await openRollkeeperDatabase();
        try {
          const documents = await new IndexedDbNpcRepository(
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
          // mirrors `NpcSyncControls.hooks.ts:938-944` exactly. The
          // `schemaVersion` clause has NO card counterpart — the card checks
          // only `contentFingerprint` — and is adapter-only, declared in the
          // harness's card-parity doc comment (matching the precedent set by
          // `calendarAdapter.ts`'s and `magicItemAdapter.ts`'s identical
          // divergence).
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
              'Your NPC roster changed since the last check. Preview the migration again.'
            );
        } finally {
          database.close();
        }
      },
      gateway: {
        previewEnrollment: async () => {
          const preview = await npcApi<NpcEnrollmentPreview>({
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
          npcApi({
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
          npcApi({
            action: 'stage-items',
            mutationId: input.mutationId,
            runId: input.runId,
            items: input.items,
          }),
        confirmCutover: input =>
          npcApi({
            action: 'confirm-cutover',
            mutationId: input.mutationId,
            runId: input.runId,
            manifestFingerprint: input.manifestFingerprint,
            expectedEpoch: input.expectedEpoch,
          }),
      },
      family: 'npc',
      recoveryRunId: context.recovery.runId,
      campaignId: context.campaignId,
      manifestFingerprint: manifest.fingerprint,
      records: manifest.records,
      expectedEpoch: Math.max(0, localEpoch - 1),
      request: {
        deviceId: deviceIdFor('npc', context.accountId, context.campaignId),
        recoveryManifestHash: context.recovery.manifestHash,
        recordCount: manifest.recordCount,
        totalBytes: manifest.totalBytes,
        // The exact staged item bodies the card sends
        // (`NpcSyncControls.hooks.ts:975-981`), built from
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
      const next = await markNpcCloudAuthority(database, {
        namespace: `user:${context.accountId}`,
        campaignId: context.campaignId,
        expectedLocalEpoch: localEpoch,
        cloudEpoch: result.epoch,
        now: () => new Date().toISOString(),
        // Plural: npc is a multi-record family and its option is the
        // `acceptedVersions` array, not `acceptedVersion`. Unlike the card
        // (which hardcodes `serverVersion: 1` for every record,
        // `NpcSyncControls.hooks.ts:999-1003`), this reads the value the
        // server actually confirmed — a KNOWN, declared card/adapter
        // divergence (`describeCardParity`'s Minor item 6 comment applies
        // here too).
        acceptedVersions: result.acceptedVersions.map(version => ({
          legacyId: version.legacyId,
          serverVersion: version.serverVersion,
          payloadFingerprint: version.payloadFingerprint,
        })),
      });
      writeNpcAuthorityMarker(localStorage, context.campaignCode, {
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
    let outboxEntries: NpcOutboxEntry[];
    let conflicts: {
      namespace?: string;
      campaignId?: string;
      family?: string;
      resolutionState?: string;
    }[];
    try {
      const repository = new IndexedDbNpcRepository(database);
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
        conflict.family === 'npc' &&
        conflict.resolutionState === 'unresolved'
    ).length;

    let documentsMatch = false;
    let tombstonesMatch = false;
    let recordCount = 0;
    if (cloudAuthority === 'postgres' && documents.length > 0) {
      const preview = await npcApi<NpcEnrollmentPreview>({
        action: 'preview-enrollment',
        campaignId: context.campaignId,
      });
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
    // Carried forward from `campaignSettingsAdapter.ts`: the marker readers
    // return `null` when the family's client flag is off, so this must
    // short-circuit here and never call the normalizer for a flag-off
    // family. Routed through `this.isVisible()` so the conformance suite can
    // pin this guard generically.
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
      pointer = await readNpcAuthority(database, namespace, context.campaignId);
    } finally {
      database.close();
    }
    // Marker dialect (brief): `readNpcAuthorityMarker` is an ordinary key,
    // keyed only by campaign code — no `accountId` component, unlike some
    // other families' marker keys.
    const rawMarker = readNpcAuthorityMarker(
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
      rawPointer = await readNpcAuthority(
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
              'npc',
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
            const sourceManifest = await buildNpcManifest({
              campaignCode: context.campaignCode,
              rawEnvelope: currentRawEnvelope(),
            });
            if (sourceManifest.blockers.length > 0) return false;
            const documents = await new IndexedDbNpcRepository(
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
          // also bumps the epoch — `rollbackNpcLocalAuthority` writes
          // `expectedEpoch + 1`. `verifyPostgresGenerationParity` below
          // already requires `preview.epoch === rawPointer.epoch`, so any
          // transition away from `postgres` also changes the epoch, and
          // the epoch check blocks it — the authority itself never needs a
          // second look.
          const preview = await npcApi<NpcEnrollmentPreview>({
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
            const documents = await new IndexedDbNpcRepository(
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
        `This browser's NPC migration record disagrees with the server and could not be safely repaired. ${decision.reason}`
      );

    // Fix round 1, item 5: `rawPointer.epoch` (the SECOND, later read every
    // evidence check above verified against), never `decision.epoch`
    // (`observed.pointer.epoch` from the FIRST read inside
    // `this.readAuthority(context)`) — closes the read-skew window a
    // concurrent cutover could otherwise land in.
    writeNpcAuthorityMarker(localStorage, context.campaignCode, {
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
      localAuthority = await readNpcAuthority(
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

    // No separate `projection-status` call: like `magic_item`, `npc` has no
    // player projection at all (`NPC_FAMILY_INVENTORY.projection:
    // 'not-applicable'`), and `NpcSyncControls.hooks.ts`'s own `rollback()`
    // (`:1377-1425`) checks only the current Postgres generation, never a
    // projection journal.
    const current = await npcApi<NpcEnrollmentPreview>({
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
        'Rollback requires the exact current Postgres generation of these NPCs.'
      );

    const result = await npcApi<{
      epoch: number;
      currentGeneration: NpcEnrollmentPreview;
    }>({
      action: 'rollback',
      mutationId: crypto.randomUUID(),
      campaignId: context.campaignId,
      expectedEpoch: localAuthority.epoch,
      // Divergence from `campaignSettingsAdapter.ts`/`calendarAdapter.ts`,
      // mirrored from `magicItemAdapter.ts`: this field is named
      // `previewFingerprint` on the wire (`NpcSyncControls.hooks.ts:1414`),
      // not `manifestFingerprint` — the single-record cards use the latter
      // name for the identical value. Mirrored exactly so the rollback
      // request body matches the card byte-for-byte.
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
      // No `projectionJournalReconciled` field: `rollbackNpcLocalAuthority`'s
      // options type has none (unlike its campaign_settings/calendar
      // siblings), matching the family's not-applicable projection.
      await rollbackNpcLocalAuthority(rollbackDatabase, {
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
    // `NpcSyncControls.hooks.ts:1441-1448` writes the marker BEFORE
    // restoring the legacy store — ORDER IS LOAD-BEARING, same reasoning as
    // `campaignSettingsAdapter.ts`'s equivalent comment.
    writeNpcAuthorityMarker(localStorage, context.campaignCode, {
      version: 1,
      authority: 'legacy_restored',
      epoch: result.epoch,
      campaignId: context.campaignId,
      namespace,
    });
    // Divergence from `calendarAdapter.ts`: like `campaignSettingsAdapter.ts`
    // and `magicItemAdapter.ts`, the NPC card's restore is UNCONDITIONAL
    // (`NpcSyncControls.hooks.ts:1448`:
    // `applyNpcDocuments(campaignCode, result.currentGeneration.documents ?? [])`)
    // — always called, defaulting to an empty list, never gated behind an
    // `if (payload)` check the way `CalendarSyncControls.tsx` gates its
    // single document. Mirrored here: no conditional guard.
    const { useNPCStore } = await import('@/store/npcStore');
    const documents = result.currentGeneration.documents ?? [];
    useNPCStore.setState(state => ({
      npcsByCampaign: {
        ...state.npcsByCampaign,
        [context.campaignCode]: sortNpcs(
          documents
            .filter(document => document.payload && !document.tombstoned)
            .map(document =>
              campaignNpcFromPayload(
                context.campaignCode,
                document.legacyId,
                document.payload!
              )
            )
        ),
      },
    }));
    return { epoch: result.epoch };
  },
} satisfies DurableFamilyAdapter<NpcManifest>;
