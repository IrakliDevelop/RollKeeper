import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDmInitiativeSync } from '../useDmInitiativeSync';
import type {
  InitiativeRollRequest,
  SharedInitiativeState,
} from '@/types/sharedState';

const state: SharedInitiativeState = {
  encounterId: 'enc-1',
  isActive: true,
  round: 1,
  currentEntityId: 'a',
  enemyHpMode: 'off',
  enemyConditionsMode: 'off',
  turnOrder: [],
  updatedAt: '',
};

const request: InitiativeRollRequest = {
  requestId: 'req-1',
  encounterId: 'enc-1',
  encounterName: 'Goblin Ambush',
  requestedAt: 1000,
};

describe('useDmInitiativeSync', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true }))
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('POSTs the initiative feature with the dmId', async () => {
    const { result } = renderHook(() =>
      useDmInitiativeSync({ campaignCode: 'ABC123', dmId: 'dm-1' })
    );
    await result.current.pushInitiative(state);

    expect(fetch).toHaveBeenCalledWith(
      '/api/campaign/ABC123/shared',
      expect.objectContaining({ method: 'POST' })
    );
    const body = JSON.parse(
      (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
    );
    expect(body.feature).toBe('initiative');
    expect(body.dmId).toBe('dm-1');
    expect(body.data.encounterId).toBe('enc-1');
  });

  it('POSTs the initiativeRequest feature with the dmId', async () => {
    const { result } = renderHook(() =>
      useDmInitiativeSync({ campaignCode: 'ABC123', dmId: 'dm-1' })
    );
    await result.current.pushInitiativeRequest(request);

    expect(fetch).toHaveBeenCalledWith(
      '/api/campaign/ABC123/shared',
      expect.objectContaining({ method: 'POST' })
    );
    const body = JSON.parse(
      (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
    );
    expect(body.feature).toBe('initiativeRequest');
    expect(body.dmId).toBe('dm-1');
    expect(body.data.requestId).toBe('req-1');
  });

  it('POSTs a null data payload when clearing the request', async () => {
    const { result } = renderHook(() =>
      useDmInitiativeSync({ campaignCode: 'ABC123', dmId: 'dm-1' })
    );
    await result.current.pushInitiativeRequest(null);

    const body = JSON.parse(
      (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
    );
    expect(body.feature).toBe('initiativeRequest');
    expect(body.data).toBeNull();
  });
});
