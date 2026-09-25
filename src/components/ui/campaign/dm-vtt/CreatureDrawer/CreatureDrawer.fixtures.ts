import type { EncounterEntity, MonsterStatBlock } from '@/types/encounter';

/**
 * Synthetic creature fixtures shared by the drawer's stories and its parity
 * test. Test/story-only — nothing in the app imports this module.
 */

export function makeCreatureStatBlock(
  overrides: Partial<MonsterStatBlock> = {}
): MonsterStatBlock {
  return {
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10,
    saves: '',
    skills: '',
    speed: '30 ft.',
    resistances: '',
    immunities: '',
    vulnerabilities: '',
    conditionImmunities: [],
    senses: '',
    passivePerception: 10,
    traits: [],
    actions: [],
    reactions: [],
    bonusActions: [],
    lairActions: [],
    cr: '1',
    type: 'humanoid',
    size: 'Medium',
    languages: '',
    alignment: 'neutral',
    hpFormula: '',
    ...overrides,
  };
}

/**
 * Library NPC with every drawer feature: save override, detail rows,
 * legendary + lair actions, pip and pool resources, a tracked entry, an
 * inventory-cost entry, a resource-cost entry, spellcasting, hit dice, a
 * timed stacked condition plus an untimed one, concentration, temp HP, and
 * death saves at 0 HP.
 */
export const FULL_CREATURE: EncounterEntity = {
  id: 'vex-1',
  type: 'npc',
  name: 'Captain Vex',
  npcSourceId: 'npc-vex',
  initiative: 17,
  initiativeModifier: 3,
  proficiencyBonus: 3,
  currentHp: 0,
  maxHp: 45,
  tempHp: 5,
  armorClass: 16,
  tempAc: 2,
  concentrationSpell: 'Hold Person',
  hasUsedReaction: false,
  deathSaves: { successes: 0, failures: 0, isStabilized: false },
  hitDice: { current: 3, max: 6, dieType: 'd8' },
  conditions: [
    {
      id: 'cond-poison',
      name: 'Poisoned',
      kind: 'debuff',
      source: 'dm',
      rounds: 3,
      stackCount: 2,
    },
    { id: 'cond-ward', name: 'Warded', kind: 'buff', rounds: null },
  ],
  monsterStatBlock: makeCreatureStatBlock({
    str: 14,
    dex: 16,
    con: 14,
    int: 12,
    wis: 13,
    cha: 15,
    saves: 'Dex +6',
    skills: 'Deception +5, Perception +4',
    resistances: 'Cold',
    immunities: 'Poison',
    vulnerabilities: 'Radiant',
    conditionImmunities: ['Charmed'],
    senses: 'Darkvision 60 ft.',
    languages: 'Common, Thieves Cant',
    passivePerception: 14,
    cr: '5',
    size: 'Medium',
    type: 'humanoid',
    alignment: 'lawful evil',
    hpFormula: '10d8',
    traits: [{ id: 'tr-cunning', name: 'Cunning', text: 'Always wary.' }],
    actions: [
      { id: 'act-volley', name: 'Volley', text: 'Rains arrows.' },
      {
        id: 'act-potion',
        name: 'Quaff Potion',
        text: 'Drinks a potion.',
        inventoryCost: { inventoryItemId: 'inv-potion', quantity: 1 },
      },
      {
        id: 'act-surge',
        name: 'Battle Surge',
        text: 'Fights harder.',
        resourceCost: { resourceId: 'res-pool', amount: 1 },
      },
    ],
  }),
  abilities: [
    {
      id: 'act-volley',
      name: 'Volley',
      description: 'Rains arrows.',
      usageType: 'per-day',
      maxUses: 2,
      usedUses: 1,
    },
  ],
  inventory: [{ id: 'inv-potion', name: 'Healing Potion', quantity: 2 }],
  resources: [
    {
      id: 'res-pips',
      name: 'Rally',
      icon: 'sparkles',
      color: 'amber',
      displayStyle: 'pips',
      maxUses: 2,
      usesExpended: 0,
      shortRestReset: 'all',
    },
    {
      id: 'res-pool',
      name: 'Grit',
      icon: 'flame',
      color: 'red',
      displayStyle: 'pool',
      maxUses: 4,
      usesExpended: 1,
      shortRestReset: 0,
    },
  ],
  legendaryActions: {
    maxActions: 3,
    usedActions: 0,
    actions: [
      { id: 'leg-dash', name: 'Quick Step', cost: 1, description: 'Moves.' },
    ],
  },
  lairActions: [
    {
      id: 'lair-smoke',
      name: 'Smoke Bomb',
      description: 'Smoke fills the hideout.',
      usedThisRound: false,
    },
  ],
  spellcasting: {
    ability: 'Charisma',
    dc: 13,
    toHit: 5,
    atWill: ['minor illusion'],
    perDay: { '1': ['hold person'] },
    usedSpells: {},
  },
};

