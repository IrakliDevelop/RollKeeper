/**
 * Additional Spells Resolver
 * Looks up parsed spell references against the ProcessedSpell database
 * and builds character Spell objects with the correct grant properties.
 */

import { ProcessedSpell } from '@/types/spells';
import { Spell } from '@/types/character';
import {
  convertProcessedSpellToFormData,
  convertFormDataToSpell,
} from './spellConversion';
import type {
  ParsedAdditionalSpells,
  ParsedGrantedSpell,
  GrantType,
  SpellChooseFilter,
} from './additionalSpellsParser';

export interface ResolvedSpell {
  spell: Spell;
  grantLabel: string;
}

export interface ResolveResult {
  resolved: ResolvedSpell[];
  unresolved: string[];
}

function findSpellByName(
  name: string,
  allSpells: ProcessedSpell[]
): ProcessedSpell | undefined {
  const lower = name.toLowerCase().trim();
  return (
    allSpells.find(s => s.name.toLowerCase() === lower) ??
    allSpells.find(
      s =>
        s.name.toLowerCase().replace(/['']/g, "'") ===
        lower.replace(/['']/g, "'")
    )
  );
}

function applyGrantProperties(
  spell: Spell,
  grant: Pick<
    ParsedGrantedSpell,
    'grantType' | 'freeCastMax' | 'restType' | 'isAlwaysPrepared'
  >,
  featName: string
): Spell {
  const updated = { ...spell, castingSource: featName };

  switch (grant.grantType) {
    case 'prepared':
      updated.isAlwaysPrepared = true;
      updated.isPrepared = true;
      if (grant.freeCastMax !== undefined) {
        updated.freeCastMax = grant.freeCastMax;
        updated.freeCastsUsed = 0;
      }
      break;

    case 'innate_daily':
      updated.freeCastMax = grant.freeCastMax ?? 1;
      updated.freeCastsUsed = 0;
      break;

    case 'innate_rest':
      updated.freeCastMax = grant.freeCastMax ?? 1;
      updated.freeCastsUsed = 0;
      break;

    case 'innate_will':
      updated.freeCastMax = 0;
      updated.freeCastsUsed = 0;
      break;

    case 'innate_ritual':
      updated.ritual = true;
      break;

    case 'known':
      break;
  }

  if (grant.isAlwaysPrepared) {
    updated.isAlwaysPrepared = true;
    updated.isPrepared = true;
  }

  return updated;
}

function processedSpellToCharacterSpell(
  processed: ProcessedSpell,
  grantType: GrantType,
  freeCastMax: number | undefined,
  restType: 'short' | 'long' | undefined,
  isAlwaysPrepared: boolean | undefined,
  featName: string
): Spell {
  const formData = convertProcessedSpellToFormData(processed);
  const spell = convertFormDataToSpell(formData);

  return applyGrantProperties(
    spell,
    { grantType, freeCastMax, restType, isAlwaysPrepared },
    featName
  );
}

/**
 * Resolve all concrete (named) spells from parsed additional spells data.
 */
export function resolveGrantedSpells(
  parsed: ParsedAdditionalSpells,
  allSpells: ProcessedSpell[],
  featName: string
): ResolveResult {
  const resolved: ResolvedSpell[] = [];
  const unresolved: string[] = [];

  for (const grant of parsed.concrete) {
    const found = findSpellByName(grant.spellName, allSpells);
    if (found) {
      const spell = processedSpellToCharacterSpell(
        found,
        grant.grantType,
        grant.freeCastMax,
        grant.restType,
        grant.isAlwaysPrepared,
        featName
      );
      resolved.push({
        spell,
        grantLabel: grantLabelForType(grant.grantType, grant.freeCastMax),
      });
    } else {
      unresolved.push(grant.spellName);
    }
  }

  return { resolved, unresolved };
}

/**
 * Convert a ProcessedSpell chosen by the user into a character Spell
 * with the correct grant properties from a choose-type entry.
 */
export function resolveChosenSpell(
  processed: ProcessedSpell,
  grantType: GrantType,
  freeCastMax: number | undefined,
  restType: 'short' | 'long' | undefined,
  isAlwaysPrepared: boolean | undefined,
  featName: string
): Spell {
  return processedSpellToCharacterSpell(
    processed,
    grantType,
    freeCastMax,
    restType,
    isAlwaysPrepared,
    featName
  );
}

/**
 * Filter the full spell list based on a choose filter from the JSON data.
 */
export function filterSpellsByChooseFilter(
  allSpells: ProcessedSpell[],
  filter: SpellChooseFilter
): ProcessedSpell[] {
  return allSpells.filter(spell => {
    if (filter.level !== undefined && spell.level !== filter.level)
      return false;

    if (filter.className) {
      const classLower = filter.className.toLowerCase();
      const matchesClass = spell.classes?.some(
        c => c.toLowerCase() === classLower
      );
      if (!matchesClass) return false;
    }

    if (filter.schools && filter.schools.length > 0) {
      const matchesSchool = filter.schools.some(
        s => s.toLowerCase() === spell.schoolName.toLowerCase()
      );
      if (!matchesSchool) return false;
    }

    if (filter.ritual && !spell.isRitual) return false;

    return true;
  });
}

function grantLabelForType(grantType: GrantType, freeCastMax?: number): string {
  switch (grantType) {
    case 'prepared':
      return 'Always Prepared';
    case 'innate_daily':
      return freeCastMax === 1
        ? '1/Long Rest (free)'
        : `${freeCastMax}/Long Rest (free)`;
    case 'innate_rest':
      return freeCastMax === 1
        ? '1/Short Rest (free)'
        : `${freeCastMax}/Short Rest (free)`;
    case 'innate_will':
      return 'At Will';
    case 'innate_ritual':
      return 'Ritual Only';
    case 'known':
      return 'Known Spell';
    default:
      return '';
  }
}
