import type { Spell } from '@/types/character';
import type { Summon, SummonType, SavedCreature } from '@/types/summon';
import type { ProcessedMonster } from '@/types/bestiary';
import { monsterToEncounterEntity } from './encounterConverter';
import { searchMonsters } from './apiClient';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/** Spell names that summon creatures */
const FAMILIAR_SPELLS = ['Find Familiar'];

const SUMMON_SPELL_PREFIXES = ['Summon '];

const SUMMON_SPELL_NAMES = [
  'Summon Beast',
  'Summon Celestial',
  'Summon Construct',
  'Summon Dragon',
  'Summon Elemental',
  'Summon Fey',
  'Summon Fiend',
  'Summon Shadowspawn',
  'Summon Undead',
  'Summon Aberration',
  'Conjure Animals',
  'Conjure Celestial',
  'Conjure Elemental',
  'Conjure Fey',
  'Conjure Minor Elementals',
  'Conjure Woodland Beings',
  'Find Steed',
  'Find Greater Steed',
];

/** Scaling data for Summon X spells (Tasha's pattern) */
export const SUMMON_SPELL_SCALING: Record<
  string,
  {
    baseAC: number;
    baseHP: number;
    hpPerLevel: number;
    baseLevel: number;
    spiritName: string;
    subtypes?: string[];
  }
> = {
  'Summon Beast': {
    baseAC: 11,
    baseHP: 30,
    hpPerLevel: 5,
    baseLevel: 2,
    spiritName: 'Bestial Spirit',
    subtypes: ['Air', 'Land', 'Water'],
  },
  'Summon Celestial': {
    baseAC: 11,
    baseHP: 40,
    hpPerLevel: 10,
    baseLevel: 5,
    spiritName: 'Celestial Spirit',
    subtypes: ['Avenger', 'Defender'],
  },
  'Summon Construct': {
    baseAC: 13,
    baseHP: 40,
    hpPerLevel: 15,
    baseLevel: 4,
    spiritName: 'Construct Spirit',
    subtypes: ['Clay', 'Metal', 'Stone'],
  },
  'Summon Dragon': {
    baseAC: 14,
    baseHP: 50,
    hpPerLevel: 10,
    baseLevel: 5,
    spiritName: 'Draconic Spirit',
    subtypes: ['Chromatic', 'Gem', 'Metallic'],
  },
  'Summon Elemental': {
    baseAC: 11,
    baseHP: 50,
    hpPerLevel: 10,
    baseLevel: 4,
    spiritName: 'Elemental Spirit',
    subtypes: ['Air', 'Earth', 'Fire', 'Water'],
  },
  'Summon Fey': {
    baseAC: 12,
    baseHP: 30,
    hpPerLevel: 10,
    baseLevel: 3,
    spiritName: 'Fey Spirit',
    subtypes: ['Fuming', 'Mirthful', 'Tricksy'],
  },
  'Summon Fiend': {
    baseAC: 12,
    baseHP: 50,
    hpPerLevel: 15,
    baseLevel: 6,
    spiritName: 'Fiendish Spirit',
    subtypes: ['Demon', 'Devil', 'Yugoloth'],
  },
  'Summon Shadowspawn': {
    baseAC: 11,
    baseHP: 35,
    hpPerLevel: 15,
    baseLevel: 3,
    spiritName: 'Shadow Spirit',
    subtypes: ['Fury', 'Despair', 'Fear'],
  },
  'Summon Undead': {
    baseAC: 11,
    baseHP: 30,
    hpPerLevel: 10,
    baseLevel: 3,
    spiritName: 'Undead Spirit',
    subtypes: ['Ghostly', 'Putrid', 'Skeletal'],
  },
  'Summon Aberration': {
    baseAC: 11,
    baseHP: 40,
    hpPerLevel: 10,
    baseLevel: 4,
    spiritName: 'Aberrant Spirit',
    subtypes: ['Beholderkin', 'Slaad', 'Star Spawn'],
  },
};

/** Check if a spell is a summoning spell */
export function isSummoningSpell(spell: Spell): boolean {
  const name = spell.name;
  if (FAMILIAR_SPELLS.includes(name)) return true;
  if (SUMMON_SPELL_NAMES.includes(name)) return true;
  if (SUMMON_SPELL_PREFIXES.some(p => name.startsWith(p))) return true;
  return false;
}

/** Get the summon type for a spell */
export function getSummonType(spell: Spell): SummonType {
  if (FAMILIAR_SPELLS.includes(spell.name)) return 'familiar';
  return 'summon';
}

/** Check if a spell uses the Tasha's spirit scaling pattern */
export function isSpiritSummonSpell(spellName: string): boolean {
  return spellName in SUMMON_SPELL_SCALING;
}

