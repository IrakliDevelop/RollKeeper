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

export function readCampaignSettingsProjectionAuthority(
  storage: Pick<Storage, 'getItem'>,
  campaignCode: string
): ProjectionAuthorityMarker | null {
  if (!isCampaignSettingsClientVisible()) return null;
  const raw = storage.getItem(
    campaignSettingsProjectionAuthorityKey(campaignCode)
  );
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
