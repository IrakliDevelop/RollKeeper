import { describe, expect, it, vi } from 'vitest';

import {
  acquireTableControl,
  prepareTableSceneRoom,
  sceneRoomMessage,
  type TableControlSession,
} from './authorityLifecycle';

/**
 * In-memory model of the PR03A control Lua (atomic.ts) including the scene
 * registry rules of `registerScene`: exact epoch/revision/fence, ownership,
 * per-entry registry revision, identity mismatch, HLEN cap and entry size.
 */
function registryServer(
  options: {
    now?: () => number;
    /** Simulates a registry read (by index) that does not yet show a scene. */
    hideFromRead?: (sceneId: string, readIndex: number) => boolean;
    entryLimit?: number;
    initializeStatus?: number;
  } = {}
) {
  const now = options.now ?? (() => Date.now());
  const state = {
    epoch: '10000000-0000-4000-8000-000000000001',
    revision: 0,
    writerFence: 0,
    leaseUntil: 0,
    holderSessionId: null as string | null,
    presentation: {
      sceneId: null as string | null,
      revision: 0,
      blanked: false,
    },
    publicRunId: null as string | null,
  };
  const registry = new Map<string, Record<string, unknown>>();
  const commands: Array<Record<string, unknown>> = [];
  const reads: string[] = [];
  const initializes: Array<Record<string, unknown>> = [];
  const descriptor = () => structuredClone(state);
  const reply = (status: string, reason: string, code: number) =>
    Response.json({ status, reason, current: descriptor() }, { status: code });
  const execute = (command: Record<string, unknown>): Response => {
    commands.push(command);
    if (command.expectedEpoch !== state.epoch)
      return reply('conflict', 'stale-epoch', 409);
    if (command.expectedRevision !== state.revision)
      return reply('conflict', 'stale-control', 409);
    if (command.expectedFence !== state.writerFence)
      return reply('conflict', 'stale-fence', 409);
    const leaseActive = state.leaseUntil > now();
    const owns =
      leaseActive && state.holderSessionId === command.holderSessionId;
    switch (command.type) {
      case 'acquire':
        if (leaseActive) return reply('conflict', 'controller-active', 409);
        state.writerFence += 1;
        state.holderSessionId = String(command.holderSessionId);
        state.leaseUntil = now() + 30_000;
        break;
      case 'takeover':
        state.writerFence += 1;
        state.holderSessionId = String(command.holderSessionId);
        state.leaseUntil = now() + 30_000;
        break;
      case 'renew':
        if (!owns) return reply('conflict', 'lease-lost', 409);
        state.leaseUntil = now() + 30_000;
        break;
      case 'registerScene': {
        if (!owns) return reply('conflict', 'lease-lost', 409);
        const sceneId = String(command.sceneId);
        const existing = registry.get(sceneId);
        if (
          existing &&
          (existing.workspaceInstanceId !== command.workspaceInstanceId ||
            existing.sourceMapId !== command.sourceMapId ||
            existing.deleted === true)
        )
          return reply('conflict', 'scene-already-registered', 409);
        const registryRevision = Number(existing?.registryRevision ?? 0);
        if (command.expectedRegistryRevision !== registryRevision)
          return reply('conflict', 'stale-registry', 409);
        if (!existing && registry.size >= 100)
          return reply('denied', 'registry-full', 403);
        const entry = {
          v: 1,
          sceneId,
          workspaceInstanceId: command.workspaceInstanceId,
          sourceMapId: command.sourceMapId,
          contentRevision: command.contentRevision,
          safeLabel: command.safeLabel,
          registryRevision: registryRevision + 1,
          deleted: false,
        };
        if (JSON.stringify(entry).length > (options.entryLimit ?? 2048))
          return reply('denied', 'entry-too-large', 403);
        registry.set(sceneId, entry);
        break;
      }
      default:
        if (!owns) return reply('conflict', 'lease-lost', 409);
    }
    state.revision += 1;
    return reply('committed', 'current', 200);
  };
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    if (!init?.method || init.method === 'GET') {
      const readIndex = reads.length;
      reads.push(url);
      return Response.json({
        current:
          state.revision === 0 && state.writerFence === 0 ? null : descriptor(),
        registry: [...registry.values()].filter(
          entry => !options.hideFromRead?.(String(entry.sceneId), readIndex)
        ),
      });
    }
    if (url.endsWith('/table/control')) {
      const body = JSON.parse(String(init.body)) as {
        command: Record<string, unknown>;
      };
      if (body.command.type === 'initialize') {
        commands.push(body.command);
        return Response.json({ status: 'committed', current: descriptor() });
      }
      return execute(body.command);
    }
    if (url.endsWith('/authority/initialize-if-empty')) {
      initializes.push(
        JSON.parse(String(init.body)) as Record<string, unknown>
      );
      const status = options.initializeStatus ?? 200;
      return Response.json({ status: 'ok' }, { status });
    }
    throw new Error(`Unexpected URL ${url}`);
  });
  const other = (type: string, holderSessionId: string) =>
    execute({
      type,
      expectedEpoch: state.epoch,
      expectedRevision: state.revision,
      expectedFence: state.writerFence,
      holderSessionId,
    });
  return {
    state,
    registry,
    commands,
    reads,
    initializes,
    fetcher,
    execute,
    other,
  };
}

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
      'This campaign already has the maximum number of live scenes'
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
    expect(sceneRoomMessage(result)).toBe('Scene name is too long to register');
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
});
