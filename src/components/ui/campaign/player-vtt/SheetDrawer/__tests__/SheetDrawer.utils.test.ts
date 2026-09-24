import { describe, it, expect } from 'vitest';

import { useCharacterStore } from '@/store/characterStore';
import type { CharacterState } from '@/types/character';

import {
  buildAbilityCells,
  buildHeaderView,
  buildHitDice,
  buildPassives,
  buildSlotSummary,
  buildVitalsView,
} from '../SheetDrawer.utils';

function fixture(overrides: Partial<CharacterState> = {}): CharacterState {
  const base = useCharacterStore.getState().character;
  return {
    ...base,
    name: 'Kaelen Voss',
    race: 'Half-Elf',
    background: 'Outlander',
    level: 7,
    totalLevel: 7,
    classes: [
      {
        className: 'Ranger',
        level: 5,
        isCustom: false,
        hitDie: 10,
        subclass: 'Hunter',
      },
      { className: 'Fighter', level: 2, isCustom: false, hitDie: 10 },
    ],
    abilities: {
      strength: 12,
      dexterity: 18,
      constitution: 14,
      intelligence: 10,
      wisdom: 15,
      charisma: 8,
    },
    hitPoints: { ...base.hitPoints, current: 38, max: 44, temporary: 0 },
    hitDicePools: { d10: { max: 7, used: 3 } },
    speed: 35,
    ...overrides,
  } as CharacterState;
}

describe('buildHeaderView', () => {
  it('formats the multiclass subtitle and chips', () => {
    const view = buildHeaderView(
      fixture({
        concentration: { isConcentrating: true, spellName: "Hunter's Mark" },
        heroicInspiration: { count: 1 },
      })
    );
    expect(view.subtitle).toBe(
      'Half-Elf · Ranger 5 (Hunter) / Fighter 2 · Outlander'
    );
    expect(view.level).toBe(7);
    expect(view.initial).toBe('K');
    expect(view.concentration).toBe("Hunter's Mark");
    expect(view.inspired).toBe(true);
  });

  it('separates exhaustion from other conditions', () => {
    const base = fixture();
    const view = buildHeaderView({
      ...base,
      conditionsAndDiseases: {
        ...base.conditionsAndDiseases,
        activeConditions: [
          {
            id: 'a',
            name: 'Prone',
            source: 'XPHB',
            description: '',
            stackable: false,
            count: 1,
            appliedAt: '',
          },
          {
            id: 'b',
            name: 'Exhaustion',
            source: 'XPHB',
            description: '',
            stackable: true,
            count: 2,
            appliedAt: '',
          },
        ],
      },
    });
    expect(view.conditions).toEqual(['Prone']);
    expect(view.exhaustion).toBe(2);
  });
});

describe('buildVitalsView', () => {
  it('computes HP percent, proficiency bonus and speed', () => {
    const v = buildVitalsView(fixture());
    expect(v.hpPercent).toBeCloseTo((38 / 44) * 100);
    expect(v.proficiencyBonus).toBe(3);
    expect(v.initiative).toBe(4);
  });
});

describe('buildAbilityCells', () => {
  it('returns six cells in STR..CHA order with save proficiency', () => {
    const base = fixture();
    const cells = buildAbilityCells({
      ...base,
      savingThrows: {
        ...base.savingThrows,
        dexterity: { ...base.savingThrows.dexterity, proficient: true },
      },
    });
    expect(cells.map(c => c.abbr)).toEqual([
      'STR',
      'DEX',
      'CON',
      'INT',
      'WIS',
      'CHA',
    ]);
    const dex = cells[1];
    expect(dex.modifier).toBe(4);
    expect(dex.save).toBe(7);
    expect(dex.saveProficient).toBe(true);
  });
});

describe('buildHitDice', () => {
  it('reports remaining per die type and tolerates missing pools', () => {
    expect(buildHitDice(fixture())).toEqual([
      { dieType: 'd10', remaining: 4, max: 7 },
    ]);
    expect(buildHitDice(fixture({ hitDicePools: undefined }))).toEqual([]);
  });
});

describe('buildSlotSummary', () => {
  it('lists only levels with slots, plus pact slots', () => {
    const base = fixture();
    const summary = buildSlotSummary({
      ...base,
      spellSlots: {
        ...base.spellSlots,
        1: { max: 4, used: 1 },
        2: { max: 2, used: 0 },
      },
      pactMagic: { level: 2, slots: { max: 2, used: 1 } },
    });
    expect(summary).toEqual([
      { label: '1st', remaining: 3, max: 4 },
      { label: '2nd', remaining: 2, max: 2 },
      { label: 'Pact 2nd', remaining: 1, max: 2 },
    ]);
  });
});

describe('buildPassives', () => {
  it('includes passive perception, insight and investigation', () => {
    const labels = buildPassives(fixture()).map(p => p.label);
    expect(labels).toEqual(['Perception', 'Insight', 'Investigation']);
  });
});
