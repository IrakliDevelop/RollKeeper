import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useActiveBattleMapId } from '@/hooks/useActiveBattleMapId';

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body));
}

describe('useActiveBattleMapId', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn(async () =>
      jsonResponse({ battleMap: { activeBattleMapId: 'map-1' } })
    );
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('fetches on mount and returns the active id', async () => {
    const { result, unmount } = renderHook(() => useActiveBattleMapId('CAMP1'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/campaign/CAMP1/shared?role=dm'
    );
    expect(result.current).toBe('map-1');
    unmount();
  });

  it('refetches every 60s', async () => {
    const { result, unmount } = renderHook(() => useActiveBattleMapId('CAMP1'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockImplementationOnce(async () =>
      jsonResponse({ battleMap: { activeBattleMapId: 'map-2' } })
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current).toBe('map-2');
    unmount();
  });

  it('refetches immediately when the tab becomes visible', async () => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => false,
    });

    const { unmount } = renderHook(() => useActiveBattleMapId('CAMP1'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('does not fetch when the tab is hidden on visibilitychange', async () => {
    const { unmount } = renderHook(() => useActiveBattleMapId('CAMP1'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('is a no-op when campaignCode is null', async () => {
    const { result, unmount } = renderHook(() => useActiveBattleMapId(null));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current).toBeNull();
    unmount();
  });

  it('keeps the last known id on fetch failure', async () => {
    const { result, unmount } = renderHook(() => useActiveBattleMapId('CAMP1'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current).toBe('map-1');

    fetchMock.mockImplementationOnce(async () => {
      throw new Error('network down');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current).toBe('map-1');
    unmount();
  });

  it('treats a non-ok response like a silent failure, keeping the last id', async () => {
    const { result, unmount } = renderHook(() => useActiveBattleMapId('CAMP1'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current).toBe('map-1');

    fetchMock.mockImplementationOnce(
      async () => new Response('error', { status: 500 })
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current).toBe('map-1');
    unmount();
  });
});
