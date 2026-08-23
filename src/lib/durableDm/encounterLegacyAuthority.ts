import { isEncounterClientVisible } from './slice11eFlags';

export interface EncounterAuthorityMarker {
  version: 1;
  authority: 'indexedDB' | 'postgres' | 'legacy_restored';
  epoch: number;
  campaignId: string;
  namespace?: `user:${string}`;
}

export function encounterAuthorityKey(campaignCode: string) {
  return `rollkeeper:encounter-authority:${campaignCode}`;
}

/**
 * The encounter family is DM-private and has no player projection (ruling 6),
 * so a single marker records which store owns the campaign's encounters.
 * Nothing is read from storage while the client flag is off.
 */
export function readEncounterAuthorityMarker(
  storage: Pick<Storage, 'getItem'>,
  campaignCode: string
): EncounterAuthorityMarker | null {
  if (!isEncounterClientVisible()) return null;
  const raw = storage.getItem(encounterAuthorityKey(campaignCode));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<EncounterAuthorityMarker>;
    if (
      value.version !== 1 ||
      !['indexedDB', 'postgres', 'legacy_restored'].includes(
        value.authority ?? ''
      ) ||
      !Number.isSafeInteger(value.epoch) ||
      typeof value.campaignId !== 'string'
    )
      return null;
    return value as EncounterAuthorityMarker;
  } catch {
    return null;
  }
}

export function writeEncounterAuthorityMarker(
  storage: Pick<Storage, 'setItem'>,
  campaignCode: string,
  marker: EncounterAuthorityMarker
) {
  storage.setItem(encounterAuthorityKey(campaignCode), JSON.stringify(marker));
}

export function encounterUsesIndexedDbAuthority(
  storage: Pick<Storage, 'getItem'>,
  campaignCode: string
) {
  const authority = readEncounterAuthorityMarker(
    storage,
    campaignCode
  )?.authority;
  return authority === 'indexedDB' || authority === 'postgres';
}
