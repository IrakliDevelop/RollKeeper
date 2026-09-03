// relay/src/gateLog.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import WebSocket from 'ws';
import { signBattleMapToken } from './token.js';
import { startRelay, type RelayHandle } from './server.js';

const SECRET = 'gate-log-test-secret';
const ROOM = 'CAMP01:bm-1';

type Envelope = {
  from?: string;
  op?: { kind?: string; to?: string; data?: { kind?: string } };
};

function playerToken(userId: string) {
  return signBattleMapToken(
    { userId, role: 'player', room: ROOM, exp: Date.now() + 30_000 },
    SECRET
  );
}

function connect(port: number, token: string): WebSocket {
  return new WebSocket(
    `ws://127.0.0.1:${port}?room=${encodeURIComponent(ROOM)}&token=${encodeURIComponent(token)}`
  );
}

async function waitOpen(socket: WebSocket): Promise<void> {
  await vi.waitFor(() => {
    expect(socket.readyState).toBe(WebSocket.OPEN);
  });
}

async function waitUntilAdmitted(
  socket: WebSocket,
  from: string
): Promise<void> {
  const messages: Envelope[] = [];
  const onMessage = (data: WebSocket.RawData) => {
    messages.push(JSON.parse(data.toString()) as Envelope);
  };
  socket.on('message', onMessage);
  socket.send(JSON.stringify({ from, op: { kind: 'request-snapshot' } }));
  await vi.waitFor(() => {
    expect(
      messages.some(m => m.op?.kind === 'snapshot' && m.op.to === from)
    ).toBe(true);
  });
  socket.off('message', onMessage);
}

function presence(data: Record<string, unknown>): string {
  return JSON.stringify({ from: 'player-a', op: { kind: 'presence', data } });
}

describe('relay gateLog observation seam', () => {
  let handle: RelayHandle | null = null;
  let a: WebSocket | null = null;

  afterEach(async () => {
    a?.close();
    a = null;
    await handle?.close();
    handle = null;
  });

  it('with gateLog: logs admitted identities and presence kinds with field NAMES only; without: logs nothing', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    handle = await startRelay({ secret: SECRET, port: 0, gateLog: true });
    const port = handle.address().port;
    a = connect(port, playerToken('player-a'));
    await waitOpen(a);
    await waitUntilAdmitted(a, 'ready-a');
    a.send(
      presence({
        kind: 'awareness',
        id: 'char-a',
        name: 'SECRET-NAME',
        cursor: { x: 1, y: 2 },
      })
    );
    await vi.waitFor(() => {
      expect(log.mock.calls.flat().join('\n')).toMatch(
        /\[gate\] presence kind=awareness fields=cursor,id,kind,name/
      );
    });
    const all = log.mock.calls.flat().join('\n');
    expect(all).toMatch(/\[gate\] admitted role=player userId=player-a room=/);
    expect(all).not.toContain('SECRET-NAME'); // names only, never values
    log.mockRestore();
  });

  it('without gateLog nothing is logged for the same traffic', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    handle = await startRelay({ secret: SECRET, port: 0 });
    const port = handle.address().port;
    a = connect(port, playerToken('player-a'));
    await waitOpen(a);
    await waitUntilAdmitted(a, 'ready-a');
    a.send(
      presence({
        kind: 'awareness',
        id: 'char-a',
        name: 'SECRET-NAME',
        cursor: { x: 1, y: 2 },
      })
    );
    // No synchronous signal that the presence frame was processed without
    // gateLog, so wait a task-queue turn for any (absent) log line to land.
    await new Promise(resolve => setTimeout(resolve, 50));
    const all = log.mock.calls.flat().join('\n');
    expect(all).not.toContain('[gate]');
    log.mockRestore();
  });
});
