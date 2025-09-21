import {
  CharacterState,
  ClassInfo,
  MulticlassInfo,
  MulticlassValidation,
  HitDicePools,
  SpellSlots,
  CharacterAbilities,
} from '@/types/character';
import { ProcessedClass } from '@/types/classes';
import { calculateSpellSlots } from './calculations';

/**
 * Convert a single-class character to multiclass format
 */
export function migrateToMulticlass(character: CharacterState): CharacterState {
  // If already has multiclass data, return as-is
  if (character.classes && character.classes.length > 0) {
    return character;
  }

  // Convert single class to multiclass format
  const singleClass: MulticlassInfo = {
    className: character.class?.name || '',
    level: character.level || 1,
    isCustom: character.class?.isCustom || false,
    spellcaster: character.class?.spellcaster,
    hitDie: character.class?.hitDie || 8,
  };

  // Calculate hit dice pools from single class
  const hitDicePools: HitDicePools = {};
  const dieType = `d${singleClass.hitDie}`;
  hitDicePools[dieType] = {
    max: singleClass.level,
    used: 0, // Start with all hit dice available
  };

  return {
    ...character,
    classes: [singleClass],
    totalLevel: character.level || 1,
    hitDicePools,
    // Keep old fields for backwards compatibility
    class: character.class,
    level: character.level,
  };
}

/**
 * Check if a character is multiclassed
 */
export function isMulticlassed(character: CharacterState): boolean {
  return (character.classes?.length || 0) > 1;
}

/**
 * Calculate hit dice pools from multiclass data
 */
export function calculateHitDicePools(classes: MulticlassInfo[], existingPools?: HitDicePools): HitDicePools {
  const hitDicePools: HitDicePools = {};
  
  // Calculate max dice for each die type
  classes.forEach(cls => {
    const dieType = `d${cls.hitDie}`;
    if (!hitDicePools[dieType]) {
      hitDicePools[dieType] = { max: 0, used: 0 };
    }
    hitDicePools[dieType].max += cls.level;
  });
  
  // Preserve used dice from existing pools, but cap at new max
  if (existingPools) {
    Object.keys(hitDicePools).forEach(dieType => {
      if (existingPools[dieType]) {
        hitDicePools[dieType].used = Math.min(
          existingPools[dieType].used,
          hitDicePools[dieType].max
        );
      }
    });
  }
  
  return hitDicePools;
}

/**
 * Get the total character level from multiclass data
 */
export function getTotalLevel(character: CharacterState): number {
  if (character.totalLevel !== undefined) {
    return character.totalLevel;
  }
  
  if (character.classes && character.classes.length > 0) {
    return character.classes.reduce((total, cls) => total + cls.level, 0);
  }
  
  return character.level || 1;
}

/**
 * Get the primary class (highest level class, or first if tied)
 */
export function getPrimaryClass(character: CharacterState): MulticlassInfo | null {
  if (!character.classes || character.classes.length === 0) {
    // Fallback to single class format
    if (character.class) {
      return {
        className: character.class.name,
        level: character.level || 1,
        isCustom: character.class.isCustom,
        spellcaster: character.class.spellcaster,
        hitDie: character.class.hitDie,
      };
    }
    return null;
  }

  return character.classes.reduce((primary, current) => 
    current.level > primary.level ? current : primary
  );
}

/**
 * Calculate spell slots for multiclass characters
 */
export function calculateMulticlassSpellSlots(classes: MulticlassInfo[]): SpellSlots {
  let casterLevel = 0;
  
  for (const classInfo of classes) {
    switch (classInfo.spellcaster) {
      case 'full':
        casterLevel += classInfo.level;
        break;
      case 'half':
        casterLevel += Math.floor(classInfo.level / 2);
        break;
      case 'third':
        casterLevel += Math.floor(classInfo.level / 3);
        break;
      case 'warlock':
        // Warlocks don't contribute to multiclass spell slots
        break;
      case 'none':
      default:
        // Non-casters don't contribute
        break;
    }
  }

  // Use the existing spell slot calculation with the combined caster level
  const dummyClassInfo: ClassInfo = {
    name: 'Multiclass',
    isCustom: false,
    spellcaster: 'full',
    hitDie: 8,
  };

  return calculateSpellSlots(dummyClassInfo, casterLevel);
}


