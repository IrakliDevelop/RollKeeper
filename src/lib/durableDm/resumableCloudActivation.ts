import { migrationMutationId } from './migrationMutationIds';

export interface CloudEnrollmentPreview {
  authority: 'legacy' | 'postgres';
  epoch?: number;
  previewFingerprint?: string;
  recordCount?: number;
  documents?: {
    legacyId: string;
    serverVersion: number;
    schemaVersion: number;
    payloadFingerprint: string;
    tombstoned: boolean;
  }[];
}

export interface ActivationManifestRecord {
  legacyId: string;
  schemaVersion: number;
  payloadFingerprint: string;
  tombstoned: boolean;
}

/**
 * Every field the server folds into its `request_hash` travels through these
 * signatures. A deterministic mutation id only replays a receipt when the
 * request hashes to the same value, so a retry that quietly changed one of
 * these raises `22023` instead — and the protocol must be able to see them to
 * keep them stable.
 *
 * Verified field-for-field against the server migrations (not against the
 * task brief, and not against any prose description of them):
 *
 *   - `supabase/migrations/20260821000000_create_campaign_documents.sql`
 *     (the original `campaign_settings` RPCs) — `begin_staging` hashes
 *     `{campaignId, deviceId, epoch, manifest, recovery, count, bytes}`
 *     (line 281), `stage_items` hashes `{runId, items}` (line 304), and
 *     `confirm_cutover` hashes `{runId, manifest, epoch}` (line 355). No
 *     `family` key appears in any of the three.
 *   - `supabase/migrations/20260822000000_register_calendar_documents.sql`,
 *     `20260823000000_register_magic_item_documents.sql`,
 *     `20260824000000_register_npc_documents.sql`,
 *     `20260825000000_register_encounter_documents.sql`, and
 *     `20260826000000_register_combat_log_archive_documents.sql` — each of
 *     these five later families gets its own dedicated RPC triplet (e.g.
 *     `begin_combat_log_archive_staging`), and each one's `request_hash`
 *     jsonb has an *additional* leading `'family','<literal>'` entry (for
 *     example, `20260826000000` lines 243, 266 and 310 for
 *     `combat_log_archive`). This is a compile-time SQL string literal
 *     hardcoded inside that family's own RPC function body — there is no
 *     `p_family` parameter anywhere in these signatures — so for any given
 *     family it is the same value on every call that family's adapter will
 *     ever make. It therefore cannot itself cause a hash mismatch between a
 *     call and its retry, and it changes nothing about what this module must
 *     keep stable.
 *
 * `family` is consequently never a field this module (or its gateway
 * signatures below) needs to send explicitly: for the original family it is
 * genuinely absent from the hash, and for every family added since, it is
 * baked into which RPC the adapter is already calling rather than being part
 * of the request body. What both eras agree on, and what the two load-bearing
 * consequences below rest on, is that the fields the CLIENT supplies —
 * `deviceId`, `runId`, the manifest/recovery hashes, the counts and the item
 * bodies — are exactly what a retry must reproduce byte-for-byte:
 *
 *   begin_staging   {campaignId, deviceId, epoch, manifest, recovery, count, bytes}
 *   stage_items     {runId, items}
 *   confirm_cutover {runId, manifest, epoch}
 *
 * `campaignId` is hashed into `begin_staging` but, like `family`, is never a
 * per-call argument on `beginStaging` below: this module relies on the
 * `ResumableActivationGateway` being bound to one campaign at construction,
 * the same way it relies on the RPC being bound to one family, so it is
 * likewise constant across every attempt a given gateway instance makes. A
 * caller that reconstructs the gateway against a different campaign between
 * attempts — not something any adapter does today — would change this
 * constant and turn a legitimate retry into `22023`, exactly as a regenerated
 * `deviceId` would.
 *
 * Two consequences follow: `runId` must come from the replayed `begin-staging`
 * result, never a fresh one, and `deviceId` must come from the persisted
 * device key, never a new UUID.
 */
