import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TableSceneRoomInput } from '@/lib/table/authorityLifecycle';
import { registryServer } from '@/lib/table/controlServer.fixture';
import type { TableRepository } from '@/lib/table/repository';

import { useTableWorkspaceAuthority } from './useTableWorkspaceAuthority';

const REPOSITORY = {} as TableRepository;

const room = (sceneId: string): TableSceneRoomInput => ({
  sceneId,
  sourceMapId: sceneId,
  workspaceInstanceId: 'workspace-1',
  contentRevision: 1,
  safeLabel: `Scene ${sceneId}`,
  canvasState: {},
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(next => {
    resolve = next;
  });
  return { promise, resolve };
}

let server: ReturnType<typeof registryServer>;

function mount(initial: TableSceneRoomInput | null) {
  return renderHook(
    ({ scene }: { scene: TableSceneRoomInput | null }) =>
      useTableWorkspaceAuthority({
        repository: REPOSITORY,
        campaignCode: 'CAMP',
        dmId: 'dm-1',
        scene,
      }),
    { initialProps: { scene: initial } }
  );
}

const posted = (type?: string) =>
  server.commands.filter(command => !type || command.type === type);

beforeEach(() => {
  server = registryServer();
  server.state.revision = 1;
  vi.stubGlobal('fetch', server.fetcher);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('W3 one control session per workspace (D8)', () => {
  it('acquires once and registers each never-registered scene once across 30 switches', async () => {
    const intervals = vi.spyOn(globalThis, 'setInterval');
    const { result, rerender, unmount } = mount(room('scene-a'));
    await waitFor(() => expect(result.current.room.status).toBe('ready'));
    const session = result.current.session;
    expect(session).not.toBeNull();
    const ids = ['scene-a', 'scene-b', 'scene-c'];
    for (let index = 1; index <= 30; index += 1) {
      const id = ids[index % ids.length]!;
      rerender({ scene: room(id) });
      await waitFor(() =>
        expect(result.current.room).toMatchObject({
          sceneId: id,
          status: 'ready',
        })
      );
    }
    expect(result.current.session).toBe(session);
    expect(result.current.controlEpoch).toBe(1);
    expect(posted('acquire')).toHaveLength(1);
    expect(posted('registerScene').map(command => command.sceneId)).toEqual(
      ids
    );
    // One prepare per (scene, controlEpoch): revisits use the settled result.
    expect(server.initializes).toHaveLength(3);
    expect(
      intervals.mock.calls.filter(([, delay]) => delay === 10_000)
    ).toHaveLength(1);
    expect(
      posted().filter(command =>
        ['show', 'blank', 'unpresent', 'deletePresented'].includes(
          String(command.type)
        )
      )
    ).toEqual([]);
    unmount();
  });

  it('mounts locally with zero control POSTs while another session holds control (R3-F6)', async () => {
    server.other('acquire', 'other-session');
    const { result, rerender } = mount(room('scene-a'));
    await waitFor(() =>
      expect(result.current.state).toMatchObject({
        phase: 'failed',
        reason: 'controller-active',
        foreignHolder: true,
      })
    );
    const sent = posted().length;
    for (const id of ['scene-b', 'scene-c', 'scene-a']) {
      rerender({ scene: room(id) });
      expect(result.current.room).toMatchObject({
        sceneId: id,
        status: 'local',
      });
    }
    expect(posted()).toHaveLength(sent);
    expect(server.initializes).toHaveLength(0);
    expect(result.current.firstOutcome).toBe(true);
  });

  it('sends nothing on scene switches after Work offline', async () => {
    const { result, rerender } = mount(room('scene-a'));
    await waitFor(() => expect(result.current.room.status).toBe('ready'));
    act(() => result.current.workOffline());
    const sent = posted().length;
    rerender({ scene: room('scene-b') });
    expect(result.current.room).toMatchObject({
      sceneId: 'scene-b',
      status: 'local',
    });
    expect(posted()).toHaveLength(sent);
  });

  it('registers before the post-acquire remount (C6-2)', async () => {
    const register = deferred();
    server = registryServer({
      gate: kind => (kind === 'registerScene' ? register.promise : undefined),
    });
    server.state.revision = 1;
    server.other('acquire', 'other-session');
    vi.stubGlobal('fetch', server.fetcher);
    const { result } = mount(room('scene-new'));
    await waitFor(() => expect(result.current.state.phase).toBe('failed'));
    expect(result.current.room.status).toBe('local');
    // The foreign lease expires; the DM explicitly acquires.
    server.state.leaseUntil = 0;
    act(() => result.current.acquire());
    await waitFor(() => expect(result.current.state.phase).toBe('ready'));
    await waitFor(() =>
      expect(result.current.room).toMatchObject({ status: 'registering' })
    );
    expect(result.current.explicitAcquired).toBe(0);
    expect(result.current.canShow).toBe(false);
    register.resolve();
    await waitFor(() => expect(result.current.room.status).toBe('ready'));
    expect(result.current.explicitAcquired).toBe(1);
    expect(result.current.canShow).toBe(true);
    expect(posted('registerScene')).toHaveLength(1);
    expect(posted('takeover')).toHaveLength(0);
  });

  it('ends on A with no stale prepare applied after A→B→A with delayed replies (C6-6)', async () => {
    const gates = new Map([
      ['scene-a', deferred()],
      ['scene-b', deferred()],
    ]);
    server = registryServer({
      gate: (kind, sceneId) =>
        kind === 'registerScene' ? gates.get(sceneId)?.promise : undefined,
    });
    server.state.revision = 1;
    vi.stubGlobal('fetch', server.fetcher);
    const { result, rerender } = mount(room('scene-a'));
    await waitFor(() =>
      expect(result.current.room).toMatchObject({
        sceneId: 'scene-a',
        status: 'registering',
      })
    );
    rerender({ scene: room('scene-b') });
    expect(result.current.room).toMatchObject({
      sceneId: 'scene-b',
      status: 'registering',
    });
    rerender({ scene: room('scene-a') });
    gates.get('scene-b')!.resolve();
    gates.get('scene-a')!.resolve();
    await waitFor(() =>
      expect(result.current.room).toMatchObject({
        sceneId: 'scene-a',
        status: 'ready',
      })
    );
    // B never started: it was no longer selected when A's prepare settled.
    expect(posted('registerScene').map(command => command.sceneId)).toEqual([
      'scene-a',
    ]);
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });
    expect(result.current.room).toMatchObject({
      sceneId: 'scene-a',
      status: 'ready',
    });
  });

  it('keeps a slow B result from replacing A when B already started', async () => {
    const gateB = deferred();
    server = registryServer({
      gate: (kind, sceneId) =>
        kind === 'initialize' && sceneId === 'scene-b'
          ? gateB.promise
          : undefined,
    });
    server.state.revision = 1;
    vi.stubGlobal('fetch', server.fetcher);
    const { result, rerender } = mount(room('scene-a'));
    await waitFor(() => expect(result.current.room.status).toBe('ready'));
    rerender({ scene: room('scene-b') });
    await waitFor(() => expect(server.initializes).toHaveLength(2));
    rerender({ scene: room('scene-a') });
    expect(result.current.room).toMatchObject({
      sceneId: 'scene-a',
      status: 'ready',
    });
    gateB.resolve();
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });
    expect(result.current.room).toMatchObject({
      sceneId: 'scene-a',
      status: 'ready',
    });
  });

  it('never prepares without a selected scene and never re-acquires after loss', async () => {
    const { result, rerender } = mount(null);
    await waitFor(() => expect(result.current.state.phase).toBe('ready'));
    expect(result.current.room.status).toBe('idle');
    expect(posted('registerScene')).toHaveLength(0);
    server.other('takeover', 'other-session');
    rerender({ scene: room('scene-a') });
    await waitFor(() => expect(result.current.state.phase).toBe('lost'));
    expect(result.current.room).toMatchObject({
      sceneId: 'scene-a',
      status: 'local',
    });
    expect(posted('acquire')).toHaveLength(1);
    rerender({ scene: room('scene-b') });
    expect(result.current.room.status).toBe('local');
    expect(posted('acquire')).toHaveLength(1);
  });

  it('surfaces a registry refusal as a visible local-only reason', async () => {
    for (let index = 0; index < 100; index += 1)
      server.registry.set(`other-${index}`, {
        sceneId: `other-${index}`,
        workspaceInstanceId: 'workspace-1',
        sourceMapId: `other-${index}`,
        registryRevision: 1,
      });
    const { result } = mount(room('scene-a'));
    await waitFor(() =>
      expect(result.current.room.message).toBe(
        'This campaign already has the maximum number of live scenes'
      )
    );
    expect(result.current.room.status).toBe('local');
    expect(result.current.state.phase).toBe('ready');
    expect(result.current.canShow).toBe(false);
  });

  it('publishes descriptor changes from ANY session command (PR04 P3.5)', async () => {
    const { result } = mount(room('scene-a'));
    await waitFor(() => expect(result.current.room.status).toBe('ready'));
    server.state.presentation = {
      sceneId: 'scene-a',
      revision: 4,
      blanked: true,
    };
    await act(async () => {
      await result.current.session!.renew();
    });
    expect(result.current.descriptor?.presentation).toEqual({
      sceneId: 'scene-a',
      revision: 4,
      blanked: true,
    });
  });

  describe('acceptance A3: transient A1b failures are not final', () => {
    function failingReads() {
      const failures = { next: 0 };
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>(async (input, init) => {
          const isRead = !init?.method || init.method === 'GET';
          if (isRead && failures.next > 0) {
            failures.next -= 1;
            return new Response('unavailable', { status: 503 });
          }
          return server.fetcher(input, init);
        })
      );
      return failures;
    }

    it('re-runs a failed registration when the scene is selected again', async () => {
      const failures = failingReads();
      const { result, rerender } = mount(null);
      await waitFor(() => expect(result.current.state.phase).toBe('ready'));
      failures.next = 1;
      rerender({ scene: room('scene-cave') });
      await waitFor(() =>
        expect(result.current.room).toMatchObject({
          sceneId: 'scene-cave',
          status: 'local',
          message: 'Live registration is unavailable; this scene stays local.',
          retryable: true,
        })
      );
      rerender({ scene: room('scene-tavern') });
      await waitFor(() => expect(result.current.room.status).toBe('ready'));
      rerender({ scene: room('scene-cave') });
      await waitFor(() =>
        expect(result.current.room).toMatchObject({
          sceneId: 'scene-cave',
          status: 'ready',
        })
      );
      expect(posted('acquire')).toHaveLength(1);
      expect(posted('registerScene').map(command => command.sceneId)).toEqual([
        'scene-tavern',
        'scene-cave',
      ]);
    });

    it('offers a retry that registers once without re-acquiring', async () => {
      const failures = failingReads();
      const { result, rerender } = mount(null);
      await waitFor(() => expect(result.current.state.phase).toBe('ready'));
      failures.next = 1;
      rerender({ scene: room('scene-cave') });
      await waitFor(() => expect(result.current.room.retryable).toBe(true));
      act(() => {
        result.current.retryRoom();
        result.current.retryRoom();
      });
      await waitFor(() => expect(result.current.room.status).toBe('ready'));
      expect(posted('registerScene')).toHaveLength(1);
      expect(posted('acquire')).toHaveLength(1);
      expect(result.current.canShow).toBe(true);
    });

    it('keeps a genuine refusal cached on reselect (registry-full retry stays explicit)', async () => {
      server.registry.set('scene-cave', {
        sceneId: 'scene-cave',
        workspaceInstanceId: 'another-device',
        sourceMapId: 'scene-cave',
        registryRevision: 1,
      });
      const { result, rerender } = mount(room('scene-cave'));
      await waitFor(() =>
        expect(result.current.room.message).toMatch(/another device/u)
      );
      expect(result.current.room.retryable).toBe(false);
      const reads = server.reads.length;
      rerender({ scene: room('scene-tavern') });
      await waitFor(() => expect(result.current.room.status).toBe('ready'));
      const afterTavern = server.reads.length;
      rerender({ scene: room('scene-cave') });
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
      });
      expect(result.current.room.status).toBe('local');
      expect(server.reads.length).toBe(afterTavern);
      expect(afterTavern).toBeGreaterThan(reads);
      expect(posted('acquire')).toHaveLength(1);
    });
  });
});
