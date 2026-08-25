import { browserRecoveryRepository } from '@/lib/browserRecoveryRepository';
import {
  buildCombatLogArchiveManifest,
  buildCombatLogArchiveWorkingCopyManifest,
  combatLogArchiveFromPayload,
  COMBAT_LOG_ARCHIVE_PERSIST_VERSION,
  type CombatLogArchiveManifest,
  type CombatLogArchivePayload,
} from '@/lib/durableDm/combatLogArchiveFamily';
import { combatLogArchiveApi } from '@/lib/durableDm/combatLogArchiveApi';
import { isCombatLogArchiveClientVisible } from '@/lib/durableDm/slice11fFlags';
import {
  readCombatLogArchiveAuthorityMarker,
  writeCombatLogArchiveAuthorityMarker,
} from '@/lib/durableDm/combatLogArchiveLegacyAuthority';
import {
  commitCombatLogArchiveLocalCutover,
  markCombatLogArchiveCloudAuthority,
  readCombatLogArchiveAuthority,
  rollbackCombatLogArchiveLocalAuthority,
} from '@/lib/indexeddb/combatLogArchiveAuthority';
import { runCombatLogArchiveIndexedDbMigration } from '@/lib/indexeddb/combatLogArchiveMigration';
import {
  IndexedDbCombatLogArchiveRepository,
  type CombatLogArchiveOutboxEntry,
} from '@/lib/indexeddb/combatLogArchiveRepository';
import { selectCombatLogArchiveFamily } from '@/lib/indexeddb/combatLogArchiveSelection';
import {
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import { IndexedDbDmWorkspaceRepository } from '@/lib/indexeddb/dmWorkspaceRepository';
import { COMBAT_LOG_STORAGE_KEY } from '@/utils/constants';
// `useCombatLogStore` is imported at CALL TIME inside `rollback` below, not at
// module scope, mirroring `encounterAdapter.ts`'s own rationale (which itself
// mirrors `campaignSettingsAdapter.ts`'s): this is a client Zustand store, and
// a module-scope import here would pull a persist-backed client store into
// the lib layer. No server importer exists today, but Task 13's adapter
// registry is exactly the kind of module a server component could import, so
// a static import would become a live SSR hazard the moment that happens.
//
// This adapter also never imports `CombatLogArchiveSyncProvider`,
// `useCombatLogArchiveSyncController`, or anything from
// `CombatLogArchiveSyncControls.hooks.ts` — mirroring `encounterAdapter.ts`'s
// equivalent note: a mounted owner exists for this family only inside the
// campaign route-group layout, and the wizard runs on a route where that
// layout is not mounted (spec R2a). Every read/write below goes straight
// through the family's own library modules, exactly as the other five
// adapters already do, never through the route-scoped owner or its React
// context.

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
import { deviceIdFor } from './shared';

interface CombatLogArchiveEnrollmentDocument {
  legacyId: string;
  serverVersion: number;
  schemaVersion: number;
  payloadFingerprint: string;
  tombstoned: boolean;
  payload: CombatLogArchivePayload | null;
}

/**
 * `combat_log_archive`'s `preview_combat_log_archive_device_enrollment` RPC
 * already returns the multi-document shape `runResumableCloudActivation`
 * expects natively (`recordCount` plus a `documents` array) — like
 * `magic_item`, `npc` and `encounter_definition`, and unlike
 * `campaign_settings`/`calendar`, whose single-record RPC returns one flat
 * document at the top level. `shared.ts`'s `normalizeFlatEnrollmentPreview`
 * (ruling R8.2) is therefore NOT used here.
 */
interface CombatLogArchiveEnrollmentPreview {
  authority: 'legacy' | 'postgres';
  epoch?: number;
  previewFingerprint?: string;
  recordCount?: number;
  documents?: CombatLogArchiveEnrollmentDocument[];
}

// Ruling R9.2: name the behavioural number instead of a bare `.slice(0, 12)`.
const FINGERPRINT_DISPLAY_LENGTH = 12;

function currentRawEnvelope() {
  return localStorage.getItem(COMBAT_LOG_STORAGE_KEY) ?? '';
}

function toManifestHandle(
  manifest: CombatLogArchiveManifest
): FamilyManifestHandle<CombatLogArchiveManifest> {
  return {
    family: 'combat_log_archive',
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
      // `COMBAT_LOG_ARCHIVE_FAMILY_INVENTORY.typedCrossFamilyReferences`
      // names `encounterId → encounter_definition`, but
      // `combatLogArchiveFamily.ts`'s own comment on
      // `CombatLogArchiveManifestBlocker` states `unresolved-encounter-reference`
      // is "declared but never emitted by this module" — resolution through
      // the encounter family's authority router is explicitly left to "the
      // cutover path that owns the router", and nothing in this slice's spec
      // or brief assigns that router to this adapter. `encounterId` therefore
      // stays a value-copy the manifest carries inside `payload`, not a
      // typed reference this handle validates or rewrites — matching
      // `encounterAdapter.ts`'s and `npcAdapter.ts`'s identical `[]` for
      // their own value-copy-only cross-family fields.
      references: [],
    })),
    native: manifest,
  };
}

