import { browserRecoveryRepository } from '@/lib/browserRecoveryRepository';
import {
  buildMagicItemManifest,
  buildMagicItemWorkingCopyManifest,
  customMagicItemFromPayload,
  MAGIC_ITEM_STORAGE_KEY,
  sortMagicItems,
  type MagicItemManifest,
  type MagicItemPayload,
} from '@/lib/durableDm/magicItemFamily';
import { magicItemApi } from '@/lib/durableDm/magicItemApi';
import { isMagicItemClientVisible } from '@/lib/durableDm/slice11cFlags';
import {
  readMagicItemAuthorityMarker,
  writeMagicItemAuthorityMarker,
} from '@/lib/durableDm/magicItemLegacyAuthority';
import {
  commitMagicItemLocalCutover,
  markMagicItemCloudAuthority,
  readMagicItemAuthority,
  rollbackMagicItemLocalAuthority,
} from '@/lib/indexeddb/magicItemAuthority';
import { runMagicItemIndexedDbMigration } from '@/lib/indexeddb/magicItemMigration';
import {
  IndexedDbMagicItemRepository,
  type MagicItemOutboxEntry,
} from '@/lib/indexeddb/magicItemRepository';
import { selectMagicItemLibrary } from '@/lib/indexeddb/magicItemSelection';
import {
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import { IndexedDbDmWorkspaceRepository } from '@/lib/indexeddb/dmWorkspaceRepository';
// `useMagicItemLibraryStore` is imported at CALL TIME inside `rollback`
// below, not at module scope, mirroring `campaignSettingsAdapter.ts`'s own
// rationale: this is a client Zustand store, and a module-scope import here
// would pull a persist-backed client store into the lib layer. No server
// importer exists today, but Task 13's adapter registry is exactly the kind
// of module a server component could import, so a static import would
// become a live SSR hazard the moment that happens.

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

interface MagicItemEnrollmentDocument {
  legacyId: string;
  serverVersion: number;
  schemaVersion: number;
  payloadFingerprint: string;
  tombstoned: boolean;
  payload: MagicItemPayload | null;
}

/**
 * `magic_item`'s `preview_magic_item_device_enrollment` RPC already returns
 * the multi-document shape `runResumableCloudActivation` expects natively
 * (`recordCount` plus a `documents` array) — unlike `campaign_settings` and
 * `calendar`, whose single-record RPC returns one flat document at the top
 * level. `shared.ts`'s `normalizeFlatEnrollmentPreview` (ruling R8.2) is
 * therefore NOT used here: there is no flat shape to reshape.
 */
interface MagicItemEnrollmentPreview {
  authority: 'legacy' | 'postgres';
  epoch?: number;
  previewFingerprint?: string;
  recordCount?: number;
  documents?: MagicItemEnrollmentDocument[];
}

// Ruling R9.2: name the behavioural number instead of a bare `.slice(0, 12)`.
const FINGERPRINT_DISPLAY_LENGTH = 12;

function currentRawEnvelope() {
  return localStorage.getItem(MAGIC_ITEM_STORAGE_KEY) ?? '';
}

function toManifestHandle(
  manifest: MagicItemManifest
): FamilyManifestHandle<MagicItemManifest> {
  return {
    family: 'magic_item',
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
      // `magic_item` has no typed cross-family references
      // (`MAGIC_ITEM_FAMILY_INVENTORY.typedCrossFamilyReferences: []`) and its
      // manifest record carries no `references` field at all.
      references: [],
    })),
    native: manifest,
  };
}

