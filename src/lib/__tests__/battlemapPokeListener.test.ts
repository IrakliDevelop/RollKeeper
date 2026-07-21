import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { createBattleMapPokeListener } from '@/lib/battlemapPokeListener';

vi.mock('@/lib/battlemapSync', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/battlemapSync')>();
  return {
    ...actual,
    mintBattleMapToken: vi.fn(),
  };
});

import { mintBattleMapToken } from '@/lib/battlemapSync';

const mockMint = vi.mocked(mintBattleMapToken);

const pokeEnvelope = (feature: string): string =>
  JSON.stringify({
    from: '@poke',
    op: { kind: 'presence', data: { kind: 'poke', feature } },
  });

const snapshotEnvelope = (): string =>
  JSON.stringify({
    from: 'hub',
    op: { kind: 'snapshot', to: 'char-1', elements: [] },
  });

const upsertEnvelope = (): string =>
  JSON.stringify({
    from: 'peer',
    op: { kind: 'upsert', element: { id: 'x' } },
  });

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number; reason?: string }) => void) | null = null;
  sent: string[] = [];
  closeCalls = 0;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }
  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    this.closeCalls += 1;
  }
  triggerOpen(): void {
    this.onopen?.();
  }
  triggerMessage(data: string): void {
    this.onmessage?.({ data });
  }
  triggerClose(code: number, reason = ''): void {
    this.onclose?.({ code, reason });
  }
}

