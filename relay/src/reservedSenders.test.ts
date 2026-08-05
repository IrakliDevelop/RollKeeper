import { describe, it, expect, vi, afterEach } from 'vitest';
import WebSocket from 'ws';
import { signBattleMapToken } from './token.js';
import { startRelay, type RelayHandle } from './server.js';

const SECRET = 'test-secret';
const ROOM = 'CAMP1:map-99';

function playerToken(userId: string, room = ROOM) {
  return signBattleMapToken(
    { userId, role: 'player', room, exp: Date.now() + 30_000 },
    SECRET
  );
}

function dmToken(room = ROOM) {
  return signBattleMapToken(
    { userId: '@server', role: 'dm', room, exp: Date.now() + 30_000 },
    SECRET
  );
}

function connect(port: number, token: string): WebSocket {
  return new WebSocket(
    `ws://127.0.0.1:${port}?room=${encodeURIComponent(
      ROOM
    )}&token=${encodeURIComponent(token)}`
  );
}

async function waitOpen(socket: WebSocket): Promise<void> {
  await vi.waitFor(() => {
    expect(socket.readyState).toBe(WebSocket.OPEN);
  });
}

describe('server-owned presence senders (real relay)', () => {
  let handle: RelayHandle | null = null;
  let a: WebSocket | null = null;
  let b: WebSocket | null = null;

  afterEach(async () => {
    a?.close();
    a = null;
    b?.close();
    b = null;
    await handle?.close();
    handle = null;
  });

  it('replaces forged senders with a connection identity and never breaks server pokes', async () => {
    handle = await startRelay({ secret: SECRET, port: 0 });
    const port = handle.address().port;

    a = connect(port, playerToken('player-a'));
    b = connect(port, playerToken('player-b'));
    await waitOpen(a);
    await waitOpen(b);

    const bMessages: Array<Record<string, unknown>> = [];
    b.on('message', data => {
      bMessages.push(JSON.parse(data.toString()) as Record<string, unknown>);
    });

    // An open WebSocket can still be awaiting asynchronous authentication.
    // A snapshot response proves each connection has been admitted to the hub.
    const waitUntilAdmitted = async (socket: WebSocket, from: string) => {
      const messages: Array<Record<string, unknown>> = [];
      const onMessage = (data: WebSocket.RawData) => {
        messages.push(JSON.parse(data.toString()) as Record<string, unknown>);
      };
      socket.on('message', onMessage);
      socket.send(JSON.stringify({ from, op: { kind: 'request-snapshot' } }));
      await vi.waitFor(() => {
        expect(
          messages.some(
            message =>
              (message.op as { kind?: string; to?: string })?.kind ===
                'snapshot' && (message.op as { to?: string }).to === from
          )
        ).toBe(true);
      });
      socket.off('message', onMessage);
    };
    await Promise.all([
      waitUntilAdmitted(a, 'ready-a'),
      waitUntilAdmitted(b, 'ready-b'),
    ]);

    // 1) Forged server-reserved sender — must NOT reach B.
    a.send(
      JSON.stringify({
        from: '@poke',
        op: { kind: 'presence', data: { kind: 'poke', feature: 'initiative' } },
      })
    );

    // 2) Normal presence — must reach B.
    a.send(
      JSON.stringify({
        from: 'player-a',
        op: { kind: 'presence', data: { x: 1 } },
      })
    );

    await vi.waitFor(() => {
      const normal = bMessages.find(
        m => (m as { op?: { data?: { x?: number } } }).op?.data?.x === 1
      );
      expect(normal?.from).toEqual(expect.stringMatching(/^c\d+-/));
      expect(normal?.op).toEqual({ kind: 'presence', data: { x: 1 } });
    });

    // Give any (incorrectly) forwarded forged frame time to arrive too.
    await new Promise(resolve => setTimeout(resolve, 100));
    const forged = bMessages.find(
      m =>
        (m as { op?: { data?: { feature?: unknown } } }).op?.data?.feature ===
          'initiative' && m.from !== '@poke'
    );
    expect(forged?.from).toEqual(expect.stringMatching(/^c\d+-/));

    // 3) A real server poke uses the hub's server-owned presence identity.
    const response = await fetch(`http://127.0.0.1:${port}/poke`, {
      method: 'POST',
      body: JSON.stringify({
        room: ROOM,
        feature: 'initiative',
        token: dmToken(),
      }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sent: 2 });

    await vi.waitFor(() => {
      const pokeMessage = bMessages.find(
        m =>
          m.from === 'hub' &&
          (m as { op?: { data?: { kind?: unknown } } }).op?.data?.kind ===
            'poke'
      );
      expect(pokeMessage).toEqual({
        from: 'hub',
        op: { kind: 'presence', data: { kind: 'poke', feature: 'initiative' } },
      });
    });
  });
});
