import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCastSpell } from '@/hooks/useCastSpell';
import { useCharacterStore } from '@/store/characterStore';
import type { Spell } from '@/types/character';

function makeSpell(overrides: Partial<Spell> = {}): Spell {
  return {
    id: 'spell-1',
    name: 'Test Spell',
    level: 3,
    school: 'Evocation',
    castingTime: '1 action',
    range: '150 feet',
    components: { verbal: true, somatic: true, material: false },
    duration: 'Instantaneous',
    description: 'Test.',
    aoe: null,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function seedCharacter() {
  const store = useCharacterStore.getState();
  const base = store.character;
  store.loadCharacterState({
    ...base,
    spells: [makeSpell()],
    spellSlots: {
      ...base.spellSlots,
      3: { max: 2, used: 0 },
      4: { max: 1, used: 0 },
    },
    pactMagic: { slots: { max: 2, used: 0 }, level: 3 },
    concentration: {
      isConcentrating: false,
      spellName: undefined,
      spellId: undefined,
      castLevel: undefined,
    } as typeof base.concentration,
    reaction: { hasUsedReaction: false },
  } as typeof base);
}

const getChar = () => useCharacterStore.getState().character;

describe('useCastSpell', () => {
  beforeEach(() => {
    seedCharacter();
  });

  it('spends a slot at the chosen (upcast) level', () => {
    const { result } = renderHook(() => useCastSpell());
    act(() => result.current.castSpell(makeSpell(), { level: 4 }));
    expect(getChar().spellSlots[4].used).toBe(1);
    expect(getChar().spellSlots[3].used).toBe(0);
  });

  it('cantrips spend nothing', () => {
    const { result } = renderHook(() => useCastSpell());
    act(() => result.current.castSpell(makeSpell({ level: 0 }), { level: 0 }));
    expect(getChar().spellSlots[3].used).toBe(0);
    expect(getChar().pactMagic?.slots.used).toBe(0);
  });

  it('ritual casts spend no slot (fixes the ignored-isRitual bug)', () => {
    const { result } = renderHook(() => useCastSpell());
    act(() =>
      result.current.castSpell(makeSpell({ ritual: true }), {
        level: 3,
        isRitual: true,
      })
    );
    expect(getChar().spellSlots[3].used).toBe(0);
  });

  it('pact casts spend a pact slot, not a regular slot', () => {
    const { result } = renderHook(() => useCastSpell());
    act(() =>
      result.current.castSpell(makeSpell(), { level: 3, usePact: true })
    );
    expect(getChar().pactMagic?.slots.used).toBe(1);
    expect(getChar().spellSlots[3].used).toBe(0);
  });

  it('free casts increment freeCastsUsed on innate spells', () => {
    const innate = makeSpell({ freeCastMax: 2, freeCastsUsed: 0 });
    useCharacterStore.getState().updateCharacter({ spells: [innate] });
    const { result } = renderHook(() => useCastSpell());
    act(() =>
      result.current.castSpell(innate, { level: 3, useFreecast: true })
    );
    expect(getChar().spells.find(s => s.id === innate.id)?.freeCastsUsed).toBe(
      1
    );
    expect(getChar().spellSlots[3].used).toBe(0);
  });

  it('replaces existing concentration', () => {
    const { result } = renderHook(() => useCastSpell());
    act(() =>
      result.current.castSpell(
        makeSpell({ id: 'a', name: 'First', concentration: true }),
        { level: 3 }
      )
    );
    expect(getChar().concentration.isConcentrating).toBe(true);
    expect(getChar().concentration.spellName).toBe('First');
    act(() =>
      result.current.castSpell(
        makeSpell({ id: 'b', name: 'Second', concentration: true }),
        { level: 3 }
      )
    );
    expect(getChar().concentration.spellName).toBe('Second');
  });

  it('auto-uses the reaction for reaction spells (once)', () => {
    const { result } = renderHook(() => useCastSpell());
    act(() =>
      result.current.castSpell(makeSpell({ castingTime: '1 reaction' }), {
        level: 3,
      })
    );
    expect(getChar().reaction?.hasUsedReaction).toBe(true);
    // second reaction cast must NOT toggle it back off
    act(() =>
      result.current.castSpell(makeSpell({ castingTime: '1 reaction' }), {
        level: 3,
      })
    );
    expect(getChar().reaction?.hasUsedReaction).toBe(true);
  });
});
