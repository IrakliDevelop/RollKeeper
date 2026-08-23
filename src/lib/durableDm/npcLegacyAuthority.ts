import { isNpcClientVisible } from './slice11dFlags';

export interface NpcAuthorityMarker {
  version: 1;
  authority: 'indexedDB' | 'postgres' | 'legacy_restored';
  epoch: number;
  campaignId: string;
  namespace?: `user:${string}`;
}

export function npcAuthorityKey(campaignCode: string) {
  return `rollkeeper:npc-authority:${campaignCode}`;
}

/**
 * The NPC family is DM-private and has no player projection, so a single marker
 * records which store owns the campaign's roster. Nothing is read from storage
 * while the client flag is off.
 */
export function readNpcAuthorityMarker(
  storage: Pick<Storage, 'getItem'>,
  campaignCode: string
): NpcAuthorityMarker | null {
  if (!isNpcClientVisible()) return null;
  const raw = storage.getItem(npcAuthorityKey(campaignCode));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<NpcAuthorityMarker>;
    if (
      value.version !== 1 ||
      !['indexedDB', 'postgres', 'legacy_restored'].includes(
        value.authority ?? ''
      ) ||
      !Number.isSafeInteger(value.epoch) ||
      typeof value.campaignId !== 'string'
    )
      return null;
    return value as NpcAuthorityMarker;
  } catch {
    return null;
  }
}

export function writeNpcAuthorityMarker(
  storage: Pick<Storage, 'setItem'>,
  campaignCode: string,
  marker: NpcAuthorityMarker
) {
  storage.setItem(npcAuthorityKey(campaignCode), JSON.stringify(marker));
}

export function npcUsesIndexedDbAuthority(
  storage: Pick<Storage, 'getItem'>,
  campaignCode: string
) {
  const authority = readNpcAuthorityMarker(storage, campaignCode)?.authority;
  return authority === 'indexedDB' || authority === 'postgres';
}
