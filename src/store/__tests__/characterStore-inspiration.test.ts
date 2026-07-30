import { describe, it, expect, beforeEach } from 'vitest';
import { useCharacterStore } from '@/store/characterStore';
import { makeCharacter } from '@/utils/__tests__/test-utils';

function reset(overrides = {}) {
  useCharacterStore.setState({
    character: makeCharacter(overrides),
    hasUnsavedChanges: false,
    saveStatus: 'saved',
    lastSaved: null,
    showDeathAnimation: false,
    showLevelUpAnimation: false,
    levelUpAnimationLevel: 1,
  });
}

describe('heroic inspiration stackable toggle', () => {
  beforeEach(() => reset());

  it('addHeroicInspiration caps at 1 when stackable is off', () => {
    reset({ stackableInspiration: false, heroicInspiration: { count: 0 } });
    const { addHeroicInspiration } = useCharacterStore.getState();
    addHeroicInspiration(1);
    addHeroicInspiration(1);
    expect(useCharacterStore.getState().character.heroicInspiration.count).toBe(
      1
    );
  });

  it('addHeroicInspiration stacks when stackable is on', () => {
    reset({ stackableInspiration: true, heroicInspiration: { count: 0 } });
    const { addHeroicInspiration } = useCharacterStore.getState();
    addHeroicInspiration(1);
    addHeroicInspiration(1);
    expect(useCharacterStore.getState().character.heroicInspiration.count).toBe(
      2
    );
  });

  it('setStackableInspiration(false) clamps an existing stack to 1', () => {
    reset({ stackableInspiration: true, heroicInspiration: { count: 3 } });
    useCharacterStore.getState().setStackableInspiration(false);
    const c = useCharacterStore.getState().character;
    expect(c.stackableInspiration).toBe(false);
    expect(c.heroicInspiration.count).toBe(1);
  });

  it('setStackableInspiration(true) leaves the count untouched', () => {
    reset({ stackableInspiration: false, heroicInspiration: { count: 1 } });
    useCharacterStore.getState().setStackableInspiration(true);
    expect(useCharacterStore.getState().character.heroicInspiration.count).toBe(
      1
    );
  });

  it('loadCharacterState clamps count to 1 when stackable is off', () => {
    const char = makeCharacter({
      stackableInspiration: false,
      heroicInspiration: { count: 4 },
    });
    useCharacterStore.getState().loadCharacterState(char);
    expect(useCharacterStore.getState().character.heroicInspiration.count).toBe(
      1
    );
  });

  it('migration defaults missing stackableInspiration to false', () => {
    const char = makeCharacter({ heroicInspiration: { count: 0 } });
    delete (char as { stackableInspiration?: boolean }).stackableInspiration;
    useCharacterStore.getState().loadCharacterState(char);
    expect(useCharacterStore.getState().character.stackableInspiration).toBe(
      false
    );
  });
});