export interface ResumableActivationGateway {
  previewEnrollment(): Promise<CloudEnrollmentPreview>;
  beginStaging(input: {
    mutationId: string;
    expectedEpoch: number;
    deviceId: string;
    manifestFingerprint: string;
    recoveryManifestHash: string;
    recordCount: number;
    totalBytes: number;
  }): Promise<{ runId: string }>;
  stageItems(input: {
    mutationId: string;
    runId: string;
    items: readonly unknown[];
  }): Promise<unknown>;
  confirmCutover(input: {
    mutationId: string;
    runId: string;
    manifestFingerprint: string;
    expectedEpoch: number;
  }): Promise<{ epoch: number }>;
}

export type ResumableActivationResult =
  | {
      status: 'activated' | 'reconciled';
      epoch: number;
      acceptedVersions: {
        legacyId: string;
        serverVersion: number;
        schemaVersion: number;
        payloadFingerprint: string;
      }[];
    }
  | {
      status: 'conflict';
      reason:
        | 'cloud-generation-diverged'
        | 'cloud-epoch-unknown'
        | 'cloud-epoch-unexpected'
        | 'cloud-preview-unusable';
    };

/**
 * True only when the cloud generation is exactly the generation this run
 * would have uploaded: same legacy ids, same fingerprints, same tombstone
 * flags, same count. Anything else means the account holds work this device
 * did not produce, and reconciling the local pointer to it would silently
 * adopt it.
 */
function matchesManifest(
  preview: CloudEnrollmentPreview,
  records: readonly ActivationManifestRecord[]
): boolean {
  const documents = preview.documents ?? [];
  if (preview.recordCount !== records.length) return false;
  if (documents.length !== records.length) return false;
  const cloud = new Map(
    documents.map(document => [document.legacyId, document])
  );
  return records.every(record => {
    const document = cloud.get(record.legacyId);
    return (
      document !== undefined &&
      document.payloadFingerprint === record.payloadFingerprint &&
      // The payload fingerprint does not cover the schema version: the same
      // bytes under a different schema version are a different document, and
      // adopting one as "already matching" would pin the device to a
      // generation it cannot correctly hydrate.
      document.schemaVersion === record.schemaVersion &&
      document.tombstoned === record.tombstoned
    );
  });
}

/**
 * Stages and activates a family in the cloud in a way that survives a lost
 * response.
 *
 * The mutation ids are derived from the run rather than generated per
 * attempt, so a repeat call replays the server's mutation receipt instead of
 * opening a second staging run — and the run id must come from that replayed
 * receipt, because the server hashes it into the request hash of both later
 * calls.
 *
 * `preview-enrollment` runs first and is read-only. It is the only way to
 * tell "confirm never committed" from "confirm committed and the response was
 * lost": in the first case the whole chain is safe to repeat, and in the
 * second case beginning another staging run is forbidden.
 */