/** Get spirit scaling data for a spell */
export function getSpiritScaling(spellName: string) {
  return SUMMON_SPELL_SCALING[spellName] ?? null;
}

/** Create a familiar summon from a bestiary monster */
export function createFamiliarFromMonster(
  monster: ProcessedMonster,
  spellId?: string,
  customName?: string
): Summon {
  const entityData = monsterToEncounterEntity(monster);

  return {
    id: generateId(),
    type: 'familiar',
    entity: {
      ...entityData,
      id: generateId(),
      name: customName || monster.name,
    },
    sourceSpellName: 'Find Familiar',
    sourceSpellId: spellId,
    requiresConcentration: false,
    duration: 'Until dismissed',
    createdAt: new Date().toISOString(),
    customName,
  };
}

/** Resolve spell-level-dependent text in trait/action descriptions */
function resolveSummonText(
  text: string,
  castAtLevel: number,
  spellAttackBonus?: number | null,
  spellcastingAbilityMod?: number | null
): string {
  const halfLevel = Math.floor(castAtLevel / 2);

  let resolved = text;

  // Replace arithmetic expressions with summonSpellLevel, e.g. (summonSpellLevel - 4)
  resolved = resolved.replace(
    /\(summonSpellLevel\s*([+-])\s*(\d+)\)/g,
    (_match, op: string, num: string) => {
      const n = parseInt(num);
      const result = op === '+' ? castAtLevel + n : castAtLevel - n;
      return String(result);
    }
  );

  // Replace bare summonSpellLevel
  resolved = resolved.replace(/summonSpellLevel/g, String(castAtLevel));

  // Replace natural language spell level references
  resolved = resolved
    .replace(/half this spell['']s level/gi, String(halfLevel))
    .replace(/half the spell['']s level/gi, String(halfLevel))
    .replace(/half the spell level/gi, String(halfLevel))
    .replace(/the spell['']s level/gi, String(castAtLevel))
    .replace(/this spell['']s level/gi, String(castAtLevel))
    .replace(/the spell level/gi, String(castAtLevel));

  // Replace spell attack modifier references (both in plain text and HTML badge spans)
  if (spellAttackBonus != null) {
    const bonusStr =
      spellAttackBonus >= 0 ? `+${spellAttackBonus}` : `${spellAttackBonus}`;

    // Replace the entire hitYourSpellAttack badge span (from referenceParser HTML output)
    // Matches: <span class="..." title="...">✨ Bonus equals your spell attack modifier</span>
    // or empty badge from TCE: <span class="..." title="...">✨ </span>
    resolved = resolved.replace(
      /<span[^>]*>✨\s*(?:Bonus equals your spell attack modifier)?<\/span>/gi,
      bonusStr
    );

    // Handle TCE format where {@hitYourSpellAttack} becomes empty, leaving " to hit"
    // Pattern: "Attack: to hit" → "Attack: +N to hit"
    resolved = resolved.replace(
      /(Attack:<\/span>)\s*to hit/gi,
      `$1 ${bonusStr} to hit`
    );
    // Also without badge: "Attack: to hit"
    resolved = resolved.replace(
      /((?:Weapon|Spell)\s+Attack:)\s*to hit/gi,
      `$1 ${bonusStr} to hit`
    );

    // Also handle plain text variants (in case text wasn't HTML-processed)
    resolved = resolved.replace(
      /Bonus equals your spell attack modifier/gi,
      bonusStr
    );
    resolved = resolved.replace(/your spell attack modifier/gi, bonusStr);
  }

  // Replace spellcasting ability modifier references
  if (spellcastingAbilityMod != null) {
    resolved = resolved.replace(
      /your spellcasting ability modifier/gi,
      String(spellcastingAbilityMod)
    );
  }

  return resolved;
}

/** Filter traits/actions to only subtype-relevant ones (removes "(X Only)" entries for other subtypes) */
function filterBySubtype(
  entries: Array<{ name: string; text: string }>,
  subtype: string | undefined,
  allSubtypes: string[]
): Array<{ name: string; text: string }> {
  if (!subtype || allSubtypes.length === 0) return entries;

  return entries.filter(entry => {
    // Check if entry is subtype-specific via "(X Only)" pattern
    const onlyMatch = entry.name.match(/\(([^)]+)\s+Only\)/i);
    if (!onlyMatch) return true; // not subtype-specific, keep it
    // Check if ANY of the listed subtypes match the selected one
    const listedTypes = onlyMatch[1]
      .split(/\s+and\s+|\s*,\s*/i)
      .map(s => s.trim().toLowerCase());
    return listedTypes.some(
      t =>
        subtype.toLowerCase().includes(t) || t.includes(subtype.toLowerCase())
    );
  });
}

