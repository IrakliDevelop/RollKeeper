import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { createShape } from '@fieldnotes/core';
import { InMemoryHubFanout, MemoryHubBackend } from '@fieldnotes/sync-server';
import { startRelay, type RelayHandle } from './server.js';
import { EphemeralHubFanout } from './ephemeral-fanout.js';
import { signBattleMapToken } from './token.js';
import { DM_AUDIENCE } from './policies.js';

const SECRET = 'fog-sync-test-secret';
let roomCounter = 0;
function nextRoom(): string {
  return `CAMP1:bm-fog-${++roomCounter}`;
}

// Tile records without a `data` field are valid coordinate/version markers.

interface Envelope {
  from: string;
  op: {
    kind: string;
    [key: string]: unknown;
  };
}

function tokenFor(
  userId: string,
  role: 'dm' | 'player' | 'display',
  room: string
): string {
  return signBattleMapToken(
    { userId, role, room, exp: Date.now() + 60_000 },
    SECRET
  );
}

function connect(
  role: 'dm' | 'player' | 'display',
  userId: string,
  port: number,
  room: string
) {
  const token = tokenFor(userId, role, room);
  const ws = new WebSocket(
    `ws://127.0.0.1:${port}/?room=${encodeURIComponent(room)}&token=${token}`
  );
  const messages: Envelope[] = [];
  ws.on('message', data => {
    try {
      messages.push(JSON.parse(String(data)) as Envelope);
    } catch {
      /* ignore */
    }
  });
  const opened = new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', reject);
  });
  const waitFor = (
    predicate: (m: Envelope) => boolean,
    timeoutMs = 3000
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
              `timeout waiting for fog message; received kinds: ${JSON.stringify(messages.map(m => m.op.kind))}`
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

async function admit(
  ...peers: Array<ReturnType<typeof connect>>
): Promise<void> {
  for (const p of peers) {
    const fromId = `admit-${Math.random().toString(36).slice(2, 8)}`;
    send(p.ws, { from: fromId, op: { kind: 'request-snapshot' } });
    await p.waitFor(m => m.op.kind === 'snapshot' && m.op.to === fromId);
  }
}

function makeDef(
  base: 'covered' | 'revealed',
  generation: string,
  bounds = { x: 0, y: 0, w: 2048, h: 2048 },
  cellSize = 128
) {
  return { version: 1, base, bounds, cellSize, tileCells: 128, generation };
}

function fogMeta(
  from: string,
  version: number,
  definition?: ReturnType<typeof makeDef>
): Envelope {
  return {
    from,
    op: {
      kind: 'fog-meta',
      record: { version, editor: from, ...(definition ? { definition } : {}) },
    },
  };
}

function fogPatch(
  from: string,
  generation: string,
  tiles: Array<{
    x: number;
    y: number;
    version: number;
    editor: string;
    data?: string;
  }>
): Envelope {
  return {
    from,
    op: {
      kind: 'fog-patch',
      generation,
      tiles: tiles.map(t => ({ generation, ...t })),
    },
  };
}

describe('fog-of-war sync (real relay)', () => {
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

  it('DM fog-meta is accepted and broadcast; player fog write is denied with correction', async () => {
    const room = nextRoom();
    const dm = connect('dm', 'dm-1', port, room);
    const player = connect('player', 'char1', port, room);
    await Promise.all([dm.opened, player.opened]);
    await admit(dm, player);

    send(dm.ws, fogMeta('dm-1', 1, makeDef('covered', 'gen-1')));

    const playerSeen = await player.waitFor(
      m => m.op.kind === 'fog-meta' && m.from !== 'hub'
    );
    const record = playerSeen.op.record as {
      version: number;
      definition?: unknown;
    };
    expect(record.version).toBe(1);
    expect(record.definition).toBeTruthy();

    send(player.ws, fogMeta('char1', 2, makeDef('revealed', 'gen-2')));
    const correction = await player.waitFor(
      m => m.from === 'hub' && m.op.kind === 'fog-meta'
    );
    const corrRecord = correction.op.record as { version: number };
    expect(corrRecord.version).toBe(1);

    dm.ws.close();
    player.ws.close();
  }, 10_000);

  it('display fog write is denied', async () => {
    const room = nextRoom();
    const dm = connect('dm', 'dm-1', port, room);
    const display = connect('display', 'display-CAMP1', port, room);
    await Promise.all([dm.opened, display.opened]);
    await admit(dm, display);

    send(
      dm.ws,
      fogMeta(
        'dm-1',
        1,
        makeDef('covered', 'gen-d1', { x: 0, y: 0, w: 1024, h: 1024 }, 64)
      )
    );
    await display.waitFor(m => m.op.kind === 'fog-meta' && m.from !== 'hub');

    send(
      display.ws,
      fogMeta(
        'display-CAMP1',
        2,
        makeDef('revealed', 'gen-d2', { x: 0, y: 0, w: 1024, h: 1024 }, 64)
      )
    );
    const correction = await display.waitFor(
      m => m.from === 'hub' && m.op.kind === 'fog-meta'
    );
    expect((correction.op.record as { version: number }).version).toBe(1);

    dm.ws.close();
    display.ws.close();
  }, 10_000);

  it('DM fog-patch tiles propagate to player; player patch is denied with correction', async () => {
    const room = nextRoom();
    const dm = connect('dm', 'dm-1', port, room);
    const player = connect('player', 'char1', port, room);
    await Promise.all([dm.opened, player.opened]);
    await admit(dm, player);

    send(dm.ws, fogMeta('dm-1', 1, makeDef('covered', 'gen-p1')));
    await player.waitFor(m => m.op.kind === 'fog-meta' && m.from !== 'hub');

    send(
      dm.ws,
      fogPatch('dm-1', 'gen-p1', [{ x: 0, y: 0, version: 1, editor: 'dm-1' }])
    );
    const patchSeen = await player.waitFor(
      m => m.op.kind === 'fog-patch' && m.from !== 'hub'
    );
    const tiles = patchSeen.op.tiles as Array<{ x: number; y: number }>;
    expect(tiles.length).toBeGreaterThanOrEqual(1);
    expect(tiles[0].x).toBe(0);
    expect(tiles[0].y).toBe(0);

    send(
      player.ws,
      fogPatch('char1', 'gen-p1', [{ x: 1, y: 0, version: 1, editor: 'char1' }])
    );
    const correction = await player.waitFor(
      m => m.from === 'hub' && m.op.kind === 'fog-patch'
    );
    expect(correction.op.tiles).toBeTruthy();

    dm.ws.close();
    player.ws.close();
  }, 10_000);

  it('late joiner snapshot includes fog', async () => {
    const room = nextRoom();
    const dm = connect('dm', 'dm-1', port, room);
    await dm.opened;
    await admit(dm);

    send(
      dm.ws,
      fogMeta(
        'dm-1',
        1,
        makeDef('covered', 'gen-lj', { x: 0, y: 0, w: 1024, h: 1024 }, 64)
      )
    );

    send(
      dm.ws,
      fogPatch('dm-1', 'gen-lj', [{ x: 0, y: 0, version: 1, editor: 'dm-1' }])
    );

    await new Promise(r => setTimeout(r, 200));

    const late = connect('player', 'char-late', port, room);
    await late.opened;
    send(late.ws, {
      from: 'char-late',
      op: { kind: 'request-snapshot' },
    });
    const snapshot = await late.waitFor(
      m => m.op.kind === 'snapshot' && m.op.to === 'char-late'
    );
    const fog = snapshot.op.fog as {
      meta: { version: number; definition?: unknown };
      tiles: unknown[];
    };
    expect(fog).toBeTruthy();
    expect(fog.meta.version).toBe(1);
    expect(fog.meta.definition).toBeTruthy();
    expect(fog.tiles.length).toBeGreaterThanOrEqual(1);

    dm.ws.close();
    late.ws.close();
  }, 10_000);

  it('DM reset (new generation) propagates', async () => {
    const room = nextRoom();
    const dm = connect('dm', 'dm-1', port, room);
    const player = connect('player', 'char1', port, room);
    await Promise.all([dm.opened, player.opened]);
    await admit(dm, player);

    send(
      dm.ws,
      fogMeta(
        'dm-1',
        1,
        makeDef('covered', 'gen-r1', { x: 0, y: 0, w: 512, h: 512 }, 64)
      )
    );
    await player.waitFor(m => m.op.kind === 'fog-meta' && m.from !== 'hub');

    send(
      dm.ws,
      fogPatch('dm-1', 'gen-r1', [{ x: 0, y: 0, version: 1, editor: 'dm-1' }])
    );
    await player.waitFor(m => m.op.kind === 'fog-patch' && m.from !== 'hub');

    send(
      dm.ws,
      fogMeta(
        'dm-1',
        2,
        makeDef('covered', 'gen-r2', { x: 0, y: 0, w: 512, h: 512 }, 64)
      )
    );
    const resetMeta = await player.waitFor(
      m =>
        m.op.kind === 'fog-meta' &&
        m.from !== 'hub' &&
        (m.op.record as { version: number }).version === 2
    );
    const def = (resetMeta.op.record as { definition?: { generation: string } })
      .definition;
    expect(def?.generation).toBe('gen-r2');

    dm.ws.close();
    player.ws.close();
  }, 10_000);

  it('DM-only elements remain absent from player snapshots independent of fog state', async () => {
    const room = nextRoom();
    const dm = connect('dm', 'dm-1', port, room);
    const player = connect('player', 'char1', port, room);
    await Promise.all([dm.opened, player.opened]);
    await admit(dm, player);

    send(dm.ws, {
      from: 'dm-1',
      op: {
        kind: 'upsert',
        element: {
          ...createShape({
            position: { x: 0, y: 0 },
            size: { w: 10, h: 10 },
          }),
          id: 'secret-note',
          audience: DM_AUDIENCE,
        },
      },
    });

    send(dm.ws, {
      from: 'dm-1',
      op: {
        kind: 'upsert',
        element: {
          ...createShape({
            position: { x: 50, y: 50 },
            size: { w: 10, h: 10 },
          }),
          id: 'public-marker',
        },
      },
    });

    await player.waitFor(
      m =>
        m.op.kind === 'upsert' &&
        (m.op.element as { id: string }).id === 'public-marker'
    );

    send(
      dm.ws,
      fogMeta(
        'dm-1',
        1,
        makeDef('covered', 'gen-ind', { x: 0, y: 0, w: 512, h: 512 }, 64)
      )
    );
    await player.waitFor(m => m.op.kind === 'fog-meta' && m.from !== 'hub');

    send(player.ws, {
      from: 'char1',
      op: { kind: 'request-snapshot' },
    });
    const snapshot = await player.waitFor(
      m => m.op.kind === 'snapshot' && m.op.to === 'char1'
    );
    const elements = snapshot.op.elements as Array<{ id: string }>;
    expect(elements.some(e => e.id === 'secret-note')).toBe(false);
    expect(elements.some(e => e.id === 'public-marker')).toBe(true);

    const fog = snapshot.op.fog as { meta: { version: number } };
    expect(fog.meta.version).toBe(1);

    dm.ws.close();
    player.ws.close();
  }, 10_000);

  it('fog state survives DM disconnect and reconnect', async () => {
    const room = nextRoom();
    const dm1 = connect('dm', 'dm-1', port, room);
    await dm1.opened;
    await admit(dm1);

    send(
      dm1.ws,
      fogMeta(
        'dm-1',
        1,
        makeDef('covered', 'gen-dc', { x: 0, y: 0, w: 1024, h: 1024 }, 64)
      )
    );
    send(
      dm1.ws,
      fogPatch('dm-1', 'gen-dc', [{ x: 0, y: 0, version: 1, editor: 'dm-1' }])
    );

    await new Promise(r => setTimeout(r, 150));
    dm1.ws.close();
    await new Promise<void>(resolve => dm1.ws.once('close', resolve));

    const dm2 = connect('dm', 'dm-1', port, room);
    await dm2.opened;
    send(dm2.ws, { from: 'dm-1', op: { kind: 'request-snapshot' } });
    const snapshot = await dm2.waitFor(
      m => m.op.kind === 'snapshot' && m.op.to === 'dm-1'
    );
    const fog = snapshot.op.fog as {
      meta: { version: number; definition?: { generation: string } };
      tiles: unknown[];
    };
    expect(fog).toBeTruthy();
    expect(fog.meta.version).toBe(1);
    expect(fog.meta.definition?.generation).toBe('gen-dc');
    expect(fog.tiles.length).toBeGreaterThanOrEqual(1);

    dm2.ws.close();
  }, 10_000);
});

describe('fog multi-instance fan-out (real relay pair)', () => {
  let fanout: InMemoryHubFanout;
  let handleA: RelayHandle;
  let handleB: RelayHandle;
  let portA: number;
  let portB: number;

  beforeAll(async () => {
    fanout = new InMemoryHubFanout();
    handleA = await startRelay({
      secret: SECRET,
      backend: new MemoryHubBackend(),
      fanout: new EphemeralHubFanout(fanout),
    });
    handleB = await startRelay({
      secret: SECRET,
      backend: new MemoryHubBackend(),
      fanout: new EphemeralHubFanout(fanout),
    });
    portA = handleA.address().port;
    portB = handleB.address().port;
  });

  afterAll(async () => {
    await Promise.all([handleA.close(), handleB.close()]);
  });

  it('DM fog on instance A reaches player on instance B via fan-out', async () => {
    const room = nextRoom();
    const dm = connect('dm', 'dm-1', portA, room);
    const player = connect('player', 'char1', portB, room);
    await Promise.all([dm.opened, player.opened]);
    await admit(dm, player);

    send(
      dm.ws,
      fogMeta(
        'dm-1',
        1,
        makeDef('covered', 'gen-fan', { x: 0, y: 0, w: 512, h: 512 }, 64)
      )
    );
    const seen = await player.waitFor(
      m => m.op.kind === 'fog-meta' && m.from !== 'hub'
    );
    const record = seen.op.record as {
      version: number;
      definition?: { generation: string };
    };
    expect(record.version).toBe(1);
    expect(record.definition?.generation).toBe('gen-fan');

    dm.ws.close();
    player.ws.close();
  }, 10_000);
});

describe('fog authorizeFog policy (unit-level)', () => {
  it('authorizeFog from makePolicies allows dm and denies player/display/missing', async () => {
    const { makePolicies } = await import('./policies.js');
    const { authorizeFog } = makePolicies('test');
    const base = {
      room: 'R:bm',
      op: {
        kind: 'fog-meta' as const,
        record: { version: 1, editor: 'x' },
      },
      current: undefined,
    };
    expect(authorizeFog({ ...base, role: 'dm', userId: 'dm-1' })).toBe(true);
    expect(authorizeFog({ ...base, role: 'player', userId: 'p1' })).toBe(false);
    expect(authorizeFog({ ...base, role: 'display', userId: 'd1' })).toBe(
      false
    );
    expect(authorizeFog({ ...base, role: undefined, userId: undefined })).toBe(
      false
    );
    expect(authorizeFog({ ...base, role: '', userId: 'x' })).toBe(false);
  });
});
