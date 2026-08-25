import { browserRecoveryRepository } from '@/lib/browserRecoveryRepository';
import {
  buildCampaignSettingsManifest,
  buildCampaignSettingsWorkingCopyManifest,
  fingerprintCampaignSettingsPayload,
  type CampaignSettingsManifest,
} from '@/lib/durableDm/campaignSettingsFamily';
import { campaignSettingsApi } from '@/lib/durableDm/campaignSettingsApi';
import { isCampaignSettingsClientVisible } from '@/lib/durableDm/slice11aFlags';
import {
  readCampaignSettingsProjectionAuthority,
  writeCampaignSettingsProjectionAuthority,
} from '@/lib/durableDm/campaignSettingsLegacyProjection';
import {
  commitCampaignSettingsLocalCutover,
  markCampaignSettingsCloudAuthority,
  readCampaignSettingsAuthority,
  rollbackCampaignSettingsLocalAuthority,
} from '@/lib/indexeddb/campaignSettingsAuthority';
import { runCampaignSettingsIndexedDbMigration } from '@/lib/indexeddb/campaignSettingsMigration';
import {
  IndexedDbCampaignSettingsRepository,
  type CampaignSettingsOutboxEntry,
} from '@/lib/indexeddb/campaignSettingsRepository';
import { selectCampaignSettings } from '@/lib/indexeddb/campaignSettingsSelection';
import {
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import { IndexedDbDmWorkspaceRepository } from '@/lib/indexeddb/dmWorkspaceRepository';
// `useDmStore` is imported at CALL TIME inside `rollback` below, not at
// module scope (fix round 2, item 6b): this is a client Zustand store, and a
// module-scope import here would pull a persist-backed client store into
// the lib layer. No server importer exists today, but Task 13's adapter
// registry is exactly the kind of module a server component could import,
// so a static import would become a live SSR hazard the moment that
// happens. NOTHING is imported statically from `@/store/dmStore` — not
// even a type (fix round 3, item 6a corrects the previous, inaccurate
// claim that a type was). `CampaignInfo` below is a SEPARATE, unrelated
// static import from `@/types/campaign`, used only to cast
// `dmDashboardUi`'s shape in `rollback`'s restore.
import type { CampaignInfo } from '@/types/campaign';
import type { Json } from '@/types/database.generated';

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
  normalizeFlatEnrollmentPreview,
  verifyPostgresGenerationParity,
  verifyPreparedGeneration,
} from './shared';

interface CampaignSettingsEnrollmentPreview {
  authority: 'legacy' | 'postgres';
  epoch?: number;
  previewFingerprint?: string;
  legacyId?: string;
  serverVersion?: number;
  schemaVersion?: number;
  payloadFingerprint?: string;
  tombstoned?: boolean;
  /** Only the `rollback` action's `currentGeneration` populates this. */
  payload?: Json | null;
}

// Ruling R9.2: name the behavioural number instead of a bare `.slice(0, 12)`.
const FINGERPRINT_DISPLAY_LENGTH = 12;

function currentRawEnvelope() {
  return localStorage.getItem('rollkeeper-dm-data') ?? '';
}

function toManifestHandle(
  manifest: CampaignSettingsManifest
): FamilyManifestHandle<CampaignSettingsManifest> {
  return {
    family: 'campaign_settings',
    fingerprint: manifest.fingerprint,
    recordCount: manifest.recordCount,
    totalBytes: manifest.totalBytes,
    blockers: manifest.blockers,
    records: manifest.records.map(record => ({
      legacyId: record.legacyId,
      schemaVersion: record.schemaVersion,
      byteCount: record.byteCount,
      payloadFingerprint: record.payloadFingerprint,
      // `campaign_settings`'s manifest record has no tombstone concept.
      tombstoned: false,
      references: record.references.map(reference => ({
        family: reference.family,
        legacyId: reference.legacyId,
      })),
    })),
    native: manifest,
  };
}

