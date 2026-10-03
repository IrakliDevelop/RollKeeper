import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { createShape } from '@fieldnotes/core';
import { MemoryHubBackend } from '@fieldnotes/sync-server';

import { startRelay, type RelayHandle } from './server.js';
import { signBattleMapToken } from './token.js';

const SECRET = 'authority-admission-secret';
const AUTHORITY_ROOM = '123e4567-e89b-42d3-a456-426614174000';
const LEGACY_ROOM = 'CAMP1_bm-legacy';

type Envelope = {
  from: string;
  op: { kind: string; to?: string; elements?: Array<{ id: string }> };
};

function connect(port: number, room: string, token: string) {
  const ws = new WebSocket(
    `ws://127.0.0.1:${port}/?room=${encodeURIComponent(room)}&token=${encodeURIComponent(token)}`
  );
  const messages: Envelope[] = [];
  ws.on('message', data => {
    messages.push(JSON.parse(String(data)) as Envelope);
  });
  const opened = new Promise<void>((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
  const closed = new Promise<number>(resolve => {
    ws.once('close', code => resolve(code));
  });
  return { ws, messages, opened, closed };
}

async function eventually(
  predicate: () => boolean,
  timeoutMs = 2_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('timed out');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

describe('authority admission without an authority runtime', () => {
  let relay: RelayHandle | null = null;
  const sockets: WebSocket[] = [];

  afterEach(async () => {
    sockets.forEach(socket => socket.close());
    await relay?.close();
    relay = null;
  });

  it('rejects v1 before legacy mutation while retaining true legacy rooms', async () => {
    const backend = new MemoryHubBackend();
    relay = await startRelay({ secret: SECRET, backend });
    const port = relay.address().port;
    const authorityToken = signBattleMapToken(
      {
        v: 1,
        userId: 'dm-v1',
        role: 'dm',
        room: AUTHORITY_ROOM,
        exp: Date.now() + 60_000,
        campaign: 'CAMP1',
        resourceKind: 'scene',
        sceneId: 'scene-a',
        epoch: '223e4567-e89b-42d3-a456-426614174000',
        roomGeneration: '323e4567-e89b-42d3-a456-426614174000',
        writerFence: 1,
      },
      SECRET
    );
    const v1 = connect(port, AUTHORITY_ROOM, authorityToken);
    sockets.push(v1.ws);
    await v1.opened;
    const forbidden = createShape({
      position: { x: 1, y: 2 },
      size: { w: 10, h: 10 },
    });
    v1.ws.send(
      JSON.stringify({
        from: 'v1-probe',
        op: { kind: 'upsert', element: forbidden },
      })
    );
    v1.ws.send(
      JSON.stringify({ from: 'v1-probe', op: { kind: 'request-snapshot' } })
    );

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(await backend.get(AUTHORITY_ROOM, forbidden.id)).toBeUndefined();
    expect(
      v1.messages.some(message =>
        message.op.elements?.some(element => element.id === forbidden.id)
      )
    ).toBe(false);
    await expect(
      Promise.race([
        v1.closed,
        new Promise<never>((_resolve, reject) =>
          setTimeout(() => reject(new Error('v1 socket stayed open')), 2_000)
        ),
      ])
    ).resolves.toBe(4401);

    const legacyToken = signBattleMapToken(
      {
        userId: 'dm-legacy',
        role: 'dm',
        room: LEGACY_ROOM,
        exp: Date.now() + 60_000,
      },
      SECRET
    );
    const legacy = connect(port, LEGACY_ROOM, legacyToken);
    sockets.push(legacy.ws);
    await legacy.opened;
    const retained = createShape({
      position: { x: 3, y: 4 },
      size: { w: 10, h: 10 },
    });
    legacy.ws.send(
      JSON.stringify({
        from: 'legacy-probe',
        op: { kind: 'upsert', element: retained },
      })
    );
    legacy.ws.send(
      JSON.stringify({
        from: 'legacy-probe',
        op: { kind: 'request-snapshot' },
      })
    );
    await eventually(() =>
      legacy.messages.some(
        message =>
          message.op.kind === 'snapshot' &&
          message.op.to === 'legacy-probe' &&
          message.op.elements?.some(element => element.id === retained.id)
      )
    );
    expect(await backend.get(LEGACY_ROOM, retained.id)).toMatchObject({
      id: retained.id,
    });
  }, 10_000);
});
