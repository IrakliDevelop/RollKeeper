import { ProcessedMonster } from '@/types/bestiary';
import {
  EncounterEntity,
  MonsterAbility,
  MonsterStatBlock,
  LegendaryActionPool,
  MonsterSpellcasting,
} from '@/types/encounter';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Parse recharge notation from action name.
 * Examples: "Fire Breath {@recharge 5}" → rechargeOn: 5
 *           "Animate Chains (Recharges after a Short or Long Rest)" → restType: 'short'
 */
function parseRechargeFromName(name: string): {
  cleanName: string;
  usageType: MonsterAbility['usageType'];
  rechargeOn?: number;
  restType?: 'short' | 'long';
} {
  // {@recharge N} pattern
  const rechargeMatch = name.match(/\{@recharge\s+(\d+)\}/);
  if (rechargeMatch) {
    return {
      cleanName: name.replace(/\s*\{@recharge\s+\d+\}\s*/g, '').trim(),
      usageType: 'recharge',
      rechargeOn: parseInt(rechargeMatch[1], 10),
    };
  }

  // "(Recharges after a Short or Long Rest)" pattern
  const shortRestMatch = name.match(
    /\(Recharges? after a Short or Long Rest\)/i
  );
  if (shortRestMatch) {
    return {
      cleanName: name.replace(shortRestMatch[0], '').trim(),
      usageType: 'per-rest',
      restType: 'short',
    };
  }

  // "(Recharges after a Long Rest)" pattern
  const longRestMatch = name.match(/\(Recharges? after a Long Rest\)/i);
  if (longRestMatch) {
    return {
      cleanName: name.replace(longRestMatch[0], '').trim(),
      usageType: 'per-rest',
      restType: 'long',
    };
  }

  // "(X/Day)" pattern
  const perDayMatch = name.match(/\((\d+)\/Day\)/i);
  if (perDayMatch) {
    return {
      cleanName: name.replace(perDayMatch[0], '').trim(),
      usageType: 'per-day',
    };
  }

  return { cleanName: name, usageType: 'unlimited' };
}

function buildMonsterAbilities(monster: ProcessedMonster): MonsterAbility[] {
  const abilities: MonsterAbility[] = [];

  // Process traits with recharge or per-day
  for (const trait of monster.traits ?? []) {
    const parsed = parseRechargeFromName(trait.name);
    if (parsed.usageType !== 'unlimited') {
      abilities.push({
        id: generateId(),
        name: parsed.cleanName,
        description: trait.text,
        usageType: parsed.usageType,
        rechargeOn: parsed.rechargeOn,
        maxUses: parsed.usageType === 'per-day' ? 1 : undefined,
        usedUses: 0,
        restType: parsed.restType,
      });
    }
  }

  // Process actions with recharge or per-day
  for (const action of monster.actions ?? []) {
    const parsed = parseRechargeFromName(action.name);
    if (parsed.usageType !== 'unlimited') {
      abilities.push({
        id: generateId(),
        name: parsed.cleanName,
        description: action.text,
        usageType: parsed.usageType,
        rechargeOn: parsed.rechargeOn,
        maxUses: parsed.usageType === 'per-day' ? 1 : undefined,
        usedUses: 0,
        restType: parsed.restType,
      });
    }
  }

  return abilities;
}

function buildLegendaryActionPool(
  monster: ProcessedMonster
): LegendaryActionPool | undefined {
  if (!monster.legendaryActions || monster.legendaryActions.length === 0)
    return undefined;

  return {
    maxActions: monster.legendaryActionCount || 3,
    usedActions: 0,
    actions: monster.legendaryActions.map(la => {
      // Parse cost from name like "Wing Attack (Costs 2 Actions)"
      const costMatch = la.name.match(/\(Costs?\s+(\d+)\s+Actions?\)/i);
      const cost = costMatch ? parseInt(costMatch[1], 10) : 1;
      const cleanName = la.name
        .replace(/\(Costs?\s+\d+\s+Actions?\)/i, '')
        .trim();

      return {
        id: generateId(),
        name: cleanName,
        cost,
        description: la.text,
      };
    }),
  };
}

