import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CanvasElement, ElementStore } from '@fieldnotes/core';
import {
  computeSeedIds,
  createManagedBattleMapConnection,
  type BattleMapConnectionStatus,
  type BattleMapTransport,
} from '@/lib/battlemapSync';

// No @fieldnotes/sync mocking: the real managed lifecycle + SyncClient run
// against an injected fake transport, so these tests exercise the actual
// adoption seam (RollKeeper glue over createManagedSyncConnection).

const el = (id: string) => ({ id }) as CanvasElement;

describe('computeSeedIds', () => {
  it('returns ids of local elements missing from the snapshot', () => {
    expect(computeSeedIds([el('a'), el('b'), el('c')], new Set(['b']))).toEqual(
      ['a', 'c']
    );
  });
  it('returns empty when snapshot covers everything', () => {
    expect(computeSeedIds([el('a')], new Set(['a']))).toEqual([]);
  });
  it('returns everything for an empty room', () => {
    expect(computeSeedIds([el('a'), el('b')], new Set())).toEqual(['a', 'b']);
  });
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
  emitClose(code: number): void {
    for (const h of [...this.closeHandlers]) h(code, '');
  }
}

interface FakeStore {
  snapshot: ReturnType<typeof vi.fn>;
  getById: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  add: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  /** test helper: simulate SyncClient's destructive reconcile deleting an id */
  simulateRemove: (id: string) => void;
}

function makeFakeStore(initial: CanvasElement[]): FakeStore {
  let elements = [...initial];
  return {
    snapshot: vi.fn(() => [...elements]),
    getById: vi.fn((id: string) => elements.find(e => e.id === id)),
    update: vi.fn(),
    add: vi.fn((element: CanvasElement) => {
      elements.push(element);
    }),
    remove: vi.fn((id: string) => {
      elements = elements.filter(e => e.id !== id);
    }),
    clear: vi.fn(() => {
      elements = [];
    }),
    // the real SyncClient subscribes to store mutations on start()
    on: vi.fn(() => () => {}),
    simulateRemove: (id: string) => {
      elements = elements.filter(e => e.id !== id);
    },
  };
}

const snapshotEnvelope = (to: string, ids: string[]): string =>
  JSON.stringify({
    from: 'hub',
    op: { kind: 'snapshot', to, elements: ids.map(id => ({ id })) },
  });

/** Flush pending microtasks + one macrotask (covers the deferred seed). */
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
    store: FakeStore,
    seedLocal = true,
    onPoke?: (feature: string) => void
  ) => {
    const conn = createManagedBattleMapConnection({
      relayUrl: 'wss://relay.example',
      campaignCode: 'CODE',
      battleMapId: 'map-1',
      store: store as unknown as ElementStore,
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
    const store = makeFakeStore([]);
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

  it('goes live and seeds missing local elements on a snapshot addressed to us', async () => {
    const store = makeFakeStore([el('a'), el('b'), el('c')]);
    const conn = await startConnection(store);
    expect(statuses).toEqual(['connecting']);

    fakeTransport.emitMessage(snapshotEnvelope('dm-1', ['b']));
    expect(statuses).toEqual(['connecting', 'live']);

    await flush(); // run the deferred seed
    expect(store.update).toHaveBeenCalledWith('a', {});
    expect(store.update).toHaveBeenCalledWith('c', {});
    expect(store.update).not.toHaveBeenCalledWith('b', {});
    expect(store.add).not.toHaveBeenCalled();

    conn.stop();
  });

  it('ignores snapshots addressed to a different client', async () => {
    const store = makeFakeStore([el('a')]);
    const conn = await startConnection(store);

    fakeTransport.emitMessage(snapshotEnvelope('someone-else', []));
    await flush();

    expect(statuses).not.toContain('live');
    expect(store.update).not.toHaveBeenCalled();
    expect(store.add).not.toHaveBeenCalled();

    conn.stop();
  });

  it('re-adds elements deleted by reconcile before the deferred seed runs (resync)', async () => {
    const store = makeFakeStore([el('a'), el('b')]);
    const conn = await startConnection(store);

    // first snapshot: hub already has everything
    fakeTransport.emitMessage(snapshotEnvelope('dm-1', ['a', 'b']));
    await flush();
    expect(store.update).not.toHaveBeenCalled();
    expect(store.add).not.toHaveBeenCalled();

    // reconnect resync: hub lost 'b'; SyncClient's reconcile deletes it
    // locally after our watcher captured localBefore but before the seed runs
    fakeTransport.emitMessage(snapshotEnvelope('dm-1', ['a']));
    store.simulateRemove('b');
    await flush();

    expect(store.add).toHaveBeenCalledTimes(1);
    expect(store.add).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'b' })
    );
    expect(store.update).not.toHaveBeenCalled();

    conn.stop();
  });

  it('does not change status on non-snapshot envelopes', async () => {
    const store = makeFakeStore([el('a')]);
    const conn = await startConnection(store);
    const before = [...statuses];

    fakeTransport.emitMessage(
      JSON.stringify({ from: 'peer', op: { kind: 'presence', data: {} } })
    );
    await flush();

    expect(statuses).toEqual(before);
    expect(store.update).not.toHaveBeenCalled();
    expect(store.add).not.toHaveBeenCalled();

    conn.stop();
  });

  it('delivers hub pokes to onPoke and ignores non-hub or non-poke frames', async () => {
    const store = makeFakeStore([]);
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
      const store = makeFakeStore([]);
      const conn = createManagedBattleMapConnection({
        relayUrl: 'wss://relay.example',
        campaignCode: 'CODE',
        battleMapId: 'map-1',
        store: store as unknown as ElementStore,
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

  it('stop() prevents the deferred seed from mutating the store', async () => {
    const store = makeFakeStore([el('a')]);
    const conn = await startConnection(store);

    fakeTransport.emitMessage(snapshotEnvelope('dm-1', []));
    conn.stop(); // before the deferred seed macrotask runs
    await flush();

    expect(store.update).not.toHaveBeenCalled();
    expect(store.add).not.toHaveBeenCalled();
    expect(fakeTransport.closed).toBe(true);
  });
});
