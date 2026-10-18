import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { createClient } from 'redis';
import WebSocket from 'ws';
import { ElementStore } from '@fieldnotes/core';
import {
  prepareAuthorityCheckpoint,
  type AuthorityClientTransport,
  type ManagedSyncEndpoint,
} from '@fieldnotes/sync';
import type { AuthorityReadContext } from '@fieldnotes/sync-server';
import { RedisHubFanout, type RedisHashClient } from '@fieldnotes/sync-redis';
import {
  createFogAuthorityServerExtension,
  prepareFogAuthorityIntent,
} from '@fieldnotes/vtt/server';
import { FogManager } from '@fieldnotes/vtt';

import { createManagedBattleMapAuthorityConnection } from '../../src/lib/battlemapAuthority.js';
import { editorFogToAuthorityFog } from '../../src/lib/table/fogShape.js';

import {
  authorityRoomKeys,
  tableControlKey,
  tableRegistryKey,
} from './authority-keys.js';
import { RedisAuthorityDriver } from './authority-driver.js';
import { EphemeralHubFanout } from './ephemeral-fanout.js';
import { startRelay, type RelayHandle } from './server.js';
import { signBattleMapToken } from './token.js';

/**
 * PR08 repair 11 (QA1): fog tiles live in a Redis hash under `x,y`. The
 * relay used to read them back in string order ("1,1" < "11,1" < "2,1"),
 * but the fog extension requires tiles sorted numerically by x, then y, so
 * once a tile reached column or row 10 every checkpoint the relay built was
 * refused and each new connection closed with 1013 "resync required".
 */
const redisUrl = process.env.REDIS_TEST_URL;
const run = redisUrl ? describe : describe.skip;
const CAMPAIGN = 'FogOrderIT';
const ROOM = 'a23e4567-e89b-42d3-a456-426614174000';
const GENERATION = 'b23e4567-e89b-42d3-a456-426614174000';
const RESTORED_GENERATION = 'c23e4567-e89b-42d3-a456-426614174000';
const EPOCH = 'd23e4567-e89b-42d3-a456-426614174000';
const SECRET = 'fog-order-secret';
const closeEvents: Array<{ code: number; reason: string }> = [];

function redisAdapter(
  client: ReturnType<typeof createClient>
): RedisHashClient {
  return {
    hGetAll: client.hGetAll.bind(client),
    hGet: async (key, field) => (await client.hGet(key, field)) ?? null,
    hSet: client.hSet.bind(client),
    hDel: client.hDel.bind(client),
    del: client.del.bind(client),
    eval: client.eval.bind(client) as RedisHashClient['eval'],
    scriptLoad: client.scriptLoad.bind(client),
    evalSha: client.evalSha.bind(client) as NonNullable<
      RedisHashClient['evalSha']
    >,
  };
}

function transport(endpoint: ManagedSyncEndpoint): AuthorityClientTransport {
  let socket: WebSocket | null = null;
  return {
    start(handlers) {
      socket = new WebSocket(
        endpoint.url,
        endpoint.protocols as string[] | undefined
      );
      socket.on('open', () => handlers.onOpen());
      socket.on('message', data => handlers.onMessage(String(data)));
      socket.on('close', (code, reason) => {
        closeEvents.push({ code, reason: String(reason) });
        handlers.onClose(code, String(reason));
      });
    },
    trySend(raw) {
      if (!socket || socket.readyState !== WebSocket.OPEN) return false;
      socket.send(raw);
      return true;
    },
    close() {
      socket?.close();
    },
  };
}

