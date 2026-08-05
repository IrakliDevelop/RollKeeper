import type { IncomingMessage, ServerResponse } from 'node:http';
import type { SyncHub } from '@fieldnotes/sync-server';
import { verifyBattleMapToken } from './token.js';

/**
 * Broadcasts a content-free poke as server-owned ephemeral presence. The
 * returned count covers this relay instance; configured hub fan-out delivers
 * the same poke to room members connected to other instances.
 */
export function pokeRoom(hub: SyncHub, room: string, feature: string): number {
  return hub.broadcastPresence(room, { kind: 'poke', feature });
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
