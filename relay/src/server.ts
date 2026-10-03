import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createHash, timingSafeEqual } from 'node:crypto';
import { createClient } from 'redis';
import { createSyncServer, readBearerToken } from '@fieldnotes/sync-server';
import type {
  Authenticate,
  AuthContext,
  AuthorityRoomDefinition,
  AuthorityState,
  HubBackend,
  HubFanout,
  ServerSyncPlugin,
  SyncHub,
} from '@fieldnotes/sync-server';
import { RedisHubFanout, type RedisHashClient } from '@fieldnotes/sync-redis';
import {
  createFogAuthorityServerExtension,
  createFogServerPlugin,
} from '@fieldnotes/vtt/server';
import { makePolicies } from './policies.js';
import { TableAccessBatcher } from './authority-access.js';
import { RedisAuthorityDriver } from './authority-driver.js';
import { verifyBattleMapToken } from './token.js';
import { tableAuthorityChallengeKey } from './authority-keys.js';
import { BufferedRedisBackend } from './backend.js';
import { EphemeralHubFanout } from './ephemeral-fanout.js';
import { handlePokeRequest } from './poke.js';

export interface StartRelayOptions {
  secret: string;
  /** Port to listen on; 0 picks an ephemeral free port (used by tests). */
  port?: number;
  /** Override the storage backend (e.g. MemoryHubBackend in tests). */
  backend?: HubBackend;
  /** Cross-instance ephemeral and durable-operation fan-out. */
  fanout?: HubFanout;
  /** Required to enable Table v1 UUID authority rooms. */
  authorityRedis?: RedisHashClient & {
    get?(key: string): Promise<string | null>;
  };
  /** Test seam; production polls idle v1 sockets every two seconds. */
  authorityPollMs?: number;
  /**
   * Hub presence throttle window in ms. Test-only seam: production
   * (`main()`) never sets it, so the sync-server default applies.
   */
  presenceThrottleMs?: number;
  /**
   * Manual-gate observation seam (env `RELAY_GATE_LOG=1`): logs admitted
   * connections and, per inbound presence envelope, the payload `kind` and
   * the SORTED TOP-LEVEL FIELD NAMES of `data` — never values. Off in
   * production.
   */
  gateLog?: boolean;
}

export interface RelayHandle {
  hub: SyncHub;
  wss: ReturnType<typeof createSyncServer>['wss'];
  address: () => AddressInfo;
  close: () => Promise<void>;
}

/**
 * Element mutations are authoritative in this relay's write-behind buffer
 * until its next Redis flush. Keep their live fan-out on this instance while
 * VTT fog operations retain the fog plugin's shared locality.
 */
export function createBufferedElementLocalityPlugin(): ServerSyncPlugin {
  return {
    name: 'rollkeeper-buffer-locality',
    async process(op, context, next) {
      const result = await next(op, context);
      if (op.kind !== 'upsert' && op.kind !== 'remove' && op.kind !== 'clear') {
        return result;
      }
      return { ...result, locality: 'local' };
    },
  };
}

/** Boots the HTTP + WebSocket relay without touching Redis or process.env
 * beyond what the caller passes in — the pieces `server.ts`'s `main()` and
 * the integration tests both need. */
