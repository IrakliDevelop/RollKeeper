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
});
