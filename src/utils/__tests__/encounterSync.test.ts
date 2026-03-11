import { describe, it, expect } from 'vitest';
import {
  mergePlayerSyncData,
  hasPlayerDataChanged,
} from '@/utils/encounterSync';
import {
  createMockEncounterEntity,
  createMockPlayerData,
  createMockCharacterState,
  createMockCondition,
} from '@/test/helpers';

describe('mergePlayerSyncData', () => {
  it('returns HP/AC from character data', () => {
    const entity = createMockEncounterEntity({
      type: 'player',
      currentHp: 30,
      maxHp: 44,
      armorClass: 16,
    });
    const playerData = createMockPlayerData({
      characterData: createMockCharacterState({
        hitPoints: {
          current: 38,
          max: 44,
          temporary: 0,
          calculationMode: 'auto',
        },
        armorClass: 18,
        isWearingShield: false,
      }),
    });

    const result = mergePlayerSyncData(entity, playerData)!;
    expect(result.currentHp).toBe(38);
    expect(result.maxHp).toBe(44);
    expect(result.armorClass).toBe(18);
  });

  it('returns null when characterData is missing', () => {
    const entity = createMockEncounterEntity({ type: 'player' });
    const playerData = createMockPlayerData({
      characterData: undefined as never,
    });

    const result = mergePlayerSyncData(entity, playerData);
    expect(result).toBeNull();
  });

  it('calculates AC with temp AC when active', () => {
    const entity = createMockEncounterEntity({
      type: 'player',
      armorClass: 16,
    });
    const playerData = createMockPlayerData({
      characterData: createMockCharacterState({
        armorClass: 16,
        tempArmorClass: 5,
        isTempACActive: true,
        isWearingShield: false,
      }),
    });

    const result = mergePlayerSyncData(entity, playerData)!;
    // base 16 + temp 5 = 21
    expect(result.armorClass).toBe(21);
  });

  it('uses base armorClass when isTempACActive is false', () => {
    const entity = createMockEncounterEntity({
      type: 'player',
      armorClass: 16,
    });
    const playerData = createMockPlayerData({
      characterData: createMockCharacterState({
        armorClass: 18,
        tempArmorClass: 5,
        isTempACActive: false,
        isWearingShield: false,
      }),
    });

    const result = mergePlayerSyncData(entity, playerData)!;
    expect(result.armorClass).toBe(18);
  });

  it('includes shield bonus in AC calculation', () => {
    const entity = createMockEncounterEntity({
      type: 'player',
      armorClass: 16,
    });
    const playerData = createMockPlayerData({
      characterData: createMockCharacterState({
        armorClass: 16,
        isWearingShield: true,
        shieldBonus: 2,
      }),
    });

    const result = mergePlayerSyncData(entity, playerData)!;
    // base 16 + shield 2 = 18
    expect(result.armorClass).toBe(18);
  });

  it('includes both temp AC and shield bonus', () => {
    const entity = createMockEncounterEntity({
      type: 'player',
      armorClass: 14,
    });
    const playerData = createMockPlayerData({
      characterData: createMockCharacterState({
        armorClass: 14,
        tempArmorClass: 3,
        isTempACActive: true,
        isWearingShield: true,
        shieldBonus: 2,
      }),
    });

    const result = mergePlayerSyncData(entity, playerData)!;
    // base 14 + temp 3 + shield 2 = 19
    expect(result.armorClass).toBe(19);
  });

  it('returns concentration spell when active', () => {
    const entity = createMockEncounterEntity({ type: 'player' });
    const playerData = createMockPlayerData({
      characterData: createMockCharacterState({
        concentration: {
          isConcentrating: true,
          spellName: 'Bless',
        },
      }),
    });

    const result = mergePlayerSyncData(entity, playerData)!;
    expect(result.concentrationSpell).toBe('Bless');
  });

  it('returns undefined concentrationSpell when not concentrating', () => {
    const entity = createMockEncounterEntity({ type: 'player' });
    const playerData = createMockPlayerData({
      characterData: createMockCharacterState({
        concentration: {
          isConcentrating: false,
        },
      }),
    });

    const result = mergePlayerSyncData(entity, playerData)!;
    expect(result.concentrationSpell).toBeUndefined();
  });

  it('preserves DM-added conditions', () => {
    const entity = createMockEncounterEntity({
      type: 'player',
      conditions: [
        createMockCondition({ id: 'dm-1', name: 'Stunned', source: 'dm' }),
      ],
    });
    const playerData = createMockPlayerData({
      characterData: createMockCharacterState({
        conditionsAndDiseases: {
          activeConditions: [],
          activeDiseases: [],
          exhaustionVariant: '2024',
        },
      }),
    });

    const result = mergePlayerSyncData(entity, playerData)!;
    expect(result.conditions).toHaveLength(1);
    expect(result.conditions![0].name).toBe('Stunned');
    expect(result.conditions![0].source).toBe('dm');
  });

  it('replaces player-synced conditions with fresh data', () => {
    const entity = createMockEncounterEntity({
      type: 'player',
      conditions: [
        createMockCondition({
          id: 'psync-old',
          name: 'Poisoned',
          source: 'player-sync',
        }),
        createMockCondition({ id: 'dm-1', name: 'Stunned', source: 'dm' }),
      ],
    });
    const playerData = createMockPlayerData({
      characterData: createMockCharacterState({
        conditionsAndDiseases: {
          activeConditions: [
            {
              id: 'cond-1',
              name: 'Blinded',
              source: 'PHB',
              description: 'Cannot see.',
              stackable: false,
              count: 1,
              appliedAt: '2025-01-01T00:00:00.000Z',
            },
          ],
          activeDiseases: [],
          exhaustionVariant: '2024',
        },
      }),
    });

    const result = mergePlayerSyncData(entity, playerData)!;
    expect(result.conditions).toHaveLength(2);

    const names = result.conditions!.map(c => c.name);
    expect(names).toContain('Stunned'); // DM condition preserved
    expect(names).toContain('Blinded'); // new player condition
    expect(names).not.toContain('Poisoned'); // old player condition removed
  });

  it('deduplicates DM conditions when player has same-name condition', () => {
    const entity = createMockEncounterEntity({
      type: 'player',
      conditions: [
        createMockCondition({ id: 'dm-1', name: 'Poisoned', source: 'dm' }),
      ],
    });
    const playerData = createMockPlayerData({
      characterData: createMockCharacterState({
        conditionsAndDiseases: {
          activeConditions: [
            {
              id: 'cond-1',
              name: 'Poisoned',
              source: 'PHB',
              description: 'Disadvantage on attacks.',
              stackable: false,
              count: 1,
              appliedAt: '2025-01-01T00:00:00.000Z',
            },
          ],
          activeDiseases: [],
          exhaustionVariant: '2024',
        },
      }),
    });

    const result = mergePlayerSyncData(entity, playerData)!;
    // Should have only one Poisoned (player-sync wins, DM duplicate removed)
    const poisonedConditions = result.conditions!.filter(
      c => c.name === 'Poisoned'
    );
    expect(poisonedConditions).toHaveLength(1);
    expect(poisonedConditions[0].source).toBe('player-sync');
  });

  it('handles temp HP from character data', () => {
    const entity = createMockEncounterEntity({
      type: 'player',
      tempHp: 0,
    });
    const playerData = createMockPlayerData({
      characterData: createMockCharacterState({
        hitPoints: {
          current: 44,
          max: 44,
          temporary: 10,
          calculationMode: 'auto',
        },
      }),
    });

    const result = mergePlayerSyncData(entity, playerData)!;
    expect(result.tempHp).toBe(10);
  });
});