export async function startRelay(
  opts: StartRelayOptions
): Promise<RelayHandle> {
  let authorityDriver: RedisAuthorityDriver | null = null;
  let pokeHandler:
    ((req: http.IncomingMessage, res: http.ServerResponse) => void) | null =
    null;
  const server = http.createServer((req, res) => {
    if (req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('ok');
      return;
    }
    if (req.url === '/poke') {
      if (pokeHandler) {
        pokeHandler(req, res);
      } else {
        res.writeHead(503);
        res.end();
      }
      return;
    }
    if (
      (req.url === '/authority-admin/checkpoint' ||
        req.url === '/authority-admin/provision') &&
      req.method === 'POST'
    ) {
      const supplied = req.headers['x-rollkeeper-relay-secret'];
      const actual = Buffer.from(typeof supplied === 'string' ? supplied : '');
      const expected = Buffer.from(opts.secret);
      if (
        actual.length !== expected.length ||
        !timingSafeEqual(actual, expected) ||
        !authorityDriver
      ) {
        res.writeHead(403);
        res.end();
        return;
      }
      let bytes = 0;
      const chunks: Buffer[] = [];
      req.on('data', chunk => {
        bytes += Buffer.byteLength(chunk);
        if (bytes > 21 * 1024 * 1024) req.destroy();
        else chunks.push(Buffer.from(chunk));
      });
      req.on('end', () => {
        void (async () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
              campaign: string;
              sceneId: string;
              room: string;
              epoch: string;
              writerFence: number;
              principal: string;
              roomGeneration: string;
              expectedGeneration?: string | null;
              expectedCasToken?: string | null;
              generation?: string;
              casToken?: string;
              state?: AuthorityState;
            };
            if (req.url === '/authority-admin/checkpoint') {
              const abort = new AbortController();
              const capture = await authorityDriver!.checkpoint(
                {
                  room: body.room,
                  actorId: body.principal,
                  connectionId: `admin:${body.principal}`,
                  userId: body.principal,
                  role: 'dm',
                  ownershipId: body.principal,
                  definitionId: 'rollkeeper-scene-v1',
                  authContext: {
                    v: 1,
                    campaign: body.campaign,
                    resourceKind: 'scene',
                    sceneId: body.sceneId,
                    room: body.room,
                    epoch: body.epoch,
                    role: 'dm',
                    writerFence: body.writerFence,
                    principal: body.principal,
                    roomGeneration: body.roomGeneration,
                  },
                  expiresAt: Date.now() + 5_000,
                  deadlineAt: Date.now() + 5_000,
                  signal: abort.signal,
                },
                { deadlineAt: Date.now() + 5_000, signal: abort.signal }
              );
              const result = {
                generation: capture.position.generation,
                revision: capture.position.revision,
                casToken: capture.casToken,
                state: capture.state,
              };
              await capture.release();
              res.writeHead(200, { 'content-type': 'application/json' });
              res.end(JSON.stringify(result));
              return;
            }
            if (!body.state || !body.generation || !body.casToken)
              throw new Error('invalid provision');
            const result = await authorityDriver!.provision({
              campaign: body.campaign,
              sceneId: body.sceneId,
              room: body.room,
              epoch: body.epoch,
              writerFence: body.writerFence,
              principal: body.principal,
              deadlineAt: Date.now() + 5_000,
              generation: body.generation,
              casToken: body.casToken,
              expectedGeneration: body.expectedGeneration ?? null,
              expectedCasToken: body.expectedCasToken ?? null,
              state: body.state,
            });
            res.writeHead(result.status === 'provisioned' ? 200 : 409, {
              'content-type': 'application/json',
            });
            res.end(JSON.stringify(result));
          } catch {
            if (!res.headersSent) res.writeHead(400);
            res.end();
          }
        })();
      });
      return;
    }
    if (req.url === '/authority-proof' && req.method === 'POST') {
      const supplied = req.headers['x-rollkeeper-relay-secret'];
      const suppliedSecret = typeof supplied === 'string' ? supplied : '';
      const expected = Buffer.from(opts.secret);
      const actual = Buffer.from(suppliedSecret);
      if (
        expected.length !== actual.length ||
        !timingSafeEqual(expected, actual) ||
        !opts.authorityRedis?.get
      ) {
        res.writeHead(403);
        res.end();
        return;
      }
      let bytes = 0;
      const chunks: Buffer[] = [];
      req.on('data', chunk => {
        bytes += Buffer.byteLength(chunk);
        if (bytes > 4096) req.destroy();
        else chunks.push(Buffer.from(chunk));
      });
      req.on('end', () => {
        void (async () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
              campaign?: unknown;
              challengeId?: unknown;
            };
            if (
              typeof body.campaign !== 'string' ||
              !/^[A-Za-z0-9_-]{1,64}$/u.test(body.campaign) ||
              typeof body.challengeId !== 'string' ||
              !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
                body.challengeId
              )
            )
              throw new Error('invalid challenge request');
            const raw = await opts.authorityRedis!.get!(
              tableAuthorityChallengeKey(body.campaign, body.challengeId)
            );
            const challenge = raw
              ? (JSON.parse(raw) as { challengeId?: unknown; nonce?: unknown })
              : null;
            if (
              !challenge ||
              challenge.challengeId !== body.challengeId ||
              typeof challenge.nonce !== 'string'
            )
              throw new Error('challenge unavailable');
            const sha256 = createHash('sha256')
              .update(challenge.nonce)
              .digest('hex');
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ challengeId: body.challengeId, sha256 }));
          } catch {
            if (!res.headersSent) res.writeHead(404);
            res.end();
          }
        })();
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const policies = makePolicies(opts.secret, opts.authorityRedis !== undefined);
  const access = opts.authorityRedis
    ? new TableAccessBatcher(opts.authorityRedis)
    : null;
  const plugins = [
    createFogServerPlugin({
      authorize: policies.authorizeFog,
      // Only authenticated RollKeeper battle-map roles receive fog state.
      // Scene bytes remain independently filtered by `canRead` below.
      filterSnapshot: (snapshot, viewer) =>
        viewer.role === 'dm' ||
        viewer.role === 'player' ||
        viewer.role === 'display'
          ? snapshot
          : null,
    }),
    createBufferedElementLocalityPlugin(),
  ];
  // `Authenticate` may return `AuthResult | null | Promise<AuthResult | null>`
  // (sync-server 0.13 `index.d.ts:164`); the wrapper awaits so both shapes
  // type-check and log correctly.
  const authenticate: Authenticate = opts.gateLog
    ? async info => {
        const identity = await policies.authenticate(info);
        if (identity) {
          console.log(
            `[gate] admitted role=${identity.role} userId=${identity.userId} room=${info.room}`
          );
        }
        return identity;
      }
    : policies.authenticate;

  const authorityDefinition: AuthorityRoomDefinition = {
    id: 'rollkeeper-scene-v1',
    extensions: [createFogAuthorityServerExtension()],
    project(context, state) {
      if (context.role === 'dm') return state;
      return {
        ...state,
        // The SDK strips ownerId after validating this is a true subset.
        elements: state.elements.filter(element => element.audience !== 'dm'),
      };
    },
    canReadOwnerId: context => context.role === 'dm',
  };
  authorityDriver = opts.authorityRedis
    ? new RedisAuthorityDriver(opts.authorityRedis)
    : null;

  const { hub, wss, close } = createSyncServer({
    server,
    ...policies,
    authenticate,
    ...(access ? { framePolicy: { authorize: access.authorizeFrame } } : {}),
    ...(authorityDriver
      ? {
          authority: {
            driver: authorityDriver,
            resolveRoom: room =>
              /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
                room
              )
                ? authorityDefinition
                : null,
            resolveIdentity: connection => ({
              actorId: connection.userId ?? connection.id,
              ownershipId:
                typeof connection.authContext?.playerPrincipal === 'string'
                  ? connection.authContext.playerPrincipal
                  : (connection.userId ?? connection.id),
            }),
          },
        }
      : {}),
    plugins,
    ...(opts.backend ? { backend: opts.backend } : {}),
    ...(opts.fanout ? { fanout: opts.fanout } : {}),
    ...(opts.presenceThrottleMs !== undefined
      ? { presenceThrottleMs: opts.presenceThrottleMs }
      : {}),
  });

  if (access) {
    wss.on('connection', (socket, request) => {
      const token = readBearerToken(request);
      const payload = token ? verifyBattleMapToken(token, opts.secret) : null;
      if (!payload || !('v' in payload) || payload.v !== 1) return;
      let active = true;
      const interval = setInterval(() => {
        void access
          .authorizeClaim(
            Object.freeze({ ...payload }) as unknown as AuthContext,
            payload.exp
          )
          .then(allowed => {
            if (active && !allowed) socket.close(4403, 'authority withdrawn');
          });
      }, opts.authorityPollMs ?? 2_000);
      const expiry = setTimeout(
        () => socket.close(4401, 'credential expired'),
        Math.max(0, payload.exp - Date.now())
      );
      socket.once('close', () => {
        active = false;
        clearInterval(interval);
        clearTimeout(expiry);
      });
    });
  }

  if (opts.gateLog) {
    wss.on('connection', socket => {
      socket.on('message', raw => {
        let env: { op?: { kind?: unknown; data?: unknown } };
        try {
          env = JSON.parse(String(raw)) as typeof env;
        } catch {
          return;
        }
        if (env?.op?.kind !== 'presence') return;
        const data = env.op.data;
        const kind =
          data &&
          typeof data === 'object' &&
          typeof (data as { kind?: unknown }).kind === 'string'
            ? (data as { kind: string }).kind
            : '-';
        const fields =
          data && typeof data === 'object'
            ? Object.keys(data as object)
                .sort()
                .join(',')
            : '-';
        console.log(`[gate] presence kind=${kind} fields=${fields}`);
      });
    });
  }

  pokeHandler = (req, res) =>
    void handlePokeRequest(hub, opts.secret, req, res).catch(err => {
      console.error('[poke]', err);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(opts.port ?? 0, () => resolve());
  });

  return {
    hub,
    wss,
    address: () => server.address() as AddressInfo,
    close,
  };
}