/** Normalize source codes so XPHB and PHB2024 are treated as equivalent */
function normalizeSource(source?: string): string | undefined {
  if (!source) return undefined;
  const upper = source.toUpperCase();
  if (upper === 'XPHB' || upper === 'PHB2024' || upper.includes('PHB 2024'))
    return 'PHB2024';
  if (upper === 'TCE') return 'TCE';
  if (upper === 'PHB') return 'PHB2024'; // spirits only exist in TCE/XPHB, prefer 2024
  return upper;
}

/** Fetch a spirit creature from the bestiary by name, preferring matching source */
async function fetchSpiritMonster(
  spiritName: string,
  preferredSource?: string
): Promise<ProcessedMonster | null> {
  try {
    const normalized = normalizeSource(preferredSource);

    // Search without source filter (the API may use different source codes)
    const result = await searchMonsters(spiritName, {}, 20);
    const matches = result.monsters.filter(
      m => m.name.toLowerCase() === spiritName.toLowerCase()
    );
    if (matches.length === 0) return result.monsters[0] ?? null;
    if (matches.length === 1) return matches[0];

    // Multiple matches — pick the one matching the preferred source
    const preferred = normalized ?? 'PHB2024';
    return (
      matches.find(m => normalizeSource(m.source) === preferred) ?? matches[0]
    );
  } catch {
    return null;
  }
}

/** Create a spirit summon with level-based scaling, fetching full stat block from bestiary */
export async function createSpiritSummon(
  spellName: string,
  castAtLevel: number,
  subtype?: string,
  spellId?: string,
  spellAttackBonus?: number | null,
  spellcastingAbilityMod?: number | null,
  spellSource?: string
): Promise<Summon | null> {
  const scaling = SUMMON_SPELL_SCALING[spellName];
  if (!scaling) return null;

  const scaledAC = scaling.baseAC + castAtLevel;
  const scaledHP =
    scaling.baseHP + scaling.hpPerLevel * (castAtLevel - scaling.baseLevel);

  const displayName = subtype
    ? `${scaling.spiritName} (${subtype})`
    : scaling.spiritName;

  // Fetch the full spirit creature from the bestiary, matching spell source
  const monster = await fetchSpiritMonster(scaling.spiritName, spellSource);

  if (monster) {
    // Use the full converter with HP/AC overrides
    const entityData = monsterToEncounterEntity(monster, {
      nameOverride: displayName,
      hpOverride: scaledHP,
      acOverride: scaledAC,
    });

    // Apply subtype filtering and spell-level text resolution to stat block
    if (entityData.monsterStatBlock) {
      const sb = entityData.monsterStatBlock;
      const allSubtypes = scaling.subtypes ?? [];

      const resolve = (t: string) =>
        resolveSummonText(
          t,
          castAtLevel,
          spellAttackBonus,
          spellcastingAbilityMod
        );

      sb.traits = filterBySubtype(sb.traits, subtype, allSubtypes).map(t => ({
        name: t.name,
        text: resolve(t.text),
      }));
      sb.actions = filterBySubtype(sb.actions, subtype, allSubtypes).map(a => ({
        name: a.name,
        text: resolve(a.text),
      }));
      sb.reactions = filterBySubtype(sb.reactions, subtype, allSubtypes).map(
        r => ({
          name: r.name,
          text: resolve(r.text),
        })
      );
      sb.bonusActions = filterBySubtype(
        sb.bonusActions,
        subtype,
        allSubtypes
      ).map(b => ({
        name: b.name,
        text: resolve(b.text),
      }));

      // Update HP formula to show scaled value
      sb.hpFormula = `${scaledHP} (scaled to level ${castAtLevel})`;
    }

    return {
      id: generateId(),
      type: 'summon',
      entity: {
        ...entityData,
        id: generateId(),
      },
      sourceSpellName: spellName,
      sourceSpellId: spellId,
      castAtLevel,
      requiresConcentration: true,
      duration: '1 hour',
      createdAt: new Date().toISOString(),
    };
  }

  // Fallback: if bestiary fetch fails, create minimal entity
  return {
    id: generateId(),
    type: 'summon',
    entity: {
      id: generateId(),
      type: 'monster',
      name: displayName,
      initiative: null,
      initiativeModifier: 0,
      currentHp: scaledHP,
      maxHp: scaledHP,
      tempHp: 0,
      armorClass: scaledAC,
      conditions: [],
      monsterStatBlock: {
        str: 18,
        dex: 11,
        con: 16,
        int: 4,
        wis: 14,
        cha: 5,
        saves: '',
        skills: '',
        speed: '30 ft.',
        resistances: '',
        immunities: '',
        vulnerabilities: '',
        conditionImmunities: [],
        senses: 'Darkvision 60 ft.',
        passivePerception: 12,
        traits: [],
        actions: [
          {
            name: 'Multiattack',
            text: `The spirit makes ${Math.floor(castAtLevel / 2)} attack(s).`,
          },
        ],
        reactions: [],
        bonusActions: [],
        lairActions: [],
        cr: '-',
        type: scaling.spiritName.split(' ')[0].toLowerCase(),
        size: 'Small',
        languages: 'understands the languages you speak',
        alignment: 'Unaligned',
        hpFormula: `${scaledHP}`,
      },
    },
    sourceSpellName: spellName,
    sourceSpellId: spellId,
    castAtLevel,
    requiresConcentration: true,
    duration: '1 hour',
    createdAt: new Date().toISOString(),
  };
}

