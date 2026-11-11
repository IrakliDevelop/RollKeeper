import type { Spell } from '@/types/character';
import type { ProcessedMonster } from '@/types/bestiary';
import type { CampaignNPC, NpcResource } from '@/types/encounter';

/** Bestiary entry with a listed passive Perception (15) that differs from the derived 9. */
export const GOBLIN: ProcessedMonster = {
  id: 'mon-goblin',
  name: 'Goblin',
  size: ['S'],
  type: 'humanoid',
  alignment: 'neutral evil',
  ac: '15',
  hp: '7 (2d6)',
  speed: '30 ft.',
  str: 8,
  dex: 14,
  con: 10,
  int: 10,
  wis: 8,
  cha: 8,
  saves: '',
  skills: '',
  resistances: '',
  immunities: '',
  vulnerabilities: '',
  senses: '',
  passivePerception: 15,
  languages: '',
  cr: '1/4',
  source: 'MM',
  page: 166,
  acValue: 15,
  hpAverage: 7,
  hpFormula: '2d6',
  legendaryActionCount: 0,
  conditionImmunities: [],
};

export const KI: NpcResource = {
  id: 'res-ki',
  name: 'Ki',
  icon: 'hand-fist',
  color: 'amber',
  displayStyle: 'pips',
  maxUses: 3,
  usesExpended: 1,
  shortRestReset: 'all',
};

const META = {
  id: 'npc-fixture',
  campaignCode: 'CAMP01',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

/**
 * Canonical: equals what the form's payload builder writes for it, so an edit
 * with no changes round-trips to the same record.
 */
export const STAT_BLOCK_NPC: CampaignNPC = {
  ...META,
  name: 'Brother Oren',
  armorClass: '16 (monk)',
  maxHp: 33,
  xp: 200,
  speed: '40 ft.',
  group: 'Temple',
  tags: ['monk'],
  loreHtml: '<p>Old friend</p>',
  hitDice: { max: 4, current: 3, dieType: 'd10' },
  initiativeModifier: 3,
  proficiencyBonus: 2,
  passivePerception: 13,
  passiveInsight: 11,
  passiveInvestigation: 10,
  inventory: [{ id: 'inv-beads', name: 'Prayer beads', quantity: 1 }],
  resources: [KI],
  monsterStatBlock: {
    str: 10,
    dex: 16,
    con: 14,
    int: 10,
    wis: 14,
    cha: 11,
    saves: 'Dex +5',
    skills: 'Perception +3',
    speed: '40 ft.',
    resistances: 'cold',
    immunities: '',
    vulnerabilities: '',
    conditionImmunities: [],
    senses: 'Darkvision 30 ft.',
    passivePerception: 13,
    traits: [
      { id: 'trait-evasion', name: 'Evasion', text: 'Dodges area damage.' },
    ],
    actions: [
      {
        id: 'action-flurry',
        name: 'Flurry of Blows',
        text: 'Two quick strikes.',
        resourceCost: { resourceId: 'res-ki', amount: 1 },
      },
    ],
    reactions: [],
    bonusActions: [],
    lairActions: [],
    cr: '2',
    type: 'Humanoid',
    size: 'Medium',
    languages: 'Common',
    alignment: 'Lawful Good',
    hpFormula: '6d8+6',
  },
};

/** STAT_BLOCK_NPC plus an entry that spends an inventory stack and a custom inflicted condition. */
export const STAT_BLOCK_FULL_NPC: CampaignNPC = {
  ...STAT_BLOCK_NPC,
  monsterStatBlock: {
    ...STAT_BLOCK_NPC.monsterStatBlock!,
    actions: [
      ...STAT_BLOCK_NPC.monsterStatBlock!.actions,
      {
        id: 'action-bead-toss',
        name: 'Bead Toss',
        text: 'Hurls a blessed bead.',
        inventoryCost: { inventoryItemId: 'inv-beads', quantity: 1 },
      },
    ],
    inflictableConditions: [
      {
        id: 'cond-shaken',
        name: 'Shaken',
        description: 'Disadvantage on attack rolls while it can see Oren.',
        icon: 'skull',
        kind: 'debuff',
        origin: 'custom',
      },
    ],
  },
};

const ONE_SPELL: Spell = {
  id: 'spell-bless',
  name: 'Bless',
  level: 1,
  school: 'Enchantment',
  castingTime: '1 action',
  range: '30 feet',
  components: { verbal: true, somatic: true, material: false },
  duration: 'Concentration, up to 1 minute',
  description: 'Up to three creatures add a d4 to attacks and saves.',
  concentration: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export const CASTER_NPC: CampaignNPC = {
  ...STAT_BLOCK_NPC,
  spellcasting: {
    casterLevel: 5,
    ability: 'wisdom',
    spellAttackBonus: 7,
    slotOverrides: { 1: 2, 3: 0 },
    slotsUsed: { 1: 1 },
    spells: [ONE_SPELL],
  },
};

export const QUICK_NPC_WITH_SCORES: CampaignNPC = {
  ...META,
  name: 'Quick Acolyte',
  armorClass: '12',
  maxHp: 18,
  speed: '30 ft.',
  abilityScores: { str: 12, dex: 14, con: 12, int: 10, wis: 16, cha: 11 },
  resources: [KI],
  hitDice: { max: 3, current: 2, dieType: 'd8' },
  proficiencyBonus: 3,
  passivePerception: 14,
};

export const QUICK_NPC_BARE: CampaignNPC = {
  ...QUICK_NPC_WITH_SCORES,
  name: 'Quick Bystander',
  abilityScores: undefined,
};

export function withoutMeta(
  npc: CampaignNPC
): Omit<CampaignNPC, 'id' | 'campaignCode' | 'createdAt' | 'updatedAt'> {
  const rest = { ...npc } as Partial<CampaignNPC>;
  delete rest.id;
  delete rest.campaignCode;
  delete rest.createdAt;
  delete rest.updatedAt;
  return rest as Omit<
    CampaignNPC,
    'id' | 'campaignCode' | 'createdAt' | 'updatedAt'
  >;
}
