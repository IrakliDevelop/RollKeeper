import { describe, it, expect, beforeEach } from 'vitest';

import { useCharacterStore } from '@/store/characterStore';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import type { Spell } from '@/types/character';

function makeSpell(overrides: Partial<Spell>): Spell {
  const now = new Date().toISOString();
  return {
    id: 'spell_test',
    name: 'Test Cantrip',
    level: 0,
    school: 'Evocation',
    castingTime: '1 action',
    range: 'Touch',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Instantaneous',
    description: 'Test',
    damage: '1d8',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const TABLE = { 1: '1d8', 5: '2d8', 11: '3d8', 17: '4d8' };

describe('backfillCantripScaling', () => {
  beforeEach(() => {
    useCharacterStore.setState({
      character: makeCharacter({
        spells: [
          makeSpell({ id: 's-fresh' }),
          makeSpell({ id: 's-custom', damageScaling: null }),
          makeSpell({ id: 's-done', damageScaling: { 1: '1d8', 5: '2d8' } }),
          makeSpell({ id: 's-leveled', level: 3 }),
        ],
      }),
    });
  });

  it('attaches scaling only to never-enriched cantrips', () => {
    useCharacterStore
      .getState()
      .backfillCantripScaling([{ spellId: 's-fresh', scaling: TABLE }]);
    const spells = useCharacterStore.getState().character.spells;
    expect(spells.find(s => s.id === 's-fresh')!.damageScaling).toEqual(TABLE);
  });

  it('never overwrites null (user-custom) or existing tables', () => {
    useCharacterStore.getState().backfillCantripScaling([
      { spellId: 's-custom', scaling: TABLE },
      { spellId: 's-done', scaling: TABLE },
    ]);
    const spells = useCharacterStore.getState().character.spells;
    expect(spells.find(s => s.id === 's-custom')!.damageScaling).toBeNull();
    expect(spells.find(s => s.id === 's-done')!.damageScaling).toEqual({
      1: '1d8',
      5: '2d8',
    });
  });

  it('ignores non-cantrips and unknown ids', () => {
    useCharacterStore.getState().backfillCantripScaling([
      { spellId: 's-leveled', scaling: TABLE },
      { spellId: 'nope', scaling: TABLE },
    ]);
    const spells = useCharacterStore.getState().character.spells;
    expect(
      spells.find(s => s.id === 's-leveled')!.damageScaling
    ).toBeUndefined();
  });

  it('is a no-op (same character reference) when nothing applies', () => {
    const before = useCharacterStore.getState().character;
    useCharacterStore
      .getState()
      .backfillCantripScaling([{ spellId: 's-custom', scaling: TABLE }]);
    expect(useCharacterStore.getState().character).toBe(before);
  });

  it('does not touch base damage', () => {
    useCharacterStore
      .getState()
      .backfillCantripScaling([{ spellId: 's-fresh', scaling: TABLE }]);
    expect(
      useCharacterStore
        .getState()
        .character.spells.find(s => s.id === 's-fresh')!.damage
    ).toBe('1d8');
  });
});
