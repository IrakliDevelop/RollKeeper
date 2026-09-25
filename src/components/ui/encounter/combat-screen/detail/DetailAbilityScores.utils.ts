import type { MonsterStatBlock } from '@/types/encounter';

export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export const ABILITY_KEYS: AbilityKey[] = [
  'str',
  'dex',
  'con',
  'int',
  'wis',
  'cha',
];

const ABILITY_KEY_SET = new Set<string>(ABILITY_KEYS);

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

export function removeSaveOverride(
  saves: string | undefined,
  ability: AbilityKey
): string {
  if (!saves) return '';
  return saves
    .split(',')
    .filter(token => {
      const match = token.trim().match(/^([a-zA-Z]{3})\s+/);
      return !match || match[1].toLowerCase() !== ability;
    })
    .map(token => token.trim())
    .filter(Boolean)
    .join(', ');
}

/** Formats a signed integer ("+3", "-1", "+0"). */
export function signed(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

/** Formats an ability score's modifier, signed ("+2", "-1"). */
export function signedModifier(score: number): string {
  return signed(Math.floor((score - 10) / 2));
}

/** Resolved saving-throw proficiencies plus the parsed override map, in one pass. */
export interface AbilitySaveState {
  proficiencies: AbilityKey[];
  saveByAbility: Partial<Record<AbilityKey, string>>;
}

/**
 * Resolves which abilities are save-proficient: explicit `saveProficiencies`
 * when present, otherwise inferred from which abilities the `saves` string
 * mentions (legacy stat blocks).
 */
export function computeSaveProficiencies(
  sb: Pick<MonsterStatBlock, 'saves' | 'saveProficiencies'>
): AbilitySaveState {
  const saveByAbility = parseSavesString(sb.saves);
  const inferredProficiencies = ABILITY_KEYS.filter(key => saveByAbility[key]);
  const proficiencies = sb.saveProficiencies ?? inferredProficiencies;
  return { proficiencies, saveByAbility };
}

/**
 * The displayed save value for one ability: an explicit `saves`-string
 * override when present, otherwise the calculated modifier + proficiency
 * bonus (when proficient).
 */
export function abilitySaveValue(
  sb: Pick<MonsterStatBlock, AbilityKey>,
  key: AbilityKey,
  proficiencies: AbilityKey[],
  saveByAbility: Partial<Record<AbilityKey, string>>,
  proficiencyBonus: number | undefined
): string {
  const proficient = proficiencies.includes(key);
  const calculated =
    Math.floor((sb[key] - 10) / 2) + (proficient ? (proficiencyBonus ?? 0) : 0);
  return saveByAbility[key] ?? signed(calculated);
}

/** The stat-block patch that toggles one ability's save proficiency. */
export function saveProficiencyPatch(
  sb: MonsterStatBlock,
  proficiencies: AbilityKey[],
  key: AbilityKey,
  proficient: boolean
): MonsterStatBlock {
  const next = proficient
    ? [...new Set([...proficiencies, key])]
    : proficiencies.filter(candidate => candidate !== key);
  return {
    ...sb,
    saveProficiencies: next,
    saves: proficient ? sb.saves : removeSaveOverride(sb.saves, key),
  };
}

/** The stat-block patch that clears a manual save override for one ability. */
export function resetSavePatch(
  sb: MonsterStatBlock,
  proficiencies: AbilityKey[],
  key: AbilityKey
): MonsterStatBlock {
  return {
    ...sb,
    saveProficiencies: proficiencies,
    saves: removeSaveOverride(sb.saves, key),
  };
}
