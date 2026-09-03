import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createClient } from 'redis';
import { createSyncServer } from '@fieldnotes/sync-server';
import type {
  Authenticate,
  HubBackend,
  HubFanout,
  SyncHub,
} from '@fieldnotes/sync-server';
import { RedisHubFanout } from '@fieldnotes/sync-redis';
import { makePolicies } from './policies.js';
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

/** Boots the HTTP + WebSocket relay without touching Redis or process.env
 * beyond what the caller passes in — the pieces `server.ts`'s `main()` and
 * the integration tests both need. */
export async function startRelay(
  opts: StartRelayOptions
): Promise<RelayHandle> {
  let pokeHandler:
    | ((req: http.IncomingMessage, res: http.ServerResponse) => void)
    | null = null;
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
    res.writeHead(404);
    res.end();
  });

  const policies = makePolicies(opts.secret);

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

  const { hub, wss, close } = createSyncServer({
    server,
    ...policies,
    authenticate,
    ...(opts.backend ? { backend: opts.backend } : {}),
    ...(opts.fanout ? { fanout: opts.fanout } : {}),
    ...(opts.presenceThrottleMs !== undefined
      ? { presenceThrottleMs: opts.presenceThrottleMs }
      : {}),
  });

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