async function eventually(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 5_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await predicate())) {
    if (Date.now() >= deadline) throw new Error('timed out');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

const positions = (tiles: ReadonlyArray<{ x: number; y: number }> = []) =>
  tiles.map(tile => `${tile.x},${tile.y}`);

/** A 2048x1536 covered map at cell 1 (16x12 tiles, the QA repro size). */
function revealedFog(): FogManager {
  const fog = new FogManager({ idFactory: () => 'fog-order-generation' });
  fog.initialize({
    bounds: { x: 0, y: 0, w: 2048, h: 1536 },
    base: 'covered',
    cellSize: 1,
  });
  // Tile columns 1, 2 and 11 on row 1, and column 1 on row 10.
  for (const [x, y] of [
    [150, 150],
    [280, 150],
    [1430, 150],
    [150, 1300],
  ] as const) {
    fog.applyRegion(
      { kind: 'rectangle', from: { x, y }, to: { x: x + 20, y: y + 20 } },
      'reveal'
    );
  }
  return fog;
}

run('fog tiles at column or row 10 and above (QA1)', () => {
  const redis = createClient({ url: redisUrl });
  const pub = createClient({ url: redisUrl });
  const sub = createClient({ url: redisUrl });
  let relay: RelayHandle;
  const clients: Array<{ stop(): void }> = [];
  const keys = authorityRoomKeys(CAMPAIGN, ROOM);
  const allKeys = [
    ...Object.values(keys),
    tableControlKey(CAMPAIGN),
    tableRegistryKey(CAMPAIGN),
  ];
  const admin = (path: string, body: Record<string, unknown>) =>
    fetch(`http://127.0.0.1:${relay.address().port}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-rollkeeper-relay-secret': SECRET,
      },
      body: JSON.stringify({
        campaign: CAMPAIGN,
        sceneId: 'scene-a',
        room: ROOM,
        epoch: EPOCH,
        writerFence: 1,
        principal: 'legacy:dm-a',
        ...body,
      }),
    });
  const token = (
    role: 'dm' | 'player',
    userId: string,
    roomGeneration: string
  ) =>
    signBattleMapToken(
      {
        v: 1,
        room: ROOM,
        exp: Date.now() + 120_000,
        campaign: CAMPAIGN,
        resourceKind: 'scene',
        sceneId: 'scene-a',
        epoch: EPOCH,
        roomGeneration,
        userId,
        role,
        ...(role === 'dm' ? { writerFence: 1 } : { playerPrincipal: userId }),
      },
      SECRET
    );
  const connect = (
    role: 'dm' | 'player',
    userId: string,
    roomGeneration = GENERATION
  ) => {
    let status = 'connecting';
    const fog = new FogManager();
    const credential = token(role, userId, roomGeneration);
    const client = createManagedBattleMapAuthorityConnection({
      relayUrl: `ws://127.0.0.1:${relay.address().port}`,
      campaignCode: CAMPAIGN,
      battleMapId: 'scene-a',
      store: new ElementStore(),
      clientId: userId,
      tokenRequest:
        role === 'dm'
          ? { role, battleMapId: 'map-a', sceneId: 'scene-a', dmId: userId }
          : {
              role,
              battleMapId: 'map-a',
              sceneId: 'scene-a',
              playerId: userId,
            },
      fog: { manager: fog },
      mint: async () => ({ token: credential, authority: 1, room: ROOM }),
      transportFactory: transport,
      onStatus: next => {
        status = next;
      },
    });
    clients.push(client);
    return { client, fog, status: () => status };
  };
  const readContext = (roomGeneration: string): AuthorityReadContext => ({
    room: ROOM,
    actorId: 'dm-a',
    connectionId: 'direct',
    userId: 'dm-a',
    role: 'dm',
    ownershipId: 'dm-a',
    definitionId: 'rollkeeper-scene-v1',
    authContext: {
      v: 1,
      campaign: CAMPAIGN,
      resourceKind: 'scene',
      sceneId: 'scene-a',
      room: ROOM,
      epoch: EPOCH,
      role: 'dm',
      writerFence: 1,
      roomGeneration,
    },
    expiresAt: Date.now() + 30_000,
    deadlineAt: Date.now() + 5_000,
    signal: new AbortController().signal,
  });
  const readOptions = () => ({
    deadlineAt: Date.now() + 5_000,
    signal: new AbortController().signal,
  });
  const sdkAccepts = async (state: unknown, label: string) => {
    const prepared = await prepareAuthorityCheckpoint(
      {
        ...(state as object),
        cursor: {
          generation: GENERATION,
          streamId: 'f'.repeat(32),
          revision: 0,
        },
        casToken: 'fog-order',
      } as Parameters<typeof prepareAuthorityCheckpoint>[0],
      {
        requestId: `fog-order-${label}`,
        checkpointId: `fog-order-${label}`,
        requiredExtensions: [createFogAuthorityServerExtension().requirement],
      }
    );
    prepared.dispose();
  };
  const describeFailure = async (extra: Record<string, unknown>) =>
    JSON.stringify({
      ...extra,
      closeEvents,
      storedTiles: await redis.hKeys(keys.fogTiles),
    });

  beforeAll(async () => {
    await Promise.all([redis.connect(), pub.connect(), sub.connect()]);
    await redis.del(allKeys);
    await redis.set(
      tableControlKey(CAMPAIGN),
      JSON.stringify({
        v: 1,
        epoch: EPOCH,
        writerFence: 1,
        holderPrincipal: 'legacy:dm-a',
        leaseUntil: Date.now() + 300_000,
        presentation: { sceneId: 'scene-a', revision: 1, blanked: false },
        displayGeneration: 1,
      })
    );
    await redis.hSet(
      tableRegistryKey(CAMPAIGN),
      'scene-a',
      JSON.stringify({
        v: 1,
        sceneId: 'scene-a',
        roomId: ROOM,
        deleted: false,
      })
    );
    relay = await startRelay({
      secret: SECRET,
      authorityRedis: redisAdapter(redis),
      fanout: new EphemeralHubFanout(new RedisHubFanout(pub, sub)),
      authorityPollMs: 50,
    });
  });

  afterAll(async () => {
    clients.forEach(client => client.stop());
    await relay?.close();
    await redis.del(allKeys);
    await Promise.all([sub.quit(), pub.quit(), redis.quit()]);
  });

  it('builds snapshots, checkpoints, evidence and restores in numeric tile order, so new connections stay live', async () => {
    const seeded = revealedFog().getState()!;
    const seededFog = editorFogToAuthorityFog(seeded, 'dm-a');
    const expected = ['1,1', '1,10', '2,1', '11,1'];
    expect(positions((seededFog as { tiles: [] }).tiles)).toEqual(expected);

    // 1. Go live: the app provisions its numerically sorted fog.
    const provision = await admin('/authority-admin/provision', {
      generation: GENERATION,
      casToken: 'a'.repeat(64),
      expectedGeneration: null,
      expectedCasToken: null,
      state: {
        elements: [],
        layers: [],
        extensions: { fog: { pluginName: 'fog', version: 1, data: seededFog } },
      },
    });
    expect(provision.status).toBe(200);

    // 2. The relay's checkpoint is in the SDK's order and the SDK accepts it.
    const driver = new RedisAuthorityDriver(redisAdapter(redis));
    const capture = await driver.checkpoint(
      readContext(GENERATION),
      readOptions()
    );
    expect(positions(capture.state.extensions.fog.data?.tiles)).toEqual(
      expected
    );
    await sdkAccepts(capture.state, 'provisioned');
    await capture.release();

    // 3. A new DM and a new player connect and stay live with the fog.
    const dm = connect('dm', 'dm-a');
    const player = connect('player', 'player-a');
    await eventually(
      () =>
        dm.status() === 'live' &&
        player.status() === 'live' &&
        dm.fog.getState()?.tiles.length === 4 &&
        player.fog.getState()?.tiles.length === 4,
      10_000
    ).catch(async () => {
      throw new Error(
        await describeFailure({ dm: dm.status(), player: player.status() })
      );
    });
    expect(positions(player.fog.getState()?.tiles)).toEqual(expected);

    // 4. An incremental DM fog edit (tile 13,10) commits, its evidence is
    // SDK-valid, connected players get it, and a late joiner is live too.
    dm.fog.applyRegion(
      {
        kind: 'rectangle',
        from: { x: 1700, y: 1400 },
        to: { x: 1720, y: 1420 },
      },
      'reveal'
    );
    const editBarrier = dm.client.captureBarrier!();
    expect(editBarrier).not.toBeNull();
    try {
      expect(
        await dm.client.waitForAcknowledgements!(editBarrier!, {
          timeoutMs: 5_000,
        })
      ).toMatchObject({ status: 'acknowledged', rejectedIds: [] });
    } finally {
      dm.client.releaseBarrier!(editBarrier!);
    }
    const afterEdit = [...expected, '13,10'];
    await eventually(
      () => player.fog.getState()?.tiles.length === 5,
      5_000
    ).catch(async () => {
      throw new Error(await describeFailure({ player: player.status() }));
    });
    const page = await driver.readAfter(
      readContext(GENERATION),
      { generation: GENERATION, revision: '0' },
      { entries: 8, bytes: 64 * 1024 },
      readOptions()
    );
    if (page.status !== 'ok' || page.records.length === 0)
      throw new Error(`expected a fog publication: ${JSON.stringify(page)}`);
    const evidence = await driver.readEvidence(
      readContext(GENERATION),
      page.records.at(-1)!,
      readOptions()
    );
    if (evidence.status !== 'available')
      throw new Error(`expected evidence: ${evidence.status}`);
    expect(positions(evidence.lease.before.extensions.fog.data?.tiles)).toEqual(
      expected
    );
    expect(positions(evidence.lease.after.extensions.fog.data?.tiles)).toEqual(
      afterEdit
    );
    await sdkAccepts(evidence.lease.before, 'before');
    await sdkAccepts(evidence.lease.after, 'after');
    await evidence.lease.release();

    const late = connect('player', 'player-b');
    await eventually(
      () => late.status() === 'live' && late.fog.getState()?.tiles.length === 5,
      10_000
    ).catch(async () => {
      throw new Error(await describeFailure({ late: late.status() }));
    });
    expect(positions(late.fog.getState()?.tiles)).toEqual(afterEdit);

    // 5. Save checkpoint completes on the live DM connection.
    const closesBefore = closeEvents.length;
    const outcomes: string[] = [];
    await eventually(async () => {
      const barrier = dm.client.captureBarrier!();
      if (!barrier) return false;
      try {
        const receipts = await dm.client.waitForAcknowledgements!(barrier, {
          timeoutMs: 10_000,
        });
        expect(receipts.status).toBe('acknowledged');
        const saved = await dm.client.requestCheckpoint!({
          barrier,
          timeoutMs: 10_000,
        });
        outcomes.push(saved.status === 'complete' ? 'complete' : saved.reason);
        if (saved.status !== 'complete') return false;
        expect(
          positions(
            (
              saved.checkpoint.extensions.fog?.data as {
                tiles: Array<{ x: number; y: number }>;
              }
            ).tiles
          )
        ).toEqual(afterEdit);
        return true;
      } finally {
        dm.client.releaseBarrier!(barrier);
      }
    }, 30_000).catch(async () => {
      throw new Error(await describeFailure({ outcomes }));
    });
    expect(closeEvents.slice(closesBefore)).toEqual([]);

    // 6. Restore: the app reads the current room and provisions a fresh
    // generation from it; re-minted connections join the restored fog.
    const currentResponse = await admin('/authority-admin/checkpoint', {
      roomGeneration: GENERATION,
    });
    expect(currentResponse.status).toBe(200);
    const current = (await currentResponse.json()) as {
      generation: string;
      casToken: string;
      state: {
        extensions: {
          fog: { data: { tiles: Array<{ x: number; y: number }> } };
        };
      };
    };
    expect(positions(current.state.extensions.fog.data.tiles)).toEqual(
      afterEdit
    );
    const restore = await admin('/authority-admin/provision', {
      generation: RESTORED_GENERATION,
      casToken: 'c'.repeat(64),
      expectedGeneration: current.generation,
      expectedCasToken: current.casToken,
      state: current.state,
    });
    expect(restore.status).toBe(200);
    for (const client of clients.splice(0)) client.stop();
    const restoredDm = connect('dm', 'dm-a', RESTORED_GENERATION);
    const restoredPlayer = connect('player', 'player-a', RESTORED_GENERATION);
    await eventually(
      () =>
        restoredDm.status() === 'live' &&
        restoredPlayer.status() === 'live' &&
        restoredPlayer.fog.getState()?.tiles.length === 5,
      10_000
    ).catch(async () => {
      throw new Error(
        await describeFailure({
          dm: restoredDm.status(),
          player: restoredPlayer.status(),
        })
      );
    });
    expect(positions(restoredPlayer.fog.getState()?.tiles)).toEqual(afterEdit);

    // 7. The DM keeps editing fog on the restored (provisioned) room: the
    // relay stored its fog records in the encoding the fog library accepts.
    restoredDm.fog.applyRegion(
      {
        kind: 'rectangle',
        from: { x: 1850, y: 1450 },
        to: { x: 1870, y: 1470 },
      },
      'reveal'
    );
    const restoredBarrier = restoredDm.client.captureBarrier!();
    expect(restoredBarrier).not.toBeNull();
    try {
      expect(
        await restoredDm.client.waitForAcknowledgements!(restoredBarrier!, {
          timeoutMs: 5_000,
        })
      ).toMatchObject({ status: 'acknowledged', rejectedIds: [] });
    } finally {
      restoredDm.client.releaseBarrier!(restoredBarrier!);
    }
    await eventually(
      () => restoredPlayer.fog.getState()?.tiles.length === 6,
      5_000
    ).catch(async () => {
      throw new Error(
        await describeFailure({ player: restoredPlayer.status() })
      );
    });
    expect(positions(restoredPlayer.fog.getState()?.tiles)).toEqual([
      ...afterEdit,
      '14,11',
    ]);
  }, 60_000);

  it('reads a room whose tiles were stored in string order by an older relay without any migration', async () => {
    for (const client of clients.splice(0)) client.stop();
    // Rewrite the stored tiles in string-sorted insertion order (what a room
    // written before the fix can look like); values are untouched.
    const stored = await redis.hGetAll(keys.fogTiles);
    const fields = Object.keys(stored).sort();
    expect(fields).toEqual(['1,1', '1,10', '11,1', '13,10', '14,11', '2,1']);
    await redis.del(keys.fogTiles);
    for (const field of fields)
      await redis.hSet(keys.fogTiles, field, stored[field]!);

    const driver = new RedisAuthorityDriver(redisAdapter(redis));
    const capture = await driver.checkpoint(
      readContext(RESTORED_GENERATION),
      readOptions()
    );
    expect(positions(capture.state.extensions.fog.data?.tiles)).toEqual([
      '1,1',
      '1,10',
      '2,1',
      '11,1',
      '13,10',
      '14,11',
    ]);
    await capture.release();
    const player = connect('player', 'player-c', RESTORED_GENERATION);
    await eventually(
      () =>
        player.status() === 'live' && player.fog.getState()?.tiles.length === 6,
      10_000
    ).catch(async () => {
      throw new Error(await describeFailure({ player: player.status() }));
    });
  }, 20_000);
  it('stores provisioned fog in the fog library encoding, so the next DM fog edit commits after a restore', async () => {
    for (const client of clients.splice(0)) client.stop();
    const seeded = revealedFog().getState()!;
    const fog = editorFogToAuthorityFog(seeded, 'dm-a') as {
      meta: { definition: { generation: string } };
      tiles: Array<{ x: number; y: number; data?: string }>;
    };
    // Whatever generation the room is at now (each test restores over it).
    const current = JSON.parse((await redis.get(keys.meta))!) as {
      generation: string;
      casToken: string;
    };
    const generation = 'e23e4567-e89b-42d3-a456-426614174000';
    const restore = await admin('/authority-admin/provision', {
      generation,
      casToken: 'e'.repeat(64),
      expectedGeneration: current.generation,
      expectedCasToken: current.casToken,
      state: {
        elements: [],
        layers: [],
        extensions: { fog: { pluginName: 'fog', version: 1, data: fog } },
      },
    });
    expect(restore.status).toBe(200);
    const definition = fog.meta.definition as unknown as {
      generation: string;
      bounds: { x: number; y: number; w: number; h: number };
      cellSize: number;
      base: string;
    };
    expect(await redis.hGet(keys.fogMeta, 'current')).toBe(
      `{"version":1,"editor":"dm-a","definition":{"version":1,"generation":"${definition.generation}","bounds":{"x":0,"y":0,"w":2048,"h":1536},"cellSize":1,"tileCells":128,"base":"covered"}}`
    );
    const first = fog.tiles[0]!;
    expect(await redis.hGet(keys.fogTiles, '1,1')).toBe(
      `{"generation":"${definition.generation}","x":1,"y":1,"version":1,"editor":"dm-a","data":"${first.data}"}`
    );

    const mutation = {
      kind: 'fog-patch' as const,
      generation: definition.generation,
      tiles: [
        {
          generation: definition.generation,
          x: 11,
          y: 1,
          version: 2,
          editor: 'dm-a',
        },
      ],
    };
    const operationId = 'fog-order-after-restore';
    const driver = new RedisAuthorityDriver(redisAdapter(redis));
    await expect(
      driver.commit(
        {
          ...readContext(generation),
          roomGeneration: generation,
          clientOperationId: operationId,
          operationDigest: createHash('sha256')
            .update(operationId)
            .digest('hex'),
        },
        {
          proposal: {
            protocol: 'authority:1',
            kind: 'propose',
            generation,
            clientOperationId: operationId,
            mutation,
          },
          intent: {
            schema: 1,
            kind: 'extension',
            key: 'fog',
            version: 1,
            payload: prepareFogAuthorityIntent(mutation),
          },
        } as Parameters<RedisAuthorityDriver['commit']>[1]
      )
    ).resolves.toMatchObject({ status: 'committed' });
  });
});
