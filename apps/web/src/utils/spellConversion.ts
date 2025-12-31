/**
 * Spell Conversion Utility
 * Converts ProcessedSpell (spellbook) to character Spell format
 */

import { ProcessedSpell } from '@/types/spells';
import { Spell, SpellActionType } from '@/types/character';
import { formatSpellDescriptionForEditor } from './referenceParser';

/**
 * Convert ProcessedSpell (from spellbook) to SpellFormData (for character sheet)
 */
export interface SpellFormData {
  name: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  components: {
    verbal: boolean;
    somatic: boolean;
    material: boolean;
    materialDescription: string;
  };
  duration: string;
  description: string;
  higherLevel: string;
  ritual: boolean;
  concentration: boolean;
  isPrepared: boolean;
  isAlwaysPrepared: boolean;
  actionType: SpellActionType | '';
  savingThrow: string;
  damage: string;
  damageType: string;
  source: string;
}

/**
 * Extract damage dice from description tags like {@damage 1d8} or {@dice 1d6}
 */
function extractDamageDice(description: string): string {
  // Match {@damage XdY} or {@dice XdY} patterns
  const damagePattern = /\{@(?:damage|dice)\s+(\d+d\d+(?:\s*\+\s*\d+)?)\}/i;
  const match = description.match(damagePattern);

  if (match && match[1]) {
    return match[1].trim();
  }

  // Also try to find standalone dice notation (e.g., "takes 3d6 fire damage")
  const standaloneDicePattern =
    /(?:takes|deals?)\s+(\d+d\d+(?:\s*\+\s*\d+)?)\s+(?:damage|fire|cold|lightning|thunder|acid|poison|necrotic|radiant|psychic|force)/i;
  const standaloneMatch = description.match(standaloneDicePattern);

  if (standaloneMatch && standaloneMatch[1]) {
    return standaloneMatch[1].trim();
  }

  return '';
}

/**
 * Normalize casting time to match character sheet format
 */
function normalizeCastingTime(castingTime: string): string {
  // Handle common formatting differences
  const normalized = castingTime.toLowerCase().trim();

  // Convert "1 bonus" to "1 bonus action"
  if (normalized === '1 bonus') {
    return '1 bonus action';
  }

  // Convert "1 reaction" to match (already correct, but ensure consistency)
  if (normalized.match(/^1 reaction/)) {
    return '1 reaction';
  }

  // Convert "N actions" to "1 action" (most common)
  if (normalized.match(/^\d+ action$/)) {
    return castingTime.replace(/(\d+) action$/, '$1 action');
  }

  // Return as-is if already in correct format
  return castingTime;
}

/**
 * Infer action type from spell metadata
 */
function inferActionType(spell: ProcessedSpell): SpellActionType | '' {
  // If spell has saving throws, it's likely a save spell
  if (spell.saves && spell.saves.length > 0) {
    return 'save';
  }

  // Check tags for attack-related indicators
  const attackTags = [
    'attack',
    'spell attack',
    'ranged spell attack',
    'melee spell attack',
  ];
  const hasAttackTag = spell.tags?.some(tag =>
    attackTags.some(attackTag => tag.toLowerCase().includes(attackTag))
  );

  if (hasAttackTag) {
    return 'attack';
  }

  // Check description for attack keywords
  const descriptionLower = spell.description.toLowerCase();
  if (
    descriptionLower.includes('spell attack') ||
    descriptionLower.includes('attack roll')
  ) {
    return 'attack';
  }

  // Check description for saving throw keywords
  if (
    descriptionLower.includes('saving throw') ||
    descriptionLower.includes('must succeed')
  ) {
    return 'save';
  }

  // Default to utility if no clear indicators
  return 'utility';
}

/**
 * Convert ProcessedSpell to SpellFormData
 */
