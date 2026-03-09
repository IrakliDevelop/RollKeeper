/**
 * Additional Spells Parser
 * Parses the `additionalSpells` field from 5eTools feat JSON into structured types.
 *
 * Handles these grant patterns:
 *   prepared._  / prepared.N     -> always prepared
 *   innate._.daily.{1|"1e"}      -> 1/long rest
 *   innate._.rest.{1}            -> 1/short rest
 *   innate._.will                -> at will
 *   innate._.ritual              -> ritual only
 *   known._                      -> added to known spells
 *
 * Spell reference formats:
 *   "spell name"                 -> plain name
 *   "spell name|source"          -> with source
 *   "spell name#c"               -> cantrip marker
 *   "spell name#N"               -> cast at level N
 *   { choose: "filter" }         -> player picks from filtered list
 *   { choose: "filter", count: N }
 */

export type GrantType =
  | 'prepared'
  | 'innate_daily'
  | 'innate_will'
  | 'innate_rest'
  | 'innate_ritual'
  | 'known';

export interface ParsedGrantedSpell {
  spellName: string;
  sourceRef: string;
  grantType: GrantType;
  freeCastMax?: number;
  restType?: 'short' | 'long';
  isAlwaysPrepared?: boolean;
  spellLevel?: number;
}

export interface ParsedChooseSpell {
  filter: string;
  count: number;
  grantType: GrantType;
  freeCastMax?: number;
  restType?: 'short' | 'long';
  isAlwaysPrepared?: boolean;
}

export interface SpellListGroup {
  name: string;
  ability?: string | { choose: string[] };
  concrete: ParsedGrantedSpell[];
  choices: ParsedChooseSpell[];
}

export interface ParsedAdditionalSpells {
  ability?: string | { choose: string[] };
  concrete: ParsedGrantedSpell[];
  choices: ParsedChooseSpell[];
  groups?: SpellListGroup[];
}

export function cleanSpellName(ref: string): { name: string; level?: number } {
  let cleaned = ref;

  // Strip source suffix: "misty step|xphb" -> "misty step"
  const pipeIdx = cleaned.indexOf('|');
  if (pipeIdx !== -1) {
    cleaned = cleaned.substring(0, pipeIdx);
  }

  // Strip level/cantrip suffix: "searing smite#2" -> "searing smite", level 2
  //                              "prestidigitation#c" -> "prestidigitation", level 0
  let level: number | undefined;
  const hashIdx = cleaned.indexOf('#');
  if (hashIdx !== -1) {
    const suffix = cleaned.substring(hashIdx + 1);
    cleaned = cleaned.substring(0, hashIdx);
    if (suffix === 'c') {
      level = 0;
    } else {
      const parsed = parseInt(suffix, 10);
      if (!isNaN(parsed)) level = parsed;
    }
  }

  return { name: cleaned.trim(), level };
}

function isChooseObject(
  item: unknown
): item is { choose: string; count?: number } {
  return (
    typeof item === 'object' &&
    item !== null &&
    'choose' in item &&
    typeof (item as Record<string, unknown>).choose === 'string'
  );
}

function collectSpellEntries(
  items: unknown[],
  grantType: GrantType,
  freeCastMax: number | undefined,
  restType: 'short' | 'long' | undefined,
  isAlwaysPrepared: boolean | undefined,
  concrete: ParsedGrantedSpell[],
  choices: ParsedChooseSpell[]
): void {
  for (const item of items) {
    if (typeof item === 'string') {
      const { name, level } = cleanSpellName(item);
      concrete.push({
        spellName: name,
        sourceRef: item,
        grantType,
        freeCastMax,
        restType,
        isAlwaysPrepared,
        spellLevel: level,
      });
    } else if (isChooseObject(item)) {
      choices.push({
        filter: item.choose,
        count: item.count ?? 1,
        grantType,
        freeCastMax,
        restType,
        isAlwaysPrepared,
      });
    }
  }
}

/**
 * Walk the `innate` object which has the shape:
 *   { "_": { "daily": { "1e": [...] }, "rest": { "1": [...] }, "will": [...], "ritual": [...] } }
 * or level-gated:
 *   { "3": { "daily": { "1": [...] } } }
 */