export const magicItemAdapter: DurableFamilyAdapter<MagicItemManifest> = {
  family: 'magic_item',
  label: 'Magic item library',

  isVisible() {
    return isMagicItemClientVisible();
  },

  async previewManifest(context) {
    const sourceManifest = await buildMagicItemManifest({
      campaignCode: context.campaignCode,
      rawEnvelope: currentRawEnvelope(),
    });
    let nextManifest = sourceManifest;
    const authority = await this.readAuthority(context);
    if (authority.state !== 'legacy' && sourceManifest.blockers.length === 0) {
      const database = await openRollkeeperDatabase();
      try {
        // Divergence from `calendarAdapter.ts`/`campaignSettingsAdapter.ts`:
        // `MagicItemSyncControls.tsx`'s own `preview()` (`:640-692`) builds
        // the working-copy manifest straight from `listDocuments()` with NO
        // per-document fingerprint re-verification against
        // `document.contentFingerprint` — unlike the single-record cards,
        // which re-fingerprint the ONE document and throw if it disagrees.
        // `buildMagicItemWorkingCopyManifest` still recomputes each
        // document's `payloadFingerprint` from its own payload (so a
        // corrupted payload cannot silently pass through), it just never
        // compares that recomputed value against the stored
        // `contentFingerprint` the way the single-record families do.
        // Mirrored exactly: no extra guard is added here.
        const documents = await new IndexedDbMagicItemRepository(
          database
        ).listDocuments(`user:${context.accountId}`, context.campaignId);
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
    return toManifestHandle(nextManifest);
  },

  confirmation(context, manifest) {
    // Spec R12: a structured contract, never a copy of the card's prose.
    const familyLabel = 'Magic item library';
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
        'A verified safety-copy download is required for this run before the magic item library can be selected.'
      );
    // The one name that breaks the pattern (brief): `selectMagicItemLibrary`,
    // not `selectMagicItemFamily`.
    selectMagicItemLibrary(localStorage, {
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
    const runId = `magic-item-${crypto.randomUUID()}`;
    const result = await runMagicItemIndexedDbMigration({
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
      // Matches `MagicItemSyncControls.tsx`'s own `prepare()` (`:804-807`):
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
          ? 'Unresolved candidates block only the magic item library; legacy behavior remains active.'
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
    // (`MagicItemSyncControls.tsx:842-847`).
    const currentSourceManifest = await buildMagicItemManifest({
      campaignCode: context.campaignCode,
      rawEnvelope: currentRawEnvelope(),
    });
    if (currentSourceManifest.fingerprint !== input.manifest.fingerprint)
      throw new Error(
        'Your magic item library changed since you prepared this browser. Preview the migration again.'
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
      const next = await commitMagicItemLocalCutover(database, {
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
        // Plural, and always an array: `magic_item` is a multi-record family
        // (`initialDocuments`, not `initialDocument`), one entry per manifest
        // record, exactly as `MagicItemSyncControls.tsx:873-887` builds them.
        initialDocuments: input.manifest.native.records.map(record => ({
          namespace,
          campaignId: context.campaignId,
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
      writeMagicItemAuthorityMarker(localStorage, context.campaignCode, {
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
      // `IndexedDbMagicItemRepository.listDocuments` — magic_item is a
      // multi-record family, so every document in the set is compared, not
      // a single `getDocument` keyed by campaign code.
      assertWorkingCopyUnchanged: async () => {
        const database = await openRollkeeperDatabase();
        try {
          const documents = await new IndexedDbMagicItemRepository(
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
          // mirrors `MagicItemSyncControls.tsx:944-955` exactly. The
          // `schemaVersion` clause has NO card counterpart — the card checks
          // only `contentFingerprint` — and is adapter-only, declared in the
          // harness's card-parity doc comment (matching the precedent set by
          // `calendarAdapter.ts`'s identical divergence).
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
              'Your magic item library changed since the last check. Preview the migration again.'
            );
        } finally {
          database.close();
        }
      },
      gateway: {
        previewEnrollment: async () => {
          const preview = await magicItemApi<MagicItemEnrollmentPreview>({
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
          magicItemApi({
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
          magicItemApi({
            action: 'stage-items',
            mutationId: input.mutationId,
            runId: input.runId,
            items: input.items,
          }),
        confirmCutover: input =>
          magicItemApi({
            action: 'confirm-cutover',
            mutationId: input.mutationId,
            runId: input.runId,
            manifestFingerprint: input.manifestFingerprint,
            expectedEpoch: input.expectedEpoch,
          }),
      },
      family: 'magic_item',
      recoveryRunId: context.recovery.runId,
      campaignId: context.campaignId,
      manifestFingerprint: manifest.fingerprint,
      records: manifest.records,
      expectedEpoch: Math.max(0, localEpoch - 1),
      request: {
        deviceId: deviceIdFor(
          'magic-item',
          context.accountId,
          context.campaignId
        ),
        recoveryManifestHash: context.recovery.manifestHash,
        recordCount: manifest.recordCount,
        totalBytes: manifest.totalBytes,
        // The exact staged item bodies the card sends
        // (`MagicItemSyncControls.tsx:987-993`), built from
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
      const next = await markMagicItemCloudAuthority(database, {
        namespace: `user:${context.accountId}`,
        campaignId: context.campaignId,
        expectedLocalEpoch: localEpoch,
        cloudEpoch: result.epoch,
        now: () => new Date().toISOString(),
        // Plural: magic_item is a multi-record family and its option is the
        // `acceptedVersions` array, not `acceptedVersion`. Unlike the card
        // (which hardcodes `serverVersion: 1` for every record,
        // `MagicItemSyncControls.tsx:1013`), this reads the value the server
        // actually confirmed — a KNOWN, declared card/adapter divergence
        // (`describeCardParity`'s Minor item 6 comment applies here too).
        acceptedVersions: result.acceptedVersions.map(version => ({
          legacyId: version.legacyId,
          serverVersion: version.serverVersion,
          payloadFingerprint: version.payloadFingerprint,
        })),
      });
      writeMagicItemAuthorityMarker(localStorage, context.campaignCode, {
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
    let outboxEntries: MagicItemOutboxEntry[];
    let conflicts: {
      namespace?: string;
      campaignId?: string;
      family?: string;
      resolutionState?: string;
    }[];
    try {
      const repository = new IndexedDbMagicItemRepository(database);
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
        conflict.family === 'magic_item' &&
        conflict.resolutionState === 'unresolved'
    ).length;

    let documentsMatch = false;
    let tombstonesMatch = false;
    let recordCount = 0;
    if (cloudAuthority === 'postgres' && documents.length > 0) {
      const preview = await magicItemApi<MagicItemEnrollmentPreview>({
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
      pointer = await readMagicItemAuthority(
        database,
        namespace,
        context.campaignId
      );
    } finally {
      database.close();
    }
    const rawMarker = readMagicItemAuthorityMarker(
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
      rawPointer = await readMagicItemAuthority(
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
              'magic_item',
              namespace,
              context.campaignId,
              rawPointer.generation
            );
            if (!preparedOk) return false;
            const documents = await new IndexedDbMagicItemRepository(
              evidenceDatabase
            ).listDocuments(namespace, context.campaignId);
            return (
              documents.length > 0 &&
              documents.every(document => !!document.contentFingerprint)
            );
          } finally {
            evidenceDatabase.close();
          }
        },
        async verifyPostgresParity() {
          const preview = await magicItemApi<MagicItemEnrollmentPreview>({
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
            const documents = await new IndexedDbMagicItemRepository(
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
        `This browser's magic item library migration record disagrees with the server and could not be safely repaired. ${decision.reason}`
      );

    writeMagicItemAuthorityMarker(localStorage, context.campaignCode, {
      version: 1,
      authority: decision.authority,
      epoch: decision.epoch,
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
      localAuthority = await readMagicItemAuthority(
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

    // No separate `projection-status` call: unlike `campaign_settings` and
    // `calendar`, `magic_item` has no player projection at all
    // (`MAGIC_ITEM_FAMILY_INVENTORY.projection: 'not-applicable'`), and
    // `MagicItemSyncControls.tsx`'s own `rollback()` (`:1402-1414`) checks
    // only the current Postgres generation, never a projection journal.
    const current = await magicItemApi<MagicItemEnrollmentPreview>({
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
        'Rollback requires the exact current Postgres generation of this library.'
      );

    const result = await magicItemApi<{
      epoch: number;
      currentGeneration: MagicItemEnrollmentPreview;
    }>({
      action: 'rollback',
      mutationId: crypto.randomUUID(),
      campaignId: context.campaignId,
      expectedEpoch: localAuthority.epoch,
      // Divergence from `campaignSettingsAdapter.ts`/`calendarAdapter.ts`:
      // this field is named `previewFingerprint` on the wire
      // (`MagicItemSyncControls.tsx:1424`), not `manifestFingerprint` — the
      // single-record cards use the latter name for the identical value.
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
      // No `projectionJournalReconciled` field:
      // `rollbackMagicItemLocalAuthority`'s options type has none (unlike its
      // campaign_settings/calendar siblings), matching the family's
      // not-applicable projection.
      await rollbackMagicItemLocalAuthority(rollbackDatabase, {
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
    // `MagicItemSyncControls.tsx:1451-1461` writes the marker BEFORE
    // restoring the legacy store — ORDER IS LOAD-BEARING, same reasoning as
    // `campaignSettingsAdapter.ts`'s equivalent comment.
    writeMagicItemAuthorityMarker(localStorage, context.campaignCode, {
      version: 1,
      authority: 'legacy_restored',
      epoch: result.epoch,
      campaignId: context.campaignId,
      namespace,
    });
    // Divergence from `calendarAdapter.ts`: like `campaignSettingsAdapter.ts`,
    // the magic item card's restore is UNCONDITIONAL
    // (`MagicItemSyncControls.tsx:1458-1461`:
    // `applyMagicItemDocuments(campaign.code, result.currentGeneration.documents ?? [])`)
    // — always called, defaulting to an empty list, never gated behind an
    // `if (payload)` check the way `CalendarSyncControls.tsx` gates its
    // single document. Mirrored here: no conditional guard.
    const { useMagicItemLibraryStore } = await import(
      '@/store/magicItemLibraryStore'
    );
    const documents = result.currentGeneration.documents ?? [];
    useMagicItemLibraryStore.setState(state => ({
      itemsByCampaign: {
        ...state.itemsByCampaign,
        [context.campaignCode]: sortMagicItems(
          documents
            .filter(document => document.payload && !document.tombstoned)
            .map(document =>
              customMagicItemFromPayload(
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
} satisfies DurableFamilyAdapter<MagicItemManifest>;
