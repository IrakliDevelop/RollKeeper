export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

const ABILITY_KEY_SET = new Set<string>([
  'str',
  'dex',
  'con',
  'int',
  'wis',
  'cha',
]);

/**
 * Parses a stat-block saves display string ("DEX +5, CON +8") into a map of
 * ability key -> save value string. Values keep their sign verbatim (the
 * bestiary loader already formats them). Malformed tokens are skipped;
 * empty/undefined input yields an empty map.
 */
export function parseSavesString(
  saves: string | undefined
): Partial<Record<AbilityKey, string>> {
  if (!saves) return {};
  const result: Partial<Record<AbilityKey, string>> = {};
  for (const token of saves.split(',')) {
    const trimmed = token.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^([a-zA-Z]{3})\s+(\S.*)$/);
    if (!match) continue;
    const key = match[1].toLowerCase();
    if (!ABILITY_KEY_SET.has(key)) continue;
    result[key as AbilityKey] = match[2].trim();
  }
  return result;
}
