import { describe, it, expect, beforeEach } from 'vitest';
import { useCharacterStore } from '@/store/characterStore';
import { makeCharacter } from '@/utils/__tests__/test-utils';

describe('days spent actions', () => {
  beforeEach(() => {
    useCharacterStore.setState({
      character: makeCharacter({ daysSpent: 2 }),
    });
  });

  it('incrementDaysSpent adds the given amount', () => {
    useCharacterStore.getState().incrementDaysSpent(3);
    expect(useCharacterStore.getState().character.daysSpent).toBe(5);
  });

  it('incrementDaysSpent defaults to one day when called with no amount', () => {
    useCharacterStore.getState().incrementDaysSpent();
    expect(useCharacterStore.getState().character.daysSpent).toBe(3);
  });

  it('incrementDaysSpent treats a non-numeric amount as one day', () => {
    // The HUD passes the action straight to onClick, so the first argument
    // can be a MouseEvent. That must never poison daysSpent with NaN.
    useCharacterStore
      .getState()
      .incrementDaysSpent(new Event('click') as unknown as number);
    expect(useCharacterStore.getState().character.daysSpent).toBe(3);
  });

  it('updateDaysSpent ignores NaN and clamps at zero', () => {
    useCharacterStore.getState().updateDaysSpent(Number.NaN);
    expect(useCharacterStore.getState().character.daysSpent).toBe(2);
    useCharacterStore.getState().updateDaysSpent(-4);
    expect(useCharacterStore.getState().character.daysSpent).toBe(0);
  });
});
