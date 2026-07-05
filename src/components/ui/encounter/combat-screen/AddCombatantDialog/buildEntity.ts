import type {
  EncounterEntity,
  CampaignNPC,
  PlayerDisposition,
} from '@/types/encounter';
import type { ProcessedMonster } from '@/types/bestiary';
import type { Spell } from '@/types/character';
import {
  monsterToEncounterEntity,
  buildAbilitiesFromStatBlock,
} from '@/utils/encounterConverter';
import {
  getNPCSpellSlots,
  calculateNPCSpellAttack,
  calculateNPCSpellDC,
  getNPCSpellcastingAbilityScore,
  getProficiencyBonusFromCR,
} from '@/utils/npcSpellcasting';

export const GROUP_COLORS = [
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
];

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

export interface CampaignPlayer {
  id: string;
  name: string;
  class: string;
  level: number;
  armorClass: number;
  currentHp: number;
  maxHp: number;
  dexterity: number;
}

export function buildPlayerEntity(
  player: CampaignPlayer,
  campaignCode?: string,
  playerColors?: Record<string, string>
): Omit<EncounterEntity, 'id'> {
  return {
    type: 'player',
    name: player.name,
    initiative: null,
    initiativeModifier: Math.floor((player.dexterity - 10) / 2),
    currentHp: player.currentHp,
    maxHp: player.maxHp,
    tempHp: 0,
    armorClass: player.armorClass,
    conditions: [],
    playerCharacterId: player.id,
    campaignCode,
    isHidden: false,
    color: playerColors?.[player.id],
  };
}

export interface NpcBuildOpts {
  isHidden: boolean;
  playerAlias?: string;
  playerDisposition: PlayerDisposition;
  campaignCode?: string;
}

export function buildNpcEntity(
  npc: CampaignNPC,
  opts: NpcBuildOpts
): Omit<EncounterEntity, 'id'> {
  const abilities = npc.monsterStatBlock
    ? buildAbilitiesFromStatBlock(npc.monsterStatBlock)
    : [];

  return {
    type: 'npc',
    name: npc.name,
    initiative: null,
    initiativeModifier:
      npc.initiativeModifier != null
        ? npc.initiativeModifier
        : npc.monsterStatBlock
          ? Math.floor((npc.monsterStatBlock.dex - 10) / 2)
          : npc.abilityScores
            ? Math.floor((npc.abilityScores.dex - 10) / 2)
            : 0,
    currentHp: npc.currentHp ?? npc.maxHp,
    maxHp: npc.maxHp,
    tempHp: 0,
    armorClass: npc.armorClass,
    conditions: [],
    isHidden: opts.isHidden,
    playerAlias: opts.playerAlias,
    playerDisposition: opts.playerDisposition,
    monsterStatBlock: npc.monsterStatBlock,
    abilities,
    hitDice: npc.hitDice ? { ...npc.hitDice } : undefined,
    npcSourceId: npc.id,
    campaignCode: opts.campaignCode,
    spellcasting: npc.spellcasting
      ? (() => {
          const abilityScores = npc.monsterStatBlock ?? npc.abilityScores;
          const abilityScore = abilityScores
            ? getNPCSpellcastingAbilityScore(
                npc.spellcasting!.ability,
                abilityScores as Parameters<
                  typeof getNPCSpellcastingAbilityScore
                >[1]
              )
            : 10;
          const profBonus = npc.monsterStatBlock
            ? getProficiencyBonusFromCR(npc.monsterStatBlock.cr)
            : (npc.proficiencyBonus ?? 2);
          const slots = getNPCSpellSlots(
            npc.spellcasting!.casterLevel,
            npc.spellcasting!.slotOverrides
          );
          return {
            ability: npc.spellcasting!.ability,
            dc: calculateNPCSpellDC(npc.spellcasting!, abilityScore, profBonus),
            toHit: calculateNPCSpellAttack(
              npc.spellcasting!,
              abilityScore,
              profBonus
            ),
            atWill: npc
              .spellcasting!.spells.filter(s => s.freeCastMax === 0)
              .map(s => s.name),
            perDay: buildPerDayMap(npc.spellcasting!.spells),
            slots: buildSlotMap(slots, npc.spellcasting!.slotsUsed),
            usedSpells: buildUsedSpellsMap(npc.spellcasting!.spells),
          };
        })()
      : undefined,
  };
}

export interface MonsterBuildOpts {
  count: number;
  hpOverride: number;
  acOverride: number;
  isHidden: boolean;
  playerAlias?: string;
  playerDisposition: PlayerDisposition;
  colorIdx: number;
}

export function buildMonsterEntities(
  monster: ProcessedMonster,
  opts: MonsterBuildOpts
): Array<Omit<EncounterEntity, 'id'>> {
  const color = GROUP_COLORS[opts.colorIdx % GROUP_COLORS.length];
  const hpOverride =
    opts.hpOverride !== monster.hpAverage ? opts.hpOverride : undefined;
  const acOverride =
    opts.acOverride !== monster.acValue ? opts.acOverride : undefined;
  const aliasValue = opts.playerAlias?.trim() || undefined;

  return Array.from({ length: opts.count }, (_, i) => {
    const suffix = opts.count > 1 ? ` ${String.fromCharCode(65 + i)}` : '';
    const entity = monsterToEncounterEntity(monster, {
      nameOverride: `${monster.name}${suffix}`,
      color,
      hpOverride,
      acOverride,
    });
    return {
      ...entity,
      isHidden: opts.isHidden,
      playerAlias: aliasValue,
      playerDisposition: opts.playerDisposition,
    };
  });
}

export interface CustomBuildOpts {
  name: string;
  type: 'npc' | 'monster';
  hp: number;
  ac: number;
  initMod: number;
  isHidden: boolean;
  playerAlias?: string;
  playerDisposition: PlayerDisposition;
}

export function buildCustomEntity(
  opts: CustomBuildOpts
): Omit<EncounterEntity, 'id'> {
  return {
    type: opts.type,
    name: opts.name.trim(),
    initiative: null,
    initiativeModifier: opts.initMod,
    currentHp: opts.hp || 1,
    maxHp: opts.hp || 1,
    tempHp: 0,
    armorClass: opts.ac,
    conditions: [],
    isHidden: opts.isHidden,
    playerAlias: opts.playerAlias?.trim() || undefined,
    playerDisposition: opts.playerDisposition,
  };
}
