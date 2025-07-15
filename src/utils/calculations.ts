import { 
  CharacterAbilities, 
  SkillName, 
  AbilityName, 
  CharacterState,
  SpellSlots,
  PactMagic,
  ClassInfo 
} from '@/types/character';
import { 
  SKILL_ABILITY_MAP, 
  PROFICIENCY_BONUS_BY_LEVEL,
  FULL_CASTER_SPELL_SLOTS,
  HALF_CASTER_SPELL_SLOTS,
  THIRD_CASTER_SPELL_SLOTS,
  WARLOCK_PACT_SLOTS,
  XP_THRESHOLDS
} from './constants';

/**
 * Calculate ability modifier from ability score
 * D&D 5e: modifier = floor((score - 10) / 2)
 */
export const calculateModifier = (score: number): number => {
  return Math.floor((score - 10) / 2);
};

/**
 * Get proficiency bonus based on character level
 */
export const getProficiencyBonus = (level: number): number => {
  const clampedLevel = Math.max(1, Math.min(20, level));
  return PROFICIENCY_BONUS_BY_LEVEL[clampedLevel] || 2;
};

/**
 * Calculate skill modifier
 * Takes into account ability modifier, proficiency, and expertise
 */
export const calculateSkillModifier = (
  character: CharacterState,
  skillName: SkillName
): number => {
  const skill = character.skills[skillName];
  const relatedAbility = SKILL_ABILITY_MAP[skillName];
  const abilityScore = character.abilities[relatedAbility];
  const abilityModifier = calculateModifier(abilityScore);
  const proficiencyBonus = getProficiencyBonus(character.level);
  
  let modifier = abilityModifier;
  
  // Add proficiency bonus if proficient
  if (skill.proficient) {
    modifier += proficiencyBonus;
  }
  
  // Double proficiency bonus for expertise
  if (skill.expertise && skill.proficient) {
    modifier += proficiencyBonus;
  }
  
  // Add any custom modifier
  if (skill.customModifier !== undefined) {
    modifier += skill.customModifier;
  }
  
  return modifier;
};

/**
 * Calculate saving throw modifier
 */
export const calculateSavingThrowModifier = (
  character: CharacterState,
  ability: AbilityName
): number => {
  const abilityScore = character.abilities[ability];
  const abilityModifier = calculateModifier(abilityScore);
  const savingThrow = character.savingThrows[ability];
  const proficiencyBonus = getProficiencyBonus(character.level);
  
  let modifier = abilityModifier;
  
  // Add proficiency bonus if proficient
  if (savingThrow.proficient) {
    modifier += proficiencyBonus;
  }
  
  // Add any custom modifier
  if (savingThrow.customModifier !== undefined) {
    modifier += savingThrow.customModifier;
  }
  
  return modifier;
};

/**
 * Calculate initiative modifier (Dexterity modifier)
 */
export const calculateInitiativeModifier = (character: CharacterState): number => {
  return calculateModifier(character.abilities.dexterity);
};

/**
 * Calculate spell save DC
 * DC = 8 + proficiency bonus + spellcasting ability modifier
 */
export const calculateSpellSaveDC = (
  character: CharacterState,
  spellcastingAbility: AbilityName
): number => {
  const abilityModifier = calculateModifier(character.abilities[spellcastingAbility]);
  const proficiencyBonus = getProficiencyBonus(character.level);
  
  return 8 + proficiencyBonus + abilityModifier;
};

/**
 * Calculate spell attack bonus
 * Attack bonus = proficiency bonus + spellcasting ability modifier
 */
export const calculateSpellAttackBonus = (
  character: CharacterState,
  spellcastingAbility: AbilityName
): number => {
  const abilityModifier = calculateModifier(character.abilities[spellcastingAbility]);
  const proficiencyBonus = getProficiencyBonus(character.level);
  
  return proficiencyBonus + abilityModifier;
};

/**
 * Calculate passive perception
 * Passive perception = 10 + Perception skill modifier
 */
export const calculatePassivePerception = (character: CharacterState): number => {
  const perceptionModifier = calculateSkillModifier(character, 'perception');
  return 10 + perceptionModifier;
};

/**
 * Calculate hit point maximum based on level and constitution
 * This is a simplified calculation - in reality it depends on class hit die
 */
export const calculateHitPointMaximum = (
  character: CharacterState,
  hitDieType: number = 8 // Default d8, could be passed from class data
): number => {
  const constitutionModifier = calculateModifier(character.abilities.constitution);
  const level = character.level;
  
  // First level gets max hit die + con mod
  // Subsequent levels get average of hit die + con mod
  const firstLevelHP = hitDieType + constitutionModifier;
  const additionalLevelsHP = (level - 1) * (Math.floor(hitDieType / 2) + 1 + constitutionModifier);
  
  return Math.max(1, firstLevelHP + additionalLevelsHP);
};

/**
 * Calculate carrying capacity (Strength score × 15)
 */
export const calculateCarryingCapacity = (character: CharacterState): number => {
  return character.abilities.strength * 15;
};

/**
 * Format modifier with proper + or - sign
 */
export const formatModifier = (modifier: number): string => {
  if (modifier >= 0) {
    return `+${modifier}`;
  }
  return modifier.toString();
};

/**
 * Get all calculated fields for a character
 * Useful for displaying computed values
 */
