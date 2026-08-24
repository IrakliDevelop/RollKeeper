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
import { deviceIdFor, normalizeFlatEnrollmentPreview } from './shared';

interface CampaignSettingsEnrollmentPreview {
  authority: 'legacy' | 'postgres';
  epoch?: number;
  previewFingerprint?: string;
  legacyId?: string;
  serverVersion?: number;
  schemaVersion?: number;
  payloadFingerprint?: string;
  tombstoned?: boolean;
}

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
      return {
        familyLabel: 'Campaign settings',
        campaignLabel: `${context.campaignCode}`,
        manifestFingerprint: manifest.fingerprint,
        requiredPhrase: `migrate campaign settings ${manifest.fingerprint.slice(0, 12)}`,
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
              !document ||
              // `document.operation === 'delete'` is a SHIPPED condition of
              // this card and must not be dropped. A delete leaves the row in
              // place with a tombstoning operation, so a single-record family
              // cannot detect it by absence the way the multi-record families
              // do — they compare the document SET against the manifest, and a
              // delete changes `actual.size`. Without this condition a
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
          // multi-record families take.
          acceptedVersion: result.acceptedVersions[0],
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
      // marker/pointer disagreement and renders as "needs repair".
      if (!isCampaignSettingsClientVisible())
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
      return { epoch: result.epoch };
    },
  } satisfies DurableFamilyAdapter<CampaignSettingsManifest>;
