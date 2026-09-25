import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { createMockEncounter, createMockEncounterEntity } from '@/test/helpers';
import { useCreatureDrawerState } from '../useCreatureDrawerState';

describe('useCreatureDrawerState', () => {
  it('open() with a monster id sets entity to that entity', () => {
    const encounter = createMockEncounter({
      entities: [
        createMockEncounterEntity({
          id: 'm1',
          name: 'Goblin',
          type: 'monster',
        }),
      ],
    });
    const onViewPlayer = vi.fn();
    const { result } = renderHook(() =>
      useCreatureDrawerState({ encounter, onViewPlayer })
    );

    act(() => result.current.open('m1'));

    expect(result.current.entity?.id).toBe('m1');
    expect(onViewPlayer).not.toHaveBeenCalled();
  });

  it('open() with a player entity that has a playerCharacterId routes to onViewPlayer and does not open the drawer', () => {
    const encounter = createMockEncounter({
      entities: [
        createMockEncounterEntity({
          id: 'p1',
          name: 'Aria',
          type: 'player',
          playerCharacterId: 'pc-1',
        }),
      ],
    });
    const onViewPlayer = vi.fn();
    const { result } = renderHook(() =>
      useCreatureDrawerState({ encounter, onViewPlayer })
    );

    act(() => result.current.open('p1'));

    expect(onViewPlayer).toHaveBeenCalledExactlyOnceWith('pc-1');
    expect(result.current.entity).toBeNull();
  });

  it('open() with an unknown id is a no-op', () => {
    const encounter = createMockEncounter({
      entities: [
        createMockEncounterEntity({
          id: 'm1',
          name: 'Goblin',
          type: 'monster',
        }),
      ],
    });
    const onViewPlayer = vi.fn();
    const { result } = renderHook(() =>
      useCreatureDrawerState({ encounter, onViewPlayer })
    );

    act(() => result.current.open('does-not-exist'));

    expect(result.current.entity).toBeNull();
    expect(onViewPlayer).not.toHaveBeenCalled();
  });

  it('open() switches entities while already open', () => {
    const encounter = createMockEncounter({
      entities: [
        createMockEncounterEntity({
          id: 'm1',
          name: 'Goblin',
          type: 'monster',
        }),
        createMockEncounterEntity({ id: 'm2', name: 'Orc', type: 'monster' }),
      ],
    });
    const onViewPlayer = vi.fn();
    const { result } = renderHook(() =>
      useCreatureDrawerState({ encounter, onViewPlayer })
    );

    act(() => result.current.open('m1'));
    expect(result.current.entity?.id).toBe('m1');

    act(() => result.current.open('m2'));
    expect(result.current.entity?.id).toBe('m2');
  });

  it('entity becomes null and the drawer closes when the entity is removed from the encounter', () => {
    const encounter = createMockEncounter({
      entities: [
        createMockEncounterEntity({
          id: 'm1',
          name: 'Goblin',
          type: 'monster',
        }),
      ],
    });
    const { result, rerender } = renderHook(
      ({ encounter }) =>
        useCreatureDrawerState({ encounter, onViewPlayer: vi.fn() }),
      { initialProps: { encounter } }
    );

    act(() => result.current.open('m1'));
    expect(result.current.entity?.id).toBe('m1');

    const updated = createMockEncounter({ ...encounter, entities: [] });
    rerender({ encounter: updated });

    expect(result.current.entity).toBeNull();
  });

  it('closes when the encounter changes to null', () => {
    const encounter = createMockEncounter({
      entities: [
        createMockEncounterEntity({
          id: 'm1',
          name: 'Goblin',
          type: 'monster',
        }),
      ],
    });
    const { result, rerender } = renderHook(
      ({
        encounter,
      }: {
        encounter: ReturnType<typeof createMockEncounter> | null;
      }) => useCreatureDrawerState({ encounter, onViewPlayer: vi.fn() }),
      { initialProps: { encounter } as { encounter: typeof encounter | null } }
    );

    act(() => result.current.open('m1'));
    expect(result.current.entity?.id).toBe('m1');

    rerender({ encounter: null });

    expect(result.current.entity).toBeNull();
  });

  it('close() clears the entity', () => {
    const encounter = createMockEncounter({
      entities: [
        createMockEncounterEntity({
          id: 'm1',
          name: 'Goblin',
          type: 'monster',
        }),
      ],
    });
    const { result } = renderHook(() =>
      useCreatureDrawerState({ encounter, onViewPlayer: vi.fn() })
    );

    act(() => result.current.open('m1'));
    expect(result.current.entity?.id).toBe('m1');

    act(() => result.current.close());

    expect(result.current.entity).toBeNull();
  });
});
