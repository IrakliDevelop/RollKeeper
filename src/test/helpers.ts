import {
  CampaignData,
  CampaignPlayerData,
  CampaignInfo,
} from '@/types/campaign';
import { CharacterState } from '@/types/character';

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
