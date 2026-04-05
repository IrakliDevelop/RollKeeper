import { FULL_CASTER_SPELL_SLOTS } from './constants';
import { NPCSpellcasting, NPCSpellcastingAbility } from '@/types/encounter';

export function getNPCSpellSlots(
  casterLevel: number,
  overrides?: Record<number, number>
): Record<number, number> {
  const base = FULL_CASTER_SPELL_SLOTS[casterLevel] ?? {};
  if (!overrides) return { ...base };
  const result = { ...base };
  for (const [lvl, count] of Object.entries(overrides)) {
    result[Number(lvl)] = count;
  }
  return result;
}

export function calculateNPCSpellAttack(
  spellcasting: NPCSpellcasting,
  abilityScore: number,
  proficiencyBonus: number
): number {
  if (spellcasting.spellAttackBonus !== undefined) {
    return spellcasting.spellAttackBonus;
  }
  const mod = Math.floor((abilityScore - 10) / 2);
  return mod + proficiencyBonus;
}

export function calculateNPCSpellDC(
  spellcasting: NPCSpellcasting,
  abilityScore: number,
  proficiencyBonus: number
): number {
  if (spellcasting.spellSaveDC !== undefined) {
    return spellcasting.spellSaveDC;
  }
  const mod = Math.floor((abilityScore - 10) / 2);
  return 8 + mod + proficiencyBonus;
}

export function getNPCSpellcastingAbilityScore(
  ability: NPCSpellcastingAbility,
  abilityScores: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  }
): number {
  const map: Record<NPCSpellcastingAbility, keyof typeof abilityScores> = {
    intelligence: 'int',
    wisdom: 'wis',
    charisma: 'cha',
  };
  return abilityScores[map[ability]];
}

export function getProficiencyBonusFromCR(
  cr: string | undefined,
  fallbackLevel?: number
): number {
  let effective = fallbackLevel ?? 1;
  if (cr !== undefined) {
    const parsed = cr.includes('/') ? 0.5 : parseFloat(cr);
    if (!isNaN(parsed)) effective = Math.max(1, Math.ceil(parsed));
  }
  return Math.floor((effective - 1) / 4) + 2;
}

export function resetNPCSpellcasting(
  spellcasting: NPCSpellcasting
): NPCSpellcasting {
  return {
    ...spellcasting,
    slotsUsed: {},
    spells: spellcasting.spells.map(spell => ({
      ...spell,
      freeCastsUsed: 0,
    })),
  };
}
