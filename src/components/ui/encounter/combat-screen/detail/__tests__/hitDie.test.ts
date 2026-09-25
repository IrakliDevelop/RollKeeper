import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  canSpendHitDie,
  hpColorClass,
  showDeathSaves,
  spendHitDie,
} from '../hitDie';
import type { EncounterEntity } from '@/types/encounter';
import type { EntityActions } from '../../types';

afterEach(() => vi.restoreAllMocks());

function makeEntity(overrides: Partial<EncounterEntity> = {}): EncounterEntity {
  return {
    id: 'e1',
    type: 'npc',
    name: 'Goblin Boss',
    initiative: null,
    initiativeModifier: 2,
    currentHp: 10,
    maxHp: 20,
    tempHp: 0,
    armorClass: 15,
    conditions: [],
    ...overrides,
  };
}

function makeActions(): EntityActions {
  return {
    onUpdate: vi.fn(),
    onRemove: vi.fn(),
    onDamage: vi.fn(),
    onHeal: vi.fn(),
    onAddTempHp: vi.fn(),
    onSetMaxHp: vi.fn(),
    onAddCondition: vi.fn(),
    onRemoveCondition: vi.fn(),
    onSetConditionRounds: vi.fn(),
    onUseAbility: vi.fn(),
    onRestoreAbility: vi.fn(),
    onSpendResource: vi.fn(),
    onRestoreResource: vi.fn(),
    onUseLegendaryAction: vi.fn(),
    onResetLegendaryActions: vi.fn(),
    onSetConcentration: vi.fn(),
    onUseLairAction: vi.fn(),
    onSetInitiative: vi.fn(),
    onLongRest: vi.fn(),
    onShortRest: vi.fn(),
  };
}

describe('hpColorClass', () => {
  it('is emerald above 50% remaining', () => {
    expect(hpColorClass(11, 20)).toBe('text-accent-emerald-text');
  });

  it('is amber at exactly 50% remaining (boundary goes amber, not emerald)', () => {
    expect(hpColorClass(10, 20)).toBe('text-accent-amber-text');
  });

  it('is amber between 25% and 50% remaining', () => {
    expect(hpColorClass(6, 20)).toBe('text-accent-amber-text');
  });

  it('is red at exactly 25% remaining (boundary goes red, not amber)', () => {
    expect(hpColorClass(5, 20)).toBe('text-accent-red-text');
  });

  it('is red at or below 25% remaining, including 0', () => {
    expect(hpColorClass(0, 20)).toBe('text-accent-red-text');
  });

  it('is red when max is 0 (avoids divide-by-zero producing a false-positive color)', () => {
    expect(hpColorClass(0, 0)).toBe('text-accent-red-text');
  });
});

describe('showDeathSaves', () => {
  it('is true for a player at 0 HP with death saves', () => {
    const entity = makeEntity({
      type: 'player',
      currentHp: 0,
      deathSaves: { successes: 0, failures: 0, isStabilized: false },
    });
    expect(showDeathSaves(entity)).toBe(true);
  });

  it('is true for an npc-sourced monster at 0 HP with death saves', () => {
    const entity = makeEntity({
      type: 'monster',
      npcSourceId: 'npc-1',
      currentHp: 0,
      deathSaves: { successes: 0, failures: 0, isStabilized: false },
    });
    expect(showDeathSaves(entity)).toBe(true);
  });

  it('is false for a plain monster with no npcSourceId', () => {
    const entity = makeEntity({
      type: 'monster',
      currentHp: 0,
      deathSaves: { successes: 0, failures: 0, isStabilized: false },
    });
    expect(showDeathSaves(entity)).toBe(false);
  });

  it('is false above 0 HP', () => {
    const entity = makeEntity({
      type: 'npc',
      currentHp: 1,
      deathSaves: { successes: 0, failures: 0, isStabilized: false },
    });
    expect(showDeathSaves(entity)).toBe(false);
  });

  it('is false when deathSaves is missing', () => {
    const entity = makeEntity({ type: 'npc', currentHp: 0 });
    expect(showDeathSaves(entity)).toBe(false);
  });
});

describe('canSpendHitDie', () => {
  it('is true for an npc with hit dice left and HP below max', () => {
    const entity = makeEntity({
      type: 'npc',
      currentHp: 10,
      maxHp: 20,
      hitDice: { current: 2, max: 4, dieType: 'd8' },
    });
    expect(canSpendHitDie(entity)).toBe(true);
  });

  it('is false for a plain monster with no npcSourceId', () => {
    const entity = makeEntity({
      type: 'monster',
      currentHp: 10,
      maxHp: 20,
      hitDice: { current: 2, max: 4, dieType: 'd8' },
    });
    expect(canSpendHitDie(entity)).toBe(false);
  });

  it('is false with no hit dice remaining', () => {
    const entity = makeEntity({
      type: 'npc',
      hitDice: { current: 0, max: 4, dieType: 'd8' },
    });
    expect(canSpendHitDie(entity)).toBe(false);
  });

  it('is false at 0 HP', () => {
    const entity = makeEntity({
      type: 'npc',
      currentHp: 0,
      hitDice: { current: 2, max: 4, dieType: 'd8' },
    });
    expect(canSpendHitDie(entity)).toBe(false);
  });

  it('is false at full HP', () => {
    const entity = makeEntity({
      type: 'npc',
      currentHp: 20,
      maxHp: 20,
      hitDice: { current: 2, max: 4, dieType: 'd8' },
    });
    expect(canSpendHitDie(entity)).toBe(false);
  });
});

describe('spendHitDie', () => {
  it('heals and decrements hit dice using the roll result', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const entity = makeEntity({
      type: 'npc',
      currentHp: 10,
      maxHp: 20,
      hitDice: { current: 2, max: 4, dieType: 'd8' },
      monsterStatBlock: undefined,
    });
    const actions = makeActions();
    spendHitDie(entity, actions);
    // d8 at 0.5 -> floor(0.5*8)+1 = 5, no CON mod
    expect(actions.onHeal).toHaveBeenCalledWith('e1', 5);
    expect(actions.onUpdate).toHaveBeenCalledWith('e1', {
      hitDice: { current: 1, max: 4, dieType: 'd8' },
    });
  });

  it('does nothing when there is no hit die to spend', () => {
    const entity = makeEntity({ type: 'npc', hitDice: undefined });
    const actions = makeActions();
    spendHitDie(entity, actions);
    expect(actions.onHeal).not.toHaveBeenCalled();
    expect(actions.onUpdate).not.toHaveBeenCalled();
  });
});
