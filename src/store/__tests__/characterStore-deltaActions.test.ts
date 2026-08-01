import { describe, it, expect, beforeEach } from 'vitest';

import { useCharacterStore } from '@/store/characterStore';
import { DEFAULT_CHARACTER_STATE } from '@/utils/constants';
import type { CharacterState } from '@/types/character';

const caster = (): CharacterState =>
  ({
    ...DEFAULT_CHARACTER_STATE,
    id: 'delta-char',
    revision: 1,
    spellSlots: {
      ...DEFAULT_CHARACTER_STATE.spellSlots,
      3: { max: 3, used: 0 },
    },
    pactMagic: { slots: { max: 2, used: 0 }, level: 3 },
  }) as unknown as CharacterState;

beforeEach(() => {
  useCharacterStore.getState().loadCharacterState(caster());
});

describe('delta spell slot actions', () => {
  it('two spends accumulate (the absolute-setter collapse case)', () => {
    useCharacterStore.getState().spendSpellSlot(3, 1);
    useCharacterStore.getState().spendSpellSlot(3, 1);
    expect(useCharacterStore.getState().character.spellSlots[3].used).toBe(2);
  });

  it('clamps at max and at 0, and no-ops emit no revision bump', () => {
    useCharacterStore.getState().spendSpellSlot(3, 99);
    expect(useCharacterStore.getState().character.spellSlots[3].used).toBe(3);
    const revision = useCharacterStore.getState().character.revision;
    useCharacterStore.getState().spendSpellSlot(3, 1); // already at max — no-op
    expect(useCharacterStore.getState().character.revision).toBe(revision);
    useCharacterStore.getState().restoreSpellSlot(3, 99);
    expect(useCharacterStore.getState().character.spellSlots[3].used).toBe(0);
  });

  it('pact magic deltas accumulate and clamp', () => {
    useCharacterStore.getState().spendPactMagicSlot();
    useCharacterStore.getState().spendPactMagicSlot();
    useCharacterStore.getState().spendPactMagicSlot();
    expect(useCharacterStore.getState().character.pactMagic?.slots.used).toBe(
      2
    );
    useCharacterStore.getState().restorePactMagicSlot(1);
    expect(useCharacterStore.getState().character.pactMagic?.slots.used).toBe(
      1
    );
  });
});

describe('idempotent AC setters', () => {
  it('setShieldEquipped(true) twice is one state change, no second revision', () => {
    useCharacterStore.getState().setShieldEquipped(true);
    const revision = useCharacterStore.getState().character.revision;
    useCharacterStore.getState().setShieldEquipped(true);
    expect(useCharacterStore.getState().character.isWearingShield).toBe(true);
    expect(useCharacterStore.getState().character.revision).toBe(revision);
  });

  it('setTempACActive is idempotent both directions', () => {
    useCharacterStore.getState().setTempACActive(true);
    useCharacterStore.getState().setTempACActive(true);
    expect(useCharacterStore.getState().character.isTempACActive).toBe(true);
    useCharacterStore.getState().setTempACActive(false);
    expect(useCharacterStore.getState().character.isTempACActive).toBe(false);
  });
});