/** Create a summon from a bestiary monster (for conjuration spells that use real monsters) */
export function createSummonFromMonster(
  monster: ProcessedMonster,
  spellName: string,
  spellId?: string,
  castAtLevel?: number,
  requiresConcentration: boolean = true,
  duration: string = '1 hour',
  customName?: string
): Summon {
  const entityData = monsterToEncounterEntity(monster);

  return {
    id: generateId(),
    type: 'summon',
    entity: {
      ...entityData,
      id: generateId(),
      name: customName || monster.name,
    },
    sourceSpellName: spellName,
    sourceSpellId: spellId,
    castAtLevel,
    requiresConcentration,
    duration,
    createdAt: new Date().toISOString(),
    customName,
  };
}

/** Build a MonsterStatBlock from a SavedCreature */
function savedCreatureToStatBlock(
  creature: SavedCreature
): import('@/types/encounter').MonsterStatBlock {
  return {
    str: creature.str,
    dex: creature.dex,
    con: creature.con,
    int: creature.int,
    wis: creature.wis,
    cha: creature.cha,
    saves: creature.saves || '',
    skills: creature.skills || '',
    speed: creature.speed,
    resistances: creature.resistances || '',
    immunities: creature.immunities || '',
    vulnerabilities: creature.vulnerabilities || '',
    conditionImmunities: creature.conditionImmunities || [],
    senses: creature.senses || '',
    passivePerception:
      creature.passivePerception ?? 10 + Math.floor((creature.wis - 10) / 2),
    traits: creature.traits || [],
    actions: creature.actions || [],
    reactions: creature.reactions || [],
    bonusActions: creature.bonusActions || [],
    lairActions: creature.lairActions || [],
    cr: creature.cr || '0',
    type: creature.type,
    size: creature.size,
    languages: creature.languages || '',
    alignment: creature.alignment,
    hpFormula: creature.hpFormula || String(creature.hp),
  };
}

/** Create a familiar summon from a saved creature template */
export function createFamiliarFromSavedCreature(
  creature: SavedCreature,
  spellId?: string,
  customName?: string
): Summon {
  const dexMod = Math.floor((creature.dex - 10) / 2);

  return {
    id: generateId(),
    type: 'familiar',
    entity: {
      id: generateId(),
      type: 'monster',
      name: customName || creature.name,
      initiative: null,
      initiativeModifier: dexMod,
      currentHp: creature.hp,
      maxHp: creature.hp,
      tempHp: 0,
      armorClass: creature.ac,
      conditions: [],
      monsterStatBlock: savedCreatureToStatBlock(creature),
      isHidden: false,
    },
    sourceSpellName: 'Find Familiar',
    sourceSpellId: spellId,
    requiresConcentration: false,
    duration: 'Until dismissed',
    createdAt: new Date().toISOString(),
    customName,
  };
}

/** Create a summon from a saved creature template (for non-familiar spells) */
export function createSummonFromSavedCreature(
  creature: SavedCreature,
  spellName: string,
  spellId?: string,
  castAtLevel?: number,
  requiresConcentration: boolean = true,
  duration: string = '1 hour',
  customName?: string
): Summon {
  const dexMod = Math.floor((creature.dex - 10) / 2);

  return {
    id: generateId(),
    type: 'summon',
    entity: {
      id: generateId(),
      type: 'monster',
      name: customName || creature.name,
      initiative: null,
      initiativeModifier: dexMod,
      currentHp: creature.hp,
      maxHp: creature.hp,
      tempHp: 0,
      armorClass: creature.ac,
      conditions: [],
      monsterStatBlock: savedCreatureToStatBlock(creature),
      isHidden: false,
    },
    sourceSpellName: spellName,
    sourceSpellId: spellId,
    castAtLevel,
    requiresConcentration,
    duration,
    createdAt: new Date().toISOString(),
    customName,
  };
}
