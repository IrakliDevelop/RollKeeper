import { describe, it, expect, vi, afterEach } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { SyncHub } from '@fieldnotes/sync-server';
import WebSocket from 'ws';
import { pokeRoom, handlePokeRequest } from './poke.js';
import { signBattleMapToken } from './token.js';
import { startRelay, type RelayHandle } from './server.js';

const SECRET = 'test-secret';
const ROOM = 'CAMP1:map-42';

/** Mirrors the real `SyncHub` shape: `rooms` maps room -> connection ids,
 * and the actual connection objects (with `send`) live in `conns`. */
function fakeHub(rooms: Record<string, { send: (m: string) => void }[]>) {
  const conns = new Map<string, { send: (m: string) => void }>();
  const roomMap = new Map<string, Set<string>>();
  let counter = 0;
  for (const [room, list] of Object.entries(rooms)) {
    const ids = new Set<string>();
    for (const conn of list) {
      const id = `c${++counter}`;
      conns.set(id, conn);
      ids.add(id);
    }
    roomMap.set(room, ids);
  }
  return { rooms: roomMap, conns } as unknown as SyncHub;
}

/** Minimal async-iterable POST request carrying a JSON body. */
function fakeReq(body: string, method = 'POST'): IncomingMessage {
  return {
    method,
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(body);
    },
  } as unknown as IncomingMessage;
}

function fakeRes() {
  const res = {
    statusCode: 0,
    body: '',
    writeHead(code: number) {
      res.statusCode = code;
      return res;
    },
    end(chunk?: string) {
      if (chunk) res.body = chunk;
    },
  };
  return res as typeof res & ServerResponse;
}

function dmToken(room = ROOM, exp = Date.now() + 30_000) {
  return signBattleMapToken(
    { userId: '@server', role: 'dm', room, exp },
    SECRET
  );
}

describe('pokeRoom', () => {
  it('sends the poke envelope to every connection in the room', () => {
    const a = { send: vi.fn() };
    const b = { send: vi.fn() };
    const hub = fakeHub({ [ROOM]: [a, b] });

    const sent = pokeRoom(hub, ROOM, 'initiative');

    expect(sent).toBe(2);
    const expected = JSON.stringify({
      from: '@poke',
      op: { kind: 'presence', data: { kind: 'poke', feature: 'initiative' } },
    });
    expect(a.send).toHaveBeenCalledWith(expected);
    expect(b.send).toHaveBeenCalledWith(expected);
  });

  it('returns 0 for an empty or unknown room', () => {
    const hub = fakeHub({});
    expect(pokeRoom(hub, ROOM, 'initiative')).toBe(0);
  });

  it('survives a connection whose send throws (dead socket)', () => {
    const dead = {
      send: vi.fn(() => {
        throw new Error('EPIPE');
      }),
    };
    const alive = { send: vi.fn() };
    const hub = fakeHub({ [ROOM]: [dead, alive] });
    expect(pokeRoom(hub, ROOM, 'initiative')).toBe(1);
    expect(alive.send).toHaveBeenCalled();
  });
});

describe('handlePokeRequest', () => {
  it('broadcasts and returns 200 {sent} for a valid dm token', async () => {
    const conn = { send: vi.fn() };
    const hub = fakeHub({ [ROOM]: [conn] });
    const res = fakeRes();
    const body = JSON.stringify({
      room: ROOM,
      feature: 'initiative',
      token: dmToken(),
    });

    await handlePokeRequest(hub, SECRET, fakeReq(body), res);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ sent: 1 });
    expect(conn.send).toHaveBeenCalledTimes(1);
  });

  it('rejects a token for a different room', async () => {
    const hub = fakeHub({ [ROOM]: [{ send: vi.fn() }] });
    const res = fakeRes();
    const body = JSON.stringify({
      room: ROOM,
      feature: 'initiative',
      token: dmToken('CAMP1:other-map'),
    });
    await handlePokeRequest(hub, SECRET, fakeReq(body), res);
    expect(res.statusCode).toBe(401);
  });

  it('rejects a non-dm role token', async () => {
    const hub = fakeHub({ [ROOM]: [{ send: vi.fn() }] });
    const res = fakeRes();
    const token = signBattleMapToken(
      { userId: 'p1', role: 'player', room: ROOM, exp: Date.now() + 30_000 },
      SECRET
    );
    const body = JSON.stringify({ room: ROOM, feature: 'initiative', token });
    await handlePokeRequest(hub, SECRET, fakeReq(body), res);
    expect(res.statusCode).toBe(401);
  });

  it('rejects an expired token', async () => {
    const hub = fakeHub({ [ROOM]: [{ send: vi.fn() }] });
    const res = fakeRes();
    const body = JSON.stringify({
      room: ROOM,
      feature: 'initiative',
      token: dmToken(ROOM, Date.now() - 1),
    });
    await handlePokeRequest(hub, SECRET, fakeReq(body), res);
    expect(res.statusCode).toBe(401);
  });

  it('rejects malformed JSON with 400', async () => {
    const res = fakeRes();
    await handlePokeRequest(fakeHub({}), SECRET, fakeReq('{nope'), res);
    expect(res.statusCode).toBe(400);
  });

  it('rejects missing fields with 400', async () => {
    const res = fakeRes();
    await handlePokeRequest(
      fakeHub({}),
      SECRET,
      fakeReq(JSON.stringify({ room: ROOM })),
      res
    );
    expect(res.statusCode).toBe(400);
  });

  it('rejects non-POST with 405', async () => {
    const res = fakeRes();
    await handlePokeRequest(fakeHub({}), SECRET, fakeReq('', 'GET'), res);
    expect(res.statusCode).toBe(405);
  });
});

describe('poke integration (real relay)', () => {
  let handle: RelayHandle | null = null;
  let socket: WebSocket | null = null;

  afterEach(async () => {
    socket?.close();
    socket = null;
    await handle?.close();
    handle = null;
  });

  it('delivers a real poke to a live websocket connection in the room', async () => {
    handle = await startRelay({ secret: SECRET, port: 0 });
    const port = handle.address().port;

    const playerToken = signBattleMapToken(
      { userId: 'p1', role: 'player', room: ROOM, exp: Date.now() + 30_000 },
      SECRET
    );
    const wsUrl = `ws://127.0.0.1:${port}?room=${encodeURIComponent(
      ROOM
    )}&token=${encodeURIComponent(playerToken)}`;
    socket = new WebSocket(wsUrl);

    const messages: string[] = [];
    socket.on('message', data => {
      messages.push(data.toString());
    });

    await vi.waitFor(() => {
      expect(socket?.readyState).toBe(WebSocket.OPEN);
    });

    // The hub registers the connection asynchronously after the WS upgrade
    // (authenticate resolves via a microtask), so retry the poke until the
    // relay reports the connection as a room member.
    await vi.waitFor(async () => {
      const response = await fetch(`http://127.0.0.1:${port}/poke`, {
        method: 'POST',
        body: JSON.stringify({
          room: ROOM,
          feature: 'initiative',
          token: dmToken(),
        }),
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ sent: 1 });
    });

    await vi.waitFor(() => {
      const pokeMessage = messages
        .map(m => JSON.parse(m) as unknown)
        .find(
          (m): m is { from: string; op: { kind: string; data: unknown } } =>
            typeof m === 'object' &&
            m !== null &&
            (m as { op?: { data?: { kind?: unknown } } }).op?.data?.kind ===
              'poke'
        );
      expect(pokeMessage).toEqual({
        from: '@poke',
        op: { kind: 'presence', data: { kind: 'poke', feature: 'initiative' } },
      });
    });
  });
});
