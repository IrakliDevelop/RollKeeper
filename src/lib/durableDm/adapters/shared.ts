import {
  requestResult,
  transactionComplete,
} from '@/lib/indexeddb/localDatabase';

import {
  matchesManifest,
  type ActivationManifestRecord,
  type CloudEnrollmentPreview,
} from '../resumableCloudActivation';

/**
 * Ruling R8.2: extracted rather than duplicated into every adapter that
 * exposes a preview-enrollment RPC shaped as a single flat document.
 * `campaign_settings` and `calendar` are single-record families whose
 * `preview-enrollment` RPC returns `legacyId`, `serverVersion`,
 * `schemaVersion`, `payloadFingerprint`, `tombstoned` and `payload` at the top
 * level — with no `recordCount` and no `documents` array — because there is
 * only ever one document. `runResumableCloudActivation`'s protocol is
 * multi-document, so this normalizes the flat shape into the
 * `CloudEnrollmentPreview` contract rather than teaching the protocol about a
 * per-family response shape.
 */
export function normalizeFlatEnrollmentPreview(raw: {
  authority: 'legacy' | 'postgres';
  epoch?: number;
  previewFingerprint?: string;
  legacyId?: string;
  serverVersion?: number;
  schemaVersion?: number;
  payloadFingerprint?: string;
  tombstoned?: boolean;
}): CloudEnrollmentPreview {
  if (raw.authority !== 'postgres') return { authority: 'legacy' };
  return {
    authority: 'postgres',
    epoch: raw.epoch,
    previewFingerprint: raw.previewFingerprint,
    recordCount: 1,
    documents: [
      {
        legacyId: raw.legacyId!,
        serverVersion: raw.serverVersion!,
        schemaVersion: raw.schemaVersion!,
        payloadFingerprint: raw.payloadFingerprint!,
        tombstoned: raw.tombstoned ?? false,
      },
    ],
  };
}

/**
 * Ruling R8.2: the six cards each keep one near-identical helper for their
 * own per-device identity, differing only in the `rollkeeper:<prefix>-device:`
 * key prefix (e.g. `campaign-settings`, `combat-log-archive`). The identity is
 * created on first use and persisted — never regenerated per attempt, because
 * it is hashed into `begin_staging` (spec R7 / ruling R2.2): a fresh value on
 * a retry turns a legitimate resumed activation into a `22023` mutation-id
 * reuse rejection.
 */
export function deviceIdFor(
  keyPrefix: string,
  accountId: string,
  campaignId: string
): string {
  const key = `rollkeeper:${keyPrefix}-device:${accountId}:${campaignId}`;
  let deviceId = localStorage.getItem(key);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(key, deviceId);
  }
  return deviceId;
}

/**
 * Task 13b's evidence for R5b row 2 ("verify the prepared generation").
 * Independently re-reads the SAME `migration-state:<namespace>:<familyKey>:
 * <campaignId>` `meta` record every `commit*LocalCutover` gates its own
 * write on (`src/lib/indexeddb/*Authority.ts`, `keys().state`), rather than
 * trusting that the IndexedDB pointer being at `indexedDB` is sufficient by
 * itself. A pointer record can only exist if a real cutover transaction
 * wrote it, but re-checking the state record here — after the fact, from a
 * fresh transaction — is what makes this a genuine second look rather than
 * repair simply believing what the pointer says about itself.
 *
 * `IDB_PRIMARY` is the state `commit*LocalCutover` checkpoints to
 * immediately after writing the pointer (see e.g.
 * `commitCampaignSettingsLocalCutover`), and it always carries the ORIGINAL
 * `CUTOVER_READY` generation's `runId` forward unchanged — so `runId ===
 * generation` ties this specific state record to the specific pointer
 * generation being repaired, not just to "cutover happened at some point".
 */
export async function verifyPreparedGeneration(
  database: IDBDatabase,
  familyKey: string,
  namespace: string,
  campaignId: string,
  generation: string
): Promise<boolean> {
  const transaction = database.transaction('meta', 'readonly');
  const state = (await requestResult(
    transaction
      .objectStore('meta')
      .get(`migration-state:${namespace}:${familyKey}:${campaignId}`)
  )) as { state?: string; runId?: string } | undefined;
  await transactionComplete(transaction);
  return state?.state === 'IDB_PRIMARY' && state?.runId === generation;
}

/**
 * Task 13b's evidence for R5b row 3: "Require `preview.epoch ===
 * pointer.epoch` AND exact document parity." `expectedEpoch` must be the
 * PONTER's epoch (the side being verified), never `expectedEpoch + 1` as
 * `runResumableCloudActivation` checks during activation — that check is
 * for a run activating INTO a new epoch; this one is confirming a pointer
 * that already claims to BE at `postgres` at a specific epoch.
 *
 * Document parity reuses `matchesManifest` rather than a second comparison:
 * the exact same legacyId/fingerprint/schemaVersion/tombstone/count rule
 * spec R5b names for this row is the rule `resumableCloudActivation.ts`
 * already enforces for the response-lost reconciliation case, and
 * reimplementing it here would risk the two definitions of "parity"
 * drifting apart silently.
 */
export function verifyPostgresGenerationParity(
  preview: CloudEnrollmentPreview,
  expectedEpoch: number,
  localDocuments: readonly ActivationManifestRecord[]
): boolean {
  // No separate `typeof preview.epoch === 'number'` guard: `===` never
  // coerces, so an absent `preview.epoch` (`undefined`) can only equal a
  // caller-supplied `expectedEpoch` that is ALSO `undefined` — which the
  // `number` parameter type rules out for every real caller — and cannot
  // equal a genuine epoch number. A redundant typeof check here would be
  // untestable dead weight (task-13b's own standing instruction against
  // guards that cannot fail).
  return (
    preview.authority === 'postgres' &&
    preview.epoch === expectedEpoch &&
    matchesManifest(preview, localDocuments)
  );
}
