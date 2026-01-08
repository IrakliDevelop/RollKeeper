import {
  ProcessedClass,
  ProcessedSubclass,
  ClassFilters,
  SpellcastingType,
  SpellcastingAbility,
  ProficiencyType,
} from '@/types/classes';

/**
 * Search classes by name, description, or features
 */
export function searchClasses(
  classes: ProcessedClass[],
  query: string
): ProcessedClass[] {
  if (!query.trim()) return classes;

  const searchTerm = query.toLowerCase().trim();

  return classes.filter(classData => {
    // Search in class name
    if (classData.name.toLowerCase().includes(searchTerm)) {
      return true;
    }

    // Search in source
    if (classData.source.toLowerCase().includes(searchTerm)) {
      return true;
    }

    // Search in description if available
    if (classData.description?.toLowerCase().includes(searchTerm)) {
      return true;
    }

    // Search in hit die
    if (classData.hitDie.toLowerCase().includes(searchTerm)) {
      return true;
    }

    // Search in spellcasting ability
    if (classData.spellcasting.ability?.toLowerCase().includes(searchTerm)) {
      return true;
    }

    // Search in subclass names
    if (
      classData.subclasses.some(
        sub =>
          sub.name.toLowerCase().includes(searchTerm) ||
          sub.shortName.toLowerCase().includes(searchTerm)
      )
    ) {
      return true;
    }

    // Search in tags
    if (classData.tags.some(tag => tag.toLowerCase().includes(searchTerm))) {
      return true;
    }

    return false;
  });
}

/**
 * Filter classes by spellcasting types
 */
export function filterBySpellcastingType(
  classes: ProcessedClass[],
  types: SpellcastingType[]
): ProcessedClass[] {
  if (!types || types.length === 0) return classes;

  return classes.filter(classData =>
    types.includes(classData.spellcasting.type)
  );
}

/**
 * Filter classes by spellcasting abilities
 */
export function filterBySpellcastingAbility(
  classes: ProcessedClass[],
  abilities: SpellcastingAbility[]
): ProcessedClass[] {
  if (!abilities || abilities.length === 0) return classes;

  return classes.filter(
    classData =>
      classData.spellcasting.ability &&
      abilities.includes(classData.spellcasting.ability)
  );
}

/**
 * Filter classes by sources
 */
export function filterBySources(
  classes: ProcessedClass[],
  sources: string[]
): ProcessedClass[] {
  if (!sources || sources.length === 0) return classes;

  return classes.filter(classData => sources.includes(classData.source));
}

/**
 * Filter classes by hit dice types
 */
export function filterByHitDice(
  classes: ProcessedClass[],
  hitDiceTypes: string[]
): ProcessedClass[] {
  if (!hitDiceTypes || hitDiceTypes.length === 0) return classes;

  return classes.filter(classData => hitDiceTypes.includes(classData.hitDie));
}

/**
 * Filter classes by primary abilities
 */
export function filterByPrimaryAbilities(
  classes: ProcessedClass[],
  abilities: ProficiencyType[]
): ProcessedClass[] {
  if (!abilities || abilities.length === 0) return classes;

  return classes.filter(classData =>
    abilities.some(ability => classData.primaryAbilities.includes(ability))
  );
}

/**
 * Filter classes based on multiple criteria
 */
export function filterClasses(
  classes: ProcessedClass[],
  filters: ClassFilters
): ProcessedClass[] {
  let filtered = classes;

  if (filters.sources && filters.sources.length > 0) {
    filtered = filterBySources(filtered, filters.sources);
  }

  if (filters.spellcastingTypes && filters.spellcastingTypes.length > 0) {
    filtered = filterBySpellcastingType(filtered, filters.spellcastingTypes);
  }

  if (
    filters.spellcastingAbilities &&
    filters.spellcastingAbilities.length > 0
  ) {
    filtered = filterBySpellcastingAbility(
      filtered,
      filters.spellcastingAbilities
    );
  }

  if (filters.hitDiceTypes && filters.hitDiceTypes.length > 0) {
    filtered = filterByHitDice(filtered, filters.hitDiceTypes);
  }

  if (filters.primaryAbilities && filters.primaryAbilities.length > 0) {
    filtered = filterByPrimaryAbilities(filtered, filters.primaryAbilities);
  }

  if (filters.searchQuery) {
    filtered = searchClasses(filtered, filters.searchQuery);
  }

  return filtered;
}

/**
 * Get all subclasses from a list of classes
 */
export function getAllSubclasses(
  classes: ProcessedClass[]
): ProcessedSubclass[] {
  return classes.flatMap(classData => classData.subclasses);
}

/**
 * Filter subclasses by search query
 */
export function searchSubclasses(
  subclasses: ProcessedSubclass[],
  query: string
): ProcessedSubclass[] {
  if (!query.trim()) return subclasses;

  const searchTerm = query.toLowerCase().trim();

  return subclasses.filter(subclass => {
    // Search in subclass name
    if (subclass.name.toLowerCase().includes(searchTerm)) {
      return true;
    }

    // Search in short name
    if (subclass.shortName.toLowerCase().includes(searchTerm)) {
      return true;
    }

    // Search in parent class name
    if (subclass.parentClassName.toLowerCase().includes(searchTerm)) {
      return true;
    }

    // Search in source
    if (subclass.source.toLowerCase().includes(searchTerm)) {
      return true;
    }

    // Search in description if available
    if (subclass.description?.toLowerCase().includes(searchTerm)) {
      return true;
    }

    return false;
  });
}

/**
 * Get class by ID
 */
export function getClassById(
  classes: ProcessedClass[],
  id: string
): ProcessedClass | undefined {
  return classes.find(classData => classData.id === id);
}

/**
 * Get subclass by ID
 */
export function getSubclassById(
  classes: ProcessedClass[],
  id: string
): ProcessedSubclass | undefined {
  for (const classData of classes) {
    const subclass = classData.subclasses.find(sub => sub.id === id);
    if (subclass) return subclass;
  }
  return undefined;
}

/**
 * Format spellcasting type for display
 */
export function formatSpellcastingType(type: SpellcastingType): string {
  switch (type) {
    case 'full':
      return 'Full Caster';
    case 'half':
      return 'Half Caster';
    case 'third':
      return 'Third Caster';
    case 'warlock':
      return 'Pact Magic';
    case 'none':
      return 'Non-Caster';
    default:
      return type;
  }
}

/**
 * Format spellcasting ability for display
 */
export function formatSpellcastingAbility(
  ability: SpellcastingAbility
): string {
  switch (ability) {
    case 'int':
      return 'Intelligence';
    case 'wis':
      return 'Wisdom';
    case 'cha':
      return 'Charisma';
    default:
      return ability;
  }
}

/**
 * Format proficiency type for display
 */
export function formatProficiencyType(type: ProficiencyType): string {
  switch (type) {
    case 'str':
      return 'Strength';
    case 'dex':
      return 'Dexterity';
    case 'con':
      return 'Constitution';
    case 'int':
      return 'Intelligence';
    case 'wis':
      return 'Wisdom';
    case 'cha':
      return 'Charisma';
    default:
      return type;
  }
}

/**
 * Get all unique sources from loaded classes
 */
export function getClassSources(classes: ProcessedClass[]): string[] {
  const sources = new Set(classes.map(c => c.source));
  return Array.from(sources).sort();
}

/**
 * Get all unique spellcasting types from loaded classes
 */
export function getSpellcastingTypes(
  classes: ProcessedClass[]
): SpellcastingType[] {
  const types = new Set(classes.map(c => c.spellcasting.type));
  return Array.from(types).sort();
}

/**
 * Get all unique hit die types from loaded classes
 */
export function getHitDiceTypes(classes: ProcessedClass[]): string[] {
  const hitDice = new Set(classes.map(c => c.hitDie));
  return Array.from(hitDice).sort();
}