// Hardcoded multiclassing requirements as fallback
const MULTICLASS_REQUIREMENTS: Record<string, Record<string, number>> = {
  'Barbarian': { strength: 13 },
  'Bard': { charisma: 13 },
  'Cleric': { wisdom: 13 },
  'Druid': { wisdom: 13 },
  'Fighter': { strength: 13 }, // Note: Fighter can also use DEX 13, but we'll use STR as primary
  'Monk': { dexterity: 13, wisdom: 13 },
  'Paladin': { strength: 13, charisma: 13 },
  'Ranger': { dexterity: 13, wisdom: 13 },
  'Rogue': { dexterity: 13 },
  'Sorcerer': { charisma: 13 },
  'Warlock': { charisma: 13 },
  'Wizard': { intelligence: 13 },
  'Artificer': { intelligence: 13 },
  'Blood Hunter': { strength: 13 }, // Assuming STR for Blood Hunter
};

/**
 * Validate multiclassing requirements
 */
export function validateMulticlassRequirements(
  currentClasses: MulticlassInfo[],
  newClassName: string,
  abilities: CharacterAbilities,
  classData?: ProcessedClass[]
): MulticlassValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Try to get requirements from API data first, then fallback to hardcoded
  let newClassRequirements: Record<string, number> = {};
  
  const newClassData = classData?.find(cls => cls.name === newClassName);
  if (newClassData?.multiclassing?.requirements && Object.keys(newClassData.multiclassing.requirements).length > 0) {
    newClassRequirements = newClassData.multiclassing.requirements;
  } else {
    newClassRequirements = MULTICLASS_REQUIREMENTS[newClassName] || {};
    
    if (Object.keys(newClassRequirements).length === 0) {
      errors.push(`Multiclassing requirements not found for ${newClassName}`);
      return { valid: false, errors, warnings };
    }
  }

  // Check requirements for the new class
  for (const [ability, requiredScore] of Object.entries(newClassRequirements)) {
    const abilityScore = abilities[ability as keyof CharacterAbilities];
    if (abilityScore < requiredScore) {
      errors.push(
        `${newClassName} requires ${ability.charAt(0).toUpperCase() + ability.slice(1)} ${requiredScore} (you have ${abilityScore})`
      );
    }
  }

  // Check requirements for existing classes (must maintain them)
  for (const existingClass of currentClasses) {
    let existingClassRequirements: Record<string, number> = {};
    
    const existingClassData = classData?.find(cls => cls.name === existingClass.className);
    if (existingClassData?.multiclassing?.requirements && Object.keys(existingClassData.multiclassing.requirements).length > 0) {
      existingClassRequirements = existingClassData.multiclassing.requirements;
    } else {
      existingClassRequirements = MULTICLASS_REQUIREMENTS[existingClass.className] || {};
    }
    
    for (const [ability, requiredScore] of Object.entries(existingClassRequirements)) {
      const abilityScore = abilities[ability as keyof CharacterAbilities];
      if (abilityScore < requiredScore) {
        errors.push(
          `You must maintain ${ability.charAt(0).toUpperCase() + ability.slice(1)} ${requiredScore} for ${existingClass.className} (you have ${abilityScore})`
        );
      }
    }
  }

  // Check for level 20 limit
  const totalLevel = currentClasses.reduce((sum, cls) => sum + cls.level, 0) + 1; // +1 for new level
  if (totalLevel > 20) {
    errors.push('Total character level cannot exceed 20');
  }

  // Add warnings for common multiclassing considerations
  if (currentClasses.length === 0) {
    warnings.push('Consider taking your first class to level 2 before multiclassing to gain important features');
  }
  const hasSpellcaster = currentClasses.some(cls => cls.spellcaster && cls.spellcaster !== 'none');
  const newClassIsSpellcaster = newClassData?.spellcasting?.type && newClassData.spellcasting.type !== 'none';
  
  if (hasSpellcaster && newClassIsSpellcaster) {
    warnings.push('Multiclassing spellcasters have complex spell slot and spell preparation rules');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Add a class level to a character
 */
export function addClassLevel(
  character: CharacterState,
  className: string,
  isCustom: boolean = false,
  spellcaster?: 'full' | 'half' | 'third' | 'warlock' | 'none',
  hitDie: number = 8,
  subclass?: string
): CharacterState {
  // Ensure character has multiclass structure
  const migratedCharacter = migrateToMulticlass(character);
  const classes = [...(migratedCharacter.classes || [])];

  // Find existing class or create new one
  const existingClassIndex = classes.findIndex(cls => cls.className === className);
  
  if (existingClassIndex >= 0) {
    // Level up existing class
    classes[existingClassIndex] = {
      ...classes[existingClassIndex],
      level: classes[existingClassIndex].level + 1,
      subclass: subclass || classes[existingClassIndex].subclass,
    };
  } else {
    // Add new class
    classes.push({
      className,
      level: 1,
      isCustom,
      spellcaster,
      hitDie,
      subclass,
    });
  }

  const totalLevel = classes.reduce((sum, cls) => sum + cls.level, 0);
  const hitDicePools = calculateHitDicePools(classes);

  // Update backwards compatibility fields
  const primaryClass = classes.reduce((primary, current) => 
    current.level > primary.level ? current : primary
  );

  const compatibilityClass: ClassInfo = {
    name: primaryClass.className,
    isCustom: primaryClass.isCustom,
    spellcaster: primaryClass.spellcaster,
    hitDie: primaryClass.hitDie,
  };

  return {
    ...migratedCharacter,
    classes,
    totalLevel,
    hitDicePools,
    // Update backwards compatibility fields
    class: compatibilityClass,
    level: totalLevel,
  };
}

/**
 * Remove a class level from a character
 */
export function removeClassLevel(
  character: CharacterState,
  className: string
): CharacterState {
  const migratedCharacter = migrateToMulticlass(character);
  const classes = [...(migratedCharacter.classes || [])];

  const classIndex = classes.findIndex(cls => cls.className === className);
  if (classIndex === -1) {
    return migratedCharacter; // Class not found
  }

  if (classes[classIndex].level > 1) {
    // Reduce level by 1
    classes[classIndex] = {
      ...classes[classIndex],
      level: classes[classIndex].level - 1,
    };
  } else {
    // Remove class entirely
    classes.splice(classIndex, 1);
  }

  // If no classes left, this shouldn't happen but handle gracefully
  if (classes.length === 0) {
    return migratedCharacter;
  }

  const totalLevel = classes.reduce((sum, cls) => sum + cls.level, 0);
  const hitDicePools = calculateHitDicePools(classes);

  // Update backwards compatibility fields
  const primaryClass = classes.reduce((primary, current) => 
    current.level > primary.level ? current : primary
  );

  const compatibilityClass: ClassInfo = {
    name: primaryClass.className,
    isCustom: primaryClass.isCustom,
    spellcaster: primaryClass.spellcaster,
    hitDie: primaryClass.hitDie,
  };

  return {
    ...migratedCharacter,
    classes,
    totalLevel,
    hitDicePools,
    // Update backwards compatibility fields
    class: compatibilityClass,
    level: totalLevel,
  };
}

/**
 * Get a formatted display string for multiclass characters
 */
export function getClassDisplayString(character: CharacterState): string {
  if (!character.classes || character.classes.length === 0) {
    // Fallback to single class format
    return `${character.class?.name || 'Unknown'} ${character.level || 1}`;
  }

  if (character.classes.length === 1) {
    const cls = character.classes[0];
    return `${cls.className} ${cls.level}`;
  }

  // Sort classes by level (descending) for display
  const sortedClasses = [...character.classes].sort((a, b) => b.level - a.level);
  const classStrings = sortedClasses.map(cls => `${cls.className} ${cls.level}`);
  const totalLevel = getTotalLevel(character);
  
  return `${classStrings.join(' / ')} (Level ${totalLevel})`;
}
