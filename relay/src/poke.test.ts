import { describe, it, expect, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { SyncHub } from '@fieldnotes/sync-server';
import { pokeRoom, handlePokeRequest } from './poke.js';
import { signBattleMapToken } from './token.js';

const SECRET = 'test-secret';
const ROOM = 'CAMP1:map-42';

function fakeHub(rooms: Record<string, { send: (m: string) => void }[]>) {
  const map = new Map<string, Set<{ send: (m: string) => void }>>();
  for (const [room, conns] of Object.entries(rooms)) {
    map.set(room, new Set(conns));
  }
  return { rooms: map } as unknown as SyncHub;
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
