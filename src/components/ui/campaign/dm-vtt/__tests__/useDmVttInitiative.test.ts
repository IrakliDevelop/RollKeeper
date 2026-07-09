import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useEncounterStore } from '@/store/encounterStore';
import { createMockEncounter, createMockEncounterEntity } from '@/test/helpers';
import { useDmVttInitiative } from '../useDmVttInitiative';

function resetStore() {
  useEncounterStore.setState({
    encounters: [],
    activeEncounterId: null,
  });
}

type FetchMock = ReturnType<typeof vi.fn>;

describe('useDmVttInitiative', () => {
  beforeEach(() => {
    resetStore();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true }))
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('follows the first linked encounter with combat started (isActive)', () => {
    useEncounterStore.setState({
      encounters: [
        createMockEncounter({
          id: 'enc-1',
          campaignCode: 'ABC',
          isActive: false,
          name: 'Not Started',
        }),
        createMockEncounter({
          id: 'enc-2',
          campaignCode: 'ABC',
          isActive: true,
          name: 'Started Fight',
        }),
      ],
    });

    const { result } = renderHook(() =>
      useDmVttInitiative({
        campaignCode: 'ABC',
        dmId: 'dm-1',
        linkedEncounterIds: ['enc-1', 'enc-2'],
      })
    );

    expect(result.current.encounter?.id).toBe('enc-2');
  });

  it('falls back to the single linked encounter when none has started', () => {
    useEncounterStore.setState({
      encounters: [
        createMockEncounter({
          id: 'enc-1',
          campaignCode: 'ABC',
          isActive: false,
        }),
      ],
    });

    const { result } = renderHook(() =>
      useDmVttInitiative({
        campaignCode: 'ABC',
        dmId: 'dm-1',
        linkedEncounterIds: ['enc-1'],
      })
    );

    expect(result.current.encounter?.id).toBe('enc-1');
  });

  it('returns null when there are no linked encounters', () => {
    const { result } = renderHook(() =>
      useDmVttInitiative({
        campaignCode: 'ABC',
        dmId: 'dm-1',
        linkedEncounterIds: [],
      })
    );

    expect(result.current.encounter).toBeNull();
    expect(result.current.activeEntity).toBeNull();
    expect(result.current.followNote).toBeNull();
  });

  it('sets followNote only when 2+ linked encounters have started', () => {
    useEncounterStore.setState({
      encounters: [
        createMockEncounter({
          id: 'enc-1',
          campaignCode: 'ABC',
          isActive: true,
          name: 'Fight A',
        }),
        createMockEncounter({
          id: 'enc-2',
          campaignCode: 'ABC',
          isActive: true,
          name: 'Fight B',
        }),
      ],
    });

    const { result } = renderHook(() =>
      useDmVttInitiative({
        campaignCode: 'ABC',
        dmId: 'dm-1',
        linkedEncounterIds: ['enc-1', 'enc-2'],
      })
    );

    expect(result.current.followNote).toBe('Following: Fight A');
  });

  it('leaves followNote null when only one linked encounter has started', () => {
    useEncounterStore.setState({
      encounters: [
        createMockEncounter({
          id: 'enc-1',
          campaignCode: 'ABC',
          isActive: true,
          name: 'Fight A',
        }),
        createMockEncounter({
          id: 'enc-2',
          campaignCode: 'ABC',
          isActive: false,
          name: 'Fight B',
        }),
      ],
    });

    const { result } = renderHook(() =>
      useDmVttInitiative({
        campaignCode: 'ABC',
        dmId: 'dm-1',
        linkedEncounterIds: ['enc-1', 'enc-2'],
      })
    );

    expect(result.current.followNote).toBeNull();
  });

  it('computes activeEntity from getSortedEntities at currentTurn when started', () => {
    useEncounterStore.setState({
      encounters: [
        createMockEncounter({
          id: 'enc-1',
          campaignCode: 'ABC',
          isActive: true,
          currentTurn: 1,
          entities: [
            createMockEncounterEntity({
              id: 'a',
              initiative: 20,
              name: 'Aria',
            }),
            createMockEncounterEntity({
              id: 'b',
              initiative: 15,
              name: 'Boss',
            }),
            createMockEncounterEntity({
              id: 'c',
              initiative: 5,
              name: 'Cleric',
            }),
          ],
        }),
      ],
    });

    const { result } = renderHook(() =>
      useDmVttInitiative({
        campaignCode: 'ABC',
        dmId: 'dm-1',
        linkedEncounterIds: ['enc-1'],
      })
    );

    expect(result.current.activeEntity?.id).toBe('b');
  });

  it('activeEntity is null when the followed encounter has not started', () => {
    useEncounterStore.setState({
      encounters: [
        createMockEncounter({
          id: 'enc-1',
          campaignCode: 'ABC',
          isActive: false,
          entities: [createMockEncounterEntity({ id: 'a', initiative: 20 })],
        }),
      ],
    });

    const { result } = renderHook(() =>
      useDmVttInitiative({
        campaignCode: 'ABC',
        dmId: 'dm-1',
        linkedEncounterIds: ['enc-1'],
      })
    );

    expect(result.current.activeEntity).toBeNull();
  });

  it('handleNextTurn advances currentTurn and pushes a /shared initiative POST', async () => {
    useEncounterStore.setState({
      encounters: [
        createMockEncounter({
          id: 'enc-1',
          campaignCode: 'ABC',
          isActive: true,
          currentTurn: 0,
          round: 1,
          entities: [
            createMockEncounterEntity({ id: 'a', initiative: 20 }),
            createMockEncounterEntity({ id: 'b', initiative: 10 }),
          ],
        }),
      ],
    });

    const { result } = renderHook(() =>
      useDmVttInitiative({
        campaignCode: 'ABC',
        dmId: 'dm-1',
        linkedEncounterIds: ['enc-1'],
      })
    );

    (fetch as FetchMock).mockClear();

    await act(async () => {
      result.current.handleNextTurn();
    });

    expect(useEncounterStore.getState().encounters[0].currentTurn).toBe(1);

    expect(fetch).toHaveBeenCalledWith(
      '/api/campaign/ABC/shared',
      expect.objectContaining({ method: 'POST' })
    );
    const lastCall = (fetch as FetchMock).mock.calls[
      (fetch as FetchMock).mock.calls.length - 1
    ];
    const body = JSON.parse(lastCall[1].body);
    expect(body.feature).toBe('initiative');
    expect(body.data.encounterId).toBe('enc-1');
  });

  it('handlePrevTurn calls the store prevTurn action for the followed encounter', async () => {
    useEncounterStore.setState({
      encounters: [
        createMockEncounter({
          id: 'enc-1',
          campaignCode: 'ABC',
          isActive: true,
          currentTurn: 1,
          round: 1,
          entities: [
            createMockEncounterEntity({ id: 'a', initiative: 20 }),
            createMockEncounterEntity({ id: 'b', initiative: 10 }),
          ],
        }),
      ],
    });

    const { result } = renderHook(() =>
      useDmVttInitiative({
        campaignCode: 'ABC',
        dmId: 'dm-1',
        linkedEncounterIds: ['enc-1'],
      })
    );

    await act(async () => {
      result.current.handlePrevTurn();
    });

    expect(useEncounterStore.getState().encounters[0].currentTurn).toBe(0);
  });

  it('handleNextTurn/handlePrevTurn are no-ops when there is no followed encounter', async () => {
    const { result } = renderHook(() =>
      useDmVttInitiative({
        campaignCode: 'ABC',
        dmId: 'dm-1',
        linkedEncounterIds: [],
      })
    );

    await act(async () => {
      result.current.handleNextTurn();
      result.current.handlePrevTurn();
    });

    expect(useEncounterStore.getState().encounters).toHaveLength(0);
  });

  it('push guard: does not POST when the followed encounter has no campaignCode', async () => {
    useEncounterStore.setState({
      encounters: [
        createMockEncounter({
          id: 'enc-1',
          campaignCode: undefined,
          isActive: true,
          entities: [createMockEncounterEntity({ id: 'a', initiative: 20 })],
        }),
      ],
    });

    renderHook(() =>
      useDmVttInitiative({
        campaignCode: 'ABC',
        dmId: 'dm-1',
        linkedEncounterIds: ['enc-1'],
      })
    );

    expect(fetch).not.toHaveBeenCalled();
  });

  it('pushes on mount for an already-started campaign-linked encounter', () => {
    useEncounterStore.setState({
      encounters: [
        createMockEncounter({
          id: 'enc-1',
          campaignCode: 'ABC',
          isActive: true,
          entities: [createMockEncounterEntity({ id: 'a', initiative: 20 })],
        }),
      ],
    });

    renderHook(() =>
      useDmVttInitiative({
        campaignCode: 'ABC',
        dmId: 'dm-1',
        linkedEncounterIds: ['enc-1'],
      })
    );

    expect(fetch).toHaveBeenCalledWith(
      '/api/campaign/ABC/shared',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
