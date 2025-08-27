import {
  SkillName,
  AbilityName,
  CharacterState,
  SpellSlots,
  PactMagic,
  ClassInfo,
  Weapon,
  SpellcastingAbility,
  TrackableTrait,
} from '@/types/character';
import {
  SKILL_ABILITY_MAP,
  PROFICIENCY_BONUS_BY_LEVEL,
  FULL_CASTER_SPELL_SLOTS,
  HALF_CASTER_SPELL_SLOTS,
  THIRD_CASTER_SPELL_SLOTS,
  WARLOCK_PACT_SLOTS,
  XP_THRESHOLDS,
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
 * Takes into account ability modifier, proficiency, expertise, and Jack of All Trades
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
  } else if (character.jackOfAllTrades) {
    // Jack of All Trades: add half proficiency bonus (rounded down) to non-proficient skills
    modifier += Math.floor(proficiencyBonus / 2);
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
export const calculateInitiativeModifier = (
  character: CharacterState
): number => {
  return calculateModifier(character.abilities.dexterity);
};

/**
 * Calculate total armor class including all bonuses
 * @param baseAC - Base armor class
 * @param tempAC - Temporary AC bonuses from spells/effects
 * @param isWearingShield - Whether character is wearing a shield
 * @param shieldBonus - AC bonus from shield (default +2 for standard shield)
 */
export const calculateTotalArmorClass = (
  baseAC: number,
  tempAC: number,
  isWearingShield: boolean,
  shieldBonus: number = 2
): number => {
  return baseAC + tempAC + (isWearingShield ? shieldBonus : 0);
};

/**
 * Calculate total armor class from character state
 */
export const calculateCharacterArmorClass = (
  character: CharacterState
): number => {
  return calculateTotalArmorClass(
    character.armorClass,
    character.tempArmorClass,
    character.isWearingShield,
    character.shieldBonus
  );
};

/**
 * Calculate passive perception
 * Passive perception = 10 + Perception skill modifier
 */
export const calculatePassivePerception = (
  character: CharacterState
): number => {
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
  const constitutionModifier = calculateModifier(
    character.abilities.constitution
  );
  const level = character.level;

  // First level gets max hit die + con mod
  // Subsequent levels get average of hit die + con mod
  const firstLevelHP = hitDieType + constitutionModifier;
  const additionalLevelsHP =
    (level - 1) * (Math.floor(hitDieType / 2) + 1 + constitutionModifier);

  return Math.max(1, firstLevelHP + additionalLevelsHP);
};

/**
 * Calculate carrying capacity (Strength score × 15)
 */
export const calculateCarryingCapacity = (
  character: CharacterState
): number => {
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

  const skillModifiers = Object.keys(character.skills).reduce(
    (acc, skillName) => {
      acc[skillName as SkillName] = calculateSkillModifier(
        character,
        skillName as SkillName
      );
      return acc;
    },
    {} as Record<SkillName, number>
  );

  const savingThrowModifiers = Object.keys(character.savingThrows).reduce(
    (acc, abilityName) => {
      acc[abilityName as AbilityName] = calculateSavingThrowModifier(
        character,
        abilityName as AbilityName
      );
      return acc;
    },
    {} as Record<AbilityName, number>
  );

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
 * Check if character is proficient with a weapon
 */
export const isWeaponProficient = (
  character: CharacterState,
  weapon: Weapon
): boolean => {
  // Check manual proficiency override first
  if (weapon.manualProficiency !== undefined) {
    return weapon.manualProficiency;
  }

  // Check category proficiency
  if (
    weapon.category === 'simple' &&
    character.weaponProficiencies.simpleWeapons
  ) {
    return true;
  }
  if (
    weapon.category === 'martial' &&
    character.weaponProficiencies.martialWeapons
  ) {
    return true;
  }

  // Check specific weapon proficiency
  return character.weaponProficiencies.specificWeapons.includes(
    weapon.name.toLowerCase()
  );
};

/**
 * Get the appropriate ability modifier for a weapon attack
 */
export const getWeaponAbilityModifier = (
  character: CharacterState,
  weapon: Weapon
): number => {
  // Finesse weapons can use DEX or STR (we'll use the higher one)
  if (weapon.weaponType.includes('finesse')) {
    return Math.max(
      calculateModifier(character.abilities.strength),
      calculateModifier(character.abilities.dexterity)
    );
  }

  // Ranged weapons use DEX
  if (weapon.weaponType.includes('ranged')) {
    return calculateModifier(character.abilities.dexterity);
  }

  // Melee weapons use STR by default
  return calculateModifier(character.abilities.strength);
};

/**
 * Calculate weapon attack bonus
 */
export const calculateWeaponAttackBonus = (
  character: CharacterState,
  weapon: Weapon
): number => {
  let attackBonus = 0;

  // Add ability modifier
  attackBonus += getWeaponAbilityModifier(character, weapon);

  // Add proficiency bonus if proficient
  if (isWeaponProficient(character, weapon)) {
    attackBonus += getProficiencyBonus(character.level);
  }

  // Add enhancement bonus
  attackBonus += weapon.enhancementBonus;

  // Add custom attack bonus
  if (weapon.attackBonus) {
    attackBonus += weapon.attackBonus;
  }

  return attackBonus;
};

/**
 * Calculate weapon damage bonus (not including dice)
 */
export const calculateWeaponDamageBonus = (
  character: CharacterState,
  weapon: Weapon
): number => {
  let damageBonus = 0;

  // Add ability modifier
  damageBonus += getWeaponAbilityModifier(character, weapon);

  // Add enhancement bonus
  damageBonus += weapon.enhancementBonus;

  // Add custom damage bonus
  if (weapon.damageBonus) {
    damageBonus += weapon.damageBonus;
  }

  return damageBonus;
};

/**
 * Get weapon attack string for display (e.g., "+7 to hit")
 */
export const getWeaponAttackString = (
  character: CharacterState,
  weapon: Weapon
): string => {
  const attackBonus = calculateWeaponAttackBonus(character, weapon);
  return `${formatModifier(attackBonus)} to hit`;
};

/**
 * Get weapon damage string for display (e.g., "1d8+3 slashing, 1d6 fire")
 */
export const getWeaponDamageString = (
  character: CharacterState,
  weapon: Weapon,
  versatile = false
): string => {
  const damageBonus = calculateWeaponDamageBonus(character, weapon);

  // Handle backward compatibility - check if damage is old format (object) or new format (array)
  if (!Array.isArray(weapon.damage)) {
    // Old format: weapon.damage is an object with dice, type, versatiledice
    const legacyDamage = weapon.damage as {
      dice: string;
      type: string;
      versatiledice?: string;
    };
    if (legacyDamage && legacyDamage.dice && legacyDamage.type) {
      const dice =
        versatile && legacyDamage.versatiledice
          ? legacyDamage.versatiledice
          : legacyDamage.dice;

      if (damageBonus === 0) {
        return `${dice} ${legacyDamage.type}`;
      }

      return `${dice}${formatModifier(damageBonus)} ${legacyDamage.type}`;
    }
    return 'No damage';
  }

  // New format: weapon.damage is an array
  if (weapon.damage.length === 0) {
    return 'No damage';
  }

  const damageStrings = weapon.damage.map((damage, index) => {
    const dice =
      versatile && damage.versatiledice ? damage.versatiledice : damage.dice;
    const bonus = index === 0 ? damageBonus : 0; // Only add weapon damage bonus to first damage

    if (bonus === 0) {
      return `${dice} ${damage.type}`;
    }

    return `${dice}${formatModifier(bonus)} ${damage.type}`;
  });

  return damageStrings.join(', ');
};

/**
 * Roll damage dice and return result string
 */
export const rollDamage = (dice: string, bonus = 0): string => {
  // Parse dice string (e.g., "1d8", "2d6", "3d4+2")
  const diceMatch = dice.match(/(\d+)d(\d+)(?:\+(\d+))?(?:-(\d+))?/i);
  if (!diceMatch) {
    // If not a valid dice string, return as-is
    return dice;
  }

  const numDice = parseInt(diceMatch[1]);
  const dieSize = parseInt(diceMatch[2]);
  const diceBonus = diceMatch[3]
    ? parseInt(diceMatch[3])
    : diceMatch[4]
      ? -parseInt(diceMatch[4])
      : 0;

  let total = 0;
  const rolls: number[] = [];

  // Roll each die
  for (let i = 0; i < numDice; i++) {
    const roll = Math.floor(Math.random() * dieSize) + 1;
    rolls.push(roll);
    total += roll;
  }

  // Add bonuses
  total += diceBonus + bonus;

  // Format result
  if (numDice === 1) {
    return `${total}${diceBonus + bonus !== 0 ? ` (${rolls[0]}${diceBonus + bonus > 0 ? `+${diceBonus + bonus}` : diceBonus + bonus})` : ''}`;
  } else {
    return `${total} (${rolls.join('+')}${diceBonus + bonus !== 0 ? `${diceBonus + bonus > 0 ? `+${diceBonus + bonus}` : diceBonus + bonus}` : ''})`;
  }
};

/**
 * Calculate spell slots for a character based on class and level
 */
export function calculateSpellSlots(
  classInfo: ClassInfo,
  level: number
): SpellSlots {
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
    level: pactData.level,
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
export function hasSpellSlots(
  spellSlots: SpellSlots | undefined,
  pactMagic?: PactMagic
): boolean {
  const hasRegularSlots = spellSlots
    ? Object.values(spellSlots).some(slot => slot.max > 0)
    : false;
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
export function getXPToNextLevel(
  currentXP: number,
  currentLevel: number
): number {
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

  return Math.min(
    100,
    Math.max(0, (xpInCurrentLevel / xpNeededForLevel) * 100)
  );
}

/**
 * Check if character should level up based on XP
 */
export function shouldLevelUp(
  currentXP: number,
  currentLevel: number
): boolean {
  const calculatedLevel = calculateLevelFromXP(currentXP);
  return calculatedLevel > currentLevel;
}

// ========================================
// SPELLCASTING CALCULATIONS
// ========================================

/**
 * Get the default spellcasting ability for a class
 */
export function getClassSpellcastingAbility(
  className: string
): SpellcastingAbility | null {
  const normalizedClass = className.toLowerCase();

  // Intelligence-based spellcasters
  if (
    normalizedClass.includes('wizard') ||
    normalizedClass.includes('artificer') ||
    normalizedClass.includes('eldritch knight') ||
    normalizedClass.includes('arcane trickster')
  ) {
    return 'intelligence';
  }

  // Wisdom-based spellcasters
  if (
    normalizedClass.includes('cleric') ||
    normalizedClass.includes('druid') ||
    normalizedClass.includes('ranger')
  ) {
    return 'wisdom';
  }

  // Charisma-based spellcasters
  if (
    normalizedClass.includes('sorcerer') ||
    normalizedClass.includes('warlock') ||
    normalizedClass.includes('bard') ||
    normalizedClass.includes('paladin')
  ) {
    return 'charisma';
  }

  // Non-spellcaster or unknown class
  return null;
}

/**
 * Get the spellcasting ability for a character (with override support)
 */
export function getCharacterSpellcastingAbility(
  character: CharacterState
): SpellcastingAbility | null {
  if (character.spellcastingStats.isAbilityOverridden) {
    return character.spellcastingStats.spellcastingAbility;
  }

  return getClassSpellcastingAbility(character.class.name);
}

/**
 * Calculate spell attack bonus with override support
 * Formula: ability modifier + proficiency bonus
 */
export function calculateSpellAttackBonus(
  character: CharacterState
): number | null {
  // Check for manual override first
  if (character.spellcastingStats.spellAttackBonus !== undefined) {
    return character.spellcastingStats.spellAttackBonus;
  }

  const spellcastingAbility = getCharacterSpellcastingAbility(character);
  if (!spellcastingAbility) {
    return null; // Not a spellcaster
  }

  const abilityModifier = calculateModifier(
    character.abilities[spellcastingAbility]
  );
  const proficiencyBonus = getProficiencyBonus(character.level);

  return abilityModifier + proficiencyBonus;
}

/**
 * Calculate spell save DC with override support
 * Formula: 8 + ability modifier + proficiency bonus
 */
export function calculateSpellSaveDC(character: CharacterState): number | null {
  // Check for manual override first
  if (character.spellcastingStats.spellSaveDC !== undefined) {
    return character.spellcastingStats.spellSaveDC;
  }

  const spellcastingAbility = getCharacterSpellcastingAbility(character);
  if (!spellcastingAbility) {
    return null; // Not a spellcaster
  }

  const abilityModifier = calculateModifier(
    character.abilities[spellcastingAbility]
  );
  const proficiencyBonus = getProficiencyBonus(character.level);

  return 8 + abilityModifier + proficiencyBonus;
}

/**
 * Check if a character is a spellcaster
 */
export function isSpellcaster(character: CharacterState): boolean {
  return (
    getCharacterSpellcastingAbility(character) !== null ||
    character.class.spellcaster !== 'none'
  );
}

/**
 * Get spellcasting ability modifier
 */
export function getSpellcastingAbilityModifier(
  character: CharacterState
): number | null {
  const spellcastingAbility = getCharacterSpellcastingAbility(character);
  if (!spellcastingAbility) {
    return null;
  }

  return calculateModifier(character.abilities[spellcastingAbility]);
}

/**
 * Format spell attack bonus for display
 */
export function getSpellAttackString(character: CharacterState): string {
  const attackBonus = calculateSpellAttackBonus(character);
  if (attackBonus === null) {
    return '—';
  }

  return attackBonus >= 0 ? `+${attackBonus}` : `${attackBonus}`;
}

/**
 * Format spell save DC for display
 */
export function getSpellSaveDCString(character: CharacterState): string {
  const saveDC = calculateSpellSaveDC(character);
  if (saveDC === null) {
    return '—';
  }

  return `${saveDC}`;
}

/**
 * Calculate effective max uses for a trackable trait
 * Takes into account proficiency bonus scaling if enabled
 */
export function calculateTraitMaxUses(
  trait: TrackableTrait,
  characterLevel: number
): number {
  if (!trait.scaleWithProficiency) {
    return trait.maxUses;
  }

  const proficiencyBonus = getProficiencyBonus(characterLevel);
  const multiplier = trait.proficiencyMultiplier || 1;

  return Math.max(1, Math.floor(proficiencyBonus * multiplier));
}
