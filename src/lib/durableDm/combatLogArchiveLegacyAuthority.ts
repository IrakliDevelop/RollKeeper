import { isCombatLogArchiveClientVisible } from './slice11fFlags';

export interface CombatLogArchiveAuthorityMarker {
  version: 1;
  campaignCode: string;
  authority: 'localStorage' | 'indexedDB' | 'postgres';
  epoch: number;
  accountId: string;
  campaignId: string;
}

export function combatLogArchiveAuthorityKey(campaignCode: string) {
  return `rollkeeper:combat-log-archive-authority:${campaignCode}`;
}

/**
 * The combat log archive family is DM-private and has no player projection,
 * so a single marker records which store owns the campaign's combat log.
 * Nothing is read from storage while the client flag is off.
 */
export function readCombatLogArchiveAuthorityMarker(
  storage: Pick<Storage, 'getItem'>,
  campaignCode: string
): CombatLogArchiveAuthorityMarker | null {
  if (!isCombatLogArchiveClientVisible()) return null;
  const raw = storage.getItem(combatLogArchiveAuthorityKey(campaignCode));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<CombatLogArchiveAuthorityMarker>;
    if (
      value.version !== 1 ||
      value.campaignCode !== campaignCode ||
      !['localStorage', 'indexedDB', 'postgres'].includes(
        value.authority ?? ''
      ) ||
      !Number.isSafeInteger(value.epoch) ||
      typeof value.accountId !== 'string' ||
      typeof value.campaignId !== 'string'
    )
      return null;
    return value as CombatLogArchiveAuthorityMarker;
  } catch {
    return null;
  }
}

export function writeCombatLogArchiveAuthorityMarker(
  storage: Pick<Storage, 'setItem'>,
  marker: CombatLogArchiveAuthorityMarker
) {
  storage.setItem(
    combatLogArchiveAuthorityKey(marker.campaignCode),
    JSON.stringify(marker)
  );
}

export function combatLogArchiveUsesIndexedDbAuthority(
  storage: Pick<Storage, 'getItem'>,
  campaignCode: string
) {
  const authority = readCombatLogArchiveAuthorityMarker(
    storage,
    campaignCode
  )?.authority;
  return authority === 'indexedDB' || authority === 'postgres';
}