export const combatLogArchiveAdapter: DurableFamilyAdapter<CombatLogArchiveManifest> =
  {
    family: 'combat_log_archive',
    label: 'Combat logs',

    isVisible() {
      return isCombatLogArchiveClientVisible();
    },

    async previewManifest(context) {
      const sourceManifest = await buildCombatLogArchiveManifest({
        campaignCode: context.campaignCode,
        rawEnvelope: currentRawEnvelope(),
      });
      let nextManifest = sourceManifest;
      const authority = await this.readAuthority(context);
      if (
        authority.state !== 'legacy' &&
        sourceManifest.blockers.length === 0
      ) {
        const database = await openRollkeeperDatabase();
        try {
          // Divergence from `calendarAdapter.ts`/`campaignSettingsAdapter.ts`,
          // mirrored from `encounterAdapter.ts`/`npcAdapter.ts`/
          // `magicItemAdapter.ts`: `CombatLogArchiveSyncControls.hooks.ts`'s
          // own `preview()` (`:795-829`) builds the working-copy manifest
          // straight from `listDocuments()` with NO per-document fingerprint
          // re-verification against `document.contentFingerprint` — unlike
          // the single-record cards, which re-fingerprint the ONE document
          // and throw if it disagrees. `buildCombatLogArchiveWorkingCopyManifest`
          // still recomputes each document's `payloadFingerprint` from its
          // own payload, it just never compares that recomputed value
          // against the stored `contentFingerprint`. Mirrored exactly: no
          // extra guard is added here.
          const documents = await new IndexedDbCombatLogArchiveRepository(
            database
          ).listDocuments(`user:${context.accountId}`, context.campaignId);
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
      // Brief's "active-combat-log blocker" divergence, same shape as
      // encounter_definition's active-encounter blocker: `sourceManifest`'s
      // blockers already include `active-combat-log` whenever an archive in
      // this campaign has no `endedAt` (`buildCombatLogArchiveManifest`,
      // `combatLogArchiveFamily.ts`, ruling 3). This handle carries that
      // blocker VERBATIM — never filtered, softened, or turned into a
      // retry. The wizard decides what to do about it; this adapter never
      // ends the combat log and never writes `endedAt` itself.
      return toManifestHandle(nextManifest);
    },

    confirmation(context, manifest) {
      // Spec R12: a structured contract, never a copy of the card's prose.
      const familyLabel = 'Combat logs';
      return {
        familyLabel,
        campaignLabel: `${context.campaignCode}`,
        manifestFingerprint: manifest.fingerprint,
        requiredPhrase: `migrate ${familyLabel.toLowerCase()} ${context.campaignCode} ${manifest.fingerprint.slice(0, FINGERPRINT_DISPLAY_LENGTH)}`,
      };
    },

    async selectFamily(context) {
      const verified =
        await browserRecoveryRepository.hasVerifiedDownloadReceipt(
          context.recovery.manifestHash
        );
      if (!verified)
        throw new Error(
          'A verified safety-copy download is required for this run before Combat logs can be selected.'
        );
      selectCombatLogArchiveFamily(localStorage, {
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
      const runId = `combat-log-archive-${crypto.randomUUID()}`;
      const result = await runCombatLogArchiveIndexedDbMigration({
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
        // Matches `CombatLogArchiveSyncControls.hooks.ts`'s own `prepare()`
        // (`:959-962`): the stricter verified-receipt gate, not the bare
        // `hasDownloadReceipt`.
        recoveryGate: {
          hasDownloadReceipt: manifestHash =>
            browserRecoveryRepository.hasVerifiedDownloadReceipt(manifestHash),
        },
      });
      // Brief: an open combat log (no `endedAt`) blocks cutover here (a
      // non-empty `manifest.blockers` keeps `result.state` at `'BLOCKED'`,
      // never `'CUTOVER_READY'`), but never blocks autosave and never ends
      // the combat log — nothing in this method, or anywhere else in this
      // adapter, writes to `endedAt`. It also never retries: the caller sees
      // a rejected promise and decides what happens next.
      if (result.state !== 'CUTOVER_READY') {
        throw new Error(
          result.manifest.blockers.length > 0
            ? 'Unresolved candidates block only Combat logs; legacy behavior remains active.'
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
      // Spec R3's `sourceManifestUnchanged` gate: re-derives the manifest
      // from the CURRENT legacy envelope immediately before cutover and
      // refuses if it drifted since `prepareIndexedDb` captured it
      // (`CombatLogArchiveSyncControls.hooks.ts:1009-1016`).
      const currentSourceManifest = await buildCombatLogArchiveManifest({
        campaignCode: context.campaignCode,
        rawEnvelope: currentRawEnvelope(),
      });
      if (currentSourceManifest.fingerprint !== input.manifest.fingerprint)
        throw new Error(
          'Your combat logs changed since you prepared this browser. Preview the migration again.'
        );
      // Spec R10. Ordered before the cutover so a failure here leaves legacy
      // authority untouched, and asserted afterwards so a caller that passes
      // a no-op cannot cut over into an unhydratable state.
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
        const next = await commitCombatLogArchiveLocalCutover(database, {
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
          // Plural, and always an array: `combat_log_archive` is a
          // multi-record family (`initialDocuments`, not `initialDocument`),
          // one entry per manifest record, exactly as
          // `CombatLogArchiveSyncControls.hooks.ts:1042-1058` builds them.
          initialDocuments: input.manifest.native.records.map(record => ({
            namespace,
            campaignId: context.campaignId,
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
        writeCombatLogArchiveAuthorityMarker(localStorage, {
          version: 1,
          campaignCode: context.campaignCode,
          authority: 'indexedDB',
          epoch: next.epoch,
          accountId: context.accountId,
          campaignId: context.campaignId,
        });
        return { epoch: next.epoch };
      } finally {
        database.close();
      }
    },

    async activateCloud(context, manifest) {
      // The local epoch is read fresh and reconciled, never carried in from
      // an earlier step: see `campaignSettingsAdapter.ts`'s equivalent
      // comment.
      const local = await this.readAuthority(context);
      if (local.state !== 'indexedDB')
        throw new Error(
          'This browser is not ready to back this data category up yet.'
        );
      const localEpoch = local.epoch;

      const result = await runResumableCloudActivation({
        // `IndexedDbCombatLogArchiveRepository.listDocuments` —
        // `combat_log_archive` is a multi-record family, so every document
        // in the set is compared, not a single `getDocument` keyed by
        // campaign code.
        assertWorkingCopyUnchanged: async () => {
          const database = await openRollkeeperDatabase();
          try {
            const documents = await new IndexedDbCombatLogArchiveRepository(
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
            // mirrors `CombatLogArchiveSyncControls.hooks.ts:1117-1128`
            // exactly. The `schemaVersion` clause has NO card counterpart —
            // the card checks only `contentFingerprint` — and is
            // adapter-only, declared in the harness's card-parity doc
            // comment (matching the precedent set by `calendarAdapter.ts`'s,
            // `magicItemAdapter.ts`'s, `npcAdapter.ts`'s and
            // `encounterAdapter.ts`'s identical divergence).
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
                'Your combat logs changed since the last check. Preview the migration again.'
              );
          } finally {
            database.close();
          }
        },
        gateway: {
          previewEnrollment: async () => {
            const preview =
              await combatLogArchiveApi<CombatLogArchiveEnrollmentPreview>({
                action: 'preview-enrollment',
                campaignId: context.campaignId,
              });
            if (preview.authority !== 'postgres')
              return { authority: 'legacy' };
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
            combatLogArchiveApi({
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
            combatLogArchiveApi({
              action: 'stage-items',
              mutationId: input.mutationId,
              runId: input.runId,
              items: input.items,
            }),
          confirmCutover: input =>
            combatLogArchiveApi({
              action: 'confirm-cutover',
              mutationId: input.mutationId,
              runId: input.runId,
              manifestFingerprint: input.manifestFingerprint,
              expectedEpoch: input.expectedEpoch,
            }),
        },
        family: 'combat_log_archive',
        recoveryRunId: context.recovery.runId,
        campaignId: context.campaignId,
        manifestFingerprint: manifest.fingerprint,
        records: manifest.records,
        expectedEpoch: Math.max(0, localEpoch - 1),
        request: {
          deviceId: deviceIdFor(
            'combat-log-archive',
            context.accountId,
            context.campaignId
          ),
          recoveryManifestHash: context.recovery.manifestHash,
          recordCount: manifest.recordCount,
          totalBytes: manifest.totalBytes,
          // The exact staged item bodies the card sends
          // (`CombatLogArchiveSyncControls.hooks.ts:1160-1166`), built from
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

      // The local half. Without it the account is Postgres-authoritative
      // while this device still believes it owns the family locally.
      const database = await openRollkeeperDatabase();
      try {
        const next = await markCombatLogArchiveCloudAuthority(database, {
          namespace: `user:${context.accountId}`,
          campaignId: context.campaignId,
          expectedLocalEpoch: localEpoch,
          cloudEpoch: result.epoch,
          now: () => new Date().toISOString(),
          // Plural: `combat_log_archive` is a multi-record family and its
          // option is the `acceptedVersions` array, not `acceptedVersion`.
          // Unlike the card (which hardcodes `serverVersion: 1` for every
          // record, `CombatLogArchiveSyncControls.hooks.ts:1186-1190`), this
          // reads the value the server actually confirmed — a KNOWN,
          // declared card/adapter divergence (`describeCardParity`'s Minor
          // item 6 comment applies here too).
          acceptedVersions: result.acceptedVersions.map(version => ({
            legacyId: version.legacyId,
            serverVersion: version.serverVersion,
            payloadFingerprint: version.payloadFingerprint,
          })),
        });
        writeCombatLogArchiveAuthorityMarker(localStorage, {
          version: 1,
          campaignCode: context.campaignCode,
          authority: 'postgres',
          epoch: next.epoch,
          accountId: context.accountId,
          campaignId: context.campaignId,
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
      let outboxEntries: CombatLogArchiveOutboxEntry[];
      let conflicts: {
        namespace?: string;
        campaignId?: string;
        family?: string;
        resolutionState?: string;
      }[];
      try {
        const repository = new IndexedDbCombatLogArchiveRepository(database);
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
          conflict.family === 'combat_log_archive' &&
          conflict.resolutionState === 'unresolved'
      ).length;

      let documentsMatch = false;
      let tombstonesMatch = false;
      let recordCount = 0;
      if (cloudAuthority === 'postgres' && documents.length > 0) {
        const preview =
          await combatLogArchiveApi<CombatLogArchiveEnrollmentPreview>({
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
      // Carried forward from `campaignSettingsAdapter.ts`/`encounterAdapter.ts`:
      // the marker readers return `null` when the family's client flag is
      // off, so this must short-circuit here and never call the normalizer
      // for a flag-off family. Routed through `this.isVisible()` so the
      // conformance suite can pin this guard generically.
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
        pointer = await readCombatLogArchiveAuthority(
          database,
          namespace,
          context.campaignId
        );
      } finally {
        database.close();
      }
      // Marker dialect (brief): unlike every other family's marker,
      // `readCombatLogArchiveAuthorityMarker` carries BOTH `accountId` and
      // `campaignId` — the only dialect that lets `normalizeFamilyAuthority`
      // detect an `account-mismatch` from this family's marker alone,
      // without needing the IndexedDB pointer to disagree first. Its
      // `authority` union is also `localStorage | indexedDB | postgres`,
      // never `legacy_restored` — see `rollback` below.
      const rawMarker = readCombatLogArchiveAuthorityMarker(
        localStorage,
        context.campaignCode
      );
      const marker: AuthorityMarkerView | null = rawMarker
        ? {
            authority: rawMarker.authority,
            epoch: rawMarker.epoch,
            campaignId: rawMarker.campaignId,
            accountId: rawMarker.accountId,
          }
        : null;
      return normalizeFamilyAuthority({
        marker,
        pointer: toAuthorityPointerView(pointer),
        accountId: context.accountId,
        campaignId: context.campaignId,
      });
    },

    async rollback(context) {
      const namespace = `user:${context.accountId}` as const;
      const database = await openRollkeeperDatabase();
      let localAuthority;
      try {
        localAuthority = await readCombatLogArchiveAuthority(
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

      // No separate `projection-status` call: like `magic_item`, `npc` and
      // `encounter_definition`, `combat_log_archive` has no player
      // projection at all (`COMBAT_LOG_ARCHIVE_FAMILY_INVENTORY.projection:
      // 'not-applicable'`), and `CombatLogArchiveSyncControls.hooks.ts`'s own
      // `rollback()` (`:1644-1730`) checks only the current Postgres
      // generation, never a projection journal.
      const current =
        await combatLogArchiveApi<CombatLogArchiveEnrollmentPreview>({
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
          'Rollback requires the exact current Postgres generation of these combat logs.'
        );

      const result = await combatLogArchiveApi<{
        epoch: number;
        currentGeneration: CombatLogArchiveEnrollmentPreview;
      }>({
        action: 'rollback',
        mutationId: crypto.randomUUID(),
        campaignId: context.campaignId,
        expectedEpoch: localAuthority.epoch,
        // Divergence from `campaignSettingsAdapter.ts`/`calendarAdapter.ts`,
        // mirrored from `encounterAdapter.ts`/`npcAdapter.ts`/
        // `magicItemAdapter.ts`: this field is named `previewFingerprint` on
        // the wire (`CombatLogArchiveSyncControls.hooks.ts:1679`), not
        // `manifestFingerprint` — the single-record cards use the latter
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
        // No `projectionJournalReconciled` field:
        // `rollbackCombatLogArchiveLocalAuthority`'s options type has none
        // (unlike its campaign_settings/calendar siblings), matching the
        // family's not-applicable projection.
        await rollbackCombatLogArchiveLocalAuthority(rollbackDatabase, {
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
      // `CombatLogArchiveSyncControls.hooks.ts:1706-1715` writes the marker
      // BEFORE restoring the legacy store — ORDER IS LOAD-BEARING, same
      // reasoning as `campaignSettingsAdapter.ts`'s equivalent comment.
      // Divergence (brief): this family's marker has no `legacy_restored`
      // value — rollback restores the legacy key, which is `localStorage`
      // authority, the same signal `readAuthority`'s dialect comment
      // documents. This is still a DISTINGUISHABLE rollback write:
      // `writeCombatLogArchiveAuthorityMarker` writes `indexedDB` only from
      // `commitLocalCutover` above and `postgres` only from `activateCloud`
      // above, so `authority: 'localStorage'` is written from nowhere else
      // in this adapter.
      writeCombatLogArchiveAuthorityMarker(localStorage, {
        version: 1,
        campaignCode: context.campaignCode,
        authority: 'localStorage',
        epoch: result.epoch,
        accountId: context.accountId,
        campaignId: context.campaignId,
      });
      // Divergence from `calendarAdapter.ts`: like `campaignSettingsAdapter.ts`,
      // `magicItemAdapter.ts`, `npcAdapter.ts` and `encounterAdapter.ts`, the
      // combat log archive card's restore is UNCONDITIONAL
      // (`CombatLogArchiveSyncControls.hooks.ts:1716-1719`:
      // `applyCombatLogArchiveDocuments(campaignCode, result.currentGeneration.documents ?? [])`)
      // — always called, defaulting to an empty list, never gated behind an
      // `if (payload)` check the way `CalendarSyncControls.tsx` gates its
      // single document. Mirrored here: no conditional guard.
      //
      // Ruling 6: `encounters` is a RECORD keyed by `archiveId` (unlike
      // `encounter_definition`'s flat, cross-campaign ARRAY), so the restore
      // rebuilds this campaign's keys rather than sorting a list — mirroring
      // `applyCombatLogArchiveDocuments`/`hideCombatLogArchives` in
      // `CombatLogArchiveSyncControls.hooks.ts:269-316` expression for
      // expression, or a rollback for one campaign would clobber every other
      // campaign's archives held in the same store.
      //
      // `combatLogTombstones` is the family's SECOND persisted collection
      // `applyCombatLogArchiveDocuments` also rewrites (brief item 8): the
      // restore strips only THIS campaign's tombstones and never rehydrates
      // any from `result.currentGeneration.documents` — the cloud preview
      // carries a `tombstoned` flag per document, not a separate tombstone
      // record with a `beforeImage`, so there is nothing to rebuild a
      // tombstone FROM. This is the one place this adapter's rollback
      // diverges from a "restore this campaign's slice" story: it only ever
      // REMOVES this campaign's tombstones, exactly mirroring the card.
      const { useCombatLogStore } = await import('@/store/combatLogStore');
      const documents = result.currentGeneration.documents ?? [];
      useCombatLogStore.setState(state => ({
        encounters: {
          ...Object.fromEntries(
            Object.entries(state.encounters).filter(
              ([, archive]) => archive.campaignCode !== context.campaignCode
            )
          ),
          ...Object.fromEntries(
            documents
              .filter(document => document.payload && !document.tombstoned)
              .map(document => [
                document.legacyId,
                combatLogArchiveFromPayload(
                  context.campaignCode,
                  document.legacyId,
                  document.payload!
                ),
              ])
          ),
        },
        combatLogTombstones: Object.fromEntries(
          Object.entries(state.combatLogTombstones).filter(
            ([, tombstone]) =>
              tombstone?.beforeImage?.campaignCode !== context.campaignCode
          )
        ),
      }));
      return { epoch: result.epoch };
    },
  } satisfies DurableFamilyAdapter<CombatLogArchiveManifest>;
