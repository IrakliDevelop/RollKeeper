import { CharacterState, SkillProficiency } from '@/types/character';

const defaultSkill: SkillProficiency = {
  proficient: false,
  expertise: false,
};

const proficientSkill: SkillProficiency = {
  proficient: true,
  expertise: false,
};

export function makeCharacter(
  overrides: Partial<CharacterState> = {}
): CharacterState {
  return {
    id: 'test-char-1',
    name: 'Test Hero',
    race: 'Human',
    class: {
      name: 'Fighter',
      isCustom: false,
      spellcaster: 'none',
      hitDie: 10,
    },
    level: 5,
    totalLevel: 5,
    experience: 6500,
    background: 'Soldier',
    alignment: 'Neutral Good',
    creatureType: 'Humanoid',
    playerName: 'Tester',
    abilities: {
      strength: 16,
      dexterity: 14,
      constitution: 14,
      intelligence: 10,
      wisdom: 12,
      charisma: 8,
    },
    skills: {
      acrobatics: { ...defaultSkill },
      animalHandling: { ...defaultSkill },
      arcana: { ...defaultSkill },
      athletics: { ...proficientSkill },
      deception: { ...defaultSkill },
      history: { ...defaultSkill },
      insight: { ...defaultSkill },
      intimidation: { ...proficientSkill },
      investigation: { ...defaultSkill },
      medicine: { ...defaultSkill },
      nature: { ...defaultSkill },
      perception: { ...proficientSkill },
      performance: { ...defaultSkill },
      persuasion: { ...defaultSkill },
      religion: { ...defaultSkill },
      sleightOfHand: { ...defaultSkill },
      stealth: { ...defaultSkill },
      survival: { ...proficientSkill },
    },
    savingThrows: {
      strength: { proficient: true },
      dexterity: { proficient: false },
      constitution: { proficient: true },
      intelligence: { proficient: false },
      wisdom: { proficient: false },
      charisma: { proficient: false },
    },
    hitPoints: {
      current: 44,
      max: 44,
      temporary: 0,
      calculationMode: 'auto' as const,
    },
    armorClass: 16,
    tempArmorClass: 0,
    isTempACActive: false,
    isWearingShield: false,
    shieldBonus: 2,
    initiative: { value: 2, isOverridden: false },
    reaction: { hasUsedReaction: false },
    speed: 30,
    hitDice: '5d10',
    spellSlots: {
      1: { max: 0, used: 0 },
      2: { max: 0, used: 0 },
      3: { max: 0, used: 0 },
      4: { max: 0, used: 0 },
      5: { max: 0, used: 0 },
      6: { max: 0, used: 0 },
      7: { max: 0, used: 0 },
      8: { max: 0, used: 0 },
      9: { max: 0, used: 0 },
    },
    heroicInspiration: { count: 0, maxCount: 1 },
    trackableTraits: [],
    extendedFeatures: [],
    favoriteFeatureIds: [],
    features: [],
    traits: [],
    notes: [],
    characterBackground: {
      backstory: '',
      personality: '',
      ideals: '',
      bonds: '',
      flaws: '',
    },
    weapons: [],
    magicItems: [],
    armorItems: [],
    inventoryItems: [],
    currency: { gold: 0, silver: 0, copper: 0, electrum: 0, platinum: 0 },
    attunementSlots: { max: 3, used: 0 },
    weaponProficiencies: {
      simpleWeapons: true,
      martialWeapons: true,
      specificWeapons: [],
    },
    spells: [],
    spellcastingStats: {
      spellcastingAbility: 'intelligence',
      isAbilityOverridden: false,
    },
    concentration: { isConcentrating: false },
    deathSavingThrows: { successes: 0, failures: 0, isStabilized: false },
    spellbook: {
      knownSpellIds: [],
      preparedSpellIds: [],
      favoriteSpellIds: [],
      customSpells: [],
      spellbookSettings: { showPreparedOnly: false },
    },
    conditionsAndDiseases: {
      activeConditions: [],
      activeDiseases: [],
      exhaustionVariant: '2014',
    },
    damageImmunities: [],
    damageResistances: [],
    conditionImmunities: [],
    senses: [],
    temporaryBuffs: [],
    summons: [],
    jackOfAllTrades: false,
    languages: [],
    toolProficiencies: [],
    daysSpent: 0,
    shareHpWithParty: true,
    ...overrides,
  } as CharacterState;
}

export function makeWizard(
  overrides: Partial<CharacterState> = {}
): CharacterState {
  return makeCharacter({
    class: {
      name: 'Wizard',
      isCustom: false,
      spellcaster: 'full',
      hitDie: 6,
    },
    abilities: {
      strength: 8,
      dexterity: 14,
      constitution: 12,
      intelligence: 18,
      wisdom: 13,
      charisma: 10,
    },
    spellcastingStats: {
      spellcastingAbility: 'intelligence',
      isAbilityOverridden: false,
    },
    ...overrides,
  });
}

export function makeWarlock(
  overrides: Partial<CharacterState> = {}
): CharacterState {
  return makeCharacter({
    class: {
      name: 'Warlock',
      isCustom: false,
      spellcaster: 'warlock',
      hitDie: 8,
    },
    abilities: {
      strength: 8,
      dexterity: 14,
      constitution: 14,
      intelligence: 10,
      wisdom: 12,
      charisma: 18,
    },
    spellcastingStats: {
      spellcastingAbility: 'charisma',
      isAbilityOverridden: false,
    },
    ...overrides,
  });
}
