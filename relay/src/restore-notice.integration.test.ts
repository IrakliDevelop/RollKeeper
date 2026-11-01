import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from 'redis';
import WebSocket from 'ws';
import { createShape, ElementStore } from '@fieldnotes/core';
import type {
  AuthorityClientTransport,
  ManagedSyncEndpoint,
} from '@fieldnotes/sync';
import { RedisHubFanout, type RedisHashClient } from '@fieldnotes/sync-redis';
import { FogManager } from '@fieldnotes/vtt';

import {
  CONNECTION_DROPPED_MESSAGE,
  createManagedBattleMapAuthorityConnection,
  OFFLINE_DISCARDED_PLAYER_MESSAGE,
} from '../../src/lib/battlemapAuthority.js';

import {
  authorityRoomKeys,
  tableControlKey,
  tableRegistryKey,
} from './authority-keys.js';
import { EphemeralHubFanout } from './ephemeral-fanout.js';
import { startRelay, type RelayHandle } from './server.js';
import { signBattleMapToken } from './token.js';

/**
 * PR08 repair 11 (QA4): a player dragging their token while the DM restores
 * a checkpoint loses the in-flight moves with the replaced room. The relay
 * either withdraws the socket (4403) or asks it to resync (1013), depending
 * on timing. Neither is a dropped connection or offline work, so the player
 * is never told so.
 */
const redisUrl = process.env.REDIS_TEST_URL;
const run = redisUrl ? describe : describe.skip;
const CAMPAIGN = 'RestoreNoticeIT';
const ROOM = 'f23e4567-e89b-42d3-a456-426614174000';
const GENERATION = 'f33e4567-e89b-42d3-a456-426614174000';
const EPOCH = 'f53e4567-e89b-42d3-a456-426614174000';
const SECRET = 'restore-notice-secret';
const EMPTY = {
  elements: [],
  layers: [],
  extensions: { fog: { pluginName: 'fog', version: 1, data: null } },
};

run('player notice when the DM restores during a drag (QA4)', () => {
  const redis = createClient({ url: redisUrl });
  const pub = createClient({ url: redisUrl });
  const sub = createClient({ url: redisUrl });
  let relay: RelayHandle;
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
    const adapter: RedisHashClient = {
      hGetAll: redis.hGetAll.bind(redis),
      hGet: async (key, field) => (await redis.hGet(key, field)) ?? null,
      hSet: redis.hSet.bind(redis),
      hDel: redis.hDel.bind(redis),
      del: redis.del.bind(redis),
      eval: redis.eval.bind(redis) as RedisHashClient['eval'],
      scriptLoad: redis.scriptLoad.bind(redis),
      evalSha: redis.evalSha.bind(redis) as NonNullable<
        RedisHashClient['evalSha']
      >,
    };
    relay = await startRelay({
      secret: SECRET,
      authorityRedis: adapter,
      fanout: new EphemeralHubFanout(new RedisHubFanout(pub, sub)),
      authorityPollMs: 50,
    });
  });

  afterAll(async () => {
    await relay?.close();
    await redis.del(allKeys);
    await Promise.all([sub.quit(), pub.quit(), redis.quit()]);
  });

  it('never says the connection dropped or offline changes were lost', async () => {
    for (let round = 1; round <= 3; round += 1) {
      await redis.del(allKeys.slice(0, -2));
      const first = await admin('/authority-admin/provision', {
        generation: `${round}${GENERATION.slice(1)}`,
        casToken: 'a'.repeat(64),
        expectedGeneration: null,
        expectedCasToken: null,
        state: EMPTY,
      });
      expect(first.status).toBe(200);
      let generation = `${round}${GENERATION.slice(1)}`;
      const log: string[] = [];
      const diagnostics: string[] = [];
      const transport = (
        endpoint: ManagedSyncEndpoint
      ): AuthorityClientTransport => {
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
              log.push(`close ${code}`);
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
      };
      const store = new ElementStore();
      let status = 'connecting';
      const player = createManagedBattleMapAuthorityConnection({
        relayUrl: `ws://127.0.0.1:${relay.address().port}`,
        campaignCode: CAMPAIGN,
        battleMapId: 'scene-a',
        store,
        clientId: 'player-a',
        tokenRequest: {
          role: 'player',
          battleMapId: 'map-a',
          sceneId: 'scene-a',
          playerId: 'player-a',
        },
        fog: { manager: new FogManager() },
        mint: async () => ({
          token: signBattleMapToken(
            {
              v: 1,
              room: ROOM,
              exp: Date.now() + 60_000,
              campaign: CAMPAIGN,
              resourceKind: 'scene',
              sceneId: 'scene-a',
              epoch: EPOCH,
              roomGeneration: generation,
              userId: 'player-a',
              role: 'player',
              playerPrincipal: 'player-a',
            },
            SECRET
          ),
          authority: 1,
          room: ROOM,
        }),
        transportFactory: transport,
        onStatus: next => {
          status = next;
        },
        onDiagnostic: message => diagnostics.push(message),
      });
      try {
        const deadline = Date.now() + 5_000;
        while (status !== 'live' && Date.now() < deadline)
          await new Promise(resolve => setTimeout(resolve, 20));
        expect(status).toBe('live');
        player.publishLayerUpsert({
          id: 'player-player-a',
          name: 'My elements',
          visible: true,
          locked: false,
          order: 500,
          opacity: 1,
        });
        store.add({
          ...createShape({
            position: { x: 0, y: 0 },
            size: { w: 10, h: 10 },
            shape: 'ellipse',
            layerId: 'player-player-a',
          }),
          id: 'drag-token',
          tokenKind: 'player',
          characterId: 'player-a',
        } as never);
        await new Promise(resolve => setTimeout(resolve, 300));
        // The player drags every 60 ms while the DM restores.
        let x = 0;
        let dragging = true;
        const drag = (async () => {
          while (dragging) {
            x += 1;
            store.update('drag-token', { position: { x, y: 0 } });
            await new Promise(resolve => setTimeout(resolve, 60));
          }
        })();
        await new Promise(resolve => setTimeout(resolve, 300));
        const current = JSON.parse((await redis.get(keys.meta))!) as {
          generation: string;
          casToken: string;
        };
        generation = `${round}${'a23e4567-e89b-42d3-a456-426614174000'.slice(1)}`;
        const restore = await admin('/authority-admin/provision', {
          generation,
          casToken: 'b'.repeat(64),
          expectedGeneration: current.generation,
          expectedCasToken: current.casToken,
          state: EMPTY,
        });
        expect(restore.status).toBe(200);
        await new Promise(resolve => setTimeout(resolve, 2_500));
        dragging = false;
        await drag;
        console.info('QA4 round', round, JSON.stringify({ log, diagnostics }));
        expect(log.some(entry => /^close (1013|4403)$/u.test(entry))).toBe(
          true
        );
        expect(diagnostics).not.toContain(CONNECTION_DROPPED_MESSAGE);
        expect(diagnostics).not.toContain(OFFLINE_DISCARDED_PLAYER_MESSAGE);
      } finally {
        player.stop();
      }
    }
  }, 40_000);
});
