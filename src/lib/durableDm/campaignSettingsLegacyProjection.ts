import { isCampaignSettingsClientVisible } from './slice11aFlags';

export type ProjectionAuthorityMarker = {
  version: 1;
  authority: 'indexedDB' | 'postgres' | 'legacy_restored';
  epoch: number;
  campaignId: string;
  namespace?: `user:${string}`;
};

export function campaignSettingsProjectionAuthorityKey(campaignCode: string) {
  return `rollkeeper:campaign-settings-projection-authority:${campaignCode}`;
}

/**
 * Parses and validates a raw `localStorage` value into a
 * `ProjectionAuthorityMarker`, or `null` if it is missing, malformed, or
 * fails shape validation (wrong `version`, unrecognized `authority`,
 * non-numeric `epoch`, non-string `campaignId`).
 *
 * Deliberately UNFLAGGED -- unlike `readCampaignSettingsProjectionAuthority`
 * below, this does NOT gate on `isCampaignSettingsClientVisible()`. It is
 * the shared parsing/validation core for both that flag-gated reader and
 * any flag-INDEPENDENT caller (e.g. `/dm`'s dashboard hardening, spec R2b),
 * so both stay in sync on what counts as a valid marker instead of
 * maintaining two divergent hand-rolled parsers (fix round 1, Minor 3).
 */
export function parseProjectionAuthorityMarker(
  raw: string | null
): ProjectionAuthorityMarker | null {
  if (!raw) return null;
  try {
    const marker = JSON.parse(raw) as Partial<ProjectionAuthorityMarker>;
    if (
      marker.version !== 1 ||
      !['indexedDB', 'postgres', 'legacy_restored'].includes(
        marker.authority ?? ''
      ) ||
      typeof marker.epoch !== 'number' ||
      typeof marker.campaignId !== 'string'
    )
      return null;
    return marker as ProjectionAuthorityMarker;
  } catch {
    return null;
  }
}

export function readCampaignSettingsProjectionAuthority(
  storage: Pick<Storage, 'getItem'>,
  campaignCode: string
): ProjectionAuthorityMarker | null {
  if (!isCampaignSettingsClientVisible()) return null;
  const raw = storage.getItem(
    campaignSettingsProjectionAuthorityKey(campaignCode)
  );
  return parseProjectionAuthorityMarker(raw);
}

export function writeCampaignSettingsProjectionAuthority(
  storage: Pick<Storage, 'setItem'>,
  campaignCode: string,
  marker: ProjectionAuthorityMarker
) {
  storage.setItem(
    campaignSettingsProjectionAuthorityKey(campaignCode),
    JSON.stringify(marker)
  );
}

export function legacyCampaignSettingsProjectionAllowed(
  storage: Pick<Storage, 'getItem'>,
  campaignCode: string
) {
  if (!isCampaignSettingsClientVisible()) return true;
  return (
    readCampaignSettingsProjectionAuthority(storage, campaignCode)
      ?.authority !== 'postgres'
  );
}

export function campaignSettingsUsesIndexedDbAuthority(
  storage: Pick<Storage, 'getItem'>,
  campaignCode: string
) {
  if (!isCampaignSettingsClientVisible()) return false;
  const marker = readCampaignSettingsProjectionAuthority(storage, campaignCode);
  return marker?.authority === 'indexedDB' || marker?.authority === 'postgres';
}
