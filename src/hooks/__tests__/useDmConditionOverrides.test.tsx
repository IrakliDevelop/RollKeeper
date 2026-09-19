// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resolveDmEffectCondition,
  useDmConditionOverrides,
} from '@/hooks/useDmConditionOverrides';
import { useCharacterStore } from '@/store/characterStore';
import { loadAllConditions } from '@/utils/conditionsDiseasesLoader';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import type { ProcessedCondition } from '@/types/character';
import type { DmEffect } from '@/types/sharedState';

vi.mock('@/utils/conditionsDiseasesLoader', () => ({
  loadAllConditions: vi.fn(async () => [
    {
      id: 'poisoned-xphb',
      name: 'Poisoned',
      source: 'XPHB',
      description: 'Canonical poisoned text.',
      isExhaustion: false,
      stackable: false,
    },
    {
      id: 'prone-xphb',
      name: 'Prone',
      source: 'XPHB',
      description: 'Canonical prone text.',
      isExhaustion: false,
      stackable: false,
    },
  ]),
}));

const CANON: ProcessedCondition[] = [
  {
    id: 'poisoned-xphb',
    name: 'Poisoned',
    source: 'XPHB',
    description: 'Canonical poisoned text.',
    isExhaustion: false,
    stackable: false,
  },
];

function effect(overrides: Partial<DmEffect>): DmEffect {
  return {
    id: 'fx-1',
    name: 'Poisoned',
    action: 'add',
    appliedAt: '2026-09-19T10:00:00.000Z',
    ...overrides,
  };
}

describe('resolveDmEffectCondition', () => {
  it('a custom effect (valid icon) bypasses the canonical lookup even when the name is canonical', () => {
    expect(
      resolveDmEffectCondition(
        effect({ description: 'DM venom text.', icon: 'droplet' }),
        CANON
      )
    ).toEqual({ source: 'DM', description: 'DM venom text.', icon: 'droplet' });
  });

  it('a standard effect is unchanged: canonical XPHB text wins over the DM text', () => {
    expect(
      resolveDmEffectCondition(effect({ description: 'DM text.' }), CANON)
    ).toEqual({ source: 'XPHB', description: 'Canonical poisoned text.' });
  });

  it('an unknown icon does not bypass, and unknown names keep the DM text or the default', () => {
    expect(
      resolveDmEffectCondition(
        effect({ description: 'DM text.', icon: 'not-an-icon' }),
        CANON
      )
    ).toEqual({ source: 'XPHB', description: 'Canonical poisoned text.' });
    expect(
      resolveDmEffectCondition(
        effect({ name: 'Hexed', description: 'DM hex.' }),
        CANON
      )
    ).toEqual({ source: 'DM', description: 'DM hex.' });
    expect(
      resolveDmEffectCondition(effect({ name: 'Hexed', icon: 'skull' }), CANON)
    ).toEqual({
      source: 'DM',
      description: 'Custom effect applied by DM',
      icon: 'skull',
    });
  });
});

describe('useDmConditionOverrides', () => {
  beforeEach(() => {
    useCharacterStore.setState({
      character: makeCharacter(),
      hasUnsavedChanges: false,
      saveStatus: 'saved',
    });
  });

  it('stores the DM text + icon for a custom effect and the canonical text for a standard one, then acknowledges', async () => {
    const onAcknowledged = vi.fn();
    const { rerender } = renderHook(
      ({ effects }: { effects: DmEffect[] | undefined }) =>
        useDmConditionOverrides(effects, onAcknowledged),
      { initialProps: { effects: undefined as DmEffect[] | undefined } }
    );
    // Let the conditions database load before the effects arrive.
    await waitFor(() => expect(loadAllConditions).toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve();
    });

    rerender({
      effects: [
        effect({
          id: 'fx-custom',
          name: 'Poisoned',
          description: 'DM venom text.',
          icon: 'droplet',
        }),
        effect({ id: 'fx-standard', name: 'Prone', description: 'ignored' }),
      ],
    });

    const active =
      useCharacterStore.getState().character.conditionsAndDiseases
        .activeConditions;
    expect(active).toHaveLength(2);
    expect(active[0]).toMatchObject({
      name: 'Poisoned',
      source: 'DM',
      description: 'DM venom text.',
      icon: 'droplet',
    });
    expect(active[1]).toMatchObject({
      name: 'Prone',
      source: 'XPHB',
      description: 'Canonical prone text.',
    });
    expect('icon' in active[1]).toBe(false);
    expect(onAcknowledged).toHaveBeenCalledTimes(1);
  });
});