describe('hasPlayerDataChanged', () => {
  it('returns false when nothing changed', () => {
    const entity = createMockEncounterEntity({
      currentHp: 20,
      maxHp: 20,
      tempHp: 0,
      armorClass: 15,
      concentrationSpell: undefined,
      conditions: [],
    });
    const updates = {
      currentHp: 20,
      maxHp: 20,
      tempHp: 0,
      armorClass: 15,
      concentrationSpell: undefined,
      conditions: [],
    };

    expect(hasPlayerDataChanged(entity, updates)).toBe(false);
  });

  it('returns true when HP changed', () => {
    const entity = createMockEncounterEntity({ currentHp: 20 });
    expect(hasPlayerDataChanged(entity, { currentHp: 15 })).toBe(true);
  });

  it('returns true when maxHp changed', () => {
    const entity = createMockEncounterEntity({ maxHp: 20 });
    expect(hasPlayerDataChanged(entity, { maxHp: 25 })).toBe(true);
  });

  it('returns true when tempHp changed', () => {
    const entity = createMockEncounterEntity({ tempHp: 0 });
    expect(hasPlayerDataChanged(entity, { tempHp: 5 })).toBe(true);
  });

  it('returns true when AC changed', () => {
    const entity = createMockEncounterEntity({ armorClass: 15 });
    expect(hasPlayerDataChanged(entity, { armorClass: 18 })).toBe(true);
  });

  it('returns true when concentration changed', () => {
    const entity = createMockEncounterEntity({ concentrationSpell: undefined });
    expect(hasPlayerDataChanged(entity, { concentrationSpell: 'Bless' })).toBe(
      true
    );
  });

  it('returns true when conditions changed', () => {
    const entity = createMockEncounterEntity({
      conditions: [createMockCondition({ name: 'Poisoned', source: 'dm' })],
    });
    expect(
      hasPlayerDataChanged(entity, {
        conditions: [
          createMockCondition({ name: 'Poisoned', source: 'dm' }),
          createMockCondition({ name: 'Blinded', source: 'player-sync' }),
        ],
      })
    ).toBe(true);
  });

  it('returns false when conditions have same name-source pairs', () => {
    const conditions = [
      createMockCondition({ name: 'Poisoned', source: 'dm' }),
    ];
    const entity = createMockEncounterEntity({
      currentHp: 20,
      maxHp: 20,
      tempHp: 0,
      armorClass: 15,
      concentrationSpell: undefined,
      conditions,
    });
    expect(
      hasPlayerDataChanged(entity, {
        currentHp: 20,
        maxHp: 20,
        tempHp: 0,
        armorClass: 15,
        concentrationSpell: undefined,
        conditions: [...conditions],
      })
    ).toBe(false);
  });
});
