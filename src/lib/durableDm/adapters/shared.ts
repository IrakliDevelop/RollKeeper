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
/**
 * Task 16 fix round 1, Important 2 (coordinator review): spec R8's second
 * verification condition -- "cloud authority is `postgres` at the EXPECTED
 * epoch" -- was never checked by any of the six `verifyCloud`
 * implementations before this fix: they compared the document multiset but
 * never `preview.epoch` against the local pointer's own epoch, so a device
 * whose cloud generation had moved to a NEWER epoch (another browser rolled
 * back and re-activated the same family) still reported `verified: true`
 * whenever the document multiset happened to still match.
 *
 * Deliberately NOT a call to `verifyPostgresGenerationParity` below: that
 * function ALSO re-derives full document parity from a differently-shaped
 * `ActivationManifestRecord[]` (the R5b repair-time working-copy shape),
 * which every `verifyCloud` already computes independently, in more detail
 * (`documentsMatch`/`tombstonesMatch` as separate, UI-facing booleans) and
 * with extensive existing conformance coverage this fix must not disturb.
 * Reusing it here would mean maintaining the SAME parity rule expressed
 * twice, over two different input shapes, for the one family of adapters --
 * exactly the drift risk `verifyPostgresGenerationParity`'s own doc comment
 * warns against. This is the narrower, independent check R8's second
 * condition actually needs.
 */
export function cloudPreviewAtExpectedEpoch(
  preview: { authority: 'legacy' | 'postgres'; epoch?: number },
  expectedEpoch: number
): boolean {
  return preview.authority === 'postgres' && preview.epoch === expectedEpoch;
}

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
