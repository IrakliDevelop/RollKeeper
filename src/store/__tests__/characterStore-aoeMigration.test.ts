import { describe, it, expect } from 'vitest';
import { useCharacterStore } from '@/store/characterStore';
import type { CharacterState, Spell } from '@/types/character';

const FIREBALL_DESC =
  'Each creature in a 20-foot-radius sphere centered on that point must make a Dexterity saving throw.';
const CURE_WOUNDS_DESC =
  'A creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability modifier.';

function makeSpell(overrides: Partial<Spell>): Spell {
  return {
    id: `spell-${overrides.name}`,
    name: 'Unnamed',
    level: 1,
    school: 'Evocation',
    castingTime: '1 action',
    range: '150 feet',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Instantaneous',
    description: '',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Build a legacy blob: current default character + spells, JSON round-tripped
 *  so undefined keys drop exactly like localStorage persistence. */
function makeLegacyCharacter(spells: Spell[]): CharacterState {
  const base = useCharacterStore.getState().character;
  return JSON.parse(JSON.stringify({ ...base, spells }));
}

describe('characterStore AoE lazy migration', () => {
  it('back-fills aoe on legacy spells during loadCharacterState', () => {
    const legacy = makeLegacyCharacter([
      makeSpell({ name: 'Fireball', level: 3, description: FIREBALL_DESC }),
      makeSpell({
        name: 'Cure Wounds',
        range: 'Touch',
        description: CURE_WOUNDS_DESC,
      }),
    ]);
    // sanity: legacy spells have no aoe key at all
    expect('aoe' in legacy.spells[0]).toBe(false);

    useCharacterStore.getState().loadCharacterState(legacy);
    const spells = useCharacterStore.getState().character.spells;

    expect(spells.find(s => s.name === 'Fireball')?.aoe).toEqual({
      shape: 'circle',
      sizeFeet: 20,
    });
    expect(spells.find(s => s.name === 'Cure Wounds')?.aoe).toBeNull();
  });

  it('never overwrites an explicit null (user cleared a detectable spell)', () => {
    const legacy = makeLegacyCharacter([
      makeSpell({
        name: 'Fireball',
        level: 3,
        description: FIREBALL_DESC,
        aoe: null,
      }),
    ]);
    useCharacterStore.getState().loadCharacterState(legacy);
    expect(
      useCharacterStore
        .getState()
        .character.spells.find(s => s.name === 'Fireball')?.aoe
    ).toBeNull();
  });

  it('never overwrites a user-set value', () => {
    const legacy = makeLegacyCharacter([
      makeSpell({
        name: 'Fireball',
        level: 3,
        description: FIREBALL_DESC,
        aoe: { shape: 'square', sizeFeet: 40 },
      }),
    ]);
    useCharacterStore.getState().loadCharacterState(legacy);
    expect(
      useCharacterStore
        .getState()
        .character.spells.find(s => s.name === 'Fireball')?.aoe
    ).toEqual({ shape: 'square', sizeFeet: 40 });
  });
});
