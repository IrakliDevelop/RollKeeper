import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';

import { useEncounterStore } from '@/store/encounterStore';
import { createMockEncounter, createMockEncounterEntity } from '@/test/helpers';
import { useDmVttInitiative } from '../useDmVttInitiative';

// Table control is the only publication path; its own hook has its own
// suite. Here the status is driven directly (default: still checking).
const control = vi.hoisted(() => ({
  status: 'checking' as string,
  error: null as string | null,
  current: null,
  publish: vi.fn(async () => {}),
}));
vi.mock('@/hooks/useTableControl', () => ({
  useTableControl: () => control,
}));

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
    control.status = 'checking';
    control.error = null;
    control.publish.mockClear();
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

  it('falls back to the resolved encounter when one of two linked ids is stale/deleted', () => {
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
        linkedEncounterIds: ['enc-1', 'deleted-enc'],
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

  it('handleNextTurn advances currentTurn and publishes through Table control', async () => {
    control.status = 'broadcasting';
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

    control.publish.mockClear();

    await act(async () => {
      result.current.handleNextTurn();
    });

    expect(useEncounterStore.getState().encounters[0].currentTurn).toBe(1);

    await waitFor(() => expect(control.publish).toHaveBeenCalled());
    const lastCall = control.publish.mock.calls[
      control.publish.mock.calls.length - 1
    ] as unknown as [string, { initiative: { encounterId: string } }];
    expect(lastCall[0]).toBe('publishInitiative');
    expect(lastCall[1].initiative.encounterId).toBe('enc-1');
    expect(
      (fetch as FetchMock).mock.calls.some(
        call => call[0] === '/api/campaign/ABC/shared'
      )
    ).toBe(false);
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

  it('push guard: does not publish when the followed encounter has no campaignCode', async () => {
    control.status = 'broadcasting';
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

    expect(control.publish).not.toHaveBeenCalled();
  });

  it('pushes on mount for an already-started campaign-linked encounter', async () => {
    control.status = 'broadcasting';
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

    await waitFor(() =>
      expect(control.publish).toHaveBeenCalledWith(
        'publishInitiative',
        expect.objectContaining({ runId: 'enc-1' })
      )
    );
  });
});

// CI leak guard: no rendered root may outlive its test. This project has no
// vitest globals, so RTL's auto-cleanup never runs: flush pending React work
// and unmount explicitly, or a scheduled commit fires after this file's jsdom
// environment is torn down (CI "instanceof" crash in getActiveElementDeep).
afterEach(async () => {
  await act(async () => {});
  cleanup();
  expect(
    document.body.childElementCount,
    'rendered roots left mounted after the test'
  ).toBe(0);
});
