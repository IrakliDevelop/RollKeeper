import { describe, expect, it, vi } from 'vitest';

import {
  acquireTableControl,
  prepareTableSceneRoom,
  sceneRoomMessage,
  type TableControlSession,
} from './authorityLifecycle';
import { registryServer } from './controlServer.fixture';

const control = (fetcher: typeof fetch) => ({
  campaignCode: 'CAMP',
  dmId: 'dm-1',
  holderSessionId: 'table-session-1',
  fetcher,
});

const scene = (sceneId: string, overrides: Record<string, unknown> = {}) => ({
  sceneId,
  sourceMapId: sceneId,
  workspaceInstanceId: 'workspace-1',
  contentRevision: 3,
  safeLabel: `Scene ${sceneId}`,
  canvasState: { elements: [] },
  ...overrides,
});

async function acquired(
  server: ReturnType<typeof registryServer>
): Promise<TableControlSession> {
  // The control record exists (the PR03A initialize already happened).
  server.state.revision = 1;
  const result = await acquireTableControl(control(server.fetcher));
  if (result.status !== 'acquired') throw new Error(JSON.stringify(result));
  return result.session;
}

const types = (server: ReturnType<typeof registryServer>, type: string) =>
  server.commands.filter(command => command.type === type);

describe('A1 session-scoped scene preparation', () => {
  it('acquires once and prepares many scenes through the one session', async () => {
    const server = registryServer();
    const session = await acquired(server);
    for (let round = 0; round < 10; round += 1) {
      for (const id of ['scene-a', 'scene-b', 'scene-c']) {
        await expect(
          prepareTableSceneRoom(session, scene(id), control(server.fetcher))
        ).resolves.toMatchObject({ status: 'ready' });
      }
    }
    expect(types(server, 'acquire')).toHaveLength(1);
    expect(types(server, 'registerScene')).toHaveLength(3);
    expect(types(server, 'registerScene')[0]).toMatchObject({
      sceneId: 'scene-a',
      sourceMapId: 'scene-a',
      workspaceInstanceId: 'workspace-1',
      contentRevision: 3,
      safeLabel: 'Scene scene-a',
      expectedRegistryRevision: 0,
      holderSessionId: 'table-session-1',
    });
    // R3-F5: a fresh DM control read per prepare (1 acquire read + 30).
    expect(server.reads).toHaveLength(31);
    expect(server.initializes).toHaveLength(30);
    expect(session.isLost()).toBe(false);
    expect(session.current().revision).toBe(server.state.revision);
  });

  it('sends registerScene through the session queue with one same-holder stale-control retry', async () => {
    const server = registryServer();
    const session = await acquired(server);
    // Another request of this holder commits in between (e.g. a renew).
    server.other('renew', 'table-session-1');
    await expect(
      prepareTableSceneRoom(session, scene('scene-a'), control(server.fetcher))
    ).resolves.toMatchObject({ status: 'ready' });
    const registers = types(server, 'registerScene');
    expect(registers).toHaveLength(2);
    expect(registers[1]!.expectedRevision).toBe(
      Number(registers[0]!.expectedRevision) + 1
    );
    expect(session.isLost()).toBe(false);
  });

  it('reports registry-full as rejected and keeps the session usable', async () => {
    const server = registryServer();
    const session = await acquired(server);
    for (let index = 0; index < 100; index += 1)
      server.registry.set(`other-${index}`, {
        sceneId: `other-${index}`,
        workspaceInstanceId: 'workspace-1',
        sourceMapId: `other-${index}`,
        registryRevision: 1,
      });
    const result = await prepareTableSceneRoom(
      session,
      scene('scene-a'),
      control(server.fetcher)
    );
    expect(result).toEqual({ status: 'rejected', reason: 'registry-full' });
    expect(sceneRoomMessage(result)).toBe(
      'This campaign has reached its limit of live scenes.'
    );
    expect(session.isLost()).toBe(false);
    expect(server.initializes).toHaveLength(0);
    await expect(session.renew()).resolves.toMatchObject({
      status: 'committed',
    });
  });

  it('reports entry-too-large as rejected without marking the session lost', async () => {
    const server = registryServer({ entryLimit: 10 });
    const session = await acquired(server);
    const result = await prepareTableSceneRoom(
      session,
      scene('scene-a'),
      control(server.fetcher)
    );
    expect(result).toEqual({ status: 'rejected', reason: 'entry-too-large' });
    expect(sceneRoomMessage(result)).toBe(
      'This scene name is too long for live play. Shorten it.'
    );
    expect(session.isLost()).toBe(false);
  });

  it('surfaces a registry identity mismatch as scene-identity-conflict without sending a command', async () => {
    const server = registryServer();
    const session = await acquired(server);
    server.registry.set('scene-a', {
      sceneId: 'scene-a',
      workspaceInstanceId: 'another-device',
      sourceMapId: 'scene-a',
      registryRevision: 1,
    });
    await expect(
      prepareTableSceneRoom(session, scene('scene-a'), control(server.fetcher))
    ).resolves.toEqual({
      status: 'conflict',
      reason: 'scene-identity-conflict',
    });
    expect(types(server, 'registerScene')).toHaveLength(0);
    expect(session.isLost()).toBe(false);
  });

  it('maps a racing scene-already-registered to scene-identity-conflict (not lost)', async () => {
    const server = registryServer({ hideFromRead: id => id === 'scene-a' });
    const session = await acquired(server);
    server.registry.set('scene-a', {
      sceneId: 'scene-a',
      workspaceInstanceId: 'another-device',
      sourceMapId: 'scene-a',
      registryRevision: 1,
    });
    await expect(
      prepareTableSceneRoom(session, scene('scene-a'), control(server.fetcher))
    ).resolves.toEqual({
      status: 'conflict',
      reason: 'scene-identity-conflict',
    });
    expect(types(server, 'registerScene')).toHaveLength(1);
    expect(session.isLost()).toBe(false);
  });

  it('treats stale-registry for the same identity as registered after a re-read', async () => {
    // Read 0 is the acquire read, read 1 the prepare read (stale), read 2
    // the re-read after `stale-registry`.
    const server = registryServer({
      hideFromRead: (id, readIndex) => id === 'scene-a' && readIndex <= 1,
    });
    const session = await acquired(server);
    server.registry.set('scene-a', {
      sceneId: 'scene-a',
      workspaceInstanceId: 'workspace-1',
      sourceMapId: 'scene-a',
      registryRevision: 1,
    });
    await expect(
      prepareTableSceneRoom(session, scene('scene-a'), control(server.fetcher))
    ).resolves.toMatchObject({ status: 'ready' });
    expect(types(server, 'registerScene')).toHaveLength(1);
    expect(server.reads).toHaveLength(3);
    expect(session.isLost()).toBe(false);
    expect(server.initializes).toHaveLength(1);
  });

  it('marks the session lost when ownership is lost before registering', async () => {
    const server = registryServer();
    const session = await acquired(server);
    server.other('takeover', 'other-session');
    const result = await prepareTableSceneRoom(
      session,
      scene('scene-a'),
      control(server.fetcher)
    );
    expect(result).toMatchObject({ status: 'lost' });
    expect(session.isLost()).toBe(true);
    expect(server.initializes).toHaveLength(0);
    expect(types(server, 'acquire')).toHaveLength(1);
  });

  it('accepts initialize-if-empty 409 as success and reports other failures', async () => {
    const existing = registryServer({ initializeStatus: 409 });
    const first = await acquired(existing);
    await expect(
      prepareTableSceneRoom(first, scene('scene-a'), control(existing.fetcher))
    ).resolves.toMatchObject({ status: 'ready' });

    const broken = registryServer({ initializeStatus: 500 });
    const second = await acquired(broken);
    await expect(
      prepareTableSceneRoom(second, scene('scene-a'), control(broken.fetcher))
    ).resolves.toEqual({ status: 'failed', reason: 'authority-initialize' });
    expect(second.isLost()).toBe(false);
  });

  it('never presents while preparing (no show/blank/unpresent commands)', async () => {
    const server = registryServer();
    const session = await acquired(server);
    await prepareTableSceneRoom(
      session,
      scene('scene-a'),
      control(server.fetcher)
    );
    expect(
      server.commands.filter(command =>
        ['show', 'blank', 'unpresent', 'deletePresented'].includes(
          String(command.type)
        )
      )
    ).toEqual([]);
  });

  it('does not take over an active foreign controller on acquire', async () => {
    const server = registryServer();
    server.state.revision = 1;
    server.other('acquire', 'other-session');
    const result = await acquireTableControl(control(server.fetcher));
    expect(result).toMatchObject({
      status: 'failed',
      reason: 'controller-active',
      holderSessionId: 'other-session',
    });
    expect(types(server, 'takeover')).toHaveLength(0);
  });

  it('times out a hung control read after 5 s and stays local with a reason (F11)', async () => {
    const server = registryServer();
    const session = await acquired(server);
    vi.useFakeTimers();
    try {
      const hanging = vi.fn<typeof fetch>(
        (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError'))
            );
          })
      );
      const pending = prepareTableSceneRoom(session, scene('scene-a'), {
        campaignCode: 'CAMP',
        dmId: 'dm-1',
        fetcher: hanging,
      });
      await vi.advanceTimersByTimeAsync(5_000);
      const result = await pending;
      expect(result).toEqual({ status: 'failed', reason: 'control-read' });
      expect(sceneRoomMessage(result)).toBe(
        "Live play isn't available right now, so this scene stays on this device."
      );
      expect(hanging.mock.calls[0]![1]?.signal).toBeInstanceOf(AbortSignal);
      expect(session.isLost()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