describe('createBattleMapPokeListener', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWebSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket);
    process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL = 'wss://relay.example';
    mockMint.mockReset();
    mockMint.mockResolvedValue('tok-1');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    delete process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;
  });

  const baseOpts = () => ({
    campaignCode: 'CODE',
    battleMapId: 'map-1',
    tokenRequest: { role: 'player' as const, playerId: 'char-1' },
    onPoke: vi.fn(),
  });

  it('1. mints a token, opens the ws url, surfaces pokes and ignores everything else', async () => {
    const opts = baseOpts();
    const stop = createBattleMapPokeListener(opts);
    await vi.advanceTimersByTimeAsync(0);

    expect(mockMint).toHaveBeenCalledWith('CODE', {
      role: 'player',
      playerId: 'char-1',
      battleMapId: 'map-1',
    });
    expect(FakeWebSocket.instances).toHaveLength(1);
    const ws = FakeWebSocket.instances[0];
    expect(ws.url).toBe('wss://relay.example?room=CODE%3Amap-1&token=tok-1');

    ws.triggerMessage(pokeEnvelope('players'));
    expect(opts.onPoke).toHaveBeenCalledWith('players');

    opts.onPoke.mockClear();
    ws.triggerMessage(snapshotEnvelope());
    ws.triggerMessage(upsertEnvelope());
    ws.triggerMessage('not json');
    expect(opts.onPoke).not.toHaveBeenCalled();

    stop();
  });

  it('2. never calls socket.send', async () => {
    const opts = baseOpts();
    const stop = createBattleMapPokeListener(opts);
    await vi.advanceTimersByTimeAsync(0);
    const ws = FakeWebSocket.instances[0];

    ws.triggerMessage(pokeEnvelope('initiative'));
    expect(ws.sent).toHaveLength(0);

    stop();
  });

  it('3. transient close retries same token once after 1s, then fresh token after 2s', async () => {
    const opts = baseOpts();
    const stop = createBattleMapPokeListener(opts);
    await vi.advanceTimersByTimeAsync(0);
    expect(mockMint).toHaveBeenCalledTimes(1);

    const ws1 = FakeWebSocket.instances[0];
    ws1.triggerClose(1006);

    // not yet due
    await vi.advanceTimersByTimeAsync(999);
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(mockMint).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(FakeWebSocket.instances).toHaveLength(2);
    // same-token retry: no new mint call, same url
    expect(mockMint).toHaveBeenCalledTimes(1);
    expect(FakeWebSocket.instances[1].url).toBe(ws1.url);

    mockMint.mockResolvedValue('tok-2');
    const ws2 = FakeWebSocket.instances[1];
    ws2.triggerClose(1006);

    await vi.advanceTimersByTimeAsync(1999);
    expect(FakeWebSocket.instances).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(FakeWebSocket.instances).toHaveLength(3);
    // second consecutive transient close -> fresh token minted
    expect(mockMint).toHaveBeenCalledTimes(2);
    expect(FakeWebSocket.instances[2].url).toContain('token=tok-2');

    stop();
  });

  it('4. fatal close (4401 token expiry) mints a fresh token and reconnects', async () => {
    const opts = baseOpts();
    const stop = createBattleMapPokeListener(opts);
    await vi.advanceTimersByTimeAsync(0);
    expect(mockMint).toHaveBeenCalledTimes(1);

    mockMint.mockResolvedValue('tok-2');
    FakeWebSocket.instances[0].triggerClose(4401);

    await vi.advanceTimersByTimeAsync(1000);
    expect(mockMint).toHaveBeenCalledTimes(2);
    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(FakeWebSocket.instances[1].url).toContain('token=tok-2');

    stop();
  });

  it('4b. other fatal codes in the 4000-4999 range also force a fresh token', async () => {
    const opts = baseOpts();
    const stop = createBattleMapPokeListener(opts);
    await vi.advanceTimersByTimeAsync(0);

    mockMint.mockResolvedValue('tok-2');
    FakeWebSocket.instances[0].triggerClose(4000);
    await vi.advanceTimersByTimeAsync(1000);

    expect(mockMint).toHaveBeenCalledTimes(2);
    expect(FakeWebSocket.instances).toHaveLength(2);

    stop();
  });

  it('5. proactively rebuilds the connection every 4 minutes', async () => {
    const opts = baseOpts();
    const stop = createBattleMapPokeListener(opts);
    await vi.advanceTimersByTimeAsync(0);
    expect(mockMint).toHaveBeenCalledTimes(1);
    const ws1 = FakeWebSocket.instances[0];

    mockMint.mockResolvedValue('tok-refreshed');
    await vi.advanceTimersByTimeAsync(4 * 60 * 1000);

    expect(ws1.closeCalls).toBe(1);
    expect(mockMint).toHaveBeenCalledTimes(2);
    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(FakeWebSocket.instances[1].url).toContain('token=tok-refreshed');

    stop();
  });

  it('6. stop() closes the live socket and is safe to call twice', async () => {
    const opts = baseOpts();
    const stop = createBattleMapPokeListener(opts);
    await vi.advanceTimersByTimeAsync(0);
    const ws = FakeWebSocket.instances[0];

    stop();
    expect(ws.closeCalls).toBe(1);
    expect(() => stop()).not.toThrow();
  });

  it('6b. stop() clears pending timers and suppresses reconnects', async () => {
    const opts = baseOpts();
    const stop = createBattleMapPokeListener(opts);
    await vi.advanceTimersByTimeAsync(0);
    const ws = FakeWebSocket.instances[0];

    ws.triggerClose(1006); // schedule a same-token retry in 1s
    stop();

    // no reconnect after stop, even once the pending backoff/refresh would fire
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(mockMint).toHaveBeenCalledTimes(1);
  });

  it('7. missing relay URL schedules a retry with backoff and never throws', async () => {
    delete process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;
    const opts = baseOpts();
    const stop = createBattleMapPokeListener(opts);
    await vi.advanceTimersByTimeAsync(0);

    expect(mockMint).not.toHaveBeenCalled();
    expect(FakeWebSocket.instances).toHaveLength(0);

    process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL = 'wss://relay.example';
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockMint).toHaveBeenCalledTimes(1);
    expect(FakeWebSocket.instances).toHaveLength(1);

    stop();
  });

  it('7b. a token-mint failure schedules a retry with backoff and never throws', async () => {
    mockMint.mockResolvedValueOnce(null);
    const opts = baseOpts();
    const stop = createBattleMapPokeListener(opts);
    await vi.advanceTimersByTimeAsync(0);

    expect(FakeWebSocket.instances).toHaveLength(0);
    mockMint.mockResolvedValue('tok-1');
    await vi.advanceTimersByTimeAsync(1000);

    expect(mockMint).toHaveBeenCalledTimes(2);
    expect(FakeWebSocket.instances).toHaveLength(1);

    stop();
  });
});
