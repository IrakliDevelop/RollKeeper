import { browserRecoveryRepository } from '@/lib/browserRecoveryRepository';
import {
  buildCalendarManifest,
  buildCalendarWorkingCopyManifest,
  fingerprintCalendarPayload,
  type CalendarManifest,
} from '@/lib/durableDm/calendarFamily';
import { calendarApi } from '@/lib/durableDm/calendarApi';
import { isCalendarClientVisible } from '@/lib/durableDm/slice11bFlags';
import {
  readCalendarProjectionAuthority,
  writeCalendarProjectionAuthority,
} from '@/lib/durableDm/calendarLegacyProjection';
import {
  commitCalendarLocalCutover,
  markCalendarCloudAuthority,
  readCalendarAuthority,
  rollbackCalendarLocalAuthority,
} from '@/lib/indexeddb/calendarAuthority';
import { runCalendarIndexedDbMigration } from '@/lib/indexeddb/calendarMigration';
import {
  IndexedDbCalendarRepository,
  type CalendarOutboxEntry,
} from '@/lib/indexeddb/calendarRepository';
import { selectCalendar } from '@/lib/indexeddb/calendarSelection';
import {
  openRollkeeperDatabase,
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';
import { IndexedDbDmWorkspaceRepository } from '@/lib/indexeddb/dmWorkspaceRepository';
// `useCalendarStore` is imported at CALL TIME inside `rollback` below, not at
// module scope, mirroring `campaignSettingsAdapter.ts`'s own rationale: this
// is a client Zustand store, and a module-scope import here would pull a
// persist-backed client store into the lib layer. No server importer exists
// today, but Task 13's adapter registry is exactly the kind of module a
// server component could import, so a static import would become a live SSR
// hazard the moment that happens.

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

interface CalendarEnrollmentPreview {
  authority: 'legacy' | 'postgres';
  epoch?: number;
  previewFingerprint?: string;
  legacyId?: string;
  serverVersion?: number;
  schemaVersion?: number;
  payloadFingerprint?: string;
  tombstoned?: boolean;
  /** Only the `rollback` action's `currentGeneration` populates this. */
  payload?: CalendarManifest['records'][number]['payload'] | null;
}

// Ruling R9.2: name the behavioural number instead of a bare `.slice(0, 12)`.
const FINGERPRINT_DISPLAY_LENGTH = 12;

function currentRawEnvelope() {
  return localStorage.getItem('rollkeeper-calendar-data') ?? '';
}

function toManifestHandle(
  manifest: CalendarManifest
): FamilyManifestHandle<CalendarManifest> {
  return {
    family: 'calendar',
    fingerprint: manifest.fingerprint,
    recordCount: manifest.recordCount,
    totalBytes: manifest.totalBytes,
    blockers: manifest.blockers,
    records: manifest.records.map(record => ({
      legacyId: record.legacyId,
      schemaVersion: record.schemaVersion,
      byteCount: record.byteCount,
      payloadFingerprint: record.payloadFingerprint,
      // `calendar`'s manifest record has no tombstone concept, same as
      // `campaign_settings` — it is a single-record family.
      tombstoned: false,
      references: record.references.map(reference => ({
        family: reference.family,
        legacyId: reference.legacyId,
      })),
    })),
    native: manifest,
  };
}

export const calendarAdapter: DurableFamilyAdapter<CalendarManifest> = {
  family: 'calendar',
  label: 'Calendar',

  isVisible() {
    return isCalendarClientVisible();
  },

  async previewManifest(context) {
    const sourceManifest = await buildCalendarManifest({
      campaignCode: context.campaignCode,
      rawEnvelope: currentRawEnvelope(),
    });
    let nextManifest = sourceManifest;
    const authority = await this.readAuthority(context);
    if (authority.state !== 'legacy' && sourceManifest.blockers.length === 0) {
      const database = await openRollkeeperDatabase();
      try {
        const document = await new IndexedDbCalendarRepository(
          database
        ).getDocument(`user:${context.accountId}`, context.campaignCode);
        if (!document || document.operation === 'delete' || !document.payload)
          throw new Error(
            'A verified IndexedDB working copy is required for preview.'
          );
        const fingerprint = await fingerprintCalendarPayload(document.payload);
        if (fingerprint !== document.contentFingerprint)
          throw new Error(
            'The IndexedDB working copy failed fingerprint verification.'
          );
        nextManifest = await buildCalendarWorkingCopyManifest({
          source: sourceManifest,
          payload: document.payload,
          schemaVersion: document.schemaVersion,
        });
      } finally {
        database.close();
      }
    }
    return toManifestHandle(nextManifest);
  },

  confirmation(context, manifest) {
    // Spec R12: a structured contract, never a copy of the card's prose.
    const familyLabel = 'Calendar';
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
        'A verified safety-copy download is required for this run before calendar can be selected.'
      );
    selectCalendar(localStorage, {
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
    const runId = `calendar-${crypto.randomUUID()}`;
    const result = await runCalendarIndexedDbMigration({
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
          ? 'Unresolved candidates block only calendar; legacy behavior remains active.'
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
    // Spec R3's `sourceManifestUnchanged` gate: the card re-derives the
    // manifest from the CURRENT legacy envelope immediately before cutover
    // and refuses if it drifted since `prepareIndexedDb` captured it
    // (`CalendarSyncControls.tsx:680-685`).
    const currentSourceManifest = await buildCalendarManifest({
      campaignCode: context.campaignCode,
      rawEnvelope: currentRawEnvelope(),
    });
    if (currentSourceManifest.fingerprint !== input.manifest.fingerprint)
      // Deliberately a DIFFERENT string from `activateCloud`'s
      // `assertWorkingCopyUnchanged` message below, matching
      // `campaignSettingsAdapter.ts`'s own distinction (fix round 2, item 6c
      // there): this names WHEN the drift was detected, before/at cutover.
      throw new Error(
        'Your campaign calendar changed since you prepared this device. Preview the migration again.'
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
      const record = input.manifest.native.records[0];
      const updatedAt = new Date().toISOString();
      const next = await commitCalendarLocalCutover(database, {
        namespace,
        campaignId: context.campaignId,
        generation: input.generation,
        confirmed: true,
        // See `campaignSettingsAdapter.ts`'s gate table for the owner of
        // each flag below; the same reasoning applies here field for field —
        // calendar shares the exact same cutover-gate shape.
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
        // Singular, and optional: calendar is a single-record family and its
        // option is `initialDocument?: CalendarDocument`, not the
        // `initialDocuments` array the multi-record families take.
        initialDocument: record
          ? {
              namespace,
              campaignId: context.campaignId,
              legacyId: record.legacyId,
              family: 'calendar',
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
      writeCalendarProjectionAuthority(localStorage, context.campaignCode, {
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
      // `IndexedDbCalendarRepository` has no `listDocuments`. It is a
      // single-record family, and its accessor is
      // `getDocument(namespace, legacyId)` — keyed by the campaign code.
      assertWorkingCopyUnchanged: async () => {
        const [record] = manifest.records;
        const database = await openRollkeeperDatabase();
        try {
          const document = await new IndexedDbCalendarRepository(
            database
          ).getDocument(`user:${context.accountId}`, record.legacyId);
          if (
            !document ||
            // The shipped delete guard (`CalendarSyncControls.tsx:777`):
            // a delete leaves the row in place with `operation: 'delete'`,
            // so a single-record family cannot detect it by absence the way
            // the multi-record families do. Without this condition a
            // calendar deleted between the preview and the upload is staged
            // as if it were still live.
            document.operation === 'delete' ||
            document.contentFingerprint !== record.payloadFingerprint ||
            document.schemaVersion !== record.schemaVersion
          )
            throw new Error(
              'Your campaign calendar changed since the last check. Preview the migration again.'
            );
        } finally {
          database.close();
        }
      },
      gateway: {
        // `preview_campaign_calendar_device_enrollment` returns a FLAT
        // single document — see `normalizeFlatEnrollmentPreview`'s doc
        // comment (ruling R8.2). No `projection-status`,
        // `projection-incidents` or `replay-projection` call belongs here:
        // this adapter never touches the player projection.
        previewEnrollment: async () => {
          const raw = await calendarApi<CalendarEnrollmentPreview>({
            action: 'preview-enrollment',
            campaignId: context.campaignId,
          });
          return normalizeFlatEnrollmentPreview(raw);
        },
        beginStaging: input =>
          calendarApi({
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
          calendarApi({
            action: 'stage-items',
            mutationId: input.mutationId,
            runId: input.runId,
            items: input.items,
          }),
        confirmCutover: input =>
          calendarApi({
            action: 'confirm-cutover',
            mutationId: input.mutationId,
            runId: input.runId,
            manifestFingerprint: input.manifestFingerprint,
            expectedEpoch: input.expectedEpoch,
          }),
      },
      family: 'calendar',
      recoveryRunId: context.recovery.runId,
      campaignId: context.campaignId,
      manifestFingerprint: manifest.fingerprint,
      records: manifest.records,
      expectedEpoch: Math.max(0, localEpoch - 1),
      request: {
        // Persisted, never freshly generated — hashed into begin_staging.
        deviceId: deviceIdFor(
          'calendar',
          context.accountId,
          context.campaignId
        ),
        recoveryManifestHash: context.recovery.manifestHash,
        recordCount: manifest.recordCount,
        totalBytes: manifest.totalBytes,
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
    // this device still believes it owns the family locally.
    const database = await openRollkeeperDatabase();
    try {
      const next = await markCalendarCloudAuthority(database, {
        namespace: `user:${context.accountId}`,
        campaignId: context.campaignId,
        expectedLocalEpoch: localEpoch,
        cloudEpoch: result.epoch,
        now: () => new Date().toISOString(),
        // Singular: calendar is a single-record family and its option is
        // `acceptedVersion?`, not the `acceptedVersions` array the
        // multi-record families take.
        acceptedVersion: {
          legacyId: result.acceptedVersions[0].legacyId,
          serverVersion: result.acceptedVersions[0].serverVersion,
          payloadFingerprint: result.acceptedVersions[0].payloadFingerprint,
        },
      });
      writeCalendarProjectionAuthority(localStorage, context.campaignCode, {
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
    let document;
    let outboxEntries: CalendarOutboxEntry[];
    let conflicts: {
      namespace?: string;
      campaignId?: string;
      family?: string;
      resolutionState?: string;
    }[];
    try {
      const repository = new IndexedDbCalendarRepository(database);
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
        conflict.family === 'calendar' &&
        conflict.resolutionState === 'unresolved'
    ).length;

    let documentsMatch = false;
    let tombstonesMatch = false;
    let recordCount = 0;
    if (cloudAuthority === 'postgres' && document) {
      const preview = await calendarApi<CalendarEnrollmentPreview>({
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
    // Carried forward from `campaignSettingsAdapter.ts`: the marker readers
    // return `null` when the family's client flag is off, so this must
    // short-circuit here and never call the normalizer for a flag-off
    // family — otherwise a disabled family with real IndexedDB history
    // reports a spurious marker/pointer disagreement and renders as "needs
    // repair". Routed through `this.isVisible()` so the conformance suite
    // can pin this guard generically.
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
      pointer = await readCalendarAuthority(
        database,
        namespace,
        context.campaignId
      );
    } finally {
      database.close();
    }
    const rawMarker = readCalendarProjectionAuthority(
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
      localAuthority = await readCalendarAuthority(
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
      calendarApi<CalendarEnrollmentPreview>({
        action: 'preview-enrollment',
        campaignId: context.campaignId,
      }),
      calendarApi<{ status: string }>({
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

    const result = await calendarApi<{
      epoch: number;
      currentGeneration: CalendarEnrollmentPreview;
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
      await rollbackCalendarLocalAuthority(rollbackDatabase, {
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
    // `CalendarSyncControls.tsx:1242-1248` writes the marker BEFORE
    // restoring the legacy store, exactly mirrored here. ORDER IS
    // LOAD-BEARING, same reasoning as `campaignSettingsAdapter.ts`'s
    // equivalent comment: `createCalendarAwareStorage` re-freezes the routed
    // calendar onto every persisted write while `calendarUsesIndexedDbAuthority`
    // is still true, which it is until the marker write below lands.
    writeCalendarProjectionAuthority(localStorage, context.campaignCode, {
      version: 1,
      authority: 'legacy_restored',
      epoch: result.epoch,
      campaignId: context.campaignId,
      namespace,
    });
    // Divergence from `campaignSettingsAdapter.ts`: the calendar card
    // (`CalendarSyncControls.tsx:1249-1250`) restores the legacy store ONLY
    // when the server's `currentGeneration` carries a payload —
    // `if (result.currentGeneration.payload) { applyCalendarPayload(...) }`
    // — unlike campaign_settings' card, which always calls `updateCampaign`
    // (defaulting every field from `payload ?? {}`). Mirrored here exactly:
    // no payload means nothing to restore, and the frozen legacy value
    // (now un-routed by the marker write above) stands as-is.
    if (result.currentGeneration.payload) {
      const { useCalendarStore } = await import('@/store/calendarStore');
      const payload = result.currentGeneration.payload;
      useCalendarStore.setState(state => ({
        calendars: [
          ...state.calendars.filter(
            value => value.campaignCode !== context.campaignCode
          ),
          { campaignCode: context.campaignCode, ...structuredClone(payload) },
        ],
      }));
    }
    return { epoch: result.epoch };
  },
} satisfies DurableFamilyAdapter<CalendarManifest>;
