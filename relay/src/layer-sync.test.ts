import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { MemoryHubBackend } from '@fieldnotes/sync-server';
import { startRelay, type RelayHandle } from './server.js';
import { signBattleMapToken } from './token.js';

/**
 * Integration test for layer-definition sync through the real relay: the
 * published, unpatched SyncHub with RollKeeper's authorizeLayer policy.
 */

const SECRET = 'layer-sync-test-secret';
const ROOM = 'ROOM1:bm-layers';

interface Envelope {
  from: string;
  op: {
    kind: string;
    [key: string]: unknown;
  };
}

function tokenFor(userId: string, role: 'dm' | 'player' | 'display'): string {
  return signBattleMapToken(
    { userId, role, room: ROOM, exp: Date.now() + 60_000 },
    SECRET
  );
}

function connect(
  role: 'dm' | 'player' | 'display',
  userId: string,
  port: number
) {
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
              `timeout waiting for message; received: ${JSON.stringify(messages)}`
            )
          );
        }
      }, 10);
    });
  return { ws, messages, opened, waitFor };
}

function layerDef(id: string, name = id, order = 200) {
  return { id, name, visible: true, locked: false, order, opacity: 1 };
}

function layerUpsert(
  from: string,
  id: string,
  version: number,
  editor: string,
  name = id
): Envelope {
  return {
    from,
    op: { kind: 'layer-upsert', layer: layerDef(id, name), version, editor },
  };
}

describe('layer-definition sync (real relay)', () => {
  let handle: RelayHandle;
  let port: number;

  beforeAll(async () => {
    handle = await startRelay({
      secret: SECRET,
      backend: new MemoryHubBackend(),
    });
    port = handle.address().port;
  });

  afterAll(async () => {
    await handle.close();
  });

  it('propagates DM layer definitions, enforces player ownership, and serves records to late joiners', async () => {
    const dm = connect('dm', 'dm-1', port);
    const player = connect('player', 'char1', port);
    await Promise.all([dm.opened, player.opened]);

    // DM defines a custom layer — the player receives it.
    dm.ws.send(
      JSON.stringify(layerUpsert('dm-1', 'layer-props', 1, 'dm-1', 'Props'))
    );
    const seen = await player.waitFor(m => m.op.kind === 'layer-upsert');
    expect((seen.op.layer as { name: string }).name).toBe('Props');

    // Player defines their own layer — allowed, DM receives it.
    player.ws.send(
      JSON.stringify(layerUpsert('char1', 'player-char1', 1, 'char1'))
    );
    await dm.waitFor(
      m =>
        m.op.kind === 'layer-upsert' &&
        (m.op.layer as { id: string }).id === 'player-char1'
    );

    // Player tries to hijack the DM's layer — denied; the hub answers the
    // sender with an authoritative correction carrying the current record,
    // and the DM never sees the forged edit.
    player.ws.send(
      JSON.stringify(
        layerUpsert('char1', 'layer-props', 5, 'char1', 'hijacked')
      )
    );
    const correction = await player.waitFor(
      m =>
        m.from === 'hub' &&
        m.op.kind === 'layer-upsert' &&
        (m.op.layer as { id: string }).id === 'layer-props'
    );
    expect((correction.op.layer as { name: string }).name).toBe('Props');
    expect(correction.op.version).toBe(1);
    expect(
      dm.messages.filter(
        m =>
          m.op.kind === 'layer-upsert' &&
          (m.op.layer as { name?: string }).name === 'hijacked'
      )
    ).toEqual([]);

    // A late joiner's snapshot carries both stored records.
    const late = connect('player', 'char2', port);
    await late.opened;
    late.ws.send(
      JSON.stringify({ from: 'char2', op: { kind: 'request-snapshot' } })
    );
    const snapshot = await late.waitFor(
      m => m.op.kind === 'snapshot' && m.op.to === 'char2'
    );
    const records = (snapshot.op.layers ?? []) as {
      id: string;
      version: number;
      definition?: { name: string };
    }[];
    const ids = records.map(r => r.id).sort();
    expect(ids).toEqual(['layer-props', 'player-char1']);
    expect(records.find(r => r.id === 'layer-props')?.definition?.name).toBe(
      'Props'
    );

    dm.ws.close();
    player.ws.close();
    late.ws.close();
  }, 10_000);

  it('display connections are read-only for layer definitions', async () => {
    const dm = connect('dm', 'dm-1', port);
    const display = connect('display', 'display-1', port);
    await Promise.all([dm.opened, display.opened]);

    display.ws.send(
      JSON.stringify(
        layerUpsert('display-1', 'player-display-1', 1, 'display-1')
      )
    );
    // Denied with no stored record: the hub reverts the sender with a
    // tombstone, and the DM sees nothing.
    const correction = await display.waitFor(
      m => m.from === 'hub' && m.op.kind === 'layer-remove'
    );
    expect(correction.op.id).toBe('player-display-1');
    expect(dm.messages.filter(m => m.op.kind === 'layer-upsert')).toEqual([]);

    dm.ws.close();
    display.ws.close();
  }, 10_000);
});
