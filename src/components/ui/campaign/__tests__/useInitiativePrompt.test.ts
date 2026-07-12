import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useInitiativePrompt } from '@/components/ui/campaign/useInitiativePrompt';
import { markSubmitted } from '@/components/ui/campaign/initiativePrompt.utils';
import { mockFetchResponse, resetFetch } from '@/test/mocks/fetch';

import type { SharedCampaignState } from '@/types/sharedState';

const baseState: SharedCampaignState = {
  calendar: null,
  messages: [],
  dmEffects: [],
  customCounter: null,
  transfers: [],
  initiative: null,
  battleMap: null,
  initiativeRequest: {
    requestId: 'r1',
    encounterId: 'e1',
    encounterName: 'Goblin Ambush',
    requestedAt: 1,
  },
};

describe('useInitiativePrompt', () => {
  beforeEach(() => {
    localStorage.clear();
    resetFetch();
  });

  it('shows for a fresh request', () => {
    const { result } = renderHook(() =>
      useInitiativePrompt({
        campaignCode: 'ABC123',
        characterId: 'char-1',
        sharedState: baseState,
      })
    );

    expect(result.current.showPrompt).toBe(true);
    expect(result.current.request?.requestId).toBe('r1');
  });

  it('is hidden when combat is active', () => {
    const { result } = renderHook(() =>
      useInitiativePrompt({
        campaignCode: 'ABC123',
        characterId: 'char-1',
        sharedState: {
          ...baseState,
          initiative: {
            encounterId: 'e1',
            isActive: true,
            round: 1,
            currentEntityId: null,
            turnOrder: [],
            enemyHpMode: 'off',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        },
      })
    );

    expect(result.current.showPrompt).toBe(false);
  });

  it('is hidden when already submitted (seeded in localStorage)', () => {
    markSubmitted('char-1', 'r1');

    const { result } = renderHook(() =>
      useInitiativePrompt({
        campaignCode: 'ABC123',
        characterId: 'char-1',
        sharedState: baseState,
      })
    );

    expect(result.current.showPrompt).toBe(false);
  });

  it('is hidden after dismiss()', () => {
    const { result } = renderHook(() =>
      useInitiativePrompt({
        campaignCode: 'ABC123',
        characterId: 'char-1',
        sharedState: baseState,
      })
    );

    expect(result.current.showPrompt).toBe(true);
    act(() => result.current.dismiss());
    expect(result.current.showPrompt).toBe(false);
  });

  it('is hidden when there is no campaign code', () => {
    const { result } = renderHook(() =>
      useInitiativePrompt({
        campaignCode: null,
        characterId: 'char-1',
        sharedState: baseState,
      })
    );

    expect(result.current.showPrompt).toBe(false);
  });

  it('POSTs the right body on submit, marks localStorage, and hides', async () => {
    const fetchMock = mockFetchResponse(200, { ok: true });

    const { result } = renderHook(() =>
      useInitiativePrompt({
        campaignCode: 'ABC123',
        characterId: 'char-1',
        sharedState: baseState,
      })
    );

    let ok = false;
    await act(async () => {
      ok = await result.current.handleSubmit(17);
    });

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/campaign/ABC123/initiative-submission',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: 'r1',
          playerId: 'char-1',
          value: 17,
        }),
      })
    );
    expect(result.current.showPrompt).toBe(false);
  });

  it('returns false and stays visible when submit fails', async () => {
    mockFetchResponse(500, { error: 'nope' });

    const { result } = renderHook(() =>
      useInitiativePrompt({
        campaignCode: 'ABC123',
        characterId: 'char-1',
        sharedState: baseState,
      })
    );

    let ok = true;
    await act(async () => {
      ok = await result.current.handleSubmit(17);
    });

    expect(ok).toBe(false);
    expect(result.current.showPrompt).toBe(true);
  });
});
