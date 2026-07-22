// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useShareWithPlayers } from '@/components/ui/campaign/location-map/useShareWithPlayers';
import { useActiveBattleMapId } from '@/hooks/useActiveBattleMapId';
import { mockFetchResponse, resetFetch } from '@/test/mocks/fetch';

vi.mock('@/hooks/useActiveBattleMapId', () => ({
  useActiveBattleMapId: vi.fn(() => null),
}));

const LOCATION = { id: 'map-a', name: 'Cave' };

describe('useShareWithPlayers', () => {
  beforeEach(() => {
    resetFetch();
    vi.mocked(useActiveBattleMapId).mockReturnValue(null);
  });

  it('hydrates ON when the server says this map is live', () => {
    vi.mocked(useActiveBattleMapId).mockReturnValue('map-a');
    const { result } = renderHook(() =>
      useShareWithPlayers('CODE', 'dm-1', LOCATION, true)
    );
    expect(result.current.sharedWithPlayers).toBe(true);
  });

  it('hydrates OFF when a DIFFERENT map is live — the stale-share trap', () => {
    vi.mocked(useActiveBattleMapId).mockReturnValue('map-b');
    const { result } = renderHook(() =>
      useShareWithPlayers('CODE', 'dm-1', LOCATION, true)
    );
    expect(result.current.sharedWithPlayers).toBe(false);
  });

  it('disabled (location mode) passes null code and stays OFF', () => {
    const { result } = renderHook(() =>
      useShareWithPlayers('CODE', 'dm-1', LOCATION, false)
    );
    expect(vi.mocked(useActiveBattleMapId)).toHaveBeenCalledWith(null);
    expect(result.current.sharedWithPlayers).toBe(false);
  });

  it('toggling ON pushes this map live', async () => {
    const fetchFn = mockFetchResponse(200, {});
    const { result } = renderHook(() =>
      useShareWithPlayers('CODE', 'dm-1', LOCATION, true)
    );
    await act(async () => {
      result.current.handleToggleShareWithPlayers();
    });
    expect(result.current.sharedWithPlayers).toBe(true);
    const [url, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/campaign/CODE/shared');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.feature).toBe('battlemap');
    expect(body.data.activeBattleMapId).toBe('map-a');
    expect(body.data.name).toBe('Cave');
    expect(body.dmId).toBe('dm-1');
  });

  it('toggling OFF clears the live map', async () => {
    vi.mocked(useActiveBattleMapId).mockReturnValue('map-a');
    const fetchFn = mockFetchResponse(200, {});
    const { result } = renderHook(() =>
      useShareWithPlayers('CODE', 'dm-1', LOCATION, true)
    );
    await act(async () => {
      result.current.handleToggleShareWithPlayers();
    });
    expect(result.current.sharedWithPlayers).toBe(false);
    const body = JSON.parse(
      ((fetchFn as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit)
        .body as string
    );
    expect(body.data.activeBattleMapId).toBeNull();
  });

  it('reconciles when the server-active id changes (e.g. combat started in another tab)', () => {
    const { result, rerender } = renderHook(() =>
      useShareWithPlayers('CODE', 'dm-1', LOCATION, true)
    );
    expect(result.current.sharedWithPlayers).toBe(false);
    vi.mocked(useActiveBattleMapId).mockReturnValue('map-a');
    rerender();
    expect(result.current.sharedWithPlayers).toBe(true);
  });
});
