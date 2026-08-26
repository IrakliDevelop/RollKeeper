import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

import { useEncounterStore } from '@/store/encounterStore';
import { createMockEncounter, createMockEncounterEntity } from '@/test/helpers';
import { useInitiativeSubmissionSync } from '../useInitiativeSubmissionSync';
import type { InitiativeSubmission } from '@/types/sharedState';

function resetStore() {
  useEncounterStore.setState({ encounters: [], activeEncounterId: null });
}

function makeFetchMock(submissions: Record<string, InitiativeSubmission>) {
  return vi.fn((_url: string, opts?: RequestInit) => {
    if (opts?.method === 'DELETE') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ submissions }),
    });
  });
}

describe('useInitiativeSubmissionSync', () => {
  beforeEach(() => {
    resetStore();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('applies a matching submission via setInitiative and deletes it', async () => {
    const encounter = createMockEncounter({
      id: 'enc-1',
      campaignCode: 'ABC',
      isActive: false,
      pendingInitiativeRequest: { requestId: 'req-1', requestedAt: 1 },
      entities: [
        createMockEncounterEntity({
          id: 'e1',
          type: 'player',
          playerCharacterId: 'char-1',
          initiative: null,
        }),
      ],
    });
    useEncounterStore.setState({
      encounters: [encounter],
      activeEncounterId: null,
    });

    const fetchMock = makeFetchMock({
      'char-1': {
        requestId: 'req-1',
        playerId: 'char-1',
        value: 17,
        submittedAt: 1,
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() =>
      useInitiativeSubmissionSync({ campaignCode: 'ABC', encounter })
    );

    await waitFor(() => {
      expect(
        useEncounterStore.getState().getEncounter('enc-1')?.entities[0]
          .initiative
      ).toBe(17);
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/campaign/ABC/initiative-submission?playerId=char-1',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  it('discards a submission with a stale requestId without applying it', async () => {
    const encounter = createMockEncounter({
      id: 'enc-1',
      campaignCode: 'ABC',
      isActive: false,
      pendingInitiativeRequest: { requestId: 'req-current', requestedAt: 1 },
      entities: [
        createMockEncounterEntity({
          id: 'e1',
          type: 'player',
          playerCharacterId: 'char-1',
          initiative: null,
        }),
      ],
    });
    useEncounterStore.setState({
      encounters: [encounter],
      activeEncounterId: null,
    });

    const fetchMock = makeFetchMock({
      'char-1': {
        requestId: 'req-stale',
        playerId: 'char-1',
        value: 9,
        submittedAt: 1,
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() =>
      useInitiativeSubmissionSync({ campaignCode: 'ABC', encounter })
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/campaign/ABC/initiative-submission?playerId=char-1',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    expect(
      useEncounterStore.getState().getEncounter('enc-1')?.entities[0].initiative
    ).toBeNull();
  });

  it('does not poll when there is no pending request', async () => {
    const encounter = createMockEncounter({
      id: 'enc-1',
      campaignCode: 'ABC',
      isActive: false,
      pendingInitiativeRequest: null,
    });
    useEncounterStore.setState({
      encounters: [encounter],
      activeEncounterId: null,
    });

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() =>
      useInitiativeSubmissionSync({ campaignCode: 'ABC', encounter })
    );

    await new Promise(resolve => setTimeout(resolve, 20));

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