export async function runResumableCloudActivation(input: {
  gateway: ResumableActivationGateway;
  /**
   * Re-reads the IndexedDB working copy and throws if it no longer matches
   * the manifest. Injected, because only the adapter knows its own
   * repository.
   */
  assertWorkingCopyUnchanged: () => Promise<void>;
  family: string;
  recoveryRunId: string;
  campaignId: string;
  manifestFingerprint: string;
  records: readonly ActivationManifestRecord[];
  expectedEpoch: number;
  /**
   * The rest of the hashed request bodies. `deviceId` MUST come from the
   * persisted `rollkeeper:<family>-device:*` key, never a fresh UUID: it is
   * hashed into begin_staging, so a regenerated id turns a legitimate retry
   * into `22023 mutation ID was already used with different input` and
   * strands the run.
   */
  request: {
    deviceId: string;
    recoveryManifestHash: string;
    recordCount: number;
    totalBytes: number;
    items: readonly unknown[];
  };
}): Promise<ResumableActivationResult> {
  const { gateway, records, expectedEpoch, request } = input;
  const idFor = (
    operation: 'begin-staging' | 'stage-items' | 'confirm-cutover'
  ) =>
    migrationMutationId({
      recoveryRunId: input.recoveryRunId,
      campaignId: input.campaignId,
      family: input.family,
      manifestFingerprint: input.manifestFingerprint,
      expectedEpoch,
      operation,
    });

  const preview = await gateway.previewEnrollment();

  if (preview.authority === 'postgres') {
    // Checked before reconciling, not only before staging: the interruption
    // that stranded this run may have been followed by local edits, and
    // adopting the cloud generation then would discard them silently.
    await input.assertWorkingCopyUnchanged();
    if (!matchesManifest(preview, records))
      return { status: 'conflict', reason: 'cloud-generation-diverged' };
    if (typeof preview.epoch !== 'number')
      return { status: 'conflict', reason: 'cloud-epoch-unknown' };
    // The epoch this run was activating INTO is `expectedEpoch + 1`. A
    // preview at any other epoch is somebody else's cutover, not this run's
    // lost response, and reconciling to it would adopt another device's
    // generation.
    if (preview.epoch !== expectedEpoch + 1)
      return { status: 'conflict', reason: 'cloud-epoch-unexpected' };
    // `previewFingerprint` is deliberately NOT compared against
    // `manifestFingerprint`: they are different hashes over different
    // inputs. `previewFingerprint` is `private.campaign_document_hash` over
    // the cloud document's fields, while `manifestFingerprint` is
    // `build*Manifest`'s hash over the legacy envelope. Recomputing the
    // server's hash on the client would duplicate a server semantic this
    // slice is forbidden to add, so parity is established by the
    // per-document comparison above plus the epoch check — both exact.
    //
    // Its presence is required and nothing more. It is deliberately NOT
    // returned or cached: rollback fetches its own fresh `preview-enrollment`
    // and passes that response's fingerprint, exactly as the shipped cards
    // do, and an activation-time value would be stale by then.
    if (
      typeof preview.previewFingerprint !== 'string' ||
      !preview.previewFingerprint
    )
      return { status: 'conflict', reason: 'cloud-preview-unusable' };
    return {
      status: 'reconciled',
      epoch: preview.epoch,
      acceptedVersions: (preview.documents ?? []).map(document => ({
        legacyId: document.legacyId,
        serverVersion: document.serverVersion,
        schemaVersion: document.schemaVersion,
        payloadFingerprint: document.payloadFingerprint,
      })),
    };
  }

  await input.assertWorkingCopyUnchanged();
  const begun = await gateway.beginStaging({
    mutationId: await idFor('begin-staging'),
    expectedEpoch,
    deviceId: request.deviceId,
    manifestFingerprint: input.manifestFingerprint,
    recoveryManifestHash: request.recoveryManifestHash,
    recordCount: request.recordCount,
    totalBytes: request.totalBytes,
  });
  await gateway.stageItems({
    mutationId: await idFor('stage-items'),
    runId: begun.runId,
    items: request.items,
  });
  // Re-checked after staging: the DM may have logged another change while
  // the upload was in flight, and only an unchanged working copy may be
  // confirmed.
  await input.assertWorkingCopyUnchanged();
  const confirmed = await gateway.confirmCutover({
    mutationId: await idFor('confirm-cutover'),
    runId: begun.runId,
    manifestFingerprint: input.manifestFingerprint,
    expectedEpoch,
  });

  return {
    status: 'activated',
    epoch: confirmed.epoch,
    acceptedVersions: records.map(record => ({
      legacyId: record.legacyId,
      serverVersion: 1,
      schemaVersion: record.schemaVersion,
      payloadFingerprint: record.payloadFingerprint,
    })),
  };
}
