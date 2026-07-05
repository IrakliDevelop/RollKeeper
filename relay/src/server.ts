import http from 'node:http';
import { createClient } from 'redis';
import { createSyncServer } from '@fieldnotes/sync-server';
import { makePolicies } from './policies.js';
import { BufferedRedisBackend } from './backend.js';

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

  const server = http.createServer((req, res) => {
    if (req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('ok');
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const { close } = createSyncServer({
    server,
    ...makePolicies(secret),
    ...(backend ? { backend } : {}),
  });

  server.listen(port, () => console.log(`[relay] listening on :${port}`));

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

main().catch(err => {
  console.error('[relay] fatal:', err);
  process.exit(1);
});
