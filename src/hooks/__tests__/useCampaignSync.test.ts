import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCampaignSync } from '@/hooks/useCampaignSync';
import {
  mockFetchResponse,
  mockFetchSequence,
  resetFetch,
} from '@/test/mocks/fetch';
import { createMockPlayerData } from '@/test/helpers';

describe('useCampaignSync', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    resetFetch();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const defaultOptions = {
    code: 'ABC123',
    dmId: 'dm-1',
    campaignName: 'Test Campaign',
    createdAt: '2025-01-01T00:00:00.000Z',
    interval: 10000,
    enabled: true,
  };

  it('starts with loading=true', () => {
    mockFetchResponse(200, { campaign: { name: 'Test' }, players: [] });
    const { result } = renderHook(() => useCampaignSync(defaultOptions));
    expect(result.current.loading).toBe(true);
  });

  it('fetches players and sets loading=false', async () => {
    const player = createMockPlayerData();
    mockFetchResponse(200, {
      campaign: {
        code: 'ABC123',
        name: 'Test Campaign',
        createdAt: '2025-01-01',
      },
      players: [player],
    });

    const { result } = renderHook(() => useCampaignSync(defaultOptions));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.players).toHaveLength(1);
    expect(result.current.campaignName).toBe('Test Campaign');
    expect(result.current.error).toBeNull();
  });

  it('sets campaignName from response', async () => {
    mockFetchResponse(200, {
      campaign: { name: 'Dragon Slayers' },
      players: [],
    });

    const { result } = renderHook(() => useCampaignSync(defaultOptions));

    await waitFor(() => {
      expect(result.current.campaignName).toBe('Dragon Slayers');
    });
  });

  it('auto-restores campaign when campaign is null', async () => {
    const fetchFn = mockFetchSequence([
      { status: 200, body: { campaign: null, players: [] } },
    ]);

    const { result } = renderHook(() => useCampaignSync(defaultOptions));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);

    const secondCall = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[1];
    expect(secondCall[0]).toBe('/api/campaign/ABC123');
    expect(secondCall[1]?.method).toBe('PUT');

    expect(result.current.campaignName).toBe('Test Campaign');
  });

  it('sets error on fetch failure', async () => {
    mockFetchResponse(500, { error: 'Server error' });

    const { result } = renderHook(() => useCampaignSync(defaultOptions));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
  });

  it('refresh triggers a new fetch', async () => {
    const fetchFn = mockFetchResponse(200, {
      campaign: { name: 'Test' },
      players: [],
    });

    const { result } = renderHook(() => useCampaignSync(defaultOptions));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const callCount = (fetchFn as ReturnType<typeof vi.fn>).mock.calls.length;

    await act(async () => {
      await result.current.refresh();
    });

    expect(
      (fetchFn as ReturnType<typeof vi.fn>).mock.calls.length
    ).toBeGreaterThan(callCount);
  });

  it('does not fetch when enabled is false', async () => {
    const fetchFn = mockFetchResponse(200, {
      campaign: { name: 'Test' },
      players: [],
    });

    renderHook(() => useCampaignSync({ ...defaultOptions, enabled: false }));

    await new Promise(r => setTimeout(r, 50));

    expect(fetchFn as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });
});
