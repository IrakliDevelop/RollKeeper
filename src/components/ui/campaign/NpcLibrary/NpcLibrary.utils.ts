import { parseAcBonus } from '@/utils/calculations';

import type { CampaignCreatureKind, CampaignNPC } from '@/types/encounter';

export interface LibraryCopy {
  heading: string;
  createLabel: string;
  emptyHeading: string;
  emptyBody: string;
  searchLabel: string;
  searchPlaceholder: string;
  noMatch: string;
  moveLabel: (name: string) => string;
  deleteMessage: (name: string) => string;
  deleteConfirm: string;
  formLabel: string;
  editLabel: string;
  sheetLabel: string;
}

export const LIBRARY_COPY: Record<CampaignCreatureKind, LibraryCopy> = {
  npc: {
    heading: 'NPCs',
    createLabel: 'Create NPC',
    emptyHeading: 'No NPCs yet',
    emptyBody: 'NPCs you create here can join any encounter in this campaign.',
    searchLabel: 'Search NPCs',
    searchPlaceholder: 'Brenn',
    noMatch: 'No NPCs match these filters.',
    moveLabel: name => `Move ${name} to custom monsters`,
    deleteMessage: name =>
      `${name} is removed from this campaign's NPCs. Encounters that already include them keep their copy.`,
    deleteConfirm: 'Delete NPC',
    formLabel: 'NPC form',
    editLabel: 'Edit NPC',
    sheetLabel: 'NPC sheet',
  },
  monster: {
    heading: 'Custom monsters',
    createLabel: 'Create custom monster',
    emptyHeading: 'No custom monsters yet',
    emptyBody:
      'Custom monsters you create here can join any encounter in this campaign.',
    searchLabel: 'Search custom monsters',
    searchPlaceholder: 'Dire wolf',
    noMatch: 'No custom monsters match these filters.',
    moveLabel: name => `Move ${name} to NPCs`,
    deleteMessage: name =>
      `${name} is removed from this campaign's custom monsters. Encounters that already include them keep their copy.`,
    deleteConfirm: 'Delete custom monster',
    formLabel: 'Custom monster form',
    editLabel: 'Edit custom monster',
    sheetLabel: 'Custom monster sheet',
  },
};

/** "Medium humanoid · CR 2 · Caster level 5"; empty when nothing is set. */
export const creatureMetaLine = (npc: CampaignNPC): string => {
  const statBlock = npc.monsterStatBlock;
  const parts = [
    [statBlock?.size, statBlock?.type].filter(Boolean).join(' '),
    statBlock?.cr ? `CR ${statBlock.cr}` : '',
    npc.spellcasting ? `Caster level ${npc.spellcasting.casterLevel}` : '',
  ];
  return parts.filter(Boolean).join(' · ');
};

export type CreatureVitalPart = { label: 'AC' | 'Speed'; value: string };

/** AC and speed as stored, as label/value pairs; free-text values are printed unchanged. */
export const creatureVitalParts = (npc: CampaignNPC): CreatureVitalPart[] => {
  const tempAc = parseAcBonus(npc.tempAc);
  const parts: CreatureVitalPart[] = [
    {
      label: 'AC',
      value: `${npc.armorClass}${
        tempAc !== 0 ? ` (${tempAc > 0 ? '+' : ''}${tempAc})` : ''
      }`,
    },
  ];
  if (npc.speed?.trim()) parts.push({ label: 'Speed', value: npc.speed });
  return parts;
};

/** AC, HP and speed as stored; free-text values are printed unchanged. */
export const creatureVitals = (npc: CampaignNPC): string[] => {
  const [ac, ...rest] = creatureVitalParts(npc);
  return [
    `AC ${ac.value}`,
    `${npc.maxHp} HP`,
    ...rest.map(part => `${part.label} ${part.value}`),
  ];
};

export type CreaturePassive = {
  label: 'Perception' | 'Insight' | 'Investigation';
  value: number;
};

/** The passive scores that are set, in Perception, Insight, Investigation order. */
export const creaturePassives = (npc: CampaignNPC): CreaturePassive[] => {
  const scores: Array<[CreaturePassive['label'], number | undefined]> = [
    ['Perception', npc.passivePerception],
    ['Insight', npc.passiveInsight],
    ['Investigation', npc.passiveInvestigation],
  ];
  return scores.flatMap(([label, value]) =>
    value == null ? [] : [{ label, value }]
  );
};
