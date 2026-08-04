import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ElementStore,
  createShape,
  type CanvasElement,
} from '@fieldnotes/core';
import {
  createManagedBattleMapConnection,
  type BattleMapConnectionStatus,
  type BattleMapTransport,
} from '@/lib/battlemapSync';

// No @fieldnotes/sync mocking: the real managed lifecycle + SyncClient run
// against an injected fake transport, so these tests exercise the actual
// adoption seam (RollKeeper glue over createManagedSyncConnection and its
// authoritative bootstrap/reconcile hooks).

/** Structurally valid element — the SDK validates snapshot elements. */
const el = (id: string): CanvasElement => ({
  ...createShape({ position: { x: 0, y: 0 }, size: { w: 1, h: 1 } }),
  id,
});

class FakeTransport implements BattleMapTransport {
  sent: string[] = [];
  closed = false;
  private msgHandlers = new Set<(message: string) => void>();
  private reconnectHandlers = new Set<() => void>();
  private closeHandlers = new Set<(code: number, reason: string) => void>();

  send(message: string): void {
    this.sent.push(message);
  }
  onMessage(handler: (message: string) => void): () => void {
    this.msgHandlers.add(handler);
    return () => this.msgHandlers.delete(handler);
  }
  onReconnect(handler: () => void): () => void {
    this.reconnectHandlers.add(handler);
    return () => this.reconnectHandlers.delete(handler);
  }
  onClose(handler: (code: number, reason: string) => void): () => void {
    this.closeHandlers.add(handler);
    return () => this.closeHandlers.delete(handler);
  }
  close(): void {
    this.closed = true;
    this.msgHandlers.clear();
    this.reconnectHandlers.clear();
    this.closeHandlers.clear();
  }

  emitMessage(message: string): void {
    for (const h of [...this.msgHandlers]) h(message);
  }
  emitReconnect(): void {
    for (const h of [...this.reconnectHandlers]) h();
  }
  emitClose(code: number): void {
    for (const h of [...this.closeHandlers]) h(code, '');
  }
}

const snapshotEnvelope = (to: string, ids: string[]): string =>
  JSON.stringify({
    from: 'hub',
    op: { kind: 'snapshot', to, elements: ids.map(id => el(id)) },
  });

const sentUpsertIds = (sent: string[]): string[] =>
  sent
    .map(
      m => JSON.parse(m) as { op: { kind: string; element?: { id: string } } }
    )
    .filter(e => e.op.kind === 'upsert' && e.op.element)
    .map(e => (e.op.element as { id: string }).id);

/** Flush pending microtasks (token mint) — nothing here defers to macrotasks. */
const flush = (): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, 0));

