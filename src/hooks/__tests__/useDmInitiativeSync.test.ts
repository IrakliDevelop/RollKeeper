import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDmInitiativeSync } from '../useDmInitiativeSync';
import type { SharedInitiativeState } from '@/types/sharedState';

const state: SharedInitiativeState = {
  encounterId: 'enc-1',
  isActive: true,
  round: 1,
  currentEntityId: 'a',
  turnOrder: [],
  updatedAt: '',
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
});
