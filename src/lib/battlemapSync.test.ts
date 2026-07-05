import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CanvasElement, ElementStore } from '@fieldnotes/core';
import {
  computeSeedIds,
  createManagedBattleMapConnection,
  type BattleMapConnectionStatus,
  type BattleMapTransport,
} from '@/lib/battlemapSync';

// SyncClient internals are not under test — stub it (and the never-constructed
// WebSocketTransport, since tests inject transportFactory).
vi.mock('@fieldnotes/sync', () => ({
  // constructible stub (arrow functions cannot be `new`-ed)
  SyncClient: vi.fn().mockImplementation(function (this: unknown) {
    return { start: vi.fn(), stop: vi.fn() };
  }),
  WebSocketTransport: vi.fn(),
}));

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
  close(): void {}

  emitMessage(message: string): void {
    for (const h of [...this.msgHandlers]) h(message);
  }
}

interface FakeStore {
  snapshot: ReturnType<typeof vi.fn>;
  getById: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  add: ReturnType<typeof vi.fn>;
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

describe('createManagedBattleMapConnection snapshot watcher', () => {
  let fakeTransport: FakeTransport;
  let statuses: BattleMapConnectionStatus[];

  beforeEach(() => {
    fakeTransport = new FakeTransport();
    statuses = [];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ token: 'test-token' }),
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const startConnection = async (store: FakeStore, seedLocal = true) => {
    const conn = createManagedBattleMapConnection({
      relayUrl: 'wss://relay.example',
      campaignCode: 'CODE',
      battleMapId: 'map-1',
      store: store as unknown as ElementStore,
      clientId: 'dm-1',
      tokenRequest: { role: 'dm', battleMapId: 'map-1', dmId: 'dm-1' },
      seedLocal,
      onStatus: s => statuses.push(s),
      transportFactory: () => fakeTransport,
    });
    // let the async connect() (token fetch) finish and wire the transport
    await flush();
    return conn;
  };

  it('goes live and seeds missing local elements on a snapshot addressed to us', async () => {
    const store = makeFakeStore([el('a'), el('b'), el('c')]);
    const conn = await startConnection(store);

    fakeTransport.emitMessage(snapshotEnvelope('dm-1', ['b']));
    expect(statuses).toContain('live');

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
      JSON.stringify({ from: 'peer', op: { kind: 'upsert', element: el('x') } })
    );
    await flush();

    expect(statuses).toEqual(before);
    expect(store.update).not.toHaveBeenCalled();
    expect(store.add).not.toHaveBeenCalled();

    conn.stop();
  });
});
