import type { CampaignNPC } from '@/types/encounter';
import type { Spell } from '@/types/character';
import {
  getNPCSpellSlots,
  calculateNPCSpellAttack,
  calculateNPCSpellDC,
  getNPCSpellcastingAbilityScore,
  getProficiencyBonusFromCR,
} from '@/utils/npcSpellcasting';

function buildPerDayMap(spells: Spell[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const spell of spells) {
    if (spell.freeCastMax && spell.freeCastMax > 0) {
      const key = String(spell.freeCastMax);
      if (!map[key]) map[key] = [];
      map[key].push(spell.name);
    }
  }
  return map;
}

function buildSlotMap(
  slots: Record<number, number>,
  slotsUsed: Record<number, number>
): Record<string, { max: number; used: number }> {
  const map: Record<string, { max: number; used: number }> = {};
  for (const [level, max] of Object.entries(slots)) {
    if (max > 0) {
      map[String(level)] = { max, used: slotsUsed[Number(level)] ?? 0 };
    }
  }
  return map;
}

function buildUsedSpellsMap(spells: Spell[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const spell of spells) {
    if (spell.freeCastMax && spell.freeCastMax > 0 && spell.freeCastsUsed) {
      map[spell.name] = spell.freeCastsUsed;
    }
  }
  return map;
}

export function buildNpcSpellcasting(npc: CampaignNPC):
  | {
      ability: string;
      dc: number;
      toHit: number;
      atWill: string[];
      perDay: Record<string, string[]>;
      slots: Record<string, { max: number; used: number }>;
      usedSpells: Record<string, number>;
    }
  | undefined {
  if (!npc.spellcasting) return undefined;
  const sc = npc.spellcasting;
  const abilityScores = npc.monsterStatBlock ?? npc.abilityScores;
  const abilityScore = abilityScores
    ? getNPCSpellcastingAbilityScore(
        sc.ability,
        abilityScores as Parameters<typeof getNPCSpellcastingAbilityScore>[1]
      )
    : 10;
  const profBonus = npc.monsterStatBlock
    ? getProficiencyBonusFromCR(npc.monsterStatBlock.cr)
    : (npc.proficiencyBonus ?? 2);
  const slots = getNPCSpellSlots(sc.casterLevel, sc.slotOverrides);
  return {
    ability: sc.ability,
    dc: calculateNPCSpellDC(sc, abilityScore, profBonus),
    toHit: calculateNPCSpellAttack(sc, abilityScore, profBonus),
    atWill: sc.spells.filter(s => s.freeCastMax === 0).map(s => s.name),
    perDay: buildPerDayMap(sc.spells),
    slots: buildSlotMap(slots, sc.slotsUsed),
    usedSpells: buildUsedSpellsMap(sc.spells),
  };
}