export function convertProcessedSpellToFormData(
  spell: ProcessedSpell
): SpellFormData {
  const actionType = inferActionType(spell);

  // Extract damage dice from description (still parse this as it's not in JSON)
  const extractedDamage = extractDamageDice(spell.description);

  // Get damage type from spell metadata (damageInflict property) - more reliable!
  const damageType = spell.damage?.[0] || '';

  // Get saving throw from spell metadata - more reliable!
  const savingThrow = spell.saves?.[0] || '';

  // Capitalize first letter of saving throw if it exists
  const formattedSavingThrow = savingThrow
    ? savingThrow.charAt(0).toUpperCase() + savingThrow.slice(1)
    : '';

  // Format descriptions for WYSIWYG editor with bold references
  const formattedDescription = formatSpellDescriptionForEditor(
    spell.description
  );
  const formattedHigherLevel = spell.higherLevelDescription
    ? formatSpellDescriptionForEditor(spell.higherLevelDescription)
    : '';

  return {
    name: spell.name,
    level: spell.level,
    school: spell.schoolName, // Use full school name
    castingTime: normalizeCastingTime(spell.castingTime), // Normalize casting time format
    range: spell.range,
    components: {
      verbal: spell.components.verbal,
      somatic: spell.components.somatic,
      material: spell.components.material,
      materialDescription: spell.components.materialComponent || '',
    },
    duration: spell.duration,
    description: formattedDescription,
    higherLevel: formattedHigherLevel,
    ritual: spell.isRitual,
    concentration: spell.concentration,
    isPrepared: false, // Default to unprepared
    isAlwaysPrepared: false, // Default to not always prepared
    actionType: actionType,
    savingThrow: formattedSavingThrow, // Use from metadata (e.g., "Dexterity")
    damage: extractedDamage, // Use extracted damage dice from description
    damageType: damageType, // Use from metadata (e.g., "fire")
    source: spell.source,
  };
}

/**
 * Convert SpellFormData to character Spell
 */
export function convertFormDataToSpell(
  formData: SpellFormData,
  existingId?: string
): Spell {
  const now = new Date().toISOString();

  return {
    id:
      existingId ||
      `spell_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: formData.name,
    level: formData.level,
    school: formData.school,
    castingTime: formData.castingTime,
    range: formData.range,
    components: {
      verbal: formData.components.verbal,
      somatic: formData.components.somatic,
      material: formData.components.material,
      materialDescription: formData.components.materialDescription || undefined,
    },
    duration: formData.duration,
    description: formData.description,
    higherLevel: formData.higherLevel || undefined,
    ritual: formData.ritual || undefined,
    concentration: formData.concentration || undefined,
    isPrepared: formData.isPrepared || undefined,
    isAlwaysPrepared: formData.isAlwaysPrepared || undefined,
    actionType: formData.actionType || undefined,
    savingThrow: formData.savingThrow || undefined,
    damage: formData.damage || undefined,
    damageType: formData.damageType || undefined,
    source: formData.source || undefined,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Search and filter spells by query
 */
export function searchSpells(
  spells: ProcessedSpell[],
  query: string
): ProcessedSpell[] {
  if (!query.trim()) {
    return spells;
  }

  const queryLower = query.toLowerCase().trim();

  return spells
    .filter(spell => {
      const nameLower = spell.name.toLowerCase();
      const schoolLower = spell.schoolName.toLowerCase();
      const descriptionLower = spell.description.toLowerCase();

      return (
        nameLower.includes(queryLower) ||
        schoolLower.includes(queryLower) ||
        descriptionLower.includes(queryLower) ||
        spell.tags?.some(tag => tag.toLowerCase().includes(queryLower))
      );
    })
    .sort((a, b) => {
      // Sort by relevance: exact match first, then starts with, then contains
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();

      const aExact = aName === queryLower;
      const bExact = bName === queryLower;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      const aStarts = aName.startsWith(queryLower);
      const bStarts = bName.startsWith(queryLower);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      // Then sort alphabetically
      return aName.localeCompare(bName);
    });
}