function parseInnateBlock(
  innate: Record<string, unknown>,
  concrete: ParsedGrantedSpell[],
  choices: ParsedChooseSpell[]
): void {
  for (const [_levelKey, block] of Object.entries(innate)) {
    if (typeof block !== 'object' || block === null) continue;
    const obj = block as Record<string, unknown>;

    // daily: { "1": [...], "1e": [...] }
    if (obj.daily && typeof obj.daily === 'object') {
      const daily = obj.daily as Record<string, unknown>;
      for (const [countKey, spells] of Object.entries(daily)) {
        const count = parseInt(countKey, 10) || 1;
        if (Array.isArray(spells)) {
          collectSpellEntries(
            spells,
            'innate_daily',
            count,
            'long',
            undefined,
            concrete,
            choices
          );
        }
      }
    }

    // rest: { "1": [...] }
    if (obj.rest && typeof obj.rest === 'object') {
      const rest = obj.rest as Record<string, unknown>;
      for (const [countKey, spells] of Object.entries(rest)) {
        const count = parseInt(countKey, 10) || 1;
        if (Array.isArray(spells)) {
          collectSpellEntries(
            spells,
            'innate_rest',
            count,
            'short',
            undefined,
            concrete,
            choices
          );
        }
      }
    }

    // will: [...]
    if (Array.isArray(obj.will)) {
      collectSpellEntries(
        obj.will,
        'innate_will',
        0,
        undefined,
        undefined,
        concrete,
        choices
      );
    }

    // ritual: [...]
    if (Array.isArray(obj.ritual)) {
      collectSpellEntries(
        obj.ritual,
        'innate_ritual',
        undefined,
        undefined,
        undefined,
        concrete,
        choices
      );
    }
  }
}

/**
 * Walk the `prepared` object which has the shape:
 *   { "_": ["spell1", "spell2"] }
 * or level-keyed:
 *   { "1": ["spell1"], "5": ["spell2"] }
 * or with daily sub-block:
 *   { "_": { "daily": { "1": ["spell"] } } }
 */
function parsePreparedBlock(
  prepared: Record<string, unknown>,
  concrete: ParsedGrantedSpell[],
  choices: ParsedChooseSpell[]
): void {
  for (const [_levelKey, value] of Object.entries(prepared)) {
    if (Array.isArray(value)) {
      collectSpellEntries(
        value,
        'prepared',
        undefined,
        undefined,
        true,
        concrete,
        choices
      );
    } else if (typeof value === 'object' && value !== null) {
      // Nested block like { daily: { "1": [...] } } under prepared
      const nested = value as Record<string, unknown>;
      if (nested.daily && typeof nested.daily === 'object') {
        const daily = nested.daily as Record<string, unknown>;
        for (const [countKey, spells] of Object.entries(daily)) {
          const count = parseInt(countKey, 10) || 1;
          if (Array.isArray(spells)) {
            collectSpellEntries(
              spells,
              'innate_daily',
              count,
              'long',
              true,
              concrete,
              choices
            );
          }
        }
      }
    }
  }
}

/**
 * Walk the `known` object: { "_": ["spell1", { choose: "filter" }] }
 */
function parseKnownBlock(
  known: Record<string, unknown>,
  concrete: ParsedGrantedSpell[],
  choices: ParsedChooseSpell[]
): void {
  for (const [_levelKey, value] of Object.entries(known)) {
    if (Array.isArray(value)) {
      collectSpellEntries(
        value,
        'known',
        undefined,
        undefined,
        undefined,
        concrete,
        choices
      );
    }
  }
}

function extractAbility(
  obj: Record<string, unknown>
): string | { choose: string[] } | undefined {
  if (!obj.ability) return undefined;
  if (typeof obj.ability === 'string') return obj.ability;
  if (
    typeof obj.ability === 'object' &&
    obj.ability !== null &&
    'choose' in obj.ability
  ) {
    return { choose: (obj.ability as { choose: string[] }).choose };
  }
  return undefined;
}

function parseSingleGroup(obj: Record<string, unknown>): {
  concrete: ParsedGrantedSpell[];
  choices: ParsedChooseSpell[];
} {
  const concrete: ParsedGrantedSpell[] = [];
  const choices: ParsedChooseSpell[] = [];

  if (obj.innate && typeof obj.innate === 'object') {
    parseInnateBlock(obj.innate as Record<string, unknown>, concrete, choices);
  }
  if (obj.prepared && typeof obj.prepared === 'object') {
    parsePreparedBlock(
      obj.prepared as Record<string, unknown>,
      concrete,
      choices
    );
  }
  if (obj.known && typeof obj.known === 'object') {
    parseKnownBlock(obj.known as Record<string, unknown>, concrete, choices);
  }

  return { concrete, choices };
}