export const campaignSettingsAdapter: DurableFamilyAdapter<CampaignSettingsManifest> =
  {
    family: 'campaign_settings',
    label: 'Campaign settings',

    isVisible() {
      return isCampaignSettingsClientVisible();
    },

    async previewManifest(context) {
      const sourceManifest = await buildCampaignSettingsManifest({
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
          const document = await new IndexedDbCampaignSettingsRepository(
            database
          ).getDocument(`user:${context.accountId}`, context.campaignCode);
          if (!document || document.operation === 'delete' || !document.payload)
            throw new Error(
              'A verified IndexedDB working copy is required for preview.'
            );
          const fingerprint = await fingerprintCampaignSettingsPayload(
            document.payload as CampaignSettingsManifest['records'][number]['payload']
          );
          if (fingerprint !== document.contentFingerprint)
            throw new Error(
              'The IndexedDB working copy failed fingerprint verification.'
            );
          nextManifest = await buildCampaignSettingsWorkingCopyManifest({
            source: sourceManifest,
            payload:
              document.payload as CampaignSettingsManifest['records'][number]['payload'],
            schemaVersion: document.schemaVersion,
          });
        } finally {
          database.close();
        }
      }
      return toManifestHandle(nextManifest);
    },

    confirmation(context, manifest) {
      // Spec R12: a structured contract, never a copy of the card's prose. The
      // cards are untouched by this slice, so their literal strings can drift;
      // tests assert these four fields, never textual equality with a card.
      // `requiredPhrase` names both the family and the campaign the DM is
      // confirming, so a phrase built for a different family or a different
      // campaign cannot satisfy it (fix round 1, item 4).
      const familyLabel = 'Campaign settings';
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
          'A verified safety-copy download is required for this run before campaign settings can be selected.'
        );
      selectCampaignSettings(localStorage, {
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
      const runId = `settings-${crypto.randomUUID()}`;
      const result = await runCampaignSettingsIndexedDbMigration({
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
        recoveryGate: browserRecoveryRepository,
      });
      if (result.state !== 'CUTOVER_READY') {
        throw new Error(
          result.manifest.blockers.length > 0
            ? 'Unresolved candidates block only campaign_settings; legacy behavior remains active.'
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
      // Spec R3's `sourceManifestUnchanged` gate, attested below in `gates`.
      // The card re-derives the manifest from the CURRENT legacy envelope
      // immediately before cutover and refuses if it drifted since
      // `prepareIndexedDb` captured it
      // (`CampaignSettingsSyncControls.tsx:626-631`). Fix round 1 item 5:
      // this was previously attested (`sourceManifestUnchanged: true`) with
      // no equivalent check, so a DM whose campaign settings changed between
      // "prepare" and "confirm" would have had the STALE captured payload
      // cut over silently.
      const currentSourceManifest = await buildCampaignSettingsManifest({
        campaignCode: context.campaignCode,
        rawEnvelope: currentRawEnvelope(),
      });
      if (currentSourceManifest.fingerprint !== input.manifest.fingerprint)
        // Fix round 2, item 6c: deliberately a DIFFERENT string from
        // `activateCloud`'s `assertWorkingCopyUnchanged` message below —
        // both used to read identically, which meant the shared
        // `/changed since the last check/i` regex a caller might reach for
        // could not tell the two apart. Nothing is masked by it today (the
        // two live in different methods, and no test asserts across both),
        // but the phrasing here now names WHEN the drift was detected.
        throw new Error(
          'Your campaign settings changed since you prepared this browser. Preview the migration again.'
        );
      // Spec R10. The backport's defect 1 was this call missing on the local
      // cutover path: hydration then failed after reload, the store fell back
      // to the frozen legacy copy, and every later edit was accepted by the UI
      // and lost. Ordered before the cutover so a failure here leaves legacy
      // authority untouched, and asserted afterwards so a caller that passes a
      // no-op cannot cut over into an unhydratable state.
      await context.ensureWorkspaceRemembered();
      const database = await openRollkeeperDatabase();
      try {
        // There is no `readWorkspaceIdentity` helper. The identity record lives
        // in the `documents` store under [namespace, 'workspace_identity',
        // localId], which is exactly what this repository's `get` reads.
        // Matching `cloudId` is the part that matters: a record for a
        // different cloud campaign would satisfy a bare existence check and
        // still leave hydration unable to find this campaign.
        const identity = await new IndexedDbDmWorkspaceRepository(database).get(
          namespace,
          context.workspace.localId
        );
        if (!identity || identity.cloudId !== context.campaignId)
          throw new Error(
            'This browser has no owner workspace recorded for the campaign, so the migration cannot continue.'
          );
        const record = input.manifest.native.records[0];
        const updatedAt = new Date().toISOString();
        const next = await commitCampaignSettingsLocalCutover(database, {
          namespace,
          campaignId: context.campaignId,
          generation: input.generation,
          confirmed: true,
          // Fix round 2, item 7 / fix round 3, items 2-3: every gate below
          // is attested `true` with an explicit, VERIFIED owner — never a
          // bare attestation, and never a fictitious one. This table is the
          // one in the fix-round reports, kept here so a reader of the code
          // finds it without leaving the file:
          //
          // | Gate                        | Owner |
          // |------------------------------|-------|
          // | sourceManifestUnchanged      | Checked immediately above, in this method (fix round 1, item 5) |
          // | recoveryReceipt              | `prepareIndexedDb`'s `recoveryGate.hasDownloadReceipt` check inside `runCampaignSettingsIndexedDbMigration` — the generation cannot reach `CUTOVER_READY` without it |
          // | captureVerifiedAfterReopen   | `src/lib/indexeddb/migrationEngine.ts`'s cutover path reopens a fresh database connection and re-verifies the persisted capture (`verifyPersistedCapture`, called twice) before checkpointing to `CUTOVER_READY` |
          // | parity                       | `src/lib/indexeddb/migrationEngine.ts`'s `shadowGate` (`:284-288`) returns `{parity, journalEmpty}` itself and the `:469` checkpoint guard returns `SHADOWING`, not `CUTOVER_READY`, while `!gate.parity` — this method could not have received a `CUTOVER_READY` generation with it violated |
          // | noQuarantine                 | Fix round 4, item 2 corrects fix round 3's own one-frame-off claim that `shadowGate` covers this too: `shadowGate` does NOT compute `quarantineCount` — the CALLER does, via `countQuarantine` (`src/lib/indexeddb/migrationEngine.ts:453`), and the same `:469` checkpoint guard returns `SHADOWING`, not `CUTOVER_READY`, while `quarantineCount > 0` |
          // | noConflicts                  | NO independent owner exists (fix round 3, item 2 — corrects fix round 2's fictitious claim that `shadowGate` covers it: `shadowGate` returns only `{parity, journalEmpty}`, `src/lib/indexeddb/migrationEngine.ts:288`, with no conflict field at all). Folded honestly into `noQuarantine`'s reasoning: `campaign_settings` is a single-record family whose only "conflict" concept is the blocked-candidate path (`manifest.blockers.length > 0`), which is the SAME quarantine/blocker mechanism `noQuarantine` already covers — there is no SEPARATE conflict detector this gate could name |
          // | journalEmpty                 | Doubly enforced — `shadowGate` above, AND `commitCampaignSettingsLocalCutover` itself (the call below) independently re-reads the `journal` store for this `namespace`/`generation`/family and throws if it is not empty, so this is re-checked at commit time, not only attested |
          // | manifestConfirmed            | The ONE gate with no library-level enforcement today. It records that the DM has explicitly confirmed the exact manifest fingerprint about to be cut over. Spec R12 puts that confirmation in the WIZARD (the typed-phrase dialog `confirmation()` on this adapter supplies the copy for) — this adapter TRUSTS that its caller invokes `commitLocalCutover` only after the DM has confirmed. No adapter-level check exists because the adapter has no UI layer to have obtained that confirmation from; Task 14's wizard is the owner of this gate |
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
          // Singular, and optional: campaign_settings is a single-record family
          // and its option is `initialDocument?: CampaignSettingsDocument`, not
          // the `initialDocuments` array the multi-record families take. Built
          // from `input.manifest.native.records[0]`, exactly as the card does.
          initialDocument: record
            ? {
                namespace,
                campaignId: context.campaignId,
                legacyId: record.legacyId,
                family: 'campaign_settings',
                cutoverEpoch: 1,
                operation: 'create',
                payload: record.payload,
                schemaVersion: record.schemaVersion,
                localRevision: 1,
                baseServerVersion: 0,
                contentFingerprint: record.payloadFingerprint,
                updatedAt,
                deletedAt: null,
              }
            : undefined,
        });
        writeCampaignSettingsProjectionAuthority(
          localStorage,
          context.campaignCode,
          {
            version: 1,
            authority: 'indexedDB',
            epoch: next.epoch,
            campaignId: context.campaignId,
            namespace,
          }
        );
        return { epoch: next.epoch };
      } finally {
        database.close();
      }
    },

    async activateCloud(context, manifest) {
      // The local epoch is read fresh and reconciled, never carried in from an
      // earlier step: `expectedEpoch` is the epoch the SERVER is expected to
      // still hold, which the shipped cards compute as `authority.epoch - 1`
      // floored at zero. A stale local value here either rejects a legal
      // activation or, worse, confirms against the wrong epoch.
      const local = await this.readAuthority(context);
      if (local.state !== 'indexedDB')
        throw new Error(
          'This browser is not ready to back this data category up yet.'
        );
      const localEpoch = local.epoch;

      // Spec R7: the protocol lives in one place; the adapter binds the
      // family's own API route to it and supplies the working-copy check the
      // shipped card performs. Without that check an edit made while the
      // upload is in flight is silently excluded from the generation that
      // becomes authoritative.
      const result = await runResumableCloudActivation({
        // `IndexedDbCampaignSettingsRepository` has no `listDocuments`. It is a
        // single-record family, and its accessor is
        // `getDocument(namespace, legacyId)` — keyed by the campaign code,
        // which is this family's legacy id.
        assertWorkingCopyUnchanged: async () => {
          const [record] = manifest.records;
          const database = await openRollkeeperDatabase();
          try {
            const document = await new IndexedDbCampaignSettingsRepository(
              database
            ).getDocument(`user:${context.accountId}`, record.legacyId);
            if (
              // Fix round 1 (coordinator review of Task 10): the claim
              // this comment used to make here — "a single-record family
              // cannot detect [a delete] by absence the way the multi-record
              // families do ... a delete changes `actual.size`" — was FALSE
              // and produced an unpinned clause. `commit()`
              // (`campaignSettingsRepository.ts:154`) always UPSERTS the same
              // document key, including for `operation: 'delete'` — the row
              // survives with a tombstone fingerprint, so a soft delete never
              // makes `!document` true and `actual.size` never changes either
              // (this family has no `actual.size`/count check at all; it is
              // single-record). `!document` and `operation === 'delete'` are
              // two DISTINCT conditions: `!document` fires only when the row
              // is genuinely absent — e.g. `getDocument` returns `null` for a
              // HIDDEN namespace (`campaignSettingsRepository.ts:197-203`),
              // never for a delete — while `operation === 'delete'` is what
              // actually detects a soft-deleted record.
              !document ||
              // `document.operation === 'delete'` is a SHIPPED condition of
              // this card and must not be dropped. Without this condition a
              // campaign deleted between the preview and the upload is staged
              // as if it were still live.
              document.operation === 'delete' ||
              document.contentFingerprint !== record.payloadFingerprint ||
              document.schemaVersion !== record.schemaVersion
            )
              throw new Error(
                'Your campaign settings changed since the last check. Preview the migration again.'
              );
          } finally {
            database.close();
          }
        },
        gateway: {
          // `preview_campaign_settings_device_enrollment` returns a FLAT single
          // document — `legacyId`, `serverVersion`, `schemaVersion`,
          // `payloadFingerprint`, `tombstoned`, `payload` at the top level —
          // with no `recordCount` and no `documents` array. The generic
          // protocol is multi-document, so the shared normalizer (ruling R8.2)
          // reshapes it rather than teaching the protocol about a per-family
          // response shape.
          previewEnrollment: async () => {
            const raw =
              await campaignSettingsApi<CampaignSettingsEnrollmentPreview>({
                action: 'preview-enrollment',
                campaignId: context.campaignId,
              });
            return normalizeFlatEnrollmentPreview(raw);
          },
          beginStaging: input =>
            campaignSettingsApi({
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
            campaignSettingsApi({
              action: 'stage-items',
              mutationId: input.mutationId,
              runId: input.runId,
              items: input.items,
            }),
          confirmCutover: input =>
            campaignSettingsApi({
              action: 'confirm-cutover',
              mutationId: input.mutationId,
              runId: input.runId,
              manifestFingerprint: input.manifestFingerprint,
              expectedEpoch: input.expectedEpoch,
            }),
        },
        family: 'campaign_settings',
        recoveryRunId: context.recovery.runId,
        campaignId: context.campaignId,
        manifestFingerprint: manifest.fingerprint,
        records: manifest.records,
        expectedEpoch: Math.max(0, localEpoch - 1),
        request: {
          // Persisted, never freshly generated — it is hashed into
          // begin_staging (ruling R2.2).
          deviceId: deviceIdFor(
            'campaign-settings',
            context.accountId,
            context.campaignId
          ),
          recoveryManifestHash: context.recovery.manifestHash,
          recordCount: manifest.recordCount,
          totalBytes: manifest.totalBytes,
          // The exact staged item bodies the card sends, built from
          // `manifest.native.records`. They are hashed into stage_items, so
          // they must be byte-identical on a retry.
          items: manifest.native.records.map(record => ({
            legacyId: record.legacyId,
            schemaVersion: record.schemaVersion,
            payload: record.payload,
            payloadFingerprint: record.payloadFingerprint,
            tombstoned: false,
          })),
        },
      });

      if (result.status === 'conflict')
        return { status: 'conflict', reason: result.reason };

      // The local half. Without it the account is Postgres-authoritative while
      // this device still believes it owns the family locally: the accepted
      // server versions are never rebased onto the local documents, the
      // outbox rows for them are never drained, and the marker still says
      // indexedDB, so the next reload hydrates against the wrong authority.
      const database = await openRollkeeperDatabase();
      try {
        const next = await markCampaignSettingsCloudAuthority(database, {
          namespace: `user:${context.accountId}`,
          campaignId: context.campaignId,
          expectedLocalEpoch: localEpoch,
          cloudEpoch: result.epoch,
          now: () => new Date().toISOString(),
          // Singular: campaign_settings is a single-record family and its
          // option is `acceptedVersion?`, not the `acceptedVersions` array the
          // multi-record families take. Built as a minimal literal — three
          // fields, matching the card's own `activateCloud` exactly (fix
          // round 3, item 1) — rather than passing `result.acceptedVersions[0]`
          // through whole: that value is typed with an extra `schemaVersion`
          // field `markCampaignSettingsCloudAuthority`'s own option type does
          // not declare, which TypeScript's structural typing lets through
          // silently on a non-literal assignment (no excess-property check
          // fires), but the step-parity test caught the resulting byte-level
          // mismatch against the card's minimal object.
          acceptedVersion: {
            legacyId: result.acceptedVersions[0].legacyId,
            serverVersion: result.acceptedVersions[0].serverVersion,
            payloadFingerprint: result.acceptedVersions[0].payloadFingerprint,
          },
        });
        writeCampaignSettingsProjectionAuthority(
          localStorage,
          context.campaignCode,
          {
            version: 1,
            authority: 'postgres',
            epoch: next.epoch,
            campaignId: context.campaignId,
            namespace: `user:${context.accountId}`,
          }
        );
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
      let document;
      let outboxEntries: CampaignSettingsOutboxEntry[];
      let conflicts: {
        namespace?: string;
        campaignId?: string;
        family?: string;
        resolutionState?: string;
      }[];
      try {
        const repository = new IndexedDbCampaignSettingsRepository(database);
        [document, outboxEntries] = await Promise.all([
          repository.getDocument(namespace, context.campaignCode),
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
          conflict.family === 'campaign_settings' &&
          conflict.resolutionState === 'unresolved'
      ).length;

      let documentsMatch = false;
      let tombstonesMatch = false;
      let recordCount = 0;
      if (cloudAuthority === 'postgres' && document) {
        const preview =
          await campaignSettingsApi<CampaignSettingsEnrollmentPreview>({
            action: 'preview-enrollment',
            campaignId: context.campaignId,
          });
        recordCount = preview.authority === 'postgres' ? 1 : 0;
        documentsMatch =
          preview.authority === 'postgres' &&
          preview.legacyId === document.legacyId &&
          preview.payloadFingerprint === document.contentFingerprint &&
          preview.schemaVersion === document.schemaVersion;
        tombstonesMatch =
          (preview.tombstoned ?? false) === (document.operation === 'delete');
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
      // Carried forward from Task 5: the marker readers return `null` when the
      // family's client flag is off, so this must short-circuit here and never
      // call the normalizer for a flag-off family — otherwise a disabled
      // family with real IndexedDB history reports a spurious
      // marker/pointer disagreement and renders as "needs repair". Routed
      // through `this.isVisible()` (fix round 1, item 2) rather than the
      // module-level flag function directly, so the conformance suite can
      // pin this guard generically, per adapter, without knowing each
      // family's env var name.
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
        pointer = await readCampaignSettingsAuthority(
          database,
          namespace,
          context.campaignId
        );
      } finally {
        database.close();
      }
      const rawMarker = readCampaignSettingsProjectionAuthority(
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
        rawPointer = await readCampaignSettingsAuthority(
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
                'campaign_settings',
                namespace,
                context.campaignId,
                rawPointer.generation
              );
              if (!preparedOk) return false;
              const document = await new IndexedDbCampaignSettingsRepository(
                evidenceDatabase
              ).getDocument(namespace, context.campaignCode);
              return (
                !!document &&
                document.operation !== 'delete' &&
                !!document.payload
              );
            } finally {
              evidenceDatabase.close();
            }
          },
          async verifyPostgresParity() {
            const preview =
              await campaignSettingsApi<CampaignSettingsEnrollmentPreview>({
                action: 'preview-enrollment',
                campaignId: context.campaignId,
              });
            const normalizedPreview = normalizeFlatEnrollmentPreview(preview);
            const evidenceDatabase = await openRollkeeperDatabase();
            try {
              const document = await new IndexedDbCampaignSettingsRepository(
                evidenceDatabase
              ).getDocument(namespace, context.campaignCode);
              const localDocuments =
                document && document.operation !== 'delete'
                  ? [
                      {
                        legacyId: document.legacyId,
                        payloadFingerprint: document.contentFingerprint,
                        schemaVersion: document.schemaVersion,
                        tombstoned: false,
                      },
                    ]
                  : [];
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
          `This browser's campaign settings migration record disagrees with the server and could not be safely repaired. ${decision.reason}`
        );

      writeCampaignSettingsProjectionAuthority(
        localStorage,
        context.campaignCode,
        {
          version: 1,
          authority: decision.authority,
          epoch: decision.epoch,
          campaignId: context.campaignId,
          namespace,
        }
      );

      return this.readAuthority(context);
    },

    async rollback(context) {
      const namespace = `user:${context.accountId}` as const;
      const database = await openRollkeeperDatabase();
      let localAuthority;
      try {
        localAuthority = await readCampaignSettingsAuthority(
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

      const [current, projection] = await Promise.all([
        campaignSettingsApi<CampaignSettingsEnrollmentPreview>({
          action: 'preview-enrollment',
          campaignId: context.campaignId,
        }),
        campaignSettingsApi<{ status: string }>({
          action: 'projection-status',
          campaignId: context.campaignId,
        }),
      ]);
      if (
        current.authority !== 'postgres' ||
        !current.previewFingerprint ||
        !current.payloadFingerprint ||
        current.serverVersion === undefined ||
        projection.status !== 'current'
      )
        throw new Error(
          'Rollback requires the exact current Postgres generation and a reconciled projection journal.'
        );

      const result = await campaignSettingsApi<{
        epoch: number;
        currentGeneration: CampaignSettingsEnrollmentPreview;
      }>({
        action: 'rollback',
        mutationId: crypto.randomUUID(),
        campaignId: context.campaignId,
        expectedEpoch: localAuthority.epoch,
        manifestFingerprint: current.previewFingerprint,
        currentGeneration: {
          legacyId: current.legacyId,
          fingerprint: current.payloadFingerprint,
          serverVersion: current.serverVersion,
        },
        projectionJournalReconciled: true,
      });

      const rollbackDatabase = await openRollkeeperDatabase();
      try {
        await rollbackCampaignSettingsLocalAuthority(rollbackDatabase, {
          namespace,
          campaignId: context.campaignId,
          expectedEpoch: localAuthority.epoch,
          generation: localAuthority.generation,
          confirmed: true,
          currentGenerationVerified: true,
          projectionJournalReconciled: true,
          now: () => new Date().toISOString(),
        });
      } finally {
        rollbackDatabase.close();
      }
      writeCampaignSettingsProjectionAuthority(
        localStorage,
        context.campaignCode,
        {
          version: 1,
          authority: 'legacy_restored',
          epoch: result.epoch,
          campaignId: context.campaignId,
          namespace,
        }
      );
      // Fix round 1, CRITICAL item 1. `CampaignSettingsSyncControls.tsx`
      // (`:1230-1254`) writes the server's `currentGeneration.payload` back
      // into the legacy store immediately after the `legacy_restored` marker
      // write — marker first, then payload, exactly mirrored here. ORDER IS
      // LOAD-BEARING (fix round 2, item 1a): `createCampaignSettingsAwareDmStorage`
      // re-freezes the routed fields onto every write while
      // `campaignSettingsUsesIndexedDbAuthority` is still true, which it is
      // until the marker write above lands. A payload-first write would be
      // silently discarded from the persisted envelope by that same aware
      // storage. Without this restore at all, routing reverts to the FROZEN
      // legacy envelope after a wizard rollback and every campaign-settings
      // edit made during the migrated period becomes invisible to the DM,
      // even though the IndexedDB documents themselves survive untouched.
      // `useDmStore.getState()` is the store module's own action, not a
      // React controller — R1 forbids wrapping the controllers, not calling
      // the store directly. Imported here, at call time, not at module
      // scope (fix round 2, item 6b): see the import comment at the top of
      // this file.
      const { useDmStore } = await import('@/store/dmStore');
      const payload = (result.currentGeneration.payload ?? {}) as Record<
        string,
        unknown
      >;
      useDmStore.getState().updateCampaign(context.campaignCode, {
        bannerUrl:
          typeof payload.bannerUrl === 'string' ? payload.bannerUrl : undefined,
        playerColors:
          payload.playerColors && typeof payload.playerColors === 'object'
            ? (payload.playerColors as Record<string, string>)
            : undefined,
        dmDashboardUi:
          payload.dmDashboardUi && typeof payload.dmDashboardUi === 'object'
            ? (payload.dmDashboardUi as CampaignInfo['dmDashboardUi'])
            : undefined,
        stackableInspiration: payload.stackableInspiration === true,
        customCounterLabel:
          typeof payload.customCounterLabel === 'string'
            ? payload.customCounterLabel
            : undefined,
        playerCounters:
          payload.playerCounters && typeof payload.playerCounters === 'object'
            ? (payload.playerCounters as Record<string, number>)
            : undefined,
      });
      return { epoch: result.epoch };
    },
  } satisfies DurableFamilyAdapter<CampaignSettingsManifest>;
