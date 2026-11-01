import { act, cleanup, renderHook } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createTablePlayersCache,
  TablePlayersCacheProvider,
  useTablePlayersSnapshot,
} from './useTablePlayersSnapshot';

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

  it('keeps the last ready data across a failed poll and marks it stale (F1)', async () => {
    const fetchMock = vi.mocked(fetch);
    const { result } = renderHook(() =>
      useTablePlayersSnapshot('CAMP', { pollMs: 10_000 })
    );
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(result.current.snapshot).toMatchObject({
      status: 'ready',
      stale: false,
    });
    fetchMock.mockImplementationOnce(async () =>
      Response.json({ error: 'down' }, { status: 503 })
    );
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(result.current.snapshot).toMatchObject({
      status: 'ready',
      stale: true,
      data: [expect.objectContaining({ playerId: 'legacy-aria' })],
    });
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(result.current.snapshot).toMatchObject({
      status: 'ready',
      stale: false,
    });
  });
});

describe('W4 workspace players snapshot cache', () => {
  it('reuses a fresh cached snapshot on remount instead of refetching', async () => {
    const cache = createTablePlayersCache();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <TablePlayersCacheProvider value={cache}>
        {children}
      </TablePlayersCacheProvider>
    );
    const first = renderHook(() => useTablePlayersSnapshot('CAMP'), {
      wrapper,
    });
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(first.result.current.snapshot.status).toBe('ready');
    first.unmount();
    const calls = vi.mocked(fetch).mock.calls.length;
    const second = renderHook(() => useTablePlayersSnapshot('CAMP'), {
      wrapper,
    });
    expect(second.result.current.snapshot.status).toBe('ready');
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(vi.mocked(fetch).mock.calls.length).toBe(calls);
    // An explicit refresh still reads the server.
    act(() => second.result.current.refresh());
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(vi.mocked(fetch).mock.calls.length).toBe(calls + 1);
    // A stale cache (older than its window) refetches on mount.
    second.unmount();
    vi.advanceTimersByTime(11_000);
    renderHook(() => useTablePlayersSnapshot('CAMP'), { wrapper });
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(vi.mocked(fetch).mock.calls.length).toBe(calls + 2);
  });
});

describe('acceptance A1: reload() returns a fresh snapshot', () => {
  it('fetches now, updates the workspace cache and shares one in-flight read', async () => {
    const cache = createTablePlayersCache();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <TablePlayersCacheProvider value={cache}>
        {children}
      </TablePlayersCacheProvider>
    );
    const { result } = renderHook(() => useTablePlayersSnapshot('CAMP'), {
      wrapper,
    });
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    const before = vi.mocked(fetch).mock.calls.length;
    let first!: Promise<unknown>;
    let second!: Promise<unknown>;
    await act(async () => {
      first = result.current.reload();
      second = result.current.reload();
      await vi.runOnlyPendingTimersAsync();
    });
    expect(vi.mocked(fetch).mock.calls.length).toBe(before + 1);
    await expect(first).resolves.toEqual([
      { playerId: 'legacy-aria', characterId: 'char-aria', name: 'Aria' },
    ]);
    await expect(second).resolves.toEqual(await first);
    expect(cache.get('CAMP')?.players).toHaveLength(1);
  });
});

describe('acceptance A4: one players read per scene switch', () => {
  it('dedupes the roster and combat reads (StrictMode) to one per switch', async () => {
    const cache = createTablePlayersCache();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StrictMode>
        <TablePlayersCacheProvider value={cache}>
          {children}
        </TablePlayersCacheProvider>
      </StrictMode>
    );
    const useScenePanels = () => {
      // The scene's roster panel and combat panel each read the snapshot.
      const roster = useTablePlayersSnapshot('CAMP');
      const combat = useTablePlayersSnapshot('CAMP', { pollMs: null });
      return { roster, combat };
    };
    const reads = () => vi.mocked(fetch).mock.calls.length;
    for (let scene = 0; scene < 3; scene += 1) {
      const before = reads();
      const mounted = renderHook(useScenePanels, { wrapper });
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });
      expect(mounted.result.current.roster.snapshot.status).toBe('ready');
      expect(mounted.result.current.combat.snapshot.status).toBe('ready');
      expect(reads() - before).toBeLessThanOrEqual(1);
      mounted.unmount();
      // Switches spaced past the freshness window still read once.
      vi.advanceTimersByTime(11_000);
    }
  });
});

describe('FU-2 bounded players read (8 s)', () => {
  const stalled = () =>
    // Signal-agnostic: never settles even when aborted.
    vi.fn(() => new Promise<Response>(() => {}));

  it('times out a stalled read without a workspace cache and starts fresh on refresh', async () => {
    const fetchMock = stalled();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useTablePlayersSnapshot('CAMP'));
    await act(async () => vi.advanceTimersByTimeAsync(7_999));
    expect(result.current.snapshot.status).toBe('loading');
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(result.current.snapshot.status).toBe('unavailable');
    act(() => result.current.refresh());
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('bounds reload() without a workspace cache (R4-4 / FU2h)', async () => {
    vi.stubGlobal('fetch', stalled());
    const { result } = renderHook(() => useTablePlayersSnapshot('CAMP'));
    await act(async () => vi.advanceTimersByTimeAsync(8_000));
    let players: unknown = 'pending';
    act(() => {
      void result.current.reload().then(value => (players = value));
    });
    await act(async () => vi.advanceTimersByTimeAsync(7_999));
    expect(players).toBe('pending');
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(players).toBeNull();
    expect(result.current.snapshot.status).toBe('unavailable');
  });

  it('times out a stalled response body on the shared read and releases the in-flight entry', async () => {
    const fetchMock = vi.fn(
      async () =>
        ({
          ok: true,
          json: () => new Promise(() => {}),
        }) as unknown as Response
    );
    vi.stubGlobal('fetch', fetchMock);
    const cache = createTablePlayersCache();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <TablePlayersCacheProvider value={cache}>
        {children}
      </TablePlayersCacheProvider>
    );
    const { result } = renderHook(() => useTablePlayersSnapshot('CAMP'), {
      wrapper,
    });
    await act(async () => vi.advanceTimersByTimeAsync(8_000));
    expect(result.current.snapshot.status).toBe('unavailable');
    let players: unknown = 'pending';
    act(() => {
      void result.current.reload().then(value => (players = value));
    });
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => vi.advanceTimersByTimeAsync(8_000));
    expect(players).toBeNull();
    act(() => {
      void result.current.reload();
    });
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(1);
  });
});
