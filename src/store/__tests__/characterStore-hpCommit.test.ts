import { beforeEach, expect, it } from 'vitest';
import { useCharacterStore } from '../characterStore';

beforeEach(() => useCharacterStore.getState().resetCharacter());
it('direct HP targets start and clear death saves without spending temp HP', () => {
  useCharacterStore.setState(state => ({
    character: {
      ...state.character,
      hitPoints: {
        current: 20,
        max: 30,
        temporary: 7,
        calculationMode: 'manual',
      },
    },
  }));
  useCharacterStore.getState().setCurrentHitPoints(0);
  expect(useCharacterStore.getState().character.hitPoints).toMatchObject({
    current: 0,
    temporary: 7,
    deathSaves: { successes: 0, failures: 0 },
  });
  useCharacterStore.getState().setCurrentHitPoints(12);
  expect(useCharacterStore.getState().character.hitPoints).toMatchObject({
    current: 12,
    temporary: 7,
  });
  expect(
    useCharacterStore.getState().character.hitPoints.deathSaves
  ).toBeUndefined();
});
it('clamps targets and leaves a no-op character unchanged', () => {
  useCharacterStore.getState().setCurrentHitPoints(999);
  const character = useCharacterStore.getState().character;
  expect(character.hitPoints.current).toBe(character.hitPoints.max);
  useCharacterStore.getState().setCurrentHitPoints(999);
  expect(useCharacterStore.getState().character).toBe(character);
  useCharacterStore.getState().setCurrentHitPoints(-4);
  expect(useCharacterStore.getState().character.hitPoints.current).toBe(0);
});
