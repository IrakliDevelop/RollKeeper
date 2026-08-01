import { describe, it, expect, beforeAll } from 'vitest';

import { loadAllSpells } from '@/utils/spellDataLoader';
import { convertProcessedSpellToFormData } from '@/utils/spellConversion';
import type { ProcessedSpell } from '@/types/spells';

// Loads the real json/spells/*.json data — pins that scalingLevelDice
// survives processing and conversion into a character-ready scaling table.
let spells: ProcessedSpell[];

beforeAll(async () => {
  spells = await loadAllSpells();
});

function spellBySource(name: string, source: string): ProcessedSpell {
  const found = spells.find(s => s.name === name && s.source === source);
  expect(found, `${name} (${source}) should exist`).toBeDefined();
  return found!;
}

describe('cantrip scaling real-data pipeline', () => {
  it('Shocking Grasp (PHB2024) converts with the full scaling table', () => {
    const form = convertProcessedSpellToFormData(
      spellBySource('Shocking Grasp', 'PHB2024')
    );
    expect(form.damageScaling).toEqual({
      1: '1d8',
      5: '2d8',
      11: '3d8',
      17: '4d8',
    });
  });

  it('Shillelagh (PHB2024) scales dice size, not count', () => {
    const form = convertProcessedSpellToFormData(
      spellBySource('Shillelagh', 'PHB2024')
    );
    expect(form.damageScaling).toEqual({
      1: '1d8',
      5: '1d10',
      11: '1d12',
      17: '2d6',
    });
  });

  it('Toll the Dead (PHB2024) picks the base d8 track from the array shape', () => {
    const form = convertProcessedSpellToFormData(
      spellBySource('Toll the Dead', 'PHB2024')
    );
    expect(form.damageScaling?.[1]).toBe('1d8');
    expect(form.damageScaling?.[5]).toBe('2d8');
  });

  it('Eldritch Blast (PHB2024) has no scaling table (ray-count scaling)', () => {
    const form = convertProcessedSpellToFormData(
      spellBySource('Eldritch Blast', 'PHB2024')
    );
    expect(form.damageScaling).toBeUndefined();
  });

  it('leveled spells never get a scaling table', () => {
    const form = convertProcessedSpellToFormData(
      spellBySource('Fireball', 'PHB2024')
    );
    expect(form.damageScaling).toBeUndefined();
  });

  it('every processed cantrip with scalingLevelDice yields a usable table', () => {
    const scalingCantrips = spells.filter(
      s => s.isCantrip && s.scalingLevelDice
    );
    expect(scalingCantrips.length).toBeGreaterThanOrEqual(30);
    for (const spell of scalingCantrips) {
      const form = convertProcessedSpellToFormData(spell);
      expect(
        form.damageScaling,
        `${spell.name} (${spell.source})`
      ).toBeDefined();
      // No level-1 row guaranteed (True Strike starts at 5) — but every row
      // that exists must be plain rollable dice, never a {{...}} template.
      const rows = Object.values(form.damageScaling!);
      expect(rows.length, `${spell.name} rows`).toBeGreaterThan(0);
      for (const dice of rows) {
        expect(dice, `${spell.name} (${spell.source}) row`).toMatch(
          /^\d+d\d+$/
        );
      }
    }
  });
});
