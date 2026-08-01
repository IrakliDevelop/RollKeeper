import { describe, it, expect } from 'vitest';

import { summarizeBuffEffects } from '../DockBuffs.utils';
import type { BuffEffect } from '@/types/character';

function effect(partial: Partial<BuffEffect>): BuffEffect {
  return {
    id: 'e1',
    targetStat: 'ac',
    mode: 'add',
    value: 1,
    ...partial,
  };
}

describe('summarizeBuffEffects', () => {
  it('formats add mode with sign', () => {
    expect(summarizeBuffEffects([effect({ mode: 'add', value: 3 })])).toBe(
      '+3 AC'
    );
    expect(summarizeBuffEffects([effect({ mode: 'add', value: -2 })])).toBe(
      '-2 AC'
    );
  });

  it('formats set and floor modes', () => {
    expect(summarizeBuffEffects([effect({ mode: 'set', value: 13 })])).toBe(
      'AC = 13'
    );
    expect(summarizeBuffEffects([effect({ mode: 'floor', value: 16 })])).toBe(
      'AC ≥ 16'
    );
  });

  it('formats grant mode like add', () => {
    expect(
      summarizeBuffEffects([
        effect({ targetStat: 'tempHp', mode: 'grant', value: 5 }),
      ])
    ).toBe('+5 temp HP');
  });

  it('labels saving throws with the ability', () => {
    expect(
      summarizeBuffEffects([
        effect({
          targetStat: 'savingThrow',
          mode: 'add',
          value: 2,
          targetAbility: 'dexterity',
        }),
      ])
    ).toBe('+2 DEX save');
  });

  it('formats resistance, immunity, and condition immunity by target', () => {
    expect(
      summarizeBuffEffects([
        effect({ targetStat: 'damageResistance', targetDamageType: 'fire' }),
      ])
    ).toBe('resistance: fire');
    expect(
      summarizeBuffEffects([
        effect({ targetStat: 'damageImmunity', targetDamageType: 'poison' }),
      ])
    ).toBe('immunity: poison');
    expect(
      summarizeBuffEffects([
        effect({ targetStat: 'conditionImmunity', targetCondition: 'charmed' }),
      ])
    ).toBe('immune: charmed');
  });

  it('joins multiple effects with a separator', () => {
    expect(
      summarizeBuffEffects([
        effect({ mode: 'add', value: 2 }),
        effect({
          id: 'e2',
          targetStat: 'damageResistance',
          targetDamageType: 'fire',
        }),
      ])
    ).toBe('+2 AC · resistance: fire');
  });

  it('returns an empty string for no effects', () => {
    expect(summarizeBuffEffects([])).toBe('');
  });
});
