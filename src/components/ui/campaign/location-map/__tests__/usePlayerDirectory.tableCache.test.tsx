import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createTablePlayersCache,
  TablePlayersCacheProvider,
  useTablePlayersSnapshot,
  type TablePlayersCache,
} from '@/components/ui/campaign/table/useTablePlayersSnapshot';

import { usePlayerDirectory } from '../usePlayerDirectory';

const row = {
  playerId: 'legacy-a',
  playerName: 'Sam',
  characterId: 'char-a',
  characterName: 'Aria',
};
let cache: TablePlayersCache;
const reads = () =>
  vi
    .mocked(fetch)
    .mock.calls.filter(([url]) => String(url) === '/api/campaign/CAMP/players')
    .length;
const wrapper = ({ children }: { children: ReactNode }) => (
  <StrictMode>
    <TablePlayersCacheProvider value={cache}>
      {children}
    </TablePlayersCacheProvider>
  </StrictMode>
);

beforeEach(() => {
  cache = createTablePlayersCache();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ players: [row] }))
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('FU-4 Table canvas player directory shares the workspace players read', () => {
  it('reuses a fresh workspace snapshot on (StrictMode) mount: zero reads', async () => {
    cache.set('CAMP', {
      status: 'ready',
      players: [],
      campaignPlayers: [],
      data: [row as never],
      stale: false,
      fetchedAt: Date.now(),
    });
    const { result } = renderHook(() => usePlayerDirectory('CAMP', true), {
      wrapper,
    });
    await waitFor(() => expect(result.current.directory).not.toBeNull());
    expect(result.current.directory?.nameOf('char-a')).toBe('Sam');
    expect(reads()).toBe(0);
  });

  it('shares one read with the roster snapshot when the cache is stale', async () => {
    const { result } = renderHook(
      () => ({
        directory: usePlayerDirectory('CAMP', true),
        roster: useTablePlayersSnapshot('CAMP'),
      }),
      { wrapper }
    );
    await waitFor(() =>
      expect(result.current.directory.directory).not.toBeNull()
    );
    await waitFor(() =>
      expect(result.current.roster.snapshot.status).toBe('ready')
    );
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });
    expect(reads()).toBe(1);
    // An unknown peer still forces one fresh read (join mid-session).
    act(() => result.current.directory.ensureKnown(['char-new']));
    await waitFor(() => expect(reads()).toBe(2));
  });

  it('a stalled shared read is bounded: the next unknown peer reads again (R4-4 / FU2i)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
      vi.stubGlobal('fetch', fetchMock);
      const { result } = renderHook(() => usePlayerDirectory('CAMP', true), {
        wrapper,
      });
      await act(async () => vi.advanceTimersByTimeAsync(0));
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await act(async () => vi.advanceTimersByTimeAsync(8_000));
      act(() => result.current.ensureKnown(['char-late']));
      await act(async () => vi.advanceTimersByTimeAsync(0));
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.current.directory).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps a forced refresh queued during an in-flight read (R4-4 / FU4h)', async () => {
    const resolvers: Array<(response: Response) => void> = [];
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>(resolve => {
          resolvers.push(resolve);
        })
    );
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => usePlayerDirectory('CAMP', true), {
      wrapper,
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    act(() => result.current.ensureKnown(['char-new']));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // The first read lands (cache now fresh), the queued forced one still runs.
    await act(async () => resolvers[0]!(Response.json({ players: [row] })));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await act(async () =>
      resolvers[1]!(
        Response.json({
          players: [
            row,
            { ...row, playerId: 'legacy-n', characterId: 'char-new' },
          ],
        })
      )
    );
    await waitFor(() =>
      expect(result.current.directory?.ids.has('char-new')).toBe(true)
    );
  });
});
