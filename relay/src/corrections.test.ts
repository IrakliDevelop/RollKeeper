import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { MemoryHubBackend } from '@fieldnotes/sync-server';
import { startRelay, type RelayHandle } from './server.js';
import { signBattleMapToken } from './token.js';
import { DM_AUDIENCE } from './policies.js';

/**
 * Integration test for the C1 fix: it drives the REAL relay (real HTTP
 * server, real WebSocketServer, real SyncHub with our policies wired in —
 * only the storage backend is swapped for an in-memory one) so it exercises
 * the exact code path `sendCorrection` runs on, not a reimplementation of it.
 */

const SECRET = 'corrections-test-secret';
const ROOM = 'ROOM1:bm-1';
const HIDDEN_ID = 'hidden-1';
const NORMAL_ID = 'normal-1';

interface Envelope {
  from: string;
  op: {
    kind: string;
    [key: string]: unknown;
  };
}

function tokenFor(userId: string, role: 'dm' | 'player'): string {
  return signBattleMapToken(
    { userId, role, room: ROOM, exp: Date.now() + 60_000 },
    SECRET
  );
}

function connect(role: 'dm' | 'player', userId: string, port: number) {
  const token = tokenFor(userId, role);
  const ws = new WebSocket(
    `ws://127.0.0.1:${port}/?room=${encodeURIComponent(ROOM)}&token=${token}`
  );
  const messages: Envelope[] = [];
  ws.on('message', data => {
    try {
      messages.push(JSON.parse(String(data)) as Envelope);
    } catch {
      // ignore malformed frames
    }
  });
  const opened = new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', reject);
  });
  const waitFor = (
    predicate: (m: Envelope) => boolean,
    timeoutMs = 2000
  ): Promise<Envelope> =>
    new Promise((resolve, reject) => {
      const existing = messages.find(predicate);
      if (existing) {
        resolve(existing);
        return;
      }
      const start = Date.now();
      const interval = setInterval(() => {
        const found = messages.find(predicate);
        if (found) {
          clearInterval(interval);
          resolve(found);
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(interval);
          reject(
            new Error(
              `timeout waiting for message matching predicate; received: ${JSON.stringify(messages)}`
            )
          );
        }
      }, 10);
    });
  return { ws, messages, opened, waitFor };
}

function send(ws: WebSocket, envelope: Envelope): void {
  ws.send(JSON.stringify(envelope));
}

describe('sendCorrection canRead leak (C1 fix, real relay)', () => {
  let handle: RelayHandle;
  let port: number;

  beforeAll(async () => {
    handle = await startRelay({
      secret: SECRET,
      port: 0,
      backend: new MemoryHubBackend(),
    });
    port = handle.address().port;
  });

  afterAll(async () => {
    await handle.close();
  });

  it('filters rejected-op corrections through canRead', async () => {
    const dm = connect('dm', 'dm-1', port);
    const player = connect('player', 'p1', port);
    try {
      await runScenario(dm, player);
    } finally {
      // Always close both sockets — even on assertion failure — so
      // afterAll's handle.close() (which waits for the shared HTTP server's
      // connections to drain) doesn't hang and leave vitest unable to exit.
      dm.ws.close();
      player.ws.close();
      await Promise.all([
        new Promise<void>(resolve => dm.ws.once('close', () => resolve())),
        new Promise<void>(resolve => player.ws.once('close', () => resolve())),
      ]);
    }
  });
});

async function runScenario(
  dm: ReturnType<typeof connect>,
  player: ReturnType<typeof connect>
): Promise<void> {
  await Promise.all([dm.opened, player.opened]);

  // Seed the room: a DM-hidden element and a normal one. Sent in order on
  // the same connection — the hub's per-room queue guarantees hidden-1 is
  // applied to the backend before normal-1, so once the player observes
  // normal-1's broadcast we know hidden-1 is already stored.
  send(dm.ws, {
    from: 'dm-1',
    op: {
      kind: 'upsert',
      element: { id: HIDDEN_ID, type: 'shape', audience: DM_AUDIENCE },
    },
  });
  send(dm.ws, {
    from: 'dm-1',
    op: { kind: 'upsert', element: { id: NORMAL_ID, type: 'shape' } },
  });
  await player.waitFor(
    m =>
      m.op.kind === 'upsert' &&
      (m.op.element as { id: string }).id === NORMAL_ID
  );

  // 1. Player sends a `clear` — authorize denies it (players can't clear).
  // The correction must be a canRead-filtered snapshot: normal-1 present,
  // hidden-1 absent.
  send(player.ws, { from: 'p1', op: { kind: 'clear' } });
  const snapshotCorrection = await player.waitFor(
    m => m.op.kind === 'snapshot'
  );
  const elements = snapshotCorrection.op.elements as { id: string }[];
  expect(elements.map(e => e.id).sort()).toEqual([NORMAL_ID]);
  expect(elements.some(e => e.id === HIDDEN_ID)).toBe(false);

  // 2. Player attempts to remove the hidden element — authorize denies it
  // (hidden elements are untouchable by players). The correction must not
  // leak the hidden element's bytes: either a `remove`, or at minimum no
  // upsert carrying audience:'dm' element bytes.
  send(player.ws, { from: 'p1', op: { kind: 'remove', id: HIDDEN_ID } });
  const removeCorrection = await player.waitFor(
    m => m.op.kind === 'remove' || m.op.kind === 'upsert'
  );
  if (removeCorrection.op.kind === 'upsert') {
    const el = removeCorrection.op.element as {
      id: string;
      audience?: string;
    };
    expect(el.audience).not.toBe(DM_AUDIENCE);
  } else {
    expect(removeCorrection.op.kind).toBe('remove');
    expect(removeCorrection.op.id).toBe(HIDDEN_ID);
  }

  // 3. Sanity: the DM is never denied, and must not be over-filtered — a
  // DM request-snapshot still includes the hidden element.
  send(dm.ws, { from: 'dm-1', op: { kind: 'request-snapshot' } });
  const dmSnapshot = await dm.waitFor(
    m => m.op.kind === 'snapshot' && m.op.to === 'dm-1'
  );
  const dmElements = dmSnapshot.op.elements as { id: string }[];
  expect(dmElements.map(e => e.id).sort()).toEqual(
    [HIDDEN_ID, NORMAL_ID].sort()
  );
}