/** Same creature, standing (HP > 0 and below max) so Spend Hit Die shows. */
export const FULL_CREATURE_STANDING: EncounterEntity = {
  ...FULL_CREATURE,
  currentHp: 20,
  deathSaves: undefined,
};

export const LEGENDARY_MONSTER: EncounterEntity = {
  id: 'dragon-1',
  type: 'monster',
  name: 'Young Red Dragon',
  monsterSourceId: 'young-red-dragon',
  initiative: 14,
  initiativeModifier: 0,
  proficiencyBonus: 4,
  currentHp: 140,
  maxHp: 178,
  tempHp: 0,
  armorClass: 18,
  conditions: [
    { id: 'c-fright', name: 'Frightened', kind: 'debuff', rounds: 2 },
  ],
  monsterStatBlock: makeCreatureStatBlock({
    str: 23,
    dex: 10,
    con: 21,
    int: 14,
    wis: 11,
    cha: 19,
    saves: 'Dex +4, Con +9, Wis +4, Cha +8',
    skills: 'Perception +8, Stealth +4',
    speed: '40 ft., climb 40 ft., fly 80 ft.',
    immunities: 'Fire',
    senses: 'Blindsight 30 ft., Darkvision 120 ft.',
    languages: 'Common, Draconic',
    passivePerception: 18,
    cr: '10',
    size: 'Large',
    type: 'dragon',
    alignment: 'chaotic evil',
    hpFormula: '17d10+85',
    actions: [
      {
        id: 'bite',
        name: 'Bite',
        text: 'Melee Weapon Attack: +10 to hit, reach 10 ft. Hit: 17 (2d10 + 6) piercing damage.',
      },
      {
        id: 'breath',
        name: 'Fire Breath (Recharge 5-6)',
        text: 'Exhales fire.',
      },
    ],
  }),
  abilities: [
    {
      id: 'breath',
      name: 'Fire Breath',
      description: 'Exhales fire.',
      usageType: 'recharge',
      rechargeOn: 5,
      maxUses: 1,
      usedUses: 0,
    },
  ],
  legendaryActions: {
    maxActions: 3,
    usedActions: 1,
    actions: [
      {
        id: 'detect',
        name: 'Detect',
        cost: 1,
        description: 'Perception check.',
      },
      { id: 'tail', name: 'Tail Attack', cost: 1, description: 'Tail swipe.' },
      {
        id: 'wing',
        name: 'Wing Attack',
        cost: 2,
        description: 'Knocks prone.',
      },
    ],
  },
};

export const GOBLIN: EncounterEntity = {
  id: 'goblin-1',
  type: 'monster',
  name: 'Goblin',
  monsterSourceId: 'goblin',
  initiative: 12,
  initiativeModifier: 2,
  currentHp: 5,
  maxHp: 7,
  tempHp: 0,
  armorClass: 15,
  conditions: [],
  monsterStatBlock: makeCreatureStatBlock({
    str: 8,
    dex: 14,
    skills: 'Stealth +6',
    senses: 'Darkvision 60 ft.',
    languages: 'Common, Goblin',
    passivePerception: 9,
    cr: '1/4',
    size: 'Small',
    type: 'humanoid (goblinoid)',
    alignment: 'neutral evil',
    hpFormula: '2d6',
    actions: [
      {
        id: 'scimitar',
        name: 'Scimitar',
        text: 'Melee Weapon Attack: +4 to hit, reach 5 ft. Hit: 5 (1d6 + 2) slashing damage.',
      },
    ],
  }),
};

export const LAIR: EncounterEntity = {
  id: 'lair-1',
  type: 'lair',
  name: "Dragon's Lair",
  initiative: 20,
  initiativeModifier: 0,
  currentHp: 0,
  maxHp: 0,
  tempHp: 0,
  armorClass: 0,
  conditions: [],
  lairActions: [
    {
      id: 'magma',
      name: 'Magma Eruption',
      description: 'Magma erupts from a point on the ground.',
      usedThisRound: false,
    },
    {
      id: 'tremor',
      name: 'Tremor',
      description: 'The ground shakes.',
      usedThisRound: true,
    },
  ],
  regionalEffects: ['Water sources within 6 miles are supernaturally warm.'],
};

export const SUMMON: EncounterEntity = {
  id: 'wolf-1',
  type: 'monster',
  name: 'Spirit Wolf',
  summonId: 'summon-1',
  summonOwnerId: 'player-1',
  initiative: 11,
  initiativeModifier: 2,
  currentHp: 11,
  maxHp: 11,
  tempHp: 0,
  armorClass: 13,
  conditions: [],
  monsterStatBlock: makeCreatureStatBlock({
    dex: 15,
    speed: '40 ft.',
    cr: '1/4',
    type: 'beast',
    alignment: 'unaligned',
    actions: [{ id: 'bite', name: 'Bite', text: 'Knocks the target prone.' }],
  }),
};
