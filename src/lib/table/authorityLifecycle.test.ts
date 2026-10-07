import { describe, expect, it, vi } from 'vitest';

import {
  createTableControlSession,
  prepareTableSceneAuthority,
} from './authorityLifecycle';

const descriptor = (revision: number, writerFence: number) => ({
  epoch: '10000000-0000-4000-8000-000000000001',
  revision,
  writerFence,
  leaseUntil: Date.now() + 30_000,
  holderSessionId: writerFence > 0 ? 'table-session-1' : null,
  presentation: { sceneId: null as string | null, revision: 0, blanked: false },
  publicRunId: null,
});

describe('Table scene authority lifecycle', () => {
  it('prepares a private room without changing the admitted audience presentation', async () => {
    const admittedPresentation = {
      sceneId: 'already-presented-tavern',
      revision: 7,
      blanked: false,
    };
    let current: ReturnType<typeof descriptor> | null = {
      ...descriptor(7, 2),
      presentation: admittedPresentation,
    };
    const commands: Array<Record<string, unknown>> = [];
    const admittedAudiencePrivateFrames: unknown[] = [];
    let authorityBody: Record<string, unknown> | null = null;
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.includes('/table/control') && !init?.method) {
        return Response.json({ current, registry: [] });
      }
      if (url.endsWith('/table/control')) {
        const body = JSON.parse(String(init?.body)) as {
          command: Record<string, unknown>;
        };
        commands.push(body.command);
        const type = body.command.type;
        if (type === 'initialize') current = descriptor(0, 0);
        else if (type === 'acquire' || type === 'renew')
          current = {
            ...descriptor(8, 3),
            presentation: admittedPresentation,
          };
        else if (type === 'registerScene')
          current = {
            ...descriptor(9, 3),
            presentation: admittedPresentation,
          };
        else admittedAudiencePrivateFrames.push({ command: type });
        return Response.json({ status: 'committed', current });
      }
      if (url.endsWith('/authority/initialize-if-empty')) {
        authorityBody = JSON.parse(String(init?.body)) as Record<
          string,
          unknown
        >;
        return Response.json({ status: 'provisioned' });
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    const result = await prepareTableSceneAuthority({
      campaignCode: 'CAMP',
      dmId: 'dm-1',
      sceneId: 'scene-1',
      sourceMapId: 'map-original',
      workspaceInstanceId: 'workspace-1',
      contentRevision: 1,
      safeLabel: 'Crypt',
      canvasState: {
        version: 4,
        camera: { position: { x: 8, y: 9 }, zoom: 2 },
        elements: [{ id: 'token-1', type: 'token' }],
        layers: [
          {
            id: 'tokens',
            name: 'Tokens',
            visible: true,
            locked: false,
            order: 0,
            opacity: 1,
          },
        ],
        activeLayerId: 'tokens',
        extensions: { fog: { version: 1, data: null } },
      },
      holderSessionId: 'table-session-1',
      fetcher,
    });

    expect(result.status).toBe('prepared');
    expect(commands.map(command => command.type)).toEqual([
      'renew',
      'registerScene',
    ]);
    expect(commands[1]).toMatchObject({
      sceneId: 'scene-1',
      sourceMapId: 'map-original',
      workspaceInstanceId: 'workspace-1',
    });
    expect(authorityBody).toMatchObject({
      dmId: 'dm-1',
      sceneId: 'scene-1',
      expectedGeneration: null,
      expectedCasToken: null,
      state: {
        elements: [{ id: 'token-1' }],
        layers: [
          {
            id: 'tokens',
            definition: { id: 'tokens', name: 'Tokens' },
            version: 1,
            editor: 'dm-1',
          },
        ],
        extensions: {
          fog: { pluginName: 'fog', version: 1, data: null },
        },
      },
    });
    expect(current?.presentation).toEqual(admittedPresentation);
    expect(admittedAudiencePrivateFrames).toEqual([]);
  });

  it('does not silently take over another active controller', async () => {
    const commands: string[] = [];
    const active = {
      ...descriptor(8, 3),
      holderSessionId: 'other-session',
    };
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      if (!init?.method)
        return Response.json({ current: active, registry: [] });
      const command = (
        JSON.parse(String(init.body)) as { command: { type: string } }
      ).command;
      commands.push(command.type);
      return Response.json(
        { status: 'conflict', reason: 'controller-active', current: active },
        { status: 409 }
      );
    });
    await expect(
      prepareTableSceneAuthority({
        campaignCode: 'CAMP',
        dmId: 'dm-1',
        sceneId: 'scene-1',
        sourceMapId: 'map-original',
        workspaceInstanceId: 'workspace-1',
        contentRevision: 1,
        safeLabel: 'Crypt',
        canvasState: {},
        holderSessionId: 'table-session-1',
        fetcher,
      })
    ).resolves.toEqual({
      status: 'failed',
      reason: 'controller-active',
      leaseUntil: active.leaseUntil,
      holderSessionId: 'other-session',
    });
    expect(commands).toEqual(['acquire']);
  });
});

