import { isMagicItemClientVisible } from './slice11cFlags';

export interface MagicItemAuthorityMarker {
  version: 1;
  authority: 'indexedDB' | 'postgres' | 'legacy_restored';
  epoch: number;
  campaignId: string;
  namespace?: `user:${string}`;
}

export function magicItemAuthorityKey(campaignCode: string) {
  return `rollkeeper:magic-item-authority:${campaignCode}`;
}

/**
 * The magic item family has no player projection, so a single marker records
 * which store owns the campaign's library. Nothing is read from storage while
 * the client flag is off.
 */
export function readMagicItemAuthorityMarker(
  storage: Pick<Storage, 'getItem'>,
  campaignCode: string
): MagicItemAuthorityMarker | null {
  if (!isMagicItemClientVisible()) return null;
  const raw = storage.getItem(magicItemAuthorityKey(campaignCode));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<MagicItemAuthorityMarker>;
    if (
      value.version !== 1 ||
      !['indexedDB', 'postgres', 'legacy_restored'].includes(
        value.authority ?? ''
      ) ||
      !Number.isSafeInteger(value.epoch) ||
      typeof value.campaignId !== 'string'
    )
      return null;
    return value as MagicItemAuthorityMarker;
  } catch {
    return null;
  }
}

export function writeMagicItemAuthorityMarker(
  storage: Pick<Storage, 'setItem'>,
  campaignCode: string,
  marker: MagicItemAuthorityMarker
) {
  storage.setItem(magicItemAuthorityKey(campaignCode), JSON.stringify(marker));
}

export function magicItemUsesIndexedDbAuthority(
  storage: Pick<Storage, 'getItem'>,
  campaignCode: string
) {
  const authority = readMagicItemAuthorityMarker(
    storage,
    campaignCode
  )?.authority;
  return authority === 'indexedDB' || authority === 'postgres';
}
