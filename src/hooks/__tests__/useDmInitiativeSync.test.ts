import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDmInitiativeSync } from '../useDmInitiativeSync';
import type {
  InitiativeRollRequest,
  SharedInitiativeState,
} from '@/types/sharedState';

const control = vi.hoisted(() => ({
  status: 'broadcasting' as string,
  error: null as string | null,
  publish: vi.fn(async () => {}),
}));

vi.mock('@/hooks/useTableControl', () => ({
  useTableControl: () => control,
}));

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

describe('useDmInitiativeSync (Table control publication)', () => {
  beforeEach(() => {
    control.status = 'broadcasting';
    control.error = null;
    control.publish.mockClear();
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('publishes initiative through Table control, never the legacy writer', async () => {
    const { result } = renderHook(() =>
      useDmInitiativeSync({ campaignCode: 'ABC123', dmId: 'dm-1' })
    );
    await result.current.pushInitiative(state);
    expect(control.publish).toHaveBeenCalledWith('publishInitiative', {
      initiative: state,
      runId: 'enc-1',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('ends initiative when the encounter is no longer active', async () => {
    const { result } = renderHook(() =>
      useDmInitiativeSync({ campaignCode: 'ABC123', dmId: 'dm-1' })
    );
    await result.current.pushInitiative({ ...state, isActive: false });
    expect(control.publish).toHaveBeenCalledWith('endInitiative', undefined);
  });

  it('publishes and clears the roll request through Table control', async () => {
    const { result } = renderHook(() =>
      useDmInitiativeSync({ campaignCode: 'ABC123', dmId: 'dm-1' })
    );
    await result.current.pushInitiativeRequest(request);
    await result.current.pushInitiativeRequest(null);
    expect(control.publish).toHaveBeenNthCalledWith(
      1,
      'publishInitiativeRequest',
      { request }
    );
    expect(control.publish).toHaveBeenNthCalledWith(
      2,
      'publishInitiativeRequest',
      { request: null }
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('says live control is still being checked before the first answer', async () => {
    control.status = 'checking';
    const { result } = renderHook(() =>
      useDmInitiativeSync({ campaignCode: 'ABC123', dmId: 'dm-1' })
    );
    await expect(result.current.pushInitiative(state)).rejects.toThrow(
      'Checking live control'
    );
    await expect(result.current.pushInitiativeRequest(request)).rejects.toThrow(
      'Checking live control'
    );
    expect(control.publish).not.toHaveBeenCalled();
  });

  it('rejects instead of publishing while not broadcasting', async () => {
    control.status = 'not-broadcasting';
    control.error = 'Live control lease expired';
    const { result } = renderHook(() =>
      useDmInitiativeSync({ campaignCode: 'ABC123', dmId: 'dm-1' })
    );
    await expect(result.current.pushInitiative(state)).rejects.toThrow(
      'Live control lease expired'
    );
    expect(control.publish).not.toHaveBeenCalled();
  });
});