function buildMonsterSpellcasting(
  monster: ProcessedMonster
): MonsterSpellcasting | undefined {
  if (!monster.spellcastingEntries || monster.spellcastingEntries.length === 0)
    return undefined;

  const primary = monster.spellcastingEntries[0];

  const atWill: string[] = [];
  const perDay: Record<string, string[]> = {};
  const slots: Record<string, { max: number; used: number }> = {};

  for (const [level, data] of Object.entries(primary.spells)) {
    if (level === '0') {
      // Cantrips are at-will
      atWill.push(...data.spells);
    } else if (data.slots !== undefined) {
      slots[level] = { max: data.slots, used: 0 };
    } else {
      // No slots = innate/at-will for this level
      perDay[level] = data.spells;
    }
  }

  return {
    ability: primary.ability ?? 'Intelligence',
    dc: primary.dc ?? 10,
    toHit: primary.toHit ?? 0,
    atWill,
    perDay,
    slots: Object.keys(slots).length > 0 ? slots : undefined,
    usedSpells: {},
  };
}

/**
 * Calculate ability modifier from score
 */
function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/**
 * Build a full stat block from a ProcessedMonster for display in the encounter tracker.
 */
export function buildMonsterStatBlock(
  monster: ProcessedMonster,
  overrides?: MonsterOverrides
): MonsterStatBlock {
  const typeStr =
    typeof monster.type === 'string' ? monster.type : monster.type.type;
  return {
    str: overrides?.abilityScoreOverrides?.str ?? monster.str,
    dex: overrides?.abilityScoreOverrides?.dex ?? monster.dex,
    con: overrides?.abilityScoreOverrides?.con ?? monster.con,
    int: overrides?.abilityScoreOverrides?.int ?? monster.int,
    wis: overrides?.abilityScoreOverrides?.wis ?? monster.wis,
    cha: overrides?.abilityScoreOverrides?.cha ?? monster.cha,
    saves: monster.saves,
    skills: monster.skills,
    speed: monster.speed,
    resistances: monster.resistances,
    immunities: monster.immunities,
    vulnerabilities: monster.vulnerabilities,
    conditionImmunities: monster.conditionImmunities,
    senses: monster.senses,
    passivePerception: monster.passivePerception,
    traits: (monster.traits ?? []).map(t => ({ name: t.name, text: t.text })),
    actions: (monster.actions ?? []).map(a => ({ name: a.name, text: a.text })),
    reactions: (monster.reactions ?? []).map(r => ({
      name: r.name,
      text: r.text,
    })),
    cr: monster.cr,
    type: typeStr,
    size: monster.size.join(', '),
    languages: monster.languages,
    alignment: monster.alignment,
    hpFormula: monster.hpFormula,
  };
}

export interface MonsterOverrides {
  nameOverride?: string;
  color?: string;
  hpOverride?: number;
  acOverride?: number;
  abilityScoreOverrides?: Partial<
    Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number>
  >;
}

/**
 * Convert a ProcessedMonster into an EncounterEntity ready for use in combat.
 * Each call creates a new instance with a unique ID.
 */
export function monsterToEncounterEntity(
  monster: ProcessedMonster,
  options?: MonsterOverrides
): Omit<EncounterEntity, 'id'> {
  const hp = options?.hpOverride ?? monster.hpAverage;
  const ac = options?.acOverride ?? monster.acValue;
  const dex = options?.abilityScoreOverrides?.dex ?? monster.dex;

  return {
    type: 'monster',
    name: options?.nameOverride ?? monster.name,
    initiative: null,
    initiativeModifier: abilityModifier(dex),
    currentHp: hp,
    maxHp: hp,
    tempHp: 0,
    armorClass: ac,
    conditions: [],
    monsterSourceId: monster.id,
    monsterStatBlock: buildMonsterStatBlock(monster, options),
    abilities: buildMonsterAbilities(monster),
    legendaryActions: buildLegendaryActionPool(monster),
    spellcasting: buildMonsterSpellcasting(monster),
    color: options?.color,
    isHidden: false,
  };
}

/**
 * Create a lair action entity for a monster.
 */
export function createLairEntity(
  monsterName: string,
  lairActions: Array<{ name: string; description: string }>,
  regionalEffects?: string[]
): Omit<EncounterEntity, 'id'> {
  return {
    type: 'lair',
    name: `${monsterName}'s Lair`,
    initiative: 20,
    initiativeModifier: 0,
    currentHp: 0,
    maxHp: 0,
    tempHp: 0,
    armorClass: 0,
    conditions: [],
    lairActions: lairActions.map(la => ({
      id: generateId(),
      name: la.name,
      description: la.description,
      usedThisRound: false,
    })),
    regionalEffects,
    isHidden: false,
  };
}