async function main(): Promise<void> {
  const secret = process.env.BATTLEMAP_RELAY_SECRET;
  if (!secret) {
    console.error('BATTLEMAP_RELAY_SECRET is required');
    process.exit(1);
  }
  const port = Number(process.env.PORT ?? 8787);

  let backend: BufferedRedisBackend | undefined;
  let redisClient: ReturnType<typeof createClient> | undefined;
  let fanoutPublisher: ReturnType<typeof createClient> | undefined;
  let fanoutSubscriber: ReturnType<typeof createClient> | undefined;
  let fanout: RedisHubFanout | undefined;
  if (process.env.REDIS_URL) {
    redisClient = createClient({ url: process.env.REDIS_URL });
    redisClient.on('error', err => console.error('[redis]', err));
    await redisClient.connect();
    backend = new BufferedRedisBackend(redisClient, {
      flushIntervalMs: Number(process.env.FLUSH_INTERVAL_MS ?? 3000),
      roomTtlSeconds: Number(process.env.ROOM_TTL_SECONDS ?? 172800),
    });
    fanoutPublisher = redisClient.duplicate();
    fanoutSubscriber = redisClient.duplicate();
    fanoutPublisher.on('error', err =>
      console.error('[redis:fanout:publish]', err)
    );
    fanoutSubscriber.on('error', err =>
      console.error('[redis:fanout:subscribe]', err)
    );
    await Promise.all([fanoutPublisher.connect(), fanoutSubscriber.connect()]);
    fanout = new RedisHubFanout(fanoutPublisher, fanoutSubscriber, {
      onError: err => console.error('[redis:fanout]', err),
    });
    console.log(
      '[relay] using buffered Redis backend and cross-instance presence fanout'
    );
  } else {
    console.log(
      '[relay] REDIS_URL not set — in-memory rooms (state lost on restart)'
    );
  }

  const { close } = await startRelay({
    secret,
    port,
    backend,
    authorityRedis: redisClient
      ? {
          hGetAll: redisClient.hGetAll.bind(redisClient),
          hGet: async (key, field) =>
            (await redisClient!.hGet(key, field)) ?? null,
          hSet: redisClient.hSet.bind(redisClient),
          hDel: redisClient.hDel.bind(redisClient),
          del: redisClient.del.bind(redisClient),
          eval: redisClient.eval.bind(redisClient) as RedisHashClient['eval'],
          scriptLoad: redisClient.scriptLoad.bind(redisClient),
          evalSha: redisClient.evalSha.bind(redisClient) as NonNullable<
            RedisHashClient['evalSha']
          >,
          get: async key => (await redisClient!.get(key)) ?? null,
        }
      : undefined,
    fanout: fanout ? new EphemeralHubFanout(fanout) : undefined,
    gateLog: process.env.RELAY_GATE_LOG === '1',
  });
  console.log(`[relay] listening on :${port}`);

  const shutdown = async (): Promise<void> => {
    console.log('[relay] shutting down…');
    await close();
    await backend?.stopAndFlush();
    await fanoutSubscriber?.quit();
    await fanoutPublisher?.quit();
    await redisClient?.quit();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}

// Only run when executed directly (e.g. `node dist/server.js`), not when
// imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error('[relay] fatal:', err);
    process.exit(1);
  });
}
