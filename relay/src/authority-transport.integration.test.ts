import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { createClient } from 'redis';
import WebSocket from 'ws';
import { createShape, ElementStore } from '@fieldnotes/core';
import {
  bearerSubprotocols,
  createManagedAuthorityConnection,
  prepareAuthorityCheckpoint,
  type AuthorityClientTransport,
  type ManagedSyncEndpoint,
} from '@fieldnotes/sync';
import { RedisHubFanout, type RedisHashClient } from '@fieldnotes/sync-redis';
import { createFogAuthorityClientExtension } from '@fieldnotes/vtt/sync';
import {
  createFogAuthorityServerExtension,
  prepareFogAuthorityIntent,
} from '@fieldnotes/vtt/server';
import { FogManager } from '@fieldnotes/vtt';

import { createManagedBattleMapAuthorityConnection } from '../../src/lib/battlemapAuthority.js';

import {
  authorityRoomKeys,
  tableCampaignTag,
  tableControlKey,
  tableRegistryKey,
} from './authority-keys.js';
import { startRelay, type RelayHandle } from './server.js';
import { signBattleMapToken } from './token.js';
import { RedisAuthorityDriver } from './authority-driver.js';
import { EphemeralHubFanout } from './ephemeral-fanout.js';

const redisUrl = process.env.REDIS_TEST_URL;
const run = redisUrl ? describe : describe.skip;
const CAMPAIGN = 'TransportIT';
const ROOM = '623e4567-e89b-42d3-a456-426614174000';
const GENERATION = '723e4567-e89b-42d3-a456-426614174000';
const EPOCH = '823e4567-e89b-42d3-a456-426614174000';
const SECRET = 'authority-transport-secret';
const closeEvents: Array<{ code: number; reason: string }> = [];

