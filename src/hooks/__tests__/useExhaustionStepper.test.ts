import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

import { useExhaustionStepper } from '@/hooks/useExhaustionStepper';
import { useCharacterStore } from '@/store/characterStore';
import { makeCharacter } from '@/utils/__tests__/test-utils';

vi.mock('@/utils/conditionsDiseasesLoader', () => ({
  getExhaustionByVariant: vi.fn(async () => ({
    id: 'exhaustion-2024',
    name: 'Exhaustion',
    source: 'XPHB',
    description: 'rules',
    isExhaustion: true,
    stackable: true,
  })),
}));

function getChar() {
  return useCharacterStore.getState().character;
}

describe('useExhaustionStepper', () => {
  beforeEach(() => {
    useCharacterStore.setState({ character: makeCharacter() });
  });

  afterEach(() => cleanup());

  it('adds exhaustion at level 1, increments to a cap of 6, and removes at 0', async () => {
    const { result } = renderHook(() => useExhaustionStepper());
    await act(() => result.current.increment());
    expect(result.current.level).toBe(1);
    for (let i = 0; i < 7; i++) await act(() => result.current.increment());
    expect(result.current.level).toBe(6);
    for (let i = 0; i < 6; i++) act(() => result.current.decrement());
    expect(result.current.level).toBe(0);
    expect(
      getChar().conditionsAndDiseases.activeConditions.some(
        c => c.name === 'Exhaustion'
      )
    ).toBe(false);
  });

  it('ignores a second increment while the first add is still loading', async () => {
    const { result } = renderHook(() => useExhaustionStepper());
    await act(async () => {
      await Promise.all([
        result.current.increment(),
        result.current.increment(),
      ]);
    });
    const exhaustion = () =>
      getChar().conditionsAndDiseases.activeConditions.filter(
        c => c.name === 'Exhaustion'
      );
    expect(exhaustion()).toHaveLength(1);
    expect(exhaustion()[0].count).toBe(1);

    await act(() => result.current.increment());
    expect(exhaustion()).toHaveLength(1);
    expect(exhaustion()[0].count).toBe(2);
  });

  it('tolerates a character without conditionsAndDiseases when decrementing', async () => {
    useCharacterStore.setState({
      character: {
        ...makeCharacter(),
        conditionsAndDiseases: undefined,
      } as unknown as ReturnType<typeof makeCharacter>,
    });
    const { result } = renderHook(() => useExhaustionStepper());
    expect(result.current.level).toBe(0);
    expect(() => act(() => result.current.decrement())).not.toThrow();
  });
});
