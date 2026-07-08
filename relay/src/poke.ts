import type { IncomingMessage, ServerResponse } from 'node:http';
import type { SyncHub } from '@fieldnotes/sync-server';
import { verifyBattleMapToken } from './token.js';

/** Narrow structural view of the hub's private registries — same
 * private-access pattern as `corrections.ts`. `rooms` maps room -> connection
 * ids; the actual connection objects (with `send`) live in `conns`. */
interface RoomConnection {
  send(message: string): void;
}
interface HubInternals {
  rooms: Map<string, Set<string>>;
  conns: Map<string, RoomConnection>;
}

/**
 * Broadcasts a content-free poke to every socket in a room as a synthetic
 * presence message. Bypasses `broadcastPresence` deliberately: that method
 * records `presenceIds` (driving presence-leave on disconnect) and skips the
 * sender connection — neither applies to a server-originated poke.
 * The sync client's presence dispatch is stateless, so `from: '@poke'`
 * pollutes no client-side bookkeeping.
 * NOTE: broadcasts only to locally-connected sockets (bypasses hub fanout) — fine for single-instance deploy; revisit if relay runs multiple instances.
 */
export function pokeRoom(hub: SyncHub, room: string, feature: string): number {
  const internals = hub as unknown as HubInternals;
  const memberIds = internals.rooms.get(room);
  if (!memberIds || memberIds.size === 0) return 0;
  const message = JSON.stringify({
    from: '@poke',
    op: { kind: 'presence', data: { kind: 'poke', feature } },
  });
  let sent = 0;
  for (const id of memberIds) {
    const conn = internals.conns.get(id);
    if (!conn) continue;
    try {
      conn.send(message);
      sent++;
    } catch (err) {
      // dead socket — the heartbeat reaps it; poke is best-effort
      console.warn('[poke] send failed:', err);
    }
  }
  return sent;
}

const MAX_BODY_BYTES = 4096;

/**
 * HTTP handler for `POST /poke` — server-to-server, authenticated with a
 * short-lived dm-role battlemap token whose `room` must match the target.
 */
export async function handlePokeRequest(
  hub: SyncHub,
  secret: string,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end();
    return;
  }
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    totalBytes += buf.length;
    if (totalBytes > MAX_BODY_BYTES) {
      res.writeHead(413);
      res.end();
      return;
    }
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  let body: { room?: unknown; feature?: unknown; token?: unknown };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    res.writeHead(400);
    res.end();
    return;
  }
  const { room, feature, token } = body;
  if (
    typeof room !== 'string' ||
    typeof feature !== 'string' ||
    typeof token !== 'string'
  ) {
    res.writeHead(400);
    res.end();
    return;
  }
  const payload = verifyBattleMapToken(token, secret);
  if (!payload || payload.room !== room || payload.role !== 'dm') {
    res.writeHead(401);
    res.end();
    return;
  }
  const sent = pokeRoom(hub, room, feature);
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ sent }));
}
