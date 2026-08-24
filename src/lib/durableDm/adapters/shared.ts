import type { CloudEnrollmentPreview } from '../resumableCloudActivation';

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
