import {
  CampaignData,
  CampaignPlayerData,
  CampaignInfo,
} from '@/types/campaign';
import { CharacterState } from '@/types/character';
import { ProcessedMonster } from '@/types/bestiary';
import {
  EncounterEntity,
  Encounter,
  EncounterCondition,
} from '@/types/encounter';

export function createMockCharacterState(
  overrides: Partial<CharacterState> = {}
): CharacterState {
  return {
    id: 'char-1',
    name: 'Test Hero',
    race: 'Human',
    class: { name: 'Fighter', subclass: '', hitDie: 'd10', spellcasting: null },
    level: 5,
    experience: 6500,
    background: 'Soldier',
    alignment: 'Neutral Good',
    playerName: 'Test Player',
    abilities: {
      strength: { score: 16, modifier: 3, saveProficiency: true },
      dexterity: { score: 14, modifier: 2, saveProficiency: false },
      constitution: { score: 14, modifier: 2, saveProficiency: true },
      intelligence: { score: 10, modifier: 0, saveProficiency: false },
      wisdom: { score: 12, modifier: 1, saveProficiency: false },
      charisma: { score: 8, modifier: -1, saveProficiency: false },
    },
    skills: {
      acrobatics: { proficiency: 'none', bonus: 0 },
      animalHandling: { proficiency: 'none', bonus: 0 },
      arcana: { proficiency: 'none', bonus: 0 },
      athletics: { proficiency: 'proficient', bonus: 0 },
      deception: { proficiency: 'none', bonus: 0 },
      history: { proficiency: 'none', bonus: 0 },
      insight: { proficiency: 'none', bonus: 0 },
      intimidation: { proficiency: 'proficient', bonus: 0 },
      investigation: { proficiency: 'none', bonus: 0 },
      medicine: { proficiency: 'none', bonus: 0 },
      nature: { proficiency: 'none', bonus: 0 },
      perception: { proficiency: 'proficient', bonus: 0 },
      performance: { proficiency: 'none', bonus: 0 },
      persuasion: { proficiency: 'none', bonus: 0 },
      religion: { proficiency: 'none', bonus: 0 },
      sleightOfHand: { proficiency: 'none', bonus: 0 },
      stealth: { proficiency: 'none', bonus: 0 },
      survival: { proficiency: 'proficient', bonus: 0 },
    },
    hitPoints: { current: 44, max: 44, temp: 0 },
    armorClass: 18,
    tempArmorClass: 0,
    isTempACActive: false,
    isWearingShield: true,
    shieldBonus: 2,
    initiative: { bonus: 2, advantage: false },
    reaction: { used: false },
    speed: 30,
    hitDice: '5d10',
    savingThrows: {
      strength: true,
      dexterity: false,
      constitution: true,
      intelligence: false,
      wisdom: false,
      charisma: false,
    },
    proficiencyBonus: 3,
    inspiration: false,
    ...overrides,
  } as CharacterState;
}

export function createMockCampaignData(
  overrides: Partial<CampaignData> = {}
): CampaignData {
  return {
    dmId: 'dm-test-123',
    campaignName: 'Test Campaign',
    createdAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function createMockPlayerData(
  overrides: Partial<CampaignPlayerData> = {}
): CampaignPlayerData {
  return {
    playerId: 'player-1',
    playerName: 'Test Player',
    characterId: 'char-1',
    characterName: 'Test Hero',
    characterData: createMockCharacterState(),
    lastSynced: '2025-01-01T12:00:00.000Z',
    ...overrides,
  };
}

export function createMockCampaignInfo(
  overrides: Partial<CampaignInfo> = {}
): CampaignInfo {
  return {
    code: 'ABC123',
    name: 'Test Campaign',
    createdAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function createNextRequest(
  url: string,
  options: { method?: string; body?: unknown } = {}
): Request {
  const init: RequestInit = {
    method: options.method ?? 'GET',
  };
  if (options.body) {
    init.body = JSON.stringify(options.body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  return new Request(`http://localhost${url}`, init);
}

export function createRouteParams<T extends Record<string, string>>(params: T) {
  return { params: Promise.resolve(params) };
}

export function createMockProcessedMonster(
  overrides: Partial<ProcessedMonster> = {}
): ProcessedMonster {
  return {
    id: 'adult-red-dragon',
    name: 'Adult Red Dragon',
    size: ['Large'],
    type: 'Dragon',
    alignment: 'Chaotic Evil',
    ac: '19 (natural armor)',
    hp: '256 (19d12+133)',
    speed: '40 ft., climb 40 ft., fly 80 ft.',
    str: 27,
    dex: 10,
    con: 25,
    int: 16,
    wis: 13,
    cha: 21,
    saves: 'Dex +6, Con +13, Wis +7, Cha +11',
    skills: 'Perception +13, Stealth +6',
    resistances: '',
    immunities: 'fire',
    vulnerabilities: '',
    senses: 'blindsight 60 ft., darkvision 120 ft.',
    passivePerception: 23,
    languages: 'Common, Draconic',
    cr: '17',
    traits: [
      {
        name: 'Legendary Resistance (3/Day)',
        text: 'If the dragon fails a saving throw, it can choose to succeed instead.',
      },
    ],
    actions: [
      { name: 'Multiattack', text: 'The dragon makes three attacks.' },
      {
        name: 'Fire Breath {@recharge 5}',
        text: 'The dragon exhales fire in a 60-foot cone.',
      },
    ],
    reactions: [
      {
        name: 'Tail Attack',
        text: 'The dragon makes a tail attack.',
      },
    ],
    legendaryActions: [
      { name: 'Detect', text: 'The dragon makes a Wisdom (Perception) check.' },
      { name: 'Tail Attack', text: 'The dragon makes a tail attack.' },
      {
        name: 'Wing Attack (Costs 2 Actions)',
        text: 'The dragon beats its wings.',
      },
    ],
    source: 'MM',
    page: 98,
    acValue: 19,
    hpAverage: 256,
    hpFormula: '19d12+133',
    legendaryActionCount: 3,
    conditionImmunities: [],
    ...overrides,
  };
}

export function createMockEncounterEntity(
  overrides: Partial<EncounterEntity> = {}
): EncounterEntity {
  return {
    id: 'entity-1',
    type: 'monster',
    name: 'Goblin',
    initiative: null,
    initiativeModifier: 2,
    currentHp: 7,
    maxHp: 7,
    tempHp: 0,
    armorClass: 15,
    conditions: [],
    isHidden: false,
    ...overrides,
  };
}

export function createMockEncounter(
  overrides: Partial<Encounter> = {}
): Encounter {
  return {
    id: 'enc-1',
    name: 'Test Encounter',
    entities: [],
    currentTurn: 0,
    round: 0,
    isActive: false,
    sortOrder: 'initiative',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function createMockCondition(
  overrides: Partial<EncounterCondition> = {}
): EncounterCondition {
  return {
    id: 'cond-1',
    name: 'Poisoned',
    source: 'dm',
    ...overrides,
  };
}
