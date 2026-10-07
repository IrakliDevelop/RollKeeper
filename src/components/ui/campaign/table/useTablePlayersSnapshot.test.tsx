import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTablePlayersSnapshot } from './useTablePlayersSnapshot';

const body = {
  players: [
    {
      playerId: 'legacy-aria',
      playerName: 'Sam',
      characterId: 'char-aria',
      characterName: 'Aria',
      characterData: { hitPoints: { current: 12, max: 20 } },
      lastSynced: '2026-10-07T00:00:00.000Z',
    },
  ],
};

let signals: AbortSignal[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  signals = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.signal) signals.push(init.signal);
      return Response.json(body);
    })
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Table players snapshot refresh (C3-6)', () => {
  it('keeps the authorized character data for read-only live merges', async () => {
    const { result } = renderHook(() => useTablePlayersSnapshot('CAMP'));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(result.current.snapshot).toMatchObject({
      status: 'ready',
      data: [
        expect.objectContaining({
          characterData: body.players[0]!.characterData,
        }),
      ],
    });
  });

  it('refreshes every 10 s and on turn change while active, single in-flight, disposed on unmount', async () => {
    const fetchMock = vi.mocked(fetch);
    const { rerender, unmount } = renderHook(
      ({ key }) =>
        useTablePlayersSnapshot('CAMP', { pollMs: 10_000, refreshKey: key }),
      { initialProps: { key: 'turn-1' } }
    );
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    rerender({ key: 'turn-2' });
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    // Earlier requests were superseded (aborted), never left concurrently.
    expect(signals.slice(0, -1).every(signal => signal.aborted)).toBe(true);
    unmount();
    expect(signals.at(-1)?.aborted).toBe(true);
    await act(async () => vi.advanceTimersByTimeAsync(30_000));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not poll when inactive (existing behavior)', async () => {
    const fetchMock = vi.mocked(fetch);
    renderHook(() => useTablePlayersSnapshot('CAMP', { pollMs: null }));
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
