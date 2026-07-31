import { describe, it, expect, beforeEach } from 'vitest';
import { useCharacterStore } from '@/store/characterStore';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import type { CharacterState } from '@/types/character';

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

describe('rest integration', () => {
  it('short rest: bard 4 keeps expended uses, bard 5 regains all (Font of Inspiration)', () => {
    loadBard(4);
    let store = useCharacterStore.getState();
    store.useClassResource('bardic-inspiration', 2);
    store.takeShortRest();
    expect(
      useCharacterStore.getState().character.classResources?.[
        'bardic-inspiration'
      ]?.usesExpended
    ).toBe(2);

    loadBard(5);
    store = useCharacterStore.getState();
    store.useClassResource('bardic-inspiration', 2);
    store.takeShortRest();
    expect(
      useCharacterStore.getState().character.classResources?.[
        'bardic-inspiration'
      ]?.usesExpended
    ).toBe(0);
  });

  it('short rest: barbarian regains exactly one rage', () => {
    useCharacterStore.setState({
      character: makeCharacter({
        classes: [
          { className: 'Barbarian', level: 3, isCustom: false, hitDie: 12 },
        ],
        totalLevel: 3,
        classResources: { rage: { usesExpended: 3 } },
      }),
    });
    useCharacterStore.getState().takeShortRest();
    expect(
      useCharacterStore.getState().character.classResources?.['rage']
        ?.usesExpended
    ).toBe(2);
  });

  it('short rest: monk regains all focus, sorcery points untouched', () => {
    useCharacterStore.setState({
      character: makeCharacter({
        classes: [
          { className: 'Monk', level: 5, isCustom: false, hitDie: 8 },
          { className: 'Sorcerer', level: 3, isCustom: false, hitDie: 6 },
        ],
        totalLevel: 8,
        classResources: {
          'focus-points': { usesExpended: 4 },
          'sorcery-points': { usesExpended: 2 },
        },
      }),
    });
    useCharacterStore.getState().takeShortRest();
    const resources =
      useCharacterStore.getState().character.classResources ?? {};
    expect(resources['focus-points']?.usesExpended).toBe(0);
    expect(resources['sorcery-points']?.usesExpended).toBe(2);
  });

  it('long rest resets every class resource, including stale keys', () => {
    useCharacterStore.setState({
      character: makeCharacter({
        classes: [
          { className: 'Paladin', level: 6, isCustom: false, hitDie: 10 },
        ],
        totalLevel: 6,
        classResources: {
          'lay-on-hands': { usesExpended: 12 },
          'channel-divinity-paladin': { usesExpended: 1 },
          'stale-old-key': { usesExpended: 3 },
        },
      }),
    });
    useCharacterStore.getState().takeLongRest();
    const resources =
      useCharacterStore.getState().character.classResources ?? {};
    expect(resources['lay-on-hands']?.usesExpended).toBe(0);
    expect(resources['channel-divinity-paladin']?.usesExpended).toBe(0);
    expect(resources['stale-old-key']?.usesExpended).toBe(0);
  });
});

// `migrateCharacterData` (the normalization function in characterStore.ts
// that contains the "Ensure classResources exists" migration block) is not
// exported, so these tests exercise it through `loadCharacterState`, the
// public entry point that calls it — same pattern used by
// characterStore-persistence.test.ts and characterStore-aoeMigration.test.ts.
describe('legacy bardicInspiration migration', () => {
  it('copies legacy usesExpended into classResources and drops the old field', () => {
    const legacy = {
      ...makeCharacter({
        classes: [{ className: 'Bard', level: 5, isCustom: false, hitDie: 8 }],
        totalLevel: 5,
      }),
      bardicInspiration: { usesExpended: 2 },
      classResources: undefined,
    } as unknown as CharacterState;

    useCharacterStore.getState().loadCharacterState(legacy);
    const migrated = useCharacterStore.getState().character;

    expect(migrated.classResources?.['bardic-inspiration']?.usesExpended).toBe(
      2
    );
    expect(
      (migrated as unknown as Record<string, unknown>).bardicInspiration
    ).toBeUndefined();
  });

  it('does not overwrite an already-migrated value', () => {
    const partiallyMigrated = {
      ...makeCharacter({}),
      bardicInspiration: { usesExpended: 2 },
      classResources: { 'bardic-inspiration': { usesExpended: 1 } },
    } as unknown as CharacterState;

    useCharacterStore.getState().loadCharacterState(partiallyMigrated);
    const migrated = useCharacterStore.getState().character;

    expect(migrated.classResources?.['bardic-inspiration']?.usesExpended).toBe(
      1
    );
  });
});
