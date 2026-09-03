// relay/src/presenceLanes.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import WebSocket from 'ws';
import { signBattleMapToken } from './token.js';
import { startRelay, type RelayHandle } from './server.js';

const SECRET = 'lane-test-secret';
const ROOM = 'CAMP01:bm-1';
/** Wide window so "inside one window" is provable, not guessed. */
const THROTTLE_MS = 1000;
/**
 * The colliding sends must provably land inside the window opened by the
 * warm-up frame. A stalled runner (GC pause, CI contention) could otherwise
 * let the window close first — and then 0.12.0 would pass, mis-diagnosing
 * the seam. The test measures the gap and REFUSES to conclude when it is too
 * large, instead of silently passing.
 */
const MAX_GAP_MS = THROTTLE_MS / 2;

type Envelope = {
  from?: string;
  op?: { kind?: string; to?: string; data?: { kind?: string; seq?: number } };
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

/**
 * Real relay, real sockets, no timing guesses: the first awareness frame is
 * relayed immediately and OPENS the throttle window; the test waits until B
 * has received it, then — synchronously, provably inside the THROTTLE_MS
 * window (see MAX_GAP_MS) — sends one `ping` followed by a second awareness
 * frame. Kind-blind throttling
 * (sync-server ≤ 0.12.0) keeps ONE pending slot per connection, so the
 * second awareness frame replaces the pending ping and B never sees it.
 * Per-kind lanes (0.13.0) deliver both when their windows close.
 */
describe('relay presence throttle lanes', () => {
  let handle: RelayHandle | null = null;
  let a: WebSocket | null = null;
  let b: WebSocket | null = null;

  afterEach(async () => {
    a?.close();
    b?.close();
    a = null;
    b = null;
    await handle?.close();
    handle = null;
  });

  it('a same-window awareness frame never displaces a pending ping', async () => {
    handle = await startRelay({
      secret: SECRET,
      port: 0,
      presenceThrottleMs: THROTTLE_MS,
    });
    const port = handle.address().port;
    a = connect(port, playerToken('player-a'));
    b = connect(port, playerToken('player-b'));
    await waitOpen(a);
    await waitOpen(b);
    await Promise.all([
      waitUntilAdmitted(a, 'ready-a'),
      waitUntilAdmitted(b, 'ready-b'),
    ]);

    const received: Envelope[] = [];
    b.on('message', data => {
      received.push(JSON.parse(data.toString()) as Envelope);
    });
    const sender = a;

    // 1) Warm-up frame: relayed immediately, opens A's window. Sync on receipt
    //    and stamp the moment the window is known to be open. The window
    //    actually opened slightly EARLIER (when the hub relayed the frame),
    //    so measuring from receipt is conservative.
    const sentAt = performance.now();
    sender.send(
      presence({
        kind: 'awareness',
        id: 'char-a',
        cursor: { x: 0, y: 0 },
        seq: 0,
      })
    );
    await vi.waitFor(
      () => {
        expect(
          received.some(
            m => m.op?.data?.kind === 'awareness' && m.op.data.seq === 0
          )
        ).toBe(true);
      },
      { interval: 5 }
    );

    // 2) Inside the window (no await between): a ping, then another awareness frame.
    sender.send(presence({ kind: 'ping', x: 10, y: 10, color: '#fff' }));
    sender.send(
      presence({
        kind: 'awareness',
        id: 'char-a',
        cursor: { x: 1, y: 0 },
        seq: 1,
      })
    );
    const gapMs = performance.now() - sentAt;
    // Always emitted (red AND green runs): the evidence the plan asks the
    // executor to record.
    console.info(`[lanes] gapMs=${gapMs.toFixed(1)} window=${THROTTLE_MS}`);
    // Explicit elapsed-window assertion: if the runner stalled past half the
    // window between opening it and the colliding sends, the test cannot
    // distinguish lanes from no lanes — fail loudly with the reason.
    expect(
      gapMs,
      `runner stalled ${gapMs.toFixed(0)} ms before the colliding sends (limit ${MAX_GAP_MS} ms) — rerun`
    ).toBeLessThan(MAX_GAP_MS);

    // 3) Both must arrive once their windows close (≤ THROTTLE_MS + slack).
    //    The gap is part of the failure message so a red run on 0.12.0 still
    //    prints the evidence.
    await vi.waitFor(
      () => {
        expect(
          received.some(m => m.op?.data?.kind === 'ping'),
          `ping never delivered (gapMs=${gapMs.toFixed(1)}, window=${THROTTLE_MS})`
        ).toBe(true);
        expect(
          received.some(
            m => m.op?.data?.kind === 'awareness' && m.op.data.seq === 1
          ),
          `awareness seq 1 never delivered (gapMs=${gapMs.toFixed(1)})`
        ).toBe(true);
      },
      { timeout: 3 * THROTTLE_MS, interval: 20 }
    );
  });
});