describe('createManagedBattleMapConnection', () => {
  let fakeTransport: FakeTransport;
  let transportUrls: string[];
  let statuses: BattleMapConnectionStatus[];
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fakeTransport = new FakeTransport();
    transportUrls = [];
    statuses = [];
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'test-token' }),
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const startConnection = async (
    store: ElementStore,
    seedLocal = true,
    onPoke?: (feature: string) => void
  ) => {
    const conn = createManagedBattleMapConnection({
      relayUrl: 'wss://relay.example',
      campaignCode: 'CODE',
      battleMapId: 'map-1',
      store,
      clientId: 'dm-1',
      tokenRequest: { role: 'dm', battleMapId: 'map-1', dmId: 'dm-1' },
      seedLocal,
      onStatus: s => statuses.push(s),
      onPoke,
      transportFactory: url => {
        transportUrls.push(url);
        return fakeTransport;
      },
    });
    // let the async connect() (token fetch) finish and wire the transport
    await flush();
    return conn;
  };

  it('mints via the campaign token route and connects with a room+token URL', async () => {
    const store = new ElementStore();
    const conn = await startConnection(store);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/campaign/CODE/battlemap-token',
      expect.objectContaining({ method: 'POST' })
    );
    expect(transportUrls).toEqual([
      'wss://relay.example?room=CODE%3Amap-1&token=test-token',
    ]);
    // the SyncClient announces itself with the stable clientId
    const first = JSON.parse(fakeTransport.sent[0]) as {
      from: string;
      op: { kind: string };
    };
    expect(first.from).toBe('dm-1');
    expect(first.op.kind).toBe('request-snapshot');

    conn.stop();
  });

  it('goes live and synchronously re-pushes hub-unknown seed elements on the bootstrap snapshot', async () => {
    const store = new ElementStore();
    store.add(el('a'));
    store.add(el('b'));
    store.add(el('c'));
    const conn = await startConnection(store);
    expect(statuses).toEqual(['connecting']);

    fakeTransport.emitMessage(snapshotEnvelope('dm-1', ['b']));

    // No deferred macrotask: live + seed happen inside the snapshot dispatch.
    expect(statuses).toEqual(['connecting', 'live']);
    expect(sentUpsertIds(fakeTransport.sent).sort()).toEqual(['a', 'c']);
    expect(store.getById('a')).toBeDefined();
    expect(store.getById('b')).toBeDefined();
    expect(store.getById('c')).toBeDefined();

    conn.stop();
  });

  it('ignores snapshots addressed to a different client', async () => {
    const store = new ElementStore();
    store.add(el('a'));
    const conn = await startConnection(store);

    fakeTransport.emitMessage(snapshotEnvelope('someone-else', []));

    expect(statuses).not.toContain('live');
    expect(sentUpsertIds(fakeTransport.sent)).toEqual([]);
    expect(store.getById('a')).toBeDefined();

    conn.stop();
  });

  it('keeps hub-unknown local elements across a rebuild while hub-deleted elements stay deleted', async () => {
    vi.useFakeTimers();
    try {
      const store = new ElementStore();
      store.add(el('a'));
      store.add(el('b'));
      const conn = createManagedBattleMapConnection({
        relayUrl: 'wss://relay.example',
        campaignCode: 'CODE',
        battleMapId: 'map-1',
        store,
        clientId: 'dm-1',
        tokenRequest: { role: 'dm', battleMapId: 'map-1', dmId: 'dm-1' },
        seedLocal: true,
        onStatus: s => statuses.push(s),
        transportFactory: url => {
          transportUrls.push(url);
          return fakeTransport;
        },
      });
      await vi.advanceTimersByTimeAsync(0); // token mint resolves

      // Bootstrap: the hub already knows both seeds — nothing to push.
      fakeTransport.emitMessage(snapshotEnvelope('dm-1', ['a', 'b']));
      expect(statuses).toEqual(['connecting', 'live']);
      expect(sentUpsertIds(fakeTransport.sent)).toEqual([]);

      // Terminal auth close: the managed lifecycle tears the client down and
      // re-mints. While no client is attached, the host loads a new
      // local-authoritative element the hub has never seen.
      fakeTransport.emitClose(4401);
      const sendsWhileDown = fakeTransport.sent.length;
      store.add(el('n'));
      expect(fakeTransport.sent.length).toBe(sendsWhileDown); // detached — nothing sent

      await vi.advanceTimersByTimeAsync(2_000); // backoff + re-mint + rebuild
      expect(transportUrls).toHaveLength(2);
      const sentBefore = fakeTransport.sent.length;

      // The hub deleted 'b' while we were away.
      fakeTransport.emitMessage(snapshotEnvelope('dm-1', ['a']));

      expect(store.getById('a')).toBeDefined();
      expect(store.getById('b')).toBeUndefined(); // deleted-while-away — no zombie
      expect(store.getById('n')).toBeDefined(); // hub-unknown — preserved
      expect(sentUpsertIds(fakeTransport.sent.slice(sentBefore))).toEqual([
        'n',
      ]);
      conn.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not push local-only elements when seedLocal is off', async () => {
    const store = new ElementStore();
    store.add(el('x'));
    const conn = await startConnection(store, false);

    fakeTransport.emitMessage(snapshotEnvelope('dm-1', []));

    expect(statuses).toEqual(['connecting', 'live']);
    expect(sentUpsertIds(fakeTransport.sent)).toEqual([]);
    expect(store.getById('x')).toBeDefined(); // bootstrap merge keeps it locally

    conn.stop();
  });

  it('does not change status on non-snapshot envelopes', async () => {
    const store = new ElementStore();
    store.add(el('a'));
    const conn = await startConnection(store);
    const before = [...statuses];

    fakeTransport.emitMessage(
      JSON.stringify({ from: 'peer', op: { kind: 'presence', data: {} } })
    );

    expect(statuses).toEqual(before);
    expect(store.getById('a')).toBeDefined();
    expect(sentUpsertIds(fakeTransport.sent)).toEqual([]);

    conn.stop();
  });

  it('delivers hub pokes to onPoke and ignores non-hub or non-poke frames', async () => {
    const store = new ElementStore();
    const pokes: string[] = [];
    const conn = await startConnection(store, false, f => pokes.push(f));

    fakeTransport.emitMessage(
      JSON.stringify({
        from: 'hub',
        op: { kind: 'presence', data: { kind: 'poke', feature: 'initiative' } },
      })
    );
    fakeTransport.emitMessage(
      JSON.stringify({
        from: 'someone-else',
        op: { kind: 'presence', data: { kind: 'poke', feature: 'roster' } },
      })
    );
    fakeTransport.emitMessage(
      JSON.stringify({
        from: 'hub',
        op: { kind: 'presence', data: { kind: 'cursor' } },
      })
    );

    expect(pokes).toEqual(['initiative']);
    conn.stop();
  });

  it('reports denied after bounded consecutive 4401 closes (token no longer accepted)', async () => {
    vi.useFakeTimers();
    try {
      const store = new ElementStore();
      const conn = createManagedBattleMapConnection({
        relayUrl: 'wss://relay.example',
        campaignCode: 'CODE',
        battleMapId: 'map-1',
        store,
        clientId: 'dm-1',
        tokenRequest: { role: 'dm', battleMapId: 'map-1', dmId: 'dm-1' },
        onStatus: s => statuses.push(s),
        transportFactory: url => {
          transportUrls.push(url);
          return fakeTransport;
        },
      });
      await vi.advanceTimersByTimeAsync(0); // token mint 1 resolves

      // Each terminal auth close tears the connection down; the managed
      // lifecycle re-mints and rebuilds until the auth budget (4) is
      // exhausted, then settles on terminal denied.
      for (let i = 0; i < 3; i += 1) {
        fakeTransport.emitClose(4401);
        expect(statuses[statuses.length - 1]).toBe('offline');
        await vi.advanceTimersByTimeAsync(20_000); // backoff + next mint
      }
      fakeTransport.emitClose(4401); // 4th consecutive auth failure

      expect(statuses[statuses.length - 1]).toBe('denied');
      expect(transportUrls).toHaveLength(4); // one mint per auth attempt
      await vi.advanceTimersByTimeAsync(60_000);
      expect(transportUrls).toHaveLength(4); // denied is terminal — no re-mint
      conn.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('stop() closes the transport and detaches the store', async () => {
    const store = new ElementStore();
    const conn = await startConnection(store);
    fakeTransport.emitMessage(snapshotEnvelope('dm-1', []));

    conn.stop();
    expect(fakeTransport.closed).toBe(true);

    const sends = fakeTransport.sent.length;
    store.add(el('late'));
    expect(fakeTransport.sent.length).toBe(sends);
  });
});