export const getCalculatedFields = (character: CharacterState) => {
  const abilityModifiers = {
    strength: calculateModifier(character.abilities.strength),
    dexterity: calculateModifier(character.abilities.dexterity),
    constitution: calculateModifier(character.abilities.constitution),
    intelligence: calculateModifier(character.abilities.intelligence),
    wisdom: calculateModifier(character.abilities.wisdom),
    charisma: calculateModifier(character.abilities.charisma),
  };
  
  const skillModifiers = Object.keys(character.skills).reduce((acc, skillName) => {
    acc[skillName as SkillName] = calculateSkillModifier(character, skillName as SkillName);
    return acc;
  }, {} as Record<SkillName, number>);
  
  const savingThrowModifiers = Object.keys(character.savingThrows).reduce((acc, abilityName) => {
    acc[abilityName as AbilityName] = calculateSavingThrowModifier(character, abilityName as AbilityName);
    return acc;
  }, {} as Record<AbilityName, number>);
  
  return {
    proficiencyBonus: getProficiencyBonus(character.level),
    abilityModifiers,
    skillModifiers,
    savingThrowModifiers,
    initiativeModifier: calculateInitiativeModifier(character),
    passivePerception: calculatePassivePerception(character),
    carryingCapacity: calculateCarryingCapacity(character),
  };
}; 

/**
 * Calculate spell slots for a character based on class and level
 */
export function calculateSpellSlots(classInfo: ClassInfo, level: number): SpellSlots {
  const emptySlots: SpellSlots = {
    1: { max: 0, used: 0 },
    2: { max: 0, used: 0 },
    3: { max: 0, used: 0 },
    4: { max: 0, used: 0 },
    5: { max: 0, used: 0 },
    6: { max: 0, used: 0 },
    7: { max: 0, used: 0 },
    8: { max: 0, used: 0 },
    9: { max: 0, used: 0 },
  };

  if (classInfo.spellcaster === 'none' || classInfo.spellcaster === 'warlock') {
    return emptySlots;
  }

  let slotsTable: Record<number, Record<number, number>>;
  
  switch (classInfo.spellcaster) {
    case 'full':
      slotsTable = FULL_CASTER_SPELL_SLOTS;
      break;
    case 'half':
      slotsTable = HALF_CASTER_SPELL_SLOTS;
      break;
    case 'third':
      slotsTable = THIRD_CASTER_SPELL_SLOTS;
      break;
    default:
      return emptySlots;
  }

  const levelSlots = slotsTable[level] || {};
  
  const result = { ...emptySlots };
  for (const [spellLevel, maxSlots] of Object.entries(levelSlots)) {
    const level = parseInt(spellLevel) as keyof SpellSlots;
    result[level] = { max: maxSlots, used: 0 };
  }

  return result;
}

/**
 * Calculate warlock pact magic slots
 */
export function calculatePactMagic(level: number): PactMagic | undefined {
  const pactData = WARLOCK_PACT_SLOTS[level];
  if (!pactData) return undefined;

  return {
    slots: { max: pactData.slots, used: 0 },
    level: pactData.level
  };
}

/**
 * Update spell slots when preserving used slots during level/class changes
 */
export function updateSpellSlotsPreservingUsed(
  newSlots: SpellSlots, 
  currentSlots: SpellSlots
): SpellSlots {
  const result = { ...newSlots };
  
  // Preserve used slots where possible, but don't exceed new max
  for (let i = 1; i <= 9; i++) {
    const level = i as keyof SpellSlots;
    const currentUsed = currentSlots[level].used;
    const newMax = newSlots[level].max;
    
    result[level].used = Math.min(currentUsed, newMax);
  }
  
  return result;
}

/**
 * Check if character has any spell slots
 */
export function hasSpellSlots(spellSlots: SpellSlots | undefined, pactMagic?: PactMagic): boolean {
  const hasRegularSlots = spellSlots ? Object.values(spellSlots).some(slot => slot.max > 0) : false;
  const hasPactSlots = pactMagic && pactMagic.slots.max > 0;
  
  return hasRegularSlots || !!hasPactSlots;
} 

/**
 * Calculate level from experience points
 */
export function calculateLevelFromXP(xp: number): number {
  // Find the highest level where XP threshold is met
  for (let level = 20; level >= 1; level--) {
    if (xp >= XP_THRESHOLDS[level]) {
      return level;
    }
  }
  return 1; // Fallback to level 1
}

/**
 * Get XP required for a specific level
 */
export function getXPForLevel(level: number): number {
  return XP_THRESHOLDS[Math.max(1, Math.min(20, level))] || 0;
}

/**
 * Get XP needed to reach the next level
 */
export function getXPToNextLevel(currentXP: number, currentLevel: number): number {
  if (currentLevel >= 20) return 0; // Max level reached
  
  const nextLevelXP = getXPForLevel(currentLevel + 1);
  return Math.max(0, nextLevelXP - currentXP);
}

/**
 * Get XP progress percentage for current level
 */
export function getXPProgress(currentXP: number, currentLevel: number): number {
  if (currentLevel >= 20) return 100; // Max level reached
  
  const currentLevelXP = getXPForLevel(currentLevel);
  const nextLevelXP = getXPForLevel(currentLevel + 1);
  const xpInCurrentLevel = currentXP - currentLevelXP;
  const xpNeededForLevel = nextLevelXP - currentLevelXP;
  
  return Math.min(100, Math.max(0, (xpInCurrentLevel / xpNeededForLevel) * 100));
}

/**
 * Check if character should level up based on XP
 */
export function shouldLevelUp(currentXP: number, currentLevel: number): boolean {
  const calculatedLevel = calculateLevelFromXP(currentXP);
  return calculatedLevel > currentLevel;
} 