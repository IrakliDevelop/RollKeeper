import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { IDBFactory } from 'fake-indexeddb';

import type { TableControlSession } from '@/lib/table/authorityLifecycle';
import { TableRepository } from '@/lib/table/repository';
import type { TableCanvasCheckpointV1 } from '@/lib/table/schema';

import { useSceneCheckpointActions } from './useSceneCheckpointActions';

const checkpoint: TableCanvasCheckpointV1 = {
  protocolVersion: 1,
  generation: 'saved-gen',
  revision: 1,
  capturedAt: '2026-10-13T00:00:00.000Z',
  state: {
    cursor: { generation: 'saved-gen', revision: 1 },
    elements: [],
    layers: [],
    extensions: { fog: { pluginName: 'fog', version: 1, data: null } },
  },
};

/** A restore whose provision answer is held until `release()`. */
function heldRestoreFetch() {
  let release!: () => void;
  const held = new Promise<void>(resolve => {
    release = resolve;
  });
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).endsWith('/checkpoint'))
      return Response.json({ generation: 'room-gen', casToken: 'cas' });
    await held;
    return Response.json({ status: 'provisioned', generation: 'new-gen' });
  });
  return { fetchMock, release };
}

afterEach(() => vi.unstubAllGlobals());

/** The page's live control session: this tab holds the lease at fence 7. */
const liveSession = {
  holderSessionId: 'session-tab-a',
  current: () => ({ writerFence: 7 }),
  isLost: () => false,
} as unknown as TableControlSession;

describe('useSceneCheckpointActions restore (review S4)', () => {
  const render = (
    sceneId: string,
    controlSession: TableControlSession | null = liveSession
  ) =>
    renderHook(
      (props: { sceneId: string }) =>
        useSceneCheckpointActions({
          repository: null,
          adapter: null,
          connection: null,
          campaignCode: 'CAMP',
          dmId: 'dm-1',
          sceneId: props.sceneId,
          controlSession,
        }),
      { initialProps: { sceneId } }
    );

  it('counts a restore and reports it for the scene that is still mounted', async () => {
    const { fetchMock, release } = heldRestoreFetch();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = render('scene-a');
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.restore(checkpoint, 'checkpoint');
    });
    release();
    await act(async () => pending);
    expect(result.current.restoredCount).toBe(1);
    expect(result.current.saveMessage).toBe('Checkpoint restored.');
  });

  it('ignores a restore that finishes after another scene was mounted', async () => {
    const { fetchMock, release } = heldRestoreFetch();
    vi.stubGlobal('fetch', fetchMock);
    const { result, rerender } = render('scene-a');
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.restore(checkpoint, 'checkpoint');
    });
    rerender({ sceneId: 'scene-b' });
    const before = result.current.saveMessage;
    release();
    await act(async () => pending);
    // No remount of scene B's canvas and no message about scene A on it.
    expect(result.current.restoredCount).toBe(0);
    expect(result.current.saveMessage).toBe(before);
    expect(result.current.recoveryBusy).toBe(false);
  });

  it('sends the live tab session and fence on both restore calls (B1)', async () => {
    const { fetchMock, release } = heldRestoreFetch();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = render('scene-a');
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.restore(checkpoint, 'checkpoint');
    });
    release();
    await act(async () => pending);
    const bodies = fetchMock.mock.calls.map(
      call =>
        JSON.parse(
          String((call as unknown as [string, RequestInit])[1].body)
        ) as Record<string, unknown>
    );
    expect(bodies).toHaveLength(2);
    for (const body of bodies)
      expect(body).toMatchObject({
        holderSessionId: 'session-tab-a',
        expectedFence: 7,
      });
  });

  it.each([
    ['no session (another tab is live)', null],
    [
      'a lost session',
      { ...liveSession, isLost: () => true } as unknown as TableControlSession,
    ],
  ])(
    'never calls the server and says this tab is not live with %s (B1)',
    async (_label, session) => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      const { result } = render('scene-a', session);
      expect(result.current.live).toBe(false);
      await act(async () => {
        await result.current.restore(checkpoint, 'checkpoint');
      });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(result.current.saveMessage).toMatch(/this tab isn't live/iu);
      expect(result.current.restoredCount).toBe(0);
    }
  );
});

describe('GG3 offline changes slot actions', () => {
  const fork = {
    savedAt: '2026-10-15T10:01:00.000Z',
    replacedEarlier: false,
    draft: checkpoint,
  };
  const render = (
    controlSession: TableControlSession | null = liveSession,
    clearOfflineFork = vi.fn(
      async (): Promise<'cleared' | 'gone' | 'failed'> => 'cleared'
    )
  ) => {
    const adapter = {
      clearOfflineFork,
      getBattleMap: () => ({ id: 'scene-a' }),
    } as never;
    const hook = renderHook(() =>
      useSceneCheckpointActions({
        repository: null,
        adapter,
        connection: null,
        campaignCode: 'CAMP',
        dmId: 'dm-1',
        sceneId: 'scene-a',
        controlSession,
      })
    );
    return { ...hook, clearOfflineFork };
  };

  it('reapplies the offline version through the live restore and then clears the slot', async () => {
    const { fetchMock, release } = heldRestoreFetch();
    vi.stubGlobal('fetch', fetchMock);
    const { result, clearOfflineFork } = render();
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.reapplyOfflineFork(fork);
    });
    release();
    await act(async () => pending);
    expect(result.current.restoredCount).toBe(1);
    expect(result.current.saveMessage).toBe('Offline changes restored.');
    expect(clearOfflineFork).toHaveBeenCalledWith(fork.savedAt);
  });

  it('keeps the slot when the restore does not happen (not live)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result, clearOfflineFork } = render(null);
    await act(async () => {
      await result.current.reapplyOfflineFork(fork);
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(clearOfflineFork).not.toHaveBeenCalled();
    expect(result.current.saveMessage).toMatch(/this tab isn't live/iu);
  });

  it('discards the slot without touching the live room', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result, clearOfflineFork } = render();
    await act(async () => {
      await result.current.discardOfflineFork(fork);
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(clearOfflineFork).toHaveBeenCalledWith(fork.savedAt);
    expect(result.current.saveMessage).toBe('Offline changes discarded.');
  });
});

describe('HH4 offline changes slot edges', () => {
  const fork = {
    savedAt: '2026-10-15T10:01:00.000Z',
    replacedEarlier: false,
    draft: checkpoint,
  };
  const render = (
    clearOfflineFork: () => Promise<'cleared' | 'gone' | 'failed'>,
    repository: TableRepository | null = null
  ) => {
    // One adapter object: a new one per render would re-run its effect.
    const adapter = {
      clearOfflineFork,
      getBattleMap: () => ({ id: 'scene' }),
    } as never;
    return renderHook(
      (props: { sceneId: string }) =>
        useSceneCheckpointActions({
          repository,
          adapter,
          connection: null,
          campaignCode: 'CAMP',
          dmId: 'dm-1',
          sceneId: props.sceneId,
          controlSession: liveSession,
        }),
      { initialProps: { sceneId: 'scene-1' } }
    );
  };

  it('says so when Discard finds the slot already gone', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const { result } = render(async () => 'gone');
    await act(async () => {
      await result.current.discardOfflineFork(fork);
    });
    expect(result.current.saveMessage).toBe(
      'These offline changes were already reapplied or discarded.'
    );
  });

  it('reports a real Discard failure', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const { result } = render(async () => 'failed');
    await act(async () => {
      await result.current.discardOfflineFork(fork);
    });
    expect(result.current.saveMessage).toBe(
      "Couldn't discard the offline changes. They are still in Details."
    );
  });

  it('clears the slot of the restored scene even after another scene was mounted', async () => {
    const factory = new IDBFactory();
    const repository = new TableRepository({
      factory,
      selection: {
        account: { kind: 'guest' },
        workspace: { localWorkspaceId: 'hh4-restore' },
      },
    });
    await repository.start();
    await repository.putSceneForTest(
      {
        schemaVersion: 1,
        workspaceKey: repository.workspaceIdentity,
        sceneId: 'scene-1',
        originalMapId: null,
        map: {
          name: 'Crypt',
          mapImageUrl: '',
          mapImageSize: { w: 1, h: 1 },
          gridEnabled: false,
          gridSettings: null,
          markers: [],
          dmOnlyElements: {},
        },
        canvasCheckpoint: null,
        offlineFork: fork,
        members: [],
        arrivalPoint: null,
        createdAt: '2026-10-05T00:00:00.000Z',
        updatedAt: '2026-10-05T00:00:00.000Z',
      },
      0
    );
    const { fetchMock, release } = heldRestoreFetch();
    vi.stubGlobal('fetch', fetchMock);
    // The mounted scene's adapter is disposed by the switch.
    const disposedClear = vi.fn(async () => 'failed' as const);
    const { result, rerender } = render(disposedClear, repository);
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.reapplyOfflineFork(fork);
    });
    rerender({ sceneId: 'scene-2' });
    release();
    await act(async () => pending);
    expect(result.current.restoredCount).toBe(0);
    const loaded = await repository.reload();
    if (loaded.status !== 'ready') throw new Error('expected ready');
    expect(loaded.snapshot.scenes[0]?.offlineFork).toBeUndefined();
    expect(disposedClear).not.toHaveBeenCalled();
    repository.dispose();
  });
});