/**
 * Parse a raw `additionalSpells` array (from a feat) into structured data.
 *
 * When the array contains multiple entries with `name` fields (e.g., Magic
 * Initiate with "Bard Spells", "Cleric Spells", etc.), the result includes
 * a `groups` array so the UI can let the player pick a spell list first.
 *
 * When entries have no names, everything is merged into a single flat result.
 */
export function parseAdditionalSpells(
  raw: unknown[]
): ParsedAdditionalSpells | null {
  if (!raw || raw.length === 0) return null;

  // Check if we have multiple named groups (e.g., Magic Initiate class options)
  const namedEntries = raw.filter(
    g =>
      typeof g === 'object' &&
      g !== null &&
      typeof (g as Record<string, unknown>).name === 'string'
  );
  const hasNamedGroups = namedEntries.length > 1;

  if (hasNamedGroups) {
    const groups: SpellListGroup[] = [];
    let firstAbility: string | { choose: string[] } | undefined;

    for (const group of raw) {
      if (typeof group !== 'object' || group === null) continue;
      const obj = group as Record<string, unknown>;
      const name = (obj.name as string) || 'Unknown';
      const ability = extractAbility(obj);
      if (!firstAbility) firstAbility = ability;

      const { concrete, choices } = parseSingleGroup(obj);
      if (concrete.length > 0 || choices.length > 0) {
        groups.push({ name, ability, concrete, choices });
      }
    }

    if (groups.length === 0) return null;

    return {
      ability: firstAbility,
      concrete: [],
      choices: [],
      groups,
    };
  }

  // No named groups: merge everything flat (single-group feats like Fey Touched)
  const concrete: ParsedGrantedSpell[] = [];
  const choices: ParsedChooseSpell[] = [];
  let ability: string | { choose: string[] } | undefined;

  for (const group of raw) {
    if (typeof group !== 'object' || group === null) continue;
    const obj = group as Record<string, unknown>;

    const groupAbility = extractAbility(obj);
    if (groupAbility && !ability) ability = groupAbility;

    const result = parseSingleGroup(obj);
    concrete.push(...result.concrete);
    choices.push(...result.choices);
  }

  if (concrete.length === 0 && choices.length === 0) return null;

  return { ability, concrete, choices };
}

/**
 * Parse a choose filter string like "level=1|class=Wizard" or "level=0|class=Sorcerer"
 * into structured filter criteria for spell lookup.
 */
export interface SpellChooseFilter {
  level?: number;
  className?: string;
  schools?: string[];
  ritual?: boolean;
}

const SCHOOL_ABBREVIATION_MAP: Record<string, string> = {
  A: 'Abjuration',
  C: 'Conjuration',
  D: 'Divination',
  E: 'Enchantment',
  I: 'Illusion',
  N: 'Necromancy',
  T: 'Transmutation',
  V: 'Evocation',
};

export function parseChooseFilter(filter: string): SpellChooseFilter {
  const result: SpellChooseFilter = {};
  const parts = filter.split('|');

  for (const part of parts) {
    const [key, value] = part.split('=');
    if (!key || !value) continue;

    const normalizedKey = key.trim().toLowerCase();

    if (normalizedKey === 'level') {
      result.level = parseInt(value.trim(), 10);
    } else if (normalizedKey === 'class') {
      result.className = value.trim();
    } else if (normalizedKey === 'school') {
      result.schools = value
        .split(';')
        .map(s => SCHOOL_ABBREVIATION_MAP[s.trim()] || s.trim())
        .filter(Boolean);
    } else if (normalizedKey === 'components & miscellaneous') {
      if (value.trim().toLowerCase() === 'ritual') {
        result.ritual = true;
      }
    }
  }

  return result;
}

/**
 * Human-readable label for a grant type
 */
export function grantTypeLabel(
  grantType: GrantType,
  freeCastMax?: number
): string {
  switch (grantType) {
    case 'prepared':
      return 'Always Prepared';
    case 'innate_daily':
      return freeCastMax === 1
        ? '1/Long Rest (free)'
        : `${freeCastMax}/Long Rest (free)`;
    case 'innate_rest':
      return freeCastMax === 1
        ? '1/Short Rest (free)'
        : `${freeCastMax}/Short Rest (free)`;
    case 'innate_will':
      return 'At Will';
    case 'innate_ritual':
      return 'Ritual Only';
    case 'known':
      return 'Added to Known Spells';
    default:
      return '';
  }
}
