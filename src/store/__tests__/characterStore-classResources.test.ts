import { describe, it, expect, beforeEach } from 'vitest';
import { useCharacterStore } from '@/store/characterStore';
import { makeCharacter } from '@/utils/__tests__/test-utils';

function loadBard(level = 5, charisma = 16) {
  useCharacterStore.setState({
    character: makeCharacter({
      classes: [{ className: 'Bard', level, isCustom: false, hitDie: 8 }],
      totalLevel: level,
      abilities: {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma,
      },
      classResources: {},
    }),
  });
}

describe('class resource actions', () => {
  beforeEach(() => loadBard());

  it('useClassResource increments and clamps at computed max', () => {
    const store = useCharacterStore.getState();
    store.useClassResource('bardic-inspiration');
    store.useClassResource('bardic-inspiration');
    store.useClassResource('bardic-inspiration');
    store.useClassResource('bardic-inspiration'); // beyond max (CHA 16 -> 3)
    expect(
      useCharacterStore.getState().character.classResources?.[
        'bardic-inspiration'
      ]?.usesExpended
    ).toBe(3);
  });

  it('useClassResource ignores unknown/inactive resource ids', () => {
    useCharacterStore.getState().useClassResource('rage'); // bard has no rage
    expect(
      useCharacterStore.getState().character.classResources?.['rage']
    ).toBeUndefined();
  });

  it('restoreClassResource decrements and floors at 0', () => {
    const store = useCharacterStore.getState();
    store.useClassResource('bardic-inspiration');
    store.restoreClassResource('bardic-inspiration');
    store.restoreClassResource('bardic-inspiration');
    expect(
      useCharacterStore.getState().character.classResources?.[
        'bardic-inspiration'
      ]?.usesExpended
    ).toBe(0);
  });

  it('supports amount for pool resources', () => {
    useCharacterStore.setState({
      character: makeCharacter({
        classes: [
          { className: 'Paladin', level: 4, isCustom: false, hitDie: 10 },
        ],
        totalLevel: 4,
        classResources: {},
      }),
    });
    const store = useCharacterStore.getState();
    store.useClassResource('lay-on-hands', 5); // pool of 20
    store.useClassResource('lay-on-hands', 100); // clamps to 20
    expect(
      useCharacterStore.getState().character.classResources?.['lay-on-hands']
        ?.usesExpended
    ).toBe(20);
    store.restoreClassResource('lay-on-hands', 5);
    expect(
      useCharacterStore.getState().character.classResources?.['lay-on-hands']
        ?.usesExpended
    ).toBe(15);
  });

  it('resetClassResource zeroes expenditure', () => {
    const store = useCharacterStore.getState();
    store.useClassResource('bardic-inspiration', 2);
    store.resetClassResource('bardic-inspiration');
    expect(
      useCharacterStore.getState().character.classResources?.[
        'bardic-inspiration'
      ]?.usesExpended
    ).toBe(0);
  });
});
