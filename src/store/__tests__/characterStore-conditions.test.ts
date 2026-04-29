import { describe, it, expect, beforeEach } from 'vitest';
import { useCharacterStore } from '@/store/characterStore';
import { usePlayerStore } from '@/store/playerStore';
import { makeCharacter } from '@/utils/__tests__/test-utils';

function resetStore(overrides = {}) {
  useCharacterStore.setState({
    character: makeCharacter(overrides),
    hasUnsavedChanges: false,
    saveStatus: 'saved',
    lastSaved: null,
    showDeathAnimation: false,
    showLevelUpAnimation: false,
    levelUpAnimationLevel: 1,
  });
  usePlayerStore.setState({
    characters: [],
    activeCharacterId: null,
    settings: { enableDeathAnimation: false, enableLevelUpAnimation: false },
    lastSelectedCharacterId: null,
  });
}

// ============================================================
// CONDITIONS
// ============================================================

describe('characterStore — conditions', () => {
  beforeEach(() => resetStore());

  describe('addCondition', () => {
    it('adds a condition to activeConditions', () => {
      useCharacterStore
        .getState()
        .addCondition('Poisoned', 'PHB', 'Disadvantage on attacks and checks');
      const { activeConditions } =
        useCharacterStore.getState().character.conditionsAndDiseases;
      expect(activeConditions).toHaveLength(1);
      expect(activeConditions[0].name).toBe('Poisoned');
      expect(activeConditions[0].source).toBe('PHB');
    });

    it('uses default count of 1 when count omitted', () => {
      useCharacterStore
        .getState()
        .addCondition('Stunned', 'PHB', 'Cannot take actions');
      const cond =
        useCharacterStore.getState().character.conditionsAndDiseases
          .activeConditions[0];
      expect(cond.count).toBe(1);
    });

    it('respects explicit count parameter', () => {
      useCharacterStore
        .getState()
        .addCondition('Exhaustion', 'PHB', 'Exhausted', 3);
      const cond =
        useCharacterStore.getState().character.conditionsAndDiseases
          .activeConditions[0];
      expect(cond.count).toBe(3);
    });

    it('marks stackable = true for exhaustion', () => {
      useCharacterStore
        .getState()
        .addCondition('Exhaustion', 'PHB', 'Exhausted');
      const cond =
        useCharacterStore.getState().character.conditionsAndDiseases
          .activeConditions[0];
      expect(cond.stackable).toBe(true);
    });

    it('marks stackable = false for non-exhaustion conditions', () => {
      useCharacterStore.getState().addCondition('Blinded', 'PHB', 'Cannot see');
      const cond =
        useCharacterStore.getState().character.conditionsAndDiseases
          .activeConditions[0];
      expect(cond.stackable).toBe(false);
    });

    it('stores optional notes', () => {
      useCharacterStore
        .getState()
        .addCondition(
          'Charmed',
          'PHB',
          'Charmed by creature',
          1,
          'By the dragon'
        );
      const cond =
        useCharacterStore.getState().character.conditionsAndDiseases
          .activeConditions[0];
      expect(cond.notes).toBe('By the dragon');
    });

    it('marks hasUnsavedChanges', () => {
      useCharacterStore.getState().addCondition('Frightened', 'PHB', 'Feared');
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });

    it('accumulates multiple conditions', () => {
      useCharacterStore.getState().addCondition('Blinded', 'PHB', 'A');
      useCharacterStore.getState().addCondition('Deafened', 'PHB', 'B');
      const { activeConditions } =
        useCharacterStore.getState().character.conditionsAndDiseases;
      expect(activeConditions).toHaveLength(2);
    });
  });

  describe('updateCondition', () => {
    it('updates notes on an existing condition', () => {
      useCharacterStore
        .getState()
        .addCondition('Paralyzed', 'PHB', 'Paralyzed');
      const id =
        useCharacterStore.getState().character.conditionsAndDiseases
          .activeConditions[0].id;

      useCharacterStore
        .getState()
        .updateCondition(id, { notes: 'Updated note' });
      const cond =
        useCharacterStore.getState().character.conditionsAndDiseases
          .activeConditions[0];
      expect(cond.notes).toBe('Updated note');
    });

    it('updates count on a condition', () => {
      useCharacterStore
        .getState()
        .addCondition('Exhaustion', 'PHB', 'Exhausted', 1);
      const id =
        useCharacterStore.getState().character.conditionsAndDiseases
          .activeConditions[0].id;

      useCharacterStore.getState().updateCondition(id, { count: 4 });
      const cond =
        useCharacterStore.getState().character.conditionsAndDiseases
          .activeConditions[0];
      expect(cond.count).toBe(4);
    });

    it('does not affect other conditions', () => {
      useCharacterStore.getState().addCondition('Blinded', 'PHB', 'A');
      useCharacterStore.getState().addCondition('Deafened', 'PHB', 'B');
      const conditions =
        useCharacterStore.getState().character.conditionsAndDiseases
          .activeConditions;
      const firstId = conditions[0].id;

      useCharacterStore
        .getState()
        .updateCondition(firstId, { notes: 'Only first' });
      const updated =
        useCharacterStore.getState().character.conditionsAndDiseases
          .activeConditions;
      expect(updated[0].notes).toBe('Only first');
      expect(updated[1].notes).toBeUndefined();
    });
  });

  describe('removeCondition', () => {
    it('removes the condition with the given id', () => {
      useCharacterStore.getState().addCondition('Prone', 'PHB', 'Knocked down');
      const id =
        useCharacterStore.getState().character.conditionsAndDiseases
          .activeConditions[0].id;

      useCharacterStore.getState().removeCondition(id);
      expect(
        useCharacterStore.getState().character.conditionsAndDiseases
          .activeConditions
      ).toHaveLength(0);
    });

    it('does not remove other conditions', () => {
      useCharacterStore.getState().addCondition('Prone', 'PHB', 'A');
      useCharacterStore.getState().addCondition('Restrained', 'PHB', 'B');
      const firstId =
        useCharacterStore.getState().character.conditionsAndDiseases
          .activeConditions[0].id;

      useCharacterStore.getState().removeCondition(firstId);
      const remaining =
        useCharacterStore.getState().character.conditionsAndDiseases
          .activeConditions;
      expect(remaining).toHaveLength(1);
      expect(remaining[0].name).toBe('Restrained');
    });
  });

  describe('clearAllConditions', () => {
    it('removes all active conditions', () => {
      useCharacterStore.getState().addCondition('Prone', 'PHB', 'A');
      useCharacterStore.getState().addCondition('Blinded', 'PHB', 'B');
      useCharacterStore.getState().clearAllConditions();
      expect(
        useCharacterStore.getState().character.conditionsAndDiseases
          .activeConditions
      ).toHaveLength(0);
    });

    it('marks hasUnsavedChanges', () => {
      useCharacterStore.getState().clearAllConditions();
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });
});

// ============================================================
// DISEASES
// ============================================================

describe('characterStore — diseases', () => {
  beforeEach(() => resetStore());

  describe('addDisease', () => {
    it('adds a disease to activeDiseases', () => {
      useCharacterStore
        .getState()
        .addDisease('Filth Fever', 'DMG', 'A nasty disease');
      const { activeDiseases } =
        useCharacterStore.getState().character.conditionsAndDiseases;
      expect(activeDiseases).toHaveLength(1);
      expect(activeDiseases[0].name).toBe('Filth Fever');
    });

    it('stores optional onsetTime', () => {
      useCharacterStore
        .getState()
        .addDisease('Blinding Sickness', 'DMG', 'Causes blindness', '1d4 days');
      const disease =
        useCharacterStore.getState().character.conditionsAndDiseases
          .activeDiseases[0];
      expect(disease.onsetTime).toBe('1d4 days');
    });

    it('stores optional notes', () => {
      useCharacterStore
        .getState()
        .addDisease(
          'Cackle Fever',
          'DMG',
          'Causes laughter',
          undefined,
          'From the hag'
        );
      const disease =
        useCharacterStore.getState().character.conditionsAndDiseases
          .activeDiseases[0];
      expect(disease.notes).toBe('From the hag');
    });

    it('marks hasUnsavedChanges', () => {
      useCharacterStore.getState().addDisease('Sewer Plague', 'DMG', 'Plague');
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });

  describe('updateDisease', () => {
    it('updates notes on an existing disease', () => {
      useCharacterStore
        .getState()
        .addDisease('Filth Fever', 'DMG', 'Description');
      const id =
        useCharacterStore.getState().character.conditionsAndDiseases
          .activeDiseases[0].id;

      useCharacterStore
        .getState()
        .updateDisease(id, { notes: 'Healed partially' });
      const disease =
        useCharacterStore.getState().character.conditionsAndDiseases
          .activeDiseases[0];
      expect(disease.notes).toBe('Healed partially');
    });

    it('does not affect other diseases', () => {
      useCharacterStore.getState().addDisease('Filth Fever', 'DMG', 'A');
      useCharacterStore.getState().addDisease('Cackle Fever', 'DMG', 'B');
      const firstId =
        useCharacterStore.getState().character.conditionsAndDiseases
          .activeDiseases[0].id;

      useCharacterStore
        .getState()
        .updateDisease(firstId, { notes: 'Only first' });
      const diseases =
        useCharacterStore.getState().character.conditionsAndDiseases
          .activeDiseases;
      expect(diseases[0].notes).toBe('Only first');
      expect(diseases[1].notes).toBeUndefined();
    });
  });

  describe('removeDisease', () => {
    it('removes the disease with the given id', () => {
      useCharacterStore
        .getState()
        .addDisease('Filth Fever', 'DMG', 'Description');
      const id =
        useCharacterStore.getState().character.conditionsAndDiseases
          .activeDiseases[0].id;

      useCharacterStore.getState().removeDisease(id);
      expect(
        useCharacterStore.getState().character.conditionsAndDiseases
          .activeDiseases
      ).toHaveLength(0);
    });
  });

  describe('clearAllDiseases', () => {
    it('removes all active diseases', () => {
      useCharacterStore.getState().addDisease('Filth Fever', 'DMG', 'A');
      useCharacterStore.getState().addDisease('Cackle Fever', 'DMG', 'B');
      useCharacterStore.getState().clearAllDiseases();
      expect(
        useCharacterStore.getState().character.conditionsAndDiseases
          .activeDiseases
      ).toHaveLength(0);
    });

    it('marks hasUnsavedChanges', () => {
      useCharacterStore.getState().clearAllDiseases();
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });
});

// ============================================================
// EXHAUSTION
// ============================================================

describe('characterStore — exhaustion variant', () => {
  beforeEach(() => resetStore());

  it('defaults to 2014 variant', () => {
    expect(
      useCharacterStore.getState().character.conditionsAndDiseases
        .exhaustionVariant
    ).toBe('2014');
  });

  it('switches to 2024 variant', () => {
    useCharacterStore.getState().setExhaustionVariant('2024');
    expect(
      useCharacterStore.getState().character.conditionsAndDiseases
        .exhaustionVariant
    ).toBe('2024');
  });

  it('switches back to 2014 variant', () => {
    useCharacterStore.getState().setExhaustionVariant('2024');
    useCharacterStore.getState().setExhaustionVariant('2014');
    expect(
      useCharacterStore.getState().character.conditionsAndDiseases
        .exhaustionVariant
    ).toBe('2014');
  });

  it('marks hasUnsavedChanges', () => {
    useCharacterStore.getState().setExhaustionVariant('2024');
    expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
  });
});

// ============================================================
// BUFFS
// ============================================================

describe('characterStore — buffs', () => {
  beforeEach(() => resetStore());

  const baseBuff = {
    name: 'Bless',
    source: 'Spell',
    effects: [
      {
        id: 'e1',
        targetStat: 'savingThrow' as const,
        mode: 'add' as const,
        value: 2,
      },
    ],
    isActive: true,
  };

  describe('addBuff', () => {
    it('adds a buff to temporaryBuffs', () => {
      useCharacterStore.getState().addBuff(baseBuff);
      expect(
        useCharacterStore.getState().character.temporaryBuffs
      ).toHaveLength(1);
      expect(
        useCharacterStore.getState().character.temporaryBuffs[0].name
      ).toBe('Bless');
    });

    it('generates a unique id', () => {
      useCharacterStore.getState().addBuff(baseBuff);
      useCharacterStore.getState().addBuff({ ...baseBuff, name: 'Haste' });
      const ids = useCharacterStore
        .getState()
        .character.temporaryBuffs.map(b => b.id);
      expect(ids[0]).not.toBe(ids[1]);
    });

    it('marks hasUnsavedChanges', () => {
      useCharacterStore.getState().addBuff(baseBuff);
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });

  describe('updateBuff', () => {
    it('updates buff name', () => {
      useCharacterStore.getState().addBuff(baseBuff);
      const id = useCharacterStore.getState().character.temporaryBuffs[0].id;

      useCharacterStore.getState().updateBuff(id, { name: 'Updated Bless' });
      expect(
        useCharacterStore.getState().character.temporaryBuffs[0].name
      ).toBe('Updated Bless');
    });

    it('does not affect other buffs', () => {
      useCharacterStore.getState().addBuff(baseBuff);
      useCharacterStore.getState().addBuff({ ...baseBuff, name: 'Haste' });
      const firstId =
        useCharacterStore.getState().character.temporaryBuffs[0].id;

      useCharacterStore.getState().updateBuff(firstId, { name: 'Renamed' });
      expect(
        useCharacterStore.getState().character.temporaryBuffs[1].name
      ).toBe('Haste');
    });
  });

  describe('deleteBuff', () => {
    it('removes a buff by id', () => {
      useCharacterStore.getState().addBuff(baseBuff);
      const id = useCharacterStore.getState().character.temporaryBuffs[0].id;

      useCharacterStore.getState().deleteBuff(id);
      expect(
        useCharacterStore.getState().character.temporaryBuffs
      ).toHaveLength(0);
    });

    it('does not remove other buffs', () => {
      useCharacterStore.getState().addBuff(baseBuff);
      useCharacterStore.getState().addBuff({ ...baseBuff, name: 'Haste' });
      const firstId =
        useCharacterStore.getState().character.temporaryBuffs[0].id;

      useCharacterStore.getState().deleteBuff(firstId);
      expect(
        useCharacterStore.getState().character.temporaryBuffs
      ).toHaveLength(1);
      expect(
        useCharacterStore.getState().character.temporaryBuffs[0].name
      ).toBe('Haste');
    });
  });

  describe('toggleBuff', () => {
    it('toggles isActive from true to false', () => {
      useCharacterStore.getState().addBuff({ ...baseBuff, isActive: true });
      const id = useCharacterStore.getState().character.temporaryBuffs[0].id;

      useCharacterStore.getState().toggleBuff(id);
      expect(
        useCharacterStore.getState().character.temporaryBuffs[0].isActive
      ).toBe(false);
    });

    it('toggles isActive from false to true', () => {
      useCharacterStore.getState().addBuff({ ...baseBuff, isActive: false });
      const id = useCharacterStore.getState().character.temporaryBuffs[0].id;

      useCharacterStore.getState().toggleBuff(id);
      expect(
        useCharacterStore.getState().character.temporaryBuffs[0].isActive
      ).toBe(true);
    });

    it('does nothing for unknown id', () => {
      useCharacterStore.getState().addBuff(baseBuff);
      useCharacterStore.getState().toggleBuff('nonexistent-id');
      // state should be unchanged
      expect(
        useCharacterStore.getState().character.temporaryBuffs[0].isActive
      ).toBe(true);
    });

    it('marks hasUnsavedChanges', () => {
      useCharacterStore.getState().addBuff(baseBuff);
      const id = useCharacterStore.getState().character.temporaryBuffs[0].id;
      useCharacterStore.setState({ hasUnsavedChanges: false });

      useCharacterStore.getState().toggleBuff(id);
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });

    it('applies tempHp side effect when activating a tempHp buff', () => {
      const tempHpBuff = {
        name: 'Aid',
        source: 'Spell',
        effects: [
          {
            id: 'e-tempHp',
            targetStat: 'tempHp' as const,
            mode: 'grant' as const,
            value: 10,
          },
        ],
        isActive: false,
      };
      useCharacterStore.getState().addBuff(tempHpBuff);
      const id = useCharacterStore.getState().character.temporaryBuffs[0].id;

      useCharacterStore.getState().toggleBuff(id);
      expect(
        useCharacterStore.getState().character.hitPoints.temporary
      ).toBeGreaterThanOrEqual(10);
    });

    it('applies damageResistance side effect when activating', () => {
      const resistBuff = {
        name: 'Protection from Fire',
        source: 'Spell',
        effects: [
          {
            id: 'e-resist',
            targetStat: 'damageResistance' as const,
            mode: 'grant' as const,
            value: 0,
            targetDamageType: 'fire',
          },
        ],
        isActive: false,
      };
      useCharacterStore.getState().addBuff(resistBuff);
      const id = useCharacterStore.getState().character.temporaryBuffs[0].id;

      useCharacterStore.getState().toggleBuff(id);
      expect(
        useCharacterStore.getState().character.damageResistances
      ).toContain('fire');
    });

    it('removes damageResistance side effect when deactivating', () => {
      const resistBuff = {
        name: 'Protection from Fire',
        source: 'Spell',
        effects: [
          {
            id: 'e-resist',
            targetStat: 'damageResistance' as const,
            mode: 'grant' as const,
            value: 0,
            targetDamageType: 'fire',
          },
        ],
        isActive: false,
      };
      useCharacterStore.getState().addBuff(resistBuff);
      const id = useCharacterStore.getState().character.temporaryBuffs[0].id;
      // Activate first
      useCharacterStore.getState().toggleBuff(id);
      expect(
        useCharacterStore.getState().character.damageResistances
      ).toContain('fire');
      // Then deactivate
      useCharacterStore.getState().toggleBuff(id);
      expect(
        useCharacterStore.getState().character.damageResistances
      ).not.toContain('fire');
    });
  });

  describe('clearAllBuffs', () => {
    it('removes all buffs', () => {
      useCharacterStore.getState().addBuff(baseBuff);
      useCharacterStore.getState().addBuff({ ...baseBuff, name: 'Haste' });
      useCharacterStore.getState().clearAllBuffs();
      expect(
        useCharacterStore.getState().character.temporaryBuffs
      ).toHaveLength(0);
    });

    it('marks hasUnsavedChanges', () => {
      useCharacterStore.getState().clearAllBuffs();
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });
});

// ============================================================
// DEFENSES
// ============================================================

describe('characterStore — damage immunities', () => {
  beforeEach(() => resetStore());

  it('adds a damage immunity', () => {
    useCharacterStore.getState().addDamageImmunity('fire');
    expect(useCharacterStore.getState().character.damageImmunities).toContain(
      'fire'
    );
  });

  it('does not duplicate a damage immunity', () => {
    useCharacterStore.getState().addDamageImmunity('fire');
    useCharacterStore.getState().addDamageImmunity('fire');
    expect(
      useCharacterStore
        .getState()
        .character.damageImmunities.filter(d => d === 'fire')
    ).toHaveLength(1);
  });

  it('removes a damage immunity', () => {
    useCharacterStore.getState().addDamageImmunity('fire');
    useCharacterStore.getState().removeDamageImmunity('fire');
    expect(
      useCharacterStore.getState().character.damageImmunities
    ).not.toContain('fire');
  });

  it('marks hasUnsavedChanges on add', () => {
    useCharacterStore.getState().addDamageImmunity('cold');
    expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
  });

  it('marks hasUnsavedChanges on remove', () => {
    useCharacterStore.getState().addDamageImmunity('cold');
    useCharacterStore.setState({ hasUnsavedChanges: false });
    useCharacterStore.getState().removeDamageImmunity('cold');
    expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
  });
});

describe('characterStore — damage resistances', () => {
  beforeEach(() => resetStore());

  it('adds a damage resistance', () => {
    useCharacterStore.getState().addDamageResistance('poison');
    expect(useCharacterStore.getState().character.damageResistances).toContain(
      'poison'
    );
  });

  it('does not duplicate a damage resistance', () => {
    useCharacterStore.getState().addDamageResistance('poison');
    useCharacterStore.getState().addDamageResistance('poison');
    expect(
      useCharacterStore
        .getState()
        .character.damageResistances.filter(r => r === 'poison')
    ).toHaveLength(1);
  });

  it('removes a damage resistance', () => {
    useCharacterStore.getState().addDamageResistance('poison');
    useCharacterStore.getState().removeDamageResistance('poison');
    expect(
      useCharacterStore.getState().character.damageResistances
    ).not.toContain('poison');
  });

  it('marks hasUnsavedChanges on add', () => {
    useCharacterStore.getState().addDamageResistance('necrotic');
    expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
  });
});

describe('characterStore — condition immunities', () => {
  beforeEach(() => resetStore());

  it('adds a condition immunity', () => {
    useCharacterStore.getState().addConditionImmunity('frightened');
    expect(
      useCharacterStore.getState().character.conditionImmunities
    ).toContain('frightened');
  });

  it('does not duplicate a condition immunity', () => {
    useCharacterStore.getState().addConditionImmunity('frightened');
    useCharacterStore.getState().addConditionImmunity('frightened');
    expect(
      useCharacterStore
        .getState()
        .character.conditionImmunities.filter(c => c === 'frightened')
    ).toHaveLength(1);
  });

  it('removes a condition immunity', () => {
    useCharacterStore.getState().addConditionImmunity('frightened');
    useCharacterStore.getState().removeConditionImmunity('frightened');
    expect(
      useCharacterStore.getState().character.conditionImmunities
    ).not.toContain('frightened');
  });

  it('marks hasUnsavedChanges on add', () => {
    useCharacterStore.getState().addConditionImmunity('charmed');
    expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
  });
});

// ============================================================
// SENSES
// ============================================================

describe('characterStore — senses', () => {
  beforeEach(() => resetStore());

  describe('addSense', () => {
    it('adds a sense', () => {
      useCharacterStore
        .getState()
        .addSense({ name: 'Darkvision', range: 60, source: 'Racial' });
      expect(useCharacterStore.getState().character.senses).toHaveLength(1);
      expect(useCharacterStore.getState().character.senses[0].name).toBe(
        'Darkvision'
      );
    });

    it('assigns a generated id', () => {
      useCharacterStore.getState().addSense({ name: 'Darkvision', range: 60 });
      expect(useCharacterStore.getState().character.senses[0].id).toBeTruthy();
    });

    it('marks hasUnsavedChanges', () => {
      useCharacterStore.getState().addSense({ name: 'Blindsight', range: 30 });
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });

    it('stores range correctly', () => {
      useCharacterStore.getState().addSense({ name: 'Tremorsense', range: 60 });
      expect(useCharacterStore.getState().character.senses[0].range).toBe(60);
    });
  });

  describe('updateSense', () => {
    it('updates range of an existing sense', () => {
      useCharacterStore.getState().addSense({ name: 'Darkvision', range: 60 });
      const id = useCharacterStore.getState().character.senses[0].id;

      useCharacterStore.getState().updateSense(id, { range: 120 });
      expect(useCharacterStore.getState().character.senses[0].range).toBe(120);
    });

    it('does not affect other senses', () => {
      useCharacterStore.getState().addSense({ name: 'Darkvision', range: 60 });
      useCharacterStore.getState().addSense({ name: 'Blindsight', range: 30 });
      const firstId = useCharacterStore.getState().character.senses[0].id;

      useCharacterStore.getState().updateSense(firstId, { range: 120 });
      expect(useCharacterStore.getState().character.senses[1].range).toBe(30);
    });
  });

  describe('removeSense', () => {
    it('removes a sense by id', () => {
      useCharacterStore.getState().addSense({ name: 'Darkvision', range: 60 });
      const id = useCharacterStore.getState().character.senses[0].id;

      useCharacterStore.getState().removeSense(id);
      expect(useCharacterStore.getState().character.senses).toHaveLength(0);
    });

    it('does not remove other senses', () => {
      useCharacterStore.getState().addSense({ name: 'Darkvision', range: 60 });
      useCharacterStore.getState().addSense({ name: 'Blindsight', range: 30 });
      const firstId = useCharacterStore.getState().character.senses[0].id;

      useCharacterStore.getState().removeSense(firstId);
      expect(useCharacterStore.getState().character.senses).toHaveLength(1);
      expect(useCharacterStore.getState().character.senses[0].name).toBe(
        'Blindsight'
      );
    });
  });
});

// ============================================================
// LANGUAGES
// ============================================================

describe('characterStore — languages', () => {
  beforeEach(() => resetStore());

  describe('addLanguage', () => {
    it('adds a language', () => {
      useCharacterStore.getState().addLanguage({ name: 'Elvish' });
      expect(useCharacterStore.getState().character.languages).toHaveLength(1);
      expect(useCharacterStore.getState().character.languages[0].name).toBe(
        'Elvish'
      );
    });

    it('assigns a generated id', () => {
      useCharacterStore.getState().addLanguage({ name: 'Draconic' });
      expect(
        useCharacterStore.getState().character.languages[0].id
      ).toBeTruthy();
    });

    it('stores optional script', () => {
      useCharacterStore
        .getState()
        .addLanguage({ name: 'Elvish', script: 'Elvish' });
      expect(useCharacterStore.getState().character.languages[0].script).toBe(
        'Elvish'
      );
    });

    it('marks hasUnsavedChanges', () => {
      useCharacterStore.getState().addLanguage({ name: 'Common' });
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });

    it('accumulates multiple languages', () => {
      useCharacterStore.getState().addLanguage({ name: 'Common' });
      useCharacterStore.getState().addLanguage({ name: 'Elvish' });
      expect(useCharacterStore.getState().character.languages).toHaveLength(2);
    });
  });

  describe('deleteLanguage', () => {
    it('removes a language by id', () => {
      useCharacterStore.getState().addLanguage({ name: 'Elvish' });
      const id = useCharacterStore.getState().character.languages[0].id;

      useCharacterStore.getState().deleteLanguage(id);
      expect(useCharacterStore.getState().character.languages).toHaveLength(0);
    });

    it('does not remove other languages', () => {
      useCharacterStore.getState().addLanguage({ name: 'Common' });
      useCharacterStore.getState().addLanguage({ name: 'Elvish' });
      const firstId = useCharacterStore.getState().character.languages[0].id;

      useCharacterStore.getState().deleteLanguage(firstId);
      expect(useCharacterStore.getState().character.languages).toHaveLength(1);
      expect(useCharacterStore.getState().character.languages[0].name).toBe(
        'Elvish'
      );
    });
  });
});

// ============================================================
// TOOL PROFICIENCIES
// ============================================================

describe('characterStore — tool proficiencies', () => {
  beforeEach(() => resetStore());

  const baseTool = {
    name: "Thieves' Tools",
    proficiencyLevel: 'proficient' as const,
  };

  describe('addToolProficiency', () => {
    it('adds a tool proficiency', () => {
      useCharacterStore.getState().addToolProficiency(baseTool);
      expect(
        useCharacterStore.getState().character.toolProficiencies
      ).toHaveLength(1);
      expect(
        useCharacterStore.getState().character.toolProficiencies[0].name
      ).toBe("Thieves' Tools");
    });

    it('assigns a generated id', () => {
      useCharacterStore.getState().addToolProficiency(baseTool);
      expect(
        useCharacterStore.getState().character.toolProficiencies[0].id
      ).toBeTruthy();
    });

    it('stores proficiency level correctly', () => {
      useCharacterStore
        .getState()
        .addToolProficiency({
          name: "Smith's Tools",
          proficiencyLevel: 'expertise',
        });
      expect(
        useCharacterStore.getState().character.toolProficiencies[0]
          .proficiencyLevel
      ).toBe('expertise');
    });

    it('marks hasUnsavedChanges', () => {
      useCharacterStore.getState().addToolProficiency(baseTool);
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });

  describe('updateToolProficiency', () => {
    it('updates proficiency level', () => {
      useCharacterStore.getState().addToolProficiency(baseTool);
      const id = useCharacterStore.getState().character.toolProficiencies[0].id;

      useCharacterStore
        .getState()
        .updateToolProficiency(id, { proficiencyLevel: 'expertise' });
      expect(
        useCharacterStore.getState().character.toolProficiencies[0]
          .proficiencyLevel
      ).toBe('expertise');
    });

    it('does not affect other tools', () => {
      useCharacterStore.getState().addToolProficiency(baseTool);
      useCharacterStore
        .getState()
        .addToolProficiency({
          name: "Smith's Tools",
          proficiencyLevel: 'none',
        });
      const firstId =
        useCharacterStore.getState().character.toolProficiencies[0].id;

      useCharacterStore
        .getState()
        .updateToolProficiency(firstId, { proficiencyLevel: 'expertise' });
      expect(
        useCharacterStore.getState().character.toolProficiencies[1]
          .proficiencyLevel
      ).toBe('none');
    });
  });

  describe('deleteToolProficiency', () => {
    it('removes a tool proficiency by id', () => {
      useCharacterStore.getState().addToolProficiency(baseTool);
      const id = useCharacterStore.getState().character.toolProficiencies[0].id;

      useCharacterStore.getState().deleteToolProficiency(id);
      expect(
        useCharacterStore.getState().character.toolProficiencies
      ).toHaveLength(0);
    });

    it('does not remove other tools', () => {
      useCharacterStore.getState().addToolProficiency(baseTool);
      useCharacterStore
        .getState()
        .addToolProficiency({
          name: "Smith's Tools",
          proficiencyLevel: 'none',
        });
      const firstId =
        useCharacterStore.getState().character.toolProficiencies[0].id;

      useCharacterStore.getState().deleteToolProficiency(firstId);
      expect(
        useCharacterStore.getState().character.toolProficiencies
      ).toHaveLength(1);
      expect(
        useCharacterStore.getState().character.toolProficiencies[0].name
      ).toBe("Smith's Tools");
    });
  });
});

// ============================================================
// AC MANAGEMENT
// ============================================================

describe('characterStore — AC management', () => {
  beforeEach(() => resetStore());

  describe('updateTempArmorClass', () => {
    it('sets tempArmorClass', () => {
      useCharacterStore.getState().updateTempArmorClass(18);
      expect(useCharacterStore.getState().character.tempArmorClass).toBe(18);
    });

    it('marks hasUnsavedChanges', () => {
      useCharacterStore.getState().updateTempArmorClass(18);
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });

  describe('toggleTempAC', () => {
    it('toggles isTempACActive from false to true', () => {
      expect(useCharacterStore.getState().character.isTempACActive).toBe(false);
      useCharacterStore.getState().toggleTempAC();
      expect(useCharacterStore.getState().character.isTempACActive).toBe(true);
    });

    it('toggles isTempACActive from true to false', () => {
      resetStore({ isTempACActive: true });
      useCharacterStore.getState().toggleTempAC();
      expect(useCharacterStore.getState().character.isTempACActive).toBe(false);
    });

    it('marks hasUnsavedChanges', () => {
      useCharacterStore.getState().toggleTempAC();
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });

  describe('toggleShield', () => {
    it('toggles isWearingShield from false to true', () => {
      expect(useCharacterStore.getState().character.isWearingShield).toBe(
        false
      );
      useCharacterStore.getState().toggleShield();
      expect(useCharacterStore.getState().character.isWearingShield).toBe(true);
    });

    it('toggles isWearingShield from true to false', () => {
      resetStore({ isWearingShield: true });
      useCharacterStore.getState().toggleShield();
      expect(useCharacterStore.getState().character.isWearingShield).toBe(
        false
      );
    });

    it('marks hasUnsavedChanges', () => {
      useCharacterStore.getState().toggleShield();
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });

  describe('updateShieldBonus', () => {
    it('sets shieldBonus', () => {
      useCharacterStore.getState().updateShieldBonus(3);
      expect(useCharacterStore.getState().character.shieldBonus).toBe(3);
    });

    it('accepts zero shieldBonus', () => {
      useCharacterStore.getState().updateShieldBonus(0);
      expect(useCharacterStore.getState().character.shieldBonus).toBe(0);
    });

    it('marks hasUnsavedChanges', () => {
      useCharacterStore.getState().updateShieldBonus(3);
      expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
    });
  });
});
