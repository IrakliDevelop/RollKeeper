import { 
  CharacterState, 
  AbilityName, 
  SkillName 
} from '@/types/character';
import { 
  SKILL_ABILITY_MAP, 
  PROFICIENCY_BONUS_BY_LEVEL 
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