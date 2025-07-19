import { ProcessedSpell, SpellClass } from '@/types/spells';

/**
 * Get spells by level
 */
export function getSpellsByLevel(spells: ProcessedSpell[], level: number): ProcessedSpell[] {
  return spells.filter(spell => spell.level === level);
}

/**
 * Get spells by school
 */
export function getSpellsBySchool(spells: ProcessedSpell[], school: string): ProcessedSpell[] {
  return spells.filter(spell => spell.school === school || spell.schoolName === school);
}

/**
 * Get spells by class
 */
export function getSpellsByClass(spells: ProcessedSpell[], className: SpellClass): ProcessedSpell[] {
  return spells.filter(spell => spell.classes.includes(className));
}

/**
 * Search spells by name or description
 */
export function searchSpells(spells: ProcessedSpell[], query: string): ProcessedSpell[] {
  const searchTerm = query.toLowerCase();
  return spells.filter(spell => 
    spell.name.toLowerCase().includes(searchTerm) ||
    spell.description.toLowerCase().includes(searchTerm) ||
    spell.tags.some(tag => tag.toLowerCase().includes(searchTerm))
  );
}

/**
 * Filter spells based on multiple criteria
 */
export function filterSpells(
  spells: ProcessedSpell[], 
  filters: {
    levels?: number[];
    schools?: string[];
    classes?: SpellClass[];
    sources?: string[];
    ritual?: boolean;
    concentration?: boolean;
    query?: string;
  }
): ProcessedSpell[] {
  let filtered = spells;
  
  if (filters.levels && filters.levels.length > 0) {
    filtered = filtered.filter(spell => filters.levels!.includes(spell.level));
  }
  
  if (filters.schools && filters.schools.length > 0) {
    filtered = filtered.filter(spell => 
      filters.schools!.includes(spell.school) || 
      filters.schools!.includes(spell.schoolName)
    );
  }
  
  if (filters.classes && filters.classes.length > 0) {
    filtered = filtered.filter(spell => 
      filters.classes!.some(cls => spell.classes.includes(cls))
    );
  }
  
  if (filters.sources && filters.sources.length > 0) {
    filtered = filtered.filter(spell => filters.sources!.includes(spell.source));
  }
  
  if (filters.ritual !== undefined) {
    filtered = filtered.filter(spell => spell.isRitual === filters.ritual);
  }
  
  if (filters.concentration !== undefined) {
    filtered = filtered.filter(spell => spell.concentration === filters.concentration);
  }
  
  if (filters.query) {
    filtered = searchSpells(filtered, filters.query);
  }
  
  return filtered;
} 