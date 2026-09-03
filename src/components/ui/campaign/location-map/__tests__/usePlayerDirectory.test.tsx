import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { usePlayerDirectory } from '../usePlayerDirectory';

type PlayerRow = {
  characterId: string;
  playerName: string;
  characterName: string;
};

function okResponse(list: PlayerRow[]) {
  return { ok: true, json: async () => ({ players: list }) };
}

/** fetch mock whose Nth call resolves only when the test says so. */
function deferredFetch() {
  const resolvers: Array<(r: unknown) => void> = [];
  const calls: string[] = [];
  const fn = vi.fn((url: string) => {
    calls.push(url);
    return new Promise(resolve => {
      resolvers.push(resolve);
    });
  }) as unknown as typeof fetch;
  return {
    fn,
    calls,
    resolve: (i: number, list: PlayerRow[]) => resolvers[i]?.(okResponse(list)),
  };
}

describe('usePlayerDirectory', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches once on mount when enabled, exposes ids + names, and refetches once per unknown id', async () => {
    const fetchMock = vi.fn(async () =>
      okResponse([
        { characterId: 'char-a', playerName: 'Sam', characterName: 'Aria' },
      ])
    ) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => usePlayerDirectory('CAMP01', true));
    await waitFor(() => expect(result.current.directory).not.toBeNull());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/campaign/CAMP01/players');
    expect(result.current.directory?.ids.has('char-a')).toBe(true);
    expect(result.current.directory?.nameOf('char-a')).toBe('Sam');

    act(() => result.current.ensureKnown(['char-a']));
    expect(fetchMock).toHaveBeenCalledTimes(1); // known → no refetch
    act(() => result.current.ensureKnown(['char-b']));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    act(() => result.current.ensureKnown(['char-b']));
    await new Promise(r => setTimeout(r, 0));
    expect(fetchMock).toHaveBeenCalledTimes(2); // once per unknown id
  });

  it('an unknown id seen while a request is in flight queues exactly one follow-up refresh', async () => {
    const d = deferredFetch();
    vi.stubGlobal('fetch', d.fn);
    const { result } = renderHook(() => usePlayerDirectory('CAMP01', true));
    expect(d.calls).toHaveLength(1);
    act(() => result.current.ensureKnown(['char-b']));
    act(() => result.current.ensureKnown(['char-c']));
    expect(d.calls).toHaveLength(1); // still in flight, nothing extra yet
    await act(async () => {
      d.resolve(0, []); // the in-flight response predates char-b/char-c
    });
    await waitFor(() => expect(d.calls).toHaveLength(2)); // ONE follow-up, not two
    await act(async () => {
      d.resolve(1, [
        { characterId: 'char-b', playerName: 'B', characterName: 'Bee' },
      ]);
    });
    await waitFor(() =>
      expect(result.current.directory?.ids.has('char-b')).toBe(true)
    );
    expect(d.calls).toHaveLength(2);
  });

  it('a campaign change discards the stale response and resets the requested-id set', async () => {
    const d = deferredFetch();
    vi.stubGlobal('fetch', d.fn);
    const { result, rerender } = renderHook(
      ({ code }: { code: string }) => usePlayerDirectory(code, true),
      { initialProps: { code: 'CAMP01' } }
    );
    act(() => result.current.ensureKnown(['char-x']));
    rerender({ code: 'CAMP02' });
    await waitFor(() => expect(d.calls).toHaveLength(2));
    expect(d.calls[1]).toBe('/api/campaign/CAMP02/players');
    await act(async () => {
      d.resolve(0, [
        { characterId: 'stale', playerName: 'S', characterName: 'S' },
      ]); // CAMP01, late
    });
    expect(result.current.directory).toBeNull(); // stale response ignored
    await act(async () => {
      d.resolve(1, [
        { characterId: 'char-y', playerName: 'Y', characterName: 'Y' },
      ]);
    });
    await waitFor(() =>
      expect(result.current.directory?.ids.has('char-y')).toBe(true)
    );
    expect(result.current.directory?.ids.has('stale')).toBe(false);
    act(() => result.current.ensureKnown(['char-x'])); // requested set was reset on the code change
    await waitFor(() => expect(d.calls).toHaveLength(3));
  });

  it('does nothing while disabled and stays null on a failed response', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        usePlayerDirectory('CAMP01', enabled),
      { initialProps: { enabled: false } }
    );
    expect(fetchMock).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(result.current.directory).toBeNull();
  });
});
