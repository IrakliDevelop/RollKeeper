import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSharedCampaignState } from '@/hooks/useSharedCampaignState';

const EMPTY_STATE = {
  calendar: null,
  messages: [],
  dmEffects: [],
  customCounter: null,
  transfers: [],
  initiative: null,
  battleMap: null,
};

describe('useSharedCampaignState.refetchNow', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn(async () => new Response(JSON.stringify(EMPTY_STATE)));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('triggers an immediate fetch, debounced to one per second', async () => {
    const { result, unmount } = renderHook(() =>
      useSharedCampaignState('CAMP1', 'player-1')
    );
    // initial mount fetch
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const baseline = fetchMock.mock.calls.length;
    expect(baseline).toBeGreaterThanOrEqual(1);

    act(() => {
      result.current.refetchNow();
      result.current.refetchNow(); // within the same second — swallowed
      result.current.refetchNow();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchMock.mock.calls.length).toBe(baseline + 1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    const afterCooldown = fetchMock.mock.calls.length;
    act(() => {
      result.current.refetchNow();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchMock.mock.calls.length).toBe(afterCooldown + 1);

    unmount();
  });
});
