import { ProcessedMonster, BestiaryFilters } from '@/types/bestiary';
import { formatAlignment } from './bestiaryUtils';

/**
 * Parse CR string to number for comparison
 */
function parseCR(cr: string): number {
  if (!cr || cr === 'Unknown') return 0;
  
  if (cr.includes('/')) {
    const [numerator, denominator] = cr.split('/');
    return parseInt(numerator, 10) / parseInt(denominator, 10);
  }
  
  return parseFloat(cr) || 0;
}

/**
 * Filter monsters based on the provided filters
 */
export function filterMonsters(monsters: ProcessedMonster[], filters: BestiaryFilters): ProcessedMonster[] {
  return monsters.filter(monster => {
    // Search query filter
    if (filters.searchQuery) {
      const searchLower = filters.searchQuery.toLowerCase();
      const monsterType = typeof monster.type === 'string' ? monster.type : monster.type.type;
      const searchFields = [
        monster.name,
        monsterType,
        formatAlignment(monster.alignment),
        Array.isArray(monster.size) ? monster.size.join(' ') : monster.size,
        monster.cr,
        monster.source
      ].join(' ').toLowerCase();
      
      if (!searchFields.includes(searchLower)) {
        return false;
      }
    }

    // Size filter
    if (filters.sizes.length > 0) {
      const monsterSizes = Array.isArray(monster.size) ? monster.size : [monster.size || 'Unknown'];
      const hasMatchingSize = monsterSizes.some(size => 
        filters.sizes.some(filterSize => 
          size.toLowerCase().includes(filterSize.toLowerCase()) ||
          filterSize.toLowerCase().includes(size.toLowerCase())
        )
      );
      if (!hasMatchingSize) {
        return false;
      }
    }

    // Type filter
    if (filters.types.length > 0) {
      const monsterType = String(monster.type);
      const hasMatchingType = filters.types.some(type => 
        monsterType.toLowerCase().includes(type.toLowerCase())
      );
      if (!hasMatchingType) {
        return false;
      }
    }

    // Alignment filter
    if (filters.alignments.length > 0) {
      const monsterAlignment = formatAlignment(monster.alignment);
      const hasMatchingAlignment = filters.alignments.some(alignment => 
        monsterAlignment.toLowerCase().includes(alignment.toLowerCase()) ||
        alignment.toLowerCase().includes(monsterAlignment.toLowerCase())
      );
      if (!hasMatchingAlignment) {
        return false;
      }
    }

    // CR Range filter
    if (filters.crRange.min !== undefined || filters.crRange.max !== undefined) {
      const monsterCR = parseCR(monster.cr);
      
      if (filters.crRange.min !== undefined && monsterCR < filters.crRange.min) {
        return false;
      }
      
      if (filters.crRange.max !== undefined && monsterCR > filters.crRange.max) {
        return false;
      }
    }

    // Source filter
    if (filters.sources.length > 0) {
      if (!filters.sources.includes(monster.source)) {
        return false;
      }
    }

    // Special properties filters
    if (filters.hasLegendaryActions === true) {
      if (!monster.legendaryActions || monster.legendaryActions.length === 0) {
        return false;
      }
    }

    if (filters.hasSpellcasting === true) {
      // Check if monster has spellcasting in traits or actions
      const hasSpellcasting = [
        ...(monster.traits || []),
        ...(monster.actions || [])
      ].some(trait => 
        trait.name.toLowerCase().includes('spellcasting') ||
        trait.text.toLowerCase().includes('spell') ||
        trait.text.toLowerCase().includes('cantrip')
      );
      
      if (!hasSpellcasting) {
        return false;
      }
    }

    if (filters.hasConditionImmunities === true) {
      if (!monster.immunities || monster.immunities === 'None' || monster.immunities.trim() === '') {
        return false;
      }
    }

    if (filters.hasDamageResistances === true) {
      if (!monster.resistances || monster.resistances === 'None' || monster.resistances.trim() === '') {
        return false;
      }
    }

    return true;
  });
}
