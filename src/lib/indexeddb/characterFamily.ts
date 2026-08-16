export const CHARACTER_FAMILY = 'character' as const;
export const LEGACY_CHARACTER_KEY = 'rollkeeper-character';
export const PLAYER_ROSTER_KEY = 'rollkeeper-player-data';
export const CHARACTER_ENVELOPE_PREFIX = 'rollkeeper-character:';

export function isCharacterFamilyKey(key: string): boolean {
  return (
    key === LEGACY_CHARACTER_KEY ||
    key === PLAYER_ROSTER_KEY ||
    key.startsWith(CHARACTER_ENVELOPE_PREFIX)
  );
}

export function characterFamilyKeys(keys: Iterable<string>): string[] {
  return [...new Set(keys)].filter(isCharacterFamilyKey).sort();
}