/**
 * In-memory model of the PR03A Lua control contract (atomic.ts): exact
 * epoch/revision/fence checks, lease ownership, and a revision bump on every
 * commit, renewals included.
 */
function controlServer(options: { now?: () => number } = {}) {
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
  const commands: Array<Record<string, unknown>> = [];
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
        state.publicRunId = null;
        break;
      case 'takeover':
        state.writerFence += 1;
        state.holderSessionId = String(command.holderSessionId);
        state.leaseUntil = now() + 30_000;
        state.publicRunId = null;
        break;
      case 'renew':
        if (!owns) return reply('conflict', 'lease-lost', 409);
        state.leaseUntil = now() + 30_000;
        break;
      case 'publishInitiative':
        if (!owns) return reply('conflict', 'lease-lost', 409);
        state.publicRunId = String(command.runId);
        break;
      case 'endInitiative':
        if (!owns) return reply('conflict', 'lease-lost', 409);
        state.publicRunId = null;
        break;
      default:
        if (!owns) return reply('conflict', 'lease-lost', 409);
    }
    state.revision += 1;
    return reply('committed', 'current', 200);
  };
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    if (!init?.method)
      return Response.json({ current: descriptor(), registry: [] });
    if (url.endsWith('/table/control')) {
      const body = JSON.parse(String(init.body)) as {
        command: Record<string, unknown>;
      };
      return execute(body.command);
    }
    if (url.endsWith('/authority/initialize-if-empty'))
      return Response.json({ status: 'provisioned' });
    throw new Error(`Unexpected URL ${url}`);
  });
  /** A commit made by another request (e.g. a second client) of this holder. */
  const interleave = (holderSessionId: string) =>
    execute({
      type: 'publishInitiative',
      expectedEpoch: state.epoch,
      expectedRevision: state.revision,
      expectedFence: state.writerFence,
      holderSessionId,
      runId: 'run-other',
    });
  return { state, commands, fetcher, execute, interleave };
}

const prepareOptions = (fetcher: typeof fetch) => ({
  campaignCode: 'CAMP',
  dmId: 'dm-1',
  sceneId: 'scene-1',
  sourceMapId: 'map-original',
  workspaceInstanceId: 'workspace-1',
  contentRevision: 1,
  safeLabel: 'Crypt',
  canvasState: {},
  holderSessionId: 'table-session-1',
  fetcher,
});

const initiative = (runId: string) => ({
  encounterId: runId,
  isActive: true,
  round: 1,
  currentEntityId: null,
  turnOrder: [],
  enemyHpMode: 'off' as const,
  enemyConditionsMode: 'off' as const,
  updatedAt: 'synthetic',
});

