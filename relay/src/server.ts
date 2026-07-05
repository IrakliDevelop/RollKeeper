import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createClient } from 'redis';
import { createSyncServer } from '@fieldnotes/sync-server';
import type { HubBackend, SyncHub } from '@fieldnotes/sync-server';
import { makePolicies } from './policies.js';
import { BufferedRedisBackend } from './backend.js';
import { patchSendCorrectionLeak } from './corrections.js';

export interface StartRelayOptions {
  secret: string;
  /** Port to listen on; 0 picks an ephemeral free port (used by tests). */
  port?: number;
  /** Override the storage backend (e.g. MemoryHubBackend in tests). */
  backend?: HubBackend;
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
  const server = http.createServer((req, res) => {
    if (req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('ok');
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const policies = makePolicies(opts.secret);
  const { hub, wss, close } = createSyncServer({
    server,
    ...policies,
    ...(opts.backend ? { backend: opts.backend } : {}),
  });
  // Upstream sendCorrection leak — see corrections.ts.
  patchSendCorrectionLeak(hub, policies.canRead);

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
  if (process.env.REDIS_URL) {
    redisClient = createClient({ url: process.env.REDIS_URL });
    redisClient.on('error', err => console.error('[redis]', err));
    await redisClient.connect();
    backend = new BufferedRedisBackend(redisClient, {
      flushIntervalMs: Number(process.env.FLUSH_INTERVAL_MS ?? 3000),
      roomTtlSeconds: Number(process.env.ROOM_TTL_SECONDS ?? 172800),
    });
    console.log('[relay] using buffered Redis backend');
  } else {
    console.log(
      '[relay] REDIS_URL not set — in-memory rooms (state lost on restart)'
    );
  }

  const { close } = await startRelay({ secret, port, backend });
  console.log(`[relay] listening on :${port}`);

  const shutdown = async (): Promise<void> => {
    console.log('[relay] shutting down…');
    await close();
    await backend?.stopAndFlush();
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
