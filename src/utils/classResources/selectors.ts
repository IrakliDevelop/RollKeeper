import { CharacterState } from '@/types/character';
import { getProficiencyBonus } from '@/utils/calculations';

import { CLASS_RESOURCE_DEFINITIONS } from './registry';
import { ActiveClassResource } from './types';

interface CharacterClassEntry {
  className: string;
  level: number;
  classSource?: string;
}

function getCharacterClasses(character: CharacterState): CharacterClassEntry[] {
  if (character.classes && character.classes.length > 0) {
    return character.classes;
  }
  if (character.class?.name) {
    return [{ className: character.class.name, level: character.level || 1 }];
  }
  return [];
}

/**
 * All class resources this character currently has, with computed maxima.
 *
 * Edition: 2024 (XPHB) is the default ruleset. Until a PHB (2014) registry
 * exists, classes with classSource 'PHB' also resolve to XPHB definitions.
 * TODO(2014-registry): respect entry.classSource === 'PHB' here.
 */
export function getActiveClassResources(
  character: CharacterState
): ActiveClassResource[] {
  const classes = getCharacterClasses(character);
  const proficiencyBonus = getProficiencyBonus(
    character.totalLevel ?? character.level ?? 1
  );
  // Cast keeps Task 1 standalone; the field lands on CharacterState in Task 2.
  const stored = (
    character as { classResources?: Record<string, { usesExpended: number }> }
  ).classResources;

  const result: ActiveClassResource[] = [];
  for (const entry of classes) {
    const definitions = CLASS_RESOURCE_DEFINITIONS.filter(
      d =>
        d.edition === 'XPHB' &&
        d.className.toLowerCase() === entry.className.toLowerCase() &&
        entry.level >= d.minLevel
    );
    for (const definition of definitions) {
      const ctx = {
        classLevel: entry.level,
        abilities: character.abilities,
        proficiencyBonus,
      };
      const maxUses = definition.getMaxUses(ctx);
      if (maxUses <= 0) continue;
      const usesExpended = Math.min(
        stored?.[definition.id]?.usesExpended ?? 0,
        maxUses
      );
      result.push({
        definition,
        classLevel: entry.level,
        maxUses,
        die: definition.getDie?.(entry.level),
        usesExpended,
        usesRemaining: maxUses - usesExpended,
      });
    }
  }
  return result;
}
