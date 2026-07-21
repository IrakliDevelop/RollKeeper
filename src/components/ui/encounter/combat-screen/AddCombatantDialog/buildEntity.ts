import type {
  EncounterEntity,
  CampaignNPC,
  PlayerDisposition,
  MonsterStatBlock,
} from '@/types/encounter';
import type { ProcessedMonster } from '@/types/bestiary';
import {
  monsterToEncounterEntity,
  buildAbilitiesFromStatBlock,
} from '@/utils/encounterConverter';
import { buildNpcSpellcasting } from './buildNpcSpellcasting';

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
    proficiencyBonus: npc.proficiencyBonus,
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
    spellcasting: buildNpcSpellcasting(npc),
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
  statBlockOverride?: MonsterStatBlock;
  initiativeModifierOverride?: number;
  proficiencyBonusOverride?: number;
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
      statBlockOverride: opts.statBlockOverride,
      initiativeModifierOverride: opts.initiativeModifierOverride,
      proficiencyBonusOverride: opts.proficiencyBonusOverride,
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