describe('Table control session (D8)', () => {
  it('renews after an interleaved commit by retrying once with the fresh revision', async () => {
    const server = controlServer();
    server.state.revision = 4;
    const prepared = await prepareTableSceneAuthority(
      prepareOptions(server.fetcher)
    );
    if (prepared.status !== 'prepared') throw new Error('not prepared');
    server.interleave('table-session-1');
    await expect(prepared.renew()).resolves.toBe(true);
    const renewals = server.commands.filter(
      command => command.type === 'renew'
    );
    expect(renewals).toHaveLength(2);
    expect(renewals[1]!.operationId).not.toBe(renewals[0]!.operationId);
    expect(
      server.commands.some(
        command => command.type === 'acquire' && command !== server.commands[0]
      )
    ).toBe(false);
  });

  it('builds every command from the latest descriptor (publish then renew)', async () => {
    const server = controlServer();
    const prepared = await prepareTableSceneAuthority(
      prepareOptions(server.fetcher)
    );
    if (prepared.status !== 'prepared') throw new Error('not prepared');
    const session = prepared.session;
    await expect(
      session.publishInitiative('run-a', initiative('run-a'))
    ).resolves.toMatchObject({ status: 'committed' });
    await expect(session.renew()).resolves.toMatchObject({
      status: 'committed',
    });
    expect(
      server.commands.filter(command => command.type === 'renew')
    ).toHaveLength(1);
    expect(session.current().revision).toBe(server.state.revision);
  });

  it('marks takeover and lease loss as lost and never acquires or takes over', async () => {
    const server = controlServer();
    const prepared = await prepareTableSceneAuthority(
      prepareOptions(server.fetcher)
    );
    if (prepared.status !== 'prepared') throw new Error('not prepared');
    const session = prepared.session;
    // Another session explicitly takes over.
    server.execute({
      type: 'takeover',
      expectedEpoch: server.state.epoch,
      expectedRevision: server.state.revision,
      expectedFence: server.state.writerFence,
      holderSessionId: 'other-session',
    });
    const outcome = await session.publishInitiative(
      'run-a',
      initiative('run-a')
    );
    expect(outcome).toMatchObject({ status: 'lost' });
    expect(session.isLost()).toBe(true);
    const sent = server.commands.length;
    await expect(session.endInitiative()).resolves.toMatchObject({
      status: 'lost',
    });
    await expect(session.renew()).resolves.toMatchObject({ status: 'lost' });
    expect(server.commands).toHaveLength(sent);
    expect(
      server.commands.filter(command =>
        ['acquire', 'takeover'].includes(String(command.type))
      )
    ).toHaveLength(2); // the initial acquire and the other session's takeover
    expect(server.state.holderSessionId).toBe('other-session');
  });

  it('treats lease-lost from an expired lease as lost', async () => {
    let clock = 1_000_000;
    const server = controlServer({ now: () => clock });
    const session = createTableControlSession({
      campaignCode: 'CAMP',
      dmId: 'dm-1',
      holderSessionId: 'table-session-1',
      initial: { ...server.state },
      fetcher: server.fetcher,
      now: () => clock,
    });
    server.execute({
      type: 'acquire',
      expectedEpoch: server.state.epoch,
      expectedRevision: server.state.revision,
      expectedFence: server.state.writerFence,
      holderSessionId: 'table-session-1',
    });
    clock += 60_000;
    const outcome = await session.renew();
    expect(outcome).toMatchObject({ status: 'lost' });
  });

  it('refuses an oversized publication without sending a request', async () => {
    const server = controlServer();
    const prepared = await prepareTableSceneAuthority(
      prepareOptions(server.fetcher)
    );
    if (prepared.status !== 'prepared') throw new Error('not prepared');
    const before = server.commands.length;
    const huge = {
      ...initiative('run-a'),
      turnOrder: Array.from({ length: 200 }, (_, index) => ({
        entityId: `entity-${index}`,
        displayName: 'x'.repeat(150),
        type: 'npc' as const,
      })),
    };
    await expect(
      prepared.session.publishInitiative('run-a', huge)
    ).resolves.toEqual({ status: 'failed', reason: 'too-large' });
    expect(server.commands).toHaveLength(before);
    expect(prepared.session.isLost()).toBe(false);
  });

  it('serializes commands and bounds the queue at 8 pending', async () => {
    const server = controlServer();
    const prepared = await prepareTableSceneAuthority(
      prepareOptions(server.fetcher)
    );
    if (prepared.status !== 'prepared') throw new Error('not prepared');
    let inFlight = 0;
    let maxInFlight = 0;
    const release: Array<() => void> = [];
    server.fetcher.mockImplementation(async (_input, init) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise<void>(resolve => release.push(resolve));
      inFlight -= 1;
      const body = JSON.parse(String(init?.body)) as {
        command: Record<string, unknown>;
      };
      return server.execute(body.command);
    });
    const results = Array.from({ length: 9 }, () =>
      prepared.session.publishInitiative('run-a', initiative('run-a'))
    );
    await expect(results[8]).resolves.toEqual({
      status: 'failed',
      reason: 'queue-overflow',
    });
    while (release.length > 0 || inFlight > 0) {
      release.shift()?.();
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    const settled = await Promise.all(results.slice(0, 8));
    expect(settled.every(result => result.status === 'committed')).toBe(true);
    expect(maxInFlight).toBe(1);
  });

  it('marks a stale-control with a foreign holder (same epoch and fence) lost without retrying (F4)', async () => {
    const server = controlServer();
    const prepared = await prepareTableSceneAuthority(
      prepareOptions(server.fetcher)
    );
    if (prepared.status !== 'prepared') throw new Error('not prepared');
    // Same fence, different holder (forged descriptor: only the guard differs).
    server.state.revision += 1;
    server.state.holderSessionId = 'other-session';
    const before = server.commands.length;
    const outcome = await prepared.session.publishInitiative(
      'run-a',
      initiative('run-a')
    );
    expect(outcome).toMatchObject({ status: 'lost', reason: 'stale-control' });
    expect(server.commands.length - before).toBe(1);
  });

  it('treats the client lease clock as advisory: retries once and lets the server decide (F4)', async () => {
    let clientNow = Date.now();
    const server = controlServer();
    const prepared = await prepareTableSceneAuthority(
      prepareOptions(server.fetcher)
    );
    if (prepared.status !== 'prepared') throw new Error('not prepared');
    const session = createTableControlSession({
      campaignCode: 'CAMP',
      dmId: 'dm-1',
      holderSessionId: 'table-session-1',
      initial: prepared.session.current(),
      fetcher: server.fetcher,
      // A client clock far ahead of Redis time: the lease looks expired here.
      now: () => clientNow + 10 * 60_000,
    });
    clientNow += 0;
    server.interleave('table-session-1');
    await expect(session.renew()).resolves.toMatchObject({
      status: 'committed',
    });
  });
});
