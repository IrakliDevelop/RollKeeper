import { getProficiencyBonusFromCR } from '@/utils/npcSpellcasting';
import type { CampaignNPC } from '@/types/encounter';
import type { Spell } from '@/types/character';

export type SpellCategory = 'regular' | 'at_will' | 'innate';

export const SPELL_CATEGORY_LABELS: Record<SpellCategory, string> = {
  regular: 'Slot',
  at_will: 'At Will',
  innate: 'Innate',
};

export const ALL_SPELL_CATEGORIES: SpellCategory[] = [
  'regular',
  'at_will',
  'innate',
];

export function getSpellCategory(spell: Spell): SpellCategory {
  if (spell.freeCastMax !== undefined && spell.freeCastMax === 0)
    return 'at_will';
  if (spell.freeCastMax !== undefined && spell.freeCastMax > 0) return 'innate';
  return 'regular';
}

export const LEVEL_NAMES: Record<number, string> = {
  0: 'Cantrips',
  1: 'Level 1',
  2: 'Level 2',
  3: 'Level 3',
  4: 'Level 4',
  5: 'Level 5',
  6: 'Level 6',
  7: 'Level 7',
  8: 'Level 8',
  9: 'Level 9',
};

export function getAbilityScores(npc: CampaignNPC) {
  if (npc.monsterStatBlock) {
    return {
      str: npc.monsterStatBlock.str,
      dex: npc.monsterStatBlock.dex,
      con: npc.monsterStatBlock.con,
      int: npc.monsterStatBlock.int,
      wis: npc.monsterStatBlock.wis,
      cha: npc.monsterStatBlock.cha,
    };
  }
  if (npc.abilityScores) {
    return npc.abilityScores;
  }
  return { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
}

export function getProfBonus(npc: CampaignNPC): number {
  if (npc.proficiencyBonus !== undefined) return npc.proficiencyBonus;
  return getProficiencyBonusFromCR(
    npc.monsterStatBlock?.cr,
    npc.spellcasting?.casterLevel
  );
}

/** Toast message for a cast: cantrip, then ritual, then innate, else the slot level. */
export function castMessage(
  level: number,
  useFreecast: boolean,
  useRitual: boolean
): string {
  if (level === 0) return 'Cast as a cantrip';
  if (useRitual) return 'Cast as a ritual';
  if (useFreecast) return 'Innate cast';
  return `Cast at level ${level}`;
}