function redisAdapter(
  client: ReturnType<typeof createClient>
): RedisHashClient & { get(key: string): Promise<string | null> } {
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
    get: async key => (await client.get(key)) ?? null,
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

run('two relay authority transport', () => {
  const redis = createClient({ url: redisUrl });
  const pub1 = createClient({ url: redisUrl });
  const sub1 = createClient({ url: redisUrl });
  const pub2 = createClient({ url: redisUrl });
  const sub2 = createClient({ url: redisUrl });
  let first: RelayHandle;
  let second: RelayHandle;
  const clients: Array<{ stop(): void }> = [];
  const keys = authorityRoomKeys(CAMPAIGN, ROOM);
  const allKeys = [
    ...Object.values(keys),
    tableControlKey(CAMPAIGN),
    tableRegistryKey(CAMPAIGN),
  ];

  beforeAll(async () => {
    await Promise.all([
      redis.connect(),
      pub1.connect(),
      sub1.connect(),
      pub2.connect(),
      sub2.connect(),
    ]);
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
    first = await startRelay({
      secret: SECRET,
      authorityRedis: redisAdapter(redis),
      fanout: new EphemeralHubFanout(new RedisHubFanout(pub1, sub1)),
      authorityPollMs: 50,
    });
    second = await startRelay({
      secret: SECRET,
      authorityRedis: redisAdapter(redis),
      fanout: new EphemeralHubFanout(new RedisHubFanout(pub2, sub2)),
      authorityPollMs: 50,
    });
    const provision = await fetch(
      `http://127.0.0.1:${first.address().port}/authority-admin/provision`,
      {
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
          generation: GENERATION,
          casToken: 'a'.repeat(64),
          state: {
            elements: [],
            layers: [],
            extensions: {
              fog: { pluginName: 'fog', version: 1, data: null },
            },
          },
        }),
      }
    );
    expect(provision.status).toBe(200);
    const appContractMetaKey = `campaign:${tableCampaignTag(CAMPAIGN)}:room:${ROOM}:meta`;
    expect(await redis.get(appContractMetaKey)).not.toBeNull();

    const checkpoint = await fetch(
      `http://127.0.0.1:${first.address().port}/authority-admin/checkpoint`,
      {
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
          roomGeneration: GENERATION,
        }),
      }
    );
    expect(checkpoint.status).toBe(200);
    expect(await checkpoint.json()).toMatchObject({
      generation: GENERATION,
      revision: '0',
    });
  });

  afterAll(async () => {
    clients.forEach(client => client.stop());
    await Promise.all([first?.close(), second?.close()]);
    await redis.del(allKeys);
    await Promise.all([
      sub1.quit(),
      pub1.quit(),
      sub2.quit(),
      pub2.quit(),
      redis.quit(),
    ]);
  });

  it('uses the actual managed client across two relays on one primary', async () => {
    closeEvents.length = 0;
    const token = signBattleMapToken(
      {
        v: 1,
        userId: 'dm-a',
        role: 'dm',
        room: ROOM,
        exp: Date.now() + 30_000,
        campaign: CAMPAIGN,
        resourceKind: 'scene',
        sceneId: 'scene-a',
        epoch: EPOCH,
        roomGeneration: GENERATION,
        writerFence: 1,
      },
      SECRET
    );
    const playerToken = signBattleMapToken(
      {
        v: 1,
        userId: 'player-a',
        role: 'player',
        room: ROOM,
        exp: Date.now() + 30_000,
        campaign: CAMPAIGN,
        resourceKind: 'scene',
        sceneId: 'scene-a',
        epoch: EPOCH,
        roomGeneration: GENERATION,
        playerPrincipal: 'player-a',
      },
      SECRET
    );
    const direct = new RedisAuthorityDriver(redisAdapter(redis));
    const directCapture = await direct.checkpoint(
      {
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
          roomGeneration: GENERATION,
        },
        expiresAt: Date.now() + 30_000,
        deadlineAt: Date.now() + 5_000,
        signal: new AbortController().signal,
      },
      { deadlineAt: Date.now() + 5_000, signal: new AbortController().signal }
    );
    expect(directCapture.casToken).toMatch(/^[0-9a-f]{64}$/u);
    const prepared = await prepareAuthorityCheckpoint(
      {
        ...directCapture.state,
        cursor: {
          generation: GENERATION,
          streamId: 'a'.repeat(32),
          revision: 0,
        },
        casToken: directCapture.casToken,
      },
      {
        requestId: 'request-a',
        checkpointId: 'checkpoint-a',
        requiredExtensions: [createFogAuthorityServerExtension().requirement],
      }
    ).catch(error => {
      throw new Error(
        `${String(error)} ${JSON.stringify(directCapture.state)}`
      );
    });
    prepared.dispose();
    await directCapture.release();
    const create = (
      relay: RelayHandle,
      clientId: string,
      credential: string
    ) => {
      const client = createManagedAuthorityConnection({
        scopeId: `${CAMPAIGN}:scene-a`,
        clientId,
        extensions: [createFogAuthorityClientExtension()],
        resolveUrl: () => ({
          url: `ws://127.0.0.1:${relay.address().port}?room=${ROOM}`,
          protocols: bearerSubprotocols(credential),
        }),
        transportFactory: transport,
      });
      clients.push(client);
      return client;
    };
    const a = create(first, 'dm-a', token);
    const b = create(second, 'player-a', playerToken);
    await eventually(
      () => a.getState().status === 'live' && b.getState().status === 'live'
    ).catch(() => {
      throw new Error(
        JSON.stringify({ a: a.getState(), b: b.getState(), closeEvents })
      );
    });
    const element = createShape({
      position: { x: 1, y: 2 },
      size: { w: 10, h: 10 },
    });
    expect(a.submit({ kind: 'upsert', element })).toMatchObject({
      status: 'admitted',
    });
    await eventually(
      () =>
        b.getState().document?.elements.some(item => item.id === element.id) ===
        true
    ).catch(async () => {
      throw new Error(
        JSON.stringify({
          a: a.getState(),
          b: b.getState(),
          closeEvents,
          outbox: await redis.lRange(keys.outbox, 0, -1),
          claims: await redis.hGetAll(keys.outboxClaims),
          history: await redis.lRange(keys.history, 0, -1),
          evidence: await redis.hGetAll(keys.evidence),
          elements: await redis.hGetAll(keys.elements),
        })
      );
    });
    expect(
      JSON.parse((await redis.get(keys.meta))!) as { revision: number }
    ).toMatchObject({ revision: 1 });
    await eventually(async () => (await redis.lLen(keys.outbox)) === 0);
    expect({
      a: a.getState().status,
      b: b.getState().status,
      closeEvents,
    }).toEqual({
      a: 'live',
      b: 'live',
      closeEvents: [],
    });

    const connectFogAdapter = (manager: FogManager) => {
      let status = 'connecting';
      const client = createManagedBattleMapAuthorityConnection({
        relayUrl: `ws://127.0.0.1:${first.address().port}`,
        campaignCode: CAMPAIGN,
        battleMapId: 'scene-a',
        store: new ElementStore(),
        clientId: 'dm-a',
        tokenRequest: {
          role: 'dm',
          battleMapId: 'map-a',
          sceneId: 'scene-a',
          dmId: 'dm-a',
        },
        fog: { manager },
        mint: async () => ({ token, authority: 1, room: ROOM }),
        transportFactory: transport,
        onStatus: next => {
          status = next;
        },
      });
      clients.push(client);
      return { client, status: () => status };
    };

    const seededFog = new FogManager({ idFactory: () => 'fog-generation' });
    seededFog.initialize({
      bounds: { x: 0, y: 0, w: 1024, h: 1024 },
      base: 'covered',
      cellSize: 8,
    });
    seededFog.applyRegion(
      { kind: 'rectangle', from: { x: 0, y: 0 }, to: { x: 1024, y: 1024 } },
      'reveal'
    );
    const seededState = seededFog.getState()!;
    a.stop();
    b.stop();
    const commitFog = async (
      operationId: string,
      mutation: Parameters<typeof prepareFogAuthorityIntent>[0]
    ) => {
      const result = await direct.commit(
        {
          room: ROOM,
          actorId: 'dm-a',
          connectionId: 'seed-fog',
          userId: 'dm-a',
          role: 'dm',
          ownershipId: 'dm-a',
          definitionId: 'rollkeeper-scene-v1',
          roomGeneration: GENERATION,
          clientOperationId: operationId,
          operationDigest: createHash('sha256')
            .update(operationId)
            .digest('hex'),
          deadlineAt: Date.now() + 5_000,
          signal: new AbortController().signal,
          authContext: {
            v: 1,
            campaign: CAMPAIGN,
            resourceKind: 'scene',
            sceneId: 'scene-a',
            room: ROOM,
            epoch: EPOCH,
            role: 'dm',
            writerFence: 1,
            roomGeneration: GENERATION,
          },
        },
        {
          proposal: {
            protocol: 'authority:1',
            kind: 'propose',
            generation: GENERATION,
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
        }
      );
      expect(result).toMatchObject({ status: 'committed' });
    };
    const liveEmptyFog = new FogManager();
    const liveEmptyFogClient = connectFogAdapter(liveEmptyFog);
    await eventually(() => liveEmptyFogClient.status() === 'live');

    await commitFog('transport-fog-meta', {
      kind: 'fog-meta',
      record: {
        version: 700,
        editor: 'dm-a',
        definition: seededState.definition,
      },
    });
    await eventually(
      () =>
        liveEmptyFogClient.status() === 'live' &&
        liveEmptyFog.getState()?.tiles.length === 0
    ).catch(async () => {
      throw new Error(
        JSON.stringify({
          status: liveEmptyFogClient.status(),
          fog: liveEmptyFog.getState(),
          fogMeta: await redis.hGetAll(keys.fogMeta),
          fogTiles: await redis.hGetAll(keys.fogTiles),
          closeEvents,
        })
      );
    });
    expect(closeEvents.some(event => event.code === 1013)).toBe(false);
    liveEmptyFogClient.client.stop();

    const emptyFog = new FogManager();
    const emptyFogClient = connectFogAdapter(emptyFog);
    await eventually(
      () =>
        emptyFogClient.status() === 'live' &&
        emptyFog.getState()?.tiles.length === 0
    ).catch(async () => {
      throw new Error(
        JSON.stringify({
          status: emptyFogClient.status(),
          fog: emptyFog.getState(),
          fogMeta: await redis.hGetAll(keys.fogMeta),
          fogTiles: await redis.hGetAll(keys.fogTiles),
          closeEvents,
        })
      );
    });
    emptyFogClient.client.stop();

    await commitFog('transport-fog-tile', {
      kind: 'fog-patch',
      generation: seededState.definition.generation,
      tiles: seededState.tiles.map(tile => ({
        generation: seededState.definition.generation,
        x: tile.x,
        y: tile.y,
        version: 900,
        editor: 'dm-a',
        data: tile.data,
      })),
    });

    let observerStatus = 'connecting';
    const observerFog = new FogManager();
    const observer = createManagedBattleMapAuthorityConnection({
      relayUrl: `ws://127.0.0.1:${second.address().port}`,
      campaignCode: CAMPAIGN,
      battleMapId: 'scene-a',
      store: new ElementStore(),
      clientId: 'player-a',
      tokenRequest: {
        role: 'player',
        battleMapId: 'map-a',
        sceneId: 'scene-a',
        playerId: 'player-a',
      },
      fog: { manager: observerFog },
      mint: async () => ({ token: playerToken, authority: 1, room: ROOM }),
      transportFactory: transport,
      onStatus: next => {
        observerStatus = next;
      },
    });
    clients.push(observer);
    await eventually(
      () =>
        observerStatus === 'live' && observerFog.getState()?.tiles.length === 1
    );

    const checkpointFog = new FogManager();
    const checkpointClient = connectFogAdapter(checkpointFog);
    await eventually(
      () =>
        checkpointClient.status() === 'live' &&
        checkpointFog.getState()?.tiles.length === 1
    );
    checkpointClient.client.stop();

    const reconnectedFog = new FogManager();
    const reconnected = connectFogAdapter(reconnectedFog);
    await eventually(
      () =>
        reconnected.status() === 'live' &&
        reconnectedFog.getState()?.tiles.length === 1
    );
    reconnectedFog.applyRegion(
      { kind: 'rectangle', from: { x: 0, y: 0 }, to: { x: 1024, y: 1024 } },
      'conceal'
    );
    const coveringBarrier = reconnected.client.captureBarrier();
    expect(coveringBarrier).not.toBeNull();
    const coveringResult = await reconnected.client.waitForAcknowledgements(
      coveringBarrier!,
      { timeoutMs: 5_000 }
    );
    expect(coveringResult).toMatchObject({
      status: 'acknowledged',
      accepted: [expect.objectContaining({})],
      rejectedIds: [],
    });
    await eventually(
      () =>
        observerStatus === 'live' && observerFog.getState()?.tiles.length === 0
    ).catch(async () => {
      throw new Error(
        JSON.stringify({
          observerStatus,
          observerFog: observerFog.getState(),
          reconnectedStatus: reconnected.status(),
          fogTiles: await redis.hGetAll(keys.fogTiles),
          history: await redis.lRange(keys.history, 0, -1),
          closeEvents,
        })
      );
    });
    const durableTombstones = Object.values(
      await redis.hGetAll(keys.fogTiles)
    ).map(value => JSON.parse(value) as Record<string, unknown>);
    expect(durableTombstones).toEqual([
      {
        generation: seededState.definition.generation,
        x: 0,
        y: 0,
        version: 901,
        editor: 'dm-a',
      },
    ]);
    expect(durableTombstones[0]).not.toHaveProperty('data');

    const withdrawn = JSON.parse(
      (await redis.get(tableControlKey(CAMPAIGN)))!
    ) as {
      presentation: { blanked: boolean };
    };
    withdrawn.presentation.blanked = true;
    await redis.set(tableControlKey(CAMPAIGN), JSON.stringify(withdrawn));
    await eventually(
      () => reconnected.status() === 'live' && observerStatus !== 'live',
      2_000
    ).catch(() => {
      throw new Error(
        JSON.stringify({
          dmStatus: reconnected.status(),
          observerStatus,
          closeEvents,
        })
      );
    });
    expect(closeEvents.some(event => event.code === 4403)).toBe(true);
  }, 15_000);

  it('lets only the verified player move a DM-created party token through real managed clients', async () => {
    closeEvents.length = 0;
    await redis.set(
      tableControlKey(CAMPAIGN),
      JSON.stringify({
        v: 1,
        epoch: EPOCH,
        writerFence: 1,
        holderPrincipal: 'legacy:dm-a',
        leaseUntil: Date.now() + 300_000,
        presentation: { sceneId: 'scene-a', revision: 2, blanked: false },
        displayGeneration: 1,
      })
    );
    const claims = {
      v: 1 as const,
      room: ROOM,
      exp: Date.now() + 60_000,
      campaign: CAMPAIGN,
      resourceKind: 'scene' as const,
      sceneId: 'scene-a',
      epoch: EPOCH,
      roomGeneration: GENERATION,
    };
    const dmToken = signBattleMapToken(
      { ...claims, userId: 'dm-a', role: 'dm', writerFence: 1 },
      SECRET
    );
    const playerToken = (player: string) =>
      signBattleMapToken(
        { ...claims, userId: player, role: 'player', playerPrincipal: player },
        SECRET
      );
    const displayToken = signBattleMapToken(
      {
        ...claims,
        userId: `display-${CAMPAIGN}`,
        role: 'display',
        displayGeneration: 1,
      },
      SECRET
    );
    const raw = (relay: RelayHandle, clientId: string, credential: string) => {
      const client = createManagedAuthorityConnection({
        scopeId: `${CAMPAIGN}:scene-a:${clientId}`,
        clientId,
        extensions: [createFogAuthorityClientExtension()],
        resolveUrl: () => ({
          url: `ws://127.0.0.1:${relay.address().port}?room=${ROOM}`,
          protocols: bearerSubprotocols(credential),
        }),
        transportFactory: transport,
      });
      clients.push(client);
      return client;
    };
    const player = (relay: RelayHandle, playerId: string) => {
      const store = new ElementStore();
      let status = 'connecting';
      const client = createManagedBattleMapAuthorityConnection({
        relayUrl: `ws://127.0.0.1:${relay.address().port}`,
        campaignCode: CAMPAIGN,
        battleMapId: 'scene-a',
        store,
        clientId: playerId,
        tokenRequest: {
          role: 'player',
          battleMapId: 'map-a',
          sceneId: 'scene-a',
          playerId,
        },
        fog: { manager: new FogManager() },
        mint: async () => ({
          token: playerToken(playerId),
          authority: 1,
          room: ROOM,
        }),
        transportFactory: transport,
        onStatus: next => {
          status = next;
        },
      });
      clients.push(client);
      return { store, client, status: () => status };
    };

    const dm = raw(first, 'dm-a', dmToken);
    const playerA = player(second, 'player-a');
    const playerB = player(first, 'player-b');
    const display = raw(second, `display-${CAMPAIGN}`, displayToken);
    await eventually(
      () =>
        dm.getState().status === 'live' &&
        playerA.status() === 'live' &&
        playerB.status() === 'live' &&
        display.getState().status === 'live'
    ).catch(() => {
      throw new Error(
        JSON.stringify({
          dm: dm.getState().status,
          a: playerA.status(),
          b: playerB.status(),
          display: display.getState().status,
          closeEvents,
        })
      );
    });

    const band = {
      id: 'player-player-a',
      name: 'Aria',
      visible: true,
      locked: false,
      order: 500,
      opacity: 1,
    };
    const partyToken = {
      ...createShape({
        position: { x: 10, y: 10 },
        size: { w: 50, h: 50 },
        shape: 'ellipse',
        fillColor: '#ff0000',
        layerId: band.id,
      }),
      id: 'party-token-a',
      tokenKind: 'player',
      characterId: 'player-a',
      sceneMemberId: 'member-a',
    };
    expect(
      dm.submit({
        kind: 'layer-upsert',
        layer: band,
        version: 100,
        editor: 'dm-a',
      })
    ).toMatchObject({ status: 'admitted' });
    expect(dm.submit({ kind: 'upsert', element: partyToken })).toMatchObject({
      status: 'admitted',
    });
    const dmElement = () =>
      dm.getState().document?.elements.find(item => item.id === partyToken.id);
    await eventually(
      () =>
        playerA.store.getById(partyToken.id) !== undefined &&
        playerB.store.getById(partyToken.id) !== undefined &&
        display
          .getState()
          .document?.elements.some(item => item.id === partyToken.id) === true
    );
    expect(
      display.getState().document?.layers.find(record => record.id === band.id)
        ?.definition
    ).toMatchObject({ visible: true });

    playerA.store.update(partyToken.id, { position: { x: 300, y: 200 } });
    await eventually(
      () =>
        (dmElement() as { position?: { x: number } } | undefined)?.position
          ?.x === 300
    );

    playerA.store.update(partyToken.id, { size: { w: 400, h: 400 } });
    await eventually(
      () =>
        (
          playerA.store.getById(partyToken.id) as
            | { size?: { w: number } }
            | undefined
        )?.size?.w === 50
    ).catch(() => {
      throw new Error(
        `rejected resize was not restored: ${JSON.stringify(
          playerA.store.getById(partyToken.id)
        )}`
      );
    });
    expect((dmElement() as { size: { w: number } }).size.w).toBe(50);

    playerB.store.update(partyToken.id, { position: { x: 900, y: 900 } });
    await eventually(
      () =>
        (
          playerB.store.getById(partyToken.id) as
            | { position?: { x: number } }
            | undefined
        )?.position?.x === 300
    );
    expect((dmElement() as { position: { x: number } }).position.x).toBe(300);

    const displayMove = display.submit({
      kind: 'upsert',
      element: { ...partyToken, position: { x: 700, y: 700 } },
    });
    if (displayMove.status === 'admitted') {
      await eventually(
        () =>
          display
            .getState()
            .operations.find(
              item => item.clientOperationId === displayMove.clientOperationId
            )?.status === 'rejected'
      );
    }
    expect((dmElement() as { position: { x: number } }).position.x).toBe(300);

    const hide = playerA.client;
    hide.publishLayerUpsert({ ...band, visible: false });
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(
      dm.getState().document?.layers.find(record => record.id === band.id)
        ?.definition
    ).toMatchObject({ visible: true });
    expect(closeEvents.some(event => event.code === 1013)).toBe(false);
  }, 20_000);

  it('closes an admitted display socket with 4403 after rotation and sends no newer frames (PR05)', async () => {
    // Earlier tests' clients would also see 4403 when control changes.
    for (const client of clients.splice(0)) client.stop();
    await new Promise(resolve => setTimeout(resolve, 200));
    closeEvents.length = 0;
    const control = (displayGeneration: number) => ({
      v: 1,
      epoch: EPOCH,
      writerFence: 1,
      holderPrincipal: 'legacy:dm-a',
      leaseUntil: Date.now() + 300_000,
      presentation: { sceneId: 'scene-a', revision: 3, blanked: false },
      displayGeneration,
    });
    await redis.set(tableControlKey(CAMPAIGN), JSON.stringify(control(41)));
    const claims = {
      v: 1 as const,
      room: ROOM,
      exp: Date.now() + 60_000,
      campaign: CAMPAIGN,
      resourceKind: 'scene' as const,
      sceneId: 'scene-a',
      epoch: EPOCH,
      roomGeneration: GENERATION,
    };
    const connect = (relay: RelayHandle, clientId: string, token: string) => {
      const client = createManagedAuthorityConnection({
        scopeId: `${CAMPAIGN}:scene-a:${clientId}:rotation`,
        clientId,
        extensions: [createFogAuthorityClientExtension()],
        resolveUrl: () => ({
          url: `ws://127.0.0.1:${relay.address().port}?room=${ROOM}`,
          protocols: bearerSubprotocols(token),
        }),
        transportFactory: transport,
      });
      clients.push(client);
      return client;
    };
    const dm = connect(
      first,
      'dm-a',
      signBattleMapToken(
        { ...claims, userId: 'dm-a', role: 'dm', writerFence: 1 },
        SECRET
      )
    );
    const display = connect(
      second,
      `display-${CAMPAIGN}`,
      signBattleMapToken(
        {
          ...claims,
          userId: `display-${CAMPAIGN}`,
          role: 'display',
          displayGeneration: 41,
        },
        SECRET
      )
    );
    await eventually(
      () =>
        dm.getState().status === 'live' && display.getState().status === 'live'
    );
    const visible = {
      ...createShape({ position: { x: 5, y: 5 }, size: { w: 10, h: 10 } }),
      id: 'before-rotation',
    };
    dm.submit({ kind: 'upsert', element: visible });
    await eventually(
      () =>
        display
          .getState()
          .document?.elements.some(element => element.id === visible.id) ===
        true
    );

    const rotatedAt = Date.now();
    await redis.set(
      tableControlKey(CAMPAIGN),
      JSON.stringify(control(99_999_999_999_999))
    );
    // Relay poll (50 ms here) + the 1 s control-read bound.
    await eventually(
      () => closeEvents.some(event => event.code === 4403),
      1_050
    );
    expect(Date.now() - rotatedAt).toBeLessThan(1_050);
    console.log(
      'DEBUG',
      JSON.stringify(closeEvents),
      display.getState().status,
      dm.getState().status
    );
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log(
      'DEBUG2',
      JSON.stringify(closeEvents),
      display.getState().status
    );

    const hidden = {
      ...createShape({ position: { x: 9, y: 9 }, size: { w: 10, h: 10 } }),
      id: 'after-rotation',
    };
    dm.submit({ kind: 'upsert', element: hidden });
    await eventually(
      () =>
        dm
          .getState()
          .document?.elements.some(element => element.id === hidden.id) === true
    );
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(
      display
        .getState()
        .document?.elements.some(element => element.id === hidden.id) ?? false
    ).toBe(false);
  }, 15_000);
});
