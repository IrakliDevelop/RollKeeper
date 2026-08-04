import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ElementStore,
  LayerManager,
  createShape,
  type CanvasElement,
  type Layer,
} from '@fieldnotes/core';
import {
  createManagedBattleMapConnection,
  type BattleMapConnectionStatus,
  type BattleMapTransport,
} from '@/lib/battlemapSync';
import {
  ANNOTATIONS_LAYER_ID,
  CUSTOM_BAND_ORDER,
  PLAYER_BAND_ORDER,
  ensureCanonicalLayers,
  migrateCanvasToContract,
  subscribePinCanonicalLayers,
  type ViewportLike,
} from '@/components/ui/campaign/location-map/layerContract';
import {
  makeApplyRemoteLayer,
  publishOwnedLayers,
} from '@/components/ui/campaign/location-map/layerSync';

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

describe('createManagedBattleMapConnection layer sync (call-site wiring)', () => {
  let fakeTransport: FakeTransport;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fakeTransport = new FakeTransport();
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'test-token' }),
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const flushMicro = (): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, 0));

  function makeCanvas(role: 'dm' | 'player'): ViewportLike {
    const store = new ElementStore();
    const layerManager = new LayerManager(store);
    const vp = { store, layerManager };
    ensureCanonicalLayers(vp, role);
    migrateCanvasToContract(vp, role);
    return vp;
  }

  function layerDef(id: string, overrides: Partial<Layer> = {}): Layer {
    return {
      id,
      name: id,
      visible: true,
      locked: false,
      order: CUSTOM_BAND_ORDER,
      opacity: 1,
      ...overrides,
    };
  }

  function record(definition: Layer, version = 1, editor = 'remote') {
    return { id: definition.id, version, editor, definition };
  }

  const sentLayerOps = (
    sent: string[]
  ): { kind: string; layer?: Layer; version?: number; editor?: string }[] =>
    sent
      .map(m => JSON.parse(m) as { op: { kind: string } })
      .map(e => e.op as { kind: string; layer?: Layer; version?: number })
      .filter(op => op.kind === 'layer-upsert' || op.kind === 'layer-remove');

  function connect(
    vp: ViewportLike,
    roleWiring: 'dm' | 'player' | 'display',
    clientId: string,
    ownLayerId?: string
  ) {
    return createManagedBattleMapConnection({
      relayUrl: 'wss://relay.example',
      campaignCode: 'CODE',
      battleMapId: 'map-1',
      store: vp.store as ElementStore,
      clientId,
      tokenRequest: { role: 'dm', battleMapId: 'map-1', dmId: clientId },
      seedLocal: roleWiring === 'dm',
      layers: {
        applyLayer: makeApplyRemoteLayer(vp, roleWiring, { ownLayerId }),
      },
      transportFactory: () => fakeTransport,
    });
  }

  it('DM canvas: join snapshot applies layer records before elements, bands pinned (VTT/editor wiring)', async () => {
    const vp = makeCanvas('dm');
    subscribePinCanonicalLayers(vp, () => ({ annotationsLocked: false }));
    const events: string[] = [];
    vp.layerManager.on('create', l => events.push(`layer:${l.id}`));
    vp.store.on('add', element => events.push(`el:${element.id}`));

    const conn = connect(vp, 'dm', 'dm-1');
    await flushMicro();
    fakeTransport.emitMessage(
      JSON.stringify({
        from: 'hub',
        op: {
          kind: 'snapshot',
          to: 'dm-1',
          elements: [
            { ...el('img'), layerId: ANNOTATIONS_LAYER_ID },
            { ...el('tok'), layerId: 'player-char9' },
          ],
          layers: [
            record(
              layerDef('player-char9', { order: PLAYER_BAND_ORDER }),
              1,
              'char9'
            ),
            record(layerDef('layer-props', { order: 42 }), 1, 'dm-other'),
          ],
        },
      })
    );

    // The token's layer exists before the token itself lands.
    expect(events.indexOf('layer:player-char9')).toBeGreaterThanOrEqual(0);
    expect(events.indexOf('layer:player-char9')).toBeLessThan(
      events.indexOf('el:tok')
    );
    // Bands re-pinned by the subscription, even for a raw record order.
    expect(vp.layerManager.getLayer('layer-props')?.order).toBe(
      CUSTOM_BAND_ORDER
    );
    expect(vp.layerManager.getLayer('player-char9')?.order).toBe(
      PLAYER_BAND_ORDER
    );
    // DM keeps player layers unlocked (can drag player tokens).
    expect(vp.layerManager.getLayer('player-char9')?.locked).toBe(false);
    conn.stop();
  });

  it('DM canvas: connect-time publishOwnedLayers teaches peers pre-existing custom layers', async () => {
    const vp = makeCanvas('dm');
    vp.layerManager.addLayerDirect(layerDef('layer-props'));

    const conn = connect(vp, 'dm', 'dm-1');
    // Production publishes immediately after creating the connection, while
    // the token mint is still in flight — the ledger must buffer it.
    publishOwnedLayers(vp, 'dm', def => conn.publishLayerUpsert(def));
    await flushMicro();
    fakeTransport.emitMessage(snapshotEnvelope('dm-1', []));

    const ops = sentLayerOps(fakeTransport.sent);
    expect(ops).toHaveLength(1);
    expect(ops[0]?.kind).toBe('layer-upsert');
    expect(ops[0]?.layer?.id).toBe('layer-props');
    expect(ops[0]?.editor).toBe('dm-1');
    conn.stop();
  });

  it('DM canvas: an offline layer edit survives a 4401 rebuild and beats a stale reconcile record', async () => {
    vi.useFakeTimers();
    try {
      const vp = makeCanvas('dm');
      const applied: string[] = [];
      const conn = createManagedBattleMapConnection({
        relayUrl: 'wss://relay.example',
        campaignCode: 'CODE',
        battleMapId: 'map-1',
        store: vp.store as ElementStore,
        clientId: 'dm-1',
        tokenRequest: { role: 'dm', battleMapId: 'map-1', dmId: 'dm-1' },
        seedLocal: true,
        layers: {
          applyLayer: update => {
            applied.push(update.record.definition?.name ?? 'tombstone');
            makeApplyRemoteLayer(vp, 'dm')(update);
          },
        },
        transportFactory: () => fakeTransport,
      });
      await vi.advanceTimersByTimeAsync(0);
      fakeTransport.emitMessage(
        JSON.stringify({
          from: 'hub',
          op: {
            kind: 'snapshot',
            to: 'dm-1',
            elements: [],
            layers: [record(layerDef('layer-props', { name: 'v1' }), 1)],
          },
        })
      );
      expect(applied).toEqual(['v1']);

      // Token expires; the DM renames the layer while detached.
      fakeTransport.emitClose(4401);
      conn.publishLayerUpsert(
        layerDef('layer-props', { name: 'renamed offline' })
      );
      await vi.advanceTimersByTimeAsync(2_000); // re-mint + rebuild

      const sentBefore = fakeTransport.sent.length;
      // Reconcile snapshot still carries the stale v1 record.
      fakeTransport.emitMessage(
        JSON.stringify({
          from: 'hub',
          op: {
            kind: 'snapshot',
            to: 'dm-1',
            elements: [],
            layers: [record(layerDef('layer-props', { name: 'v1' }), 1)],
          },
        })
      );

      // Stale record must not fire the hook again; the newer offline edit is re-pushed.
      expect(applied).toEqual(['v1']);
      const repushed = sentLayerOps(fakeTransport.sent.slice(sentBefore));
      expect(repushed).toHaveLength(1);
      expect(repushed[0]?.layer?.name).toBe('renamed offline');
      expect(repushed[0]?.version).toBe(2);
      conn.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('player canvas: publishes its own layer, applies remote layers locked, own layer never locked or removed', async () => {
    const vp = makeCanvas('player');
    const ownLayerId = 'player-char1';
    vp.layerManager.addLayerDirect(
      layerDef(ownLayerId, { name: 'My elements', order: PLAYER_BAND_ORDER })
    );
    vp.layerManager.setActiveLayer(ownLayerId);
    subscribePinCanonicalLayers(vp, () => ({ annotationsLocked: true }));

    const conn = connect(vp, 'player', 'char1', ownLayerId);
    publishOwnedLayers(
      vp,
      'player',
      def => conn.publishLayerUpsert(def),
      ownLayerId
    );
    await flushMicro();
    fakeTransport.emitMessage(snapshotEnvelope('char1', []));

    const ops = sentLayerOps(fakeTransport.sent);
    expect(ops.map(op => op.layer?.id)).toEqual([ownLayerId]);

    // DM custom layer arrives: locked for the player.
    fakeTransport.emitMessage(
      JSON.stringify({
        from: 'relay-conn',
        op: {
          kind: 'layer-upsert',
          layer: layerDef('layer-props', { locked: false }),
          version: 1,
          editor: 'dm-1',
        },
      })
    );
    expect(vp.layerManager.getLayer('layer-props')?.locked).toBe(true);

    // A rogue tombstone for the own layer is ignored.
    fakeTransport.emitMessage(
      JSON.stringify({
        from: 'relay-conn',
        op: {
          kind: 'layer-remove',
          id: ownLayerId,
          version: 9,
          editor: 'dm-1',
        },
      })
    );
    expect(vp.layerManager.getLayer(ownLayerId)).toBeDefined();
    expect(vp.layerManager.getLayer(ownLayerId)?.locked).toBe(false);
    conn.stop();
  });

  it('display canvas: applies snapshot layer records locked and publishes nothing', async () => {
    const vp = makeCanvas('player'); // display also ensures canonical bands
    const conn = connect(vp, 'display', 'display-CODE');
    await flushMicro();
    fakeTransport.emitMessage(
      JSON.stringify({
        from: 'hub',
        op: {
          kind: 'snapshot',
          to: 'display-CODE',
          elements: [{ ...el('tok'), layerId: 'player-char9' }],
          layers: [
            record(
              layerDef('player-char9', {
                order: PLAYER_BAND_ORDER,
                locked: false,
              }),
              1,
              'char9'
            ),
          ],
        },
      })
    );

    expect(vp.layerManager.getLayer('player-char9')?.locked).toBe(true);
    expect(vp.layerManager.getLayer('player-char9')?.order).toBe(
      PLAYER_BAND_ORDER
    );
    expect(sentLayerOps(fakeTransport.sent)).toEqual([]);
    conn.stop();
  });
});

describe('createManagedBattleMapConnection presence (laser)', () => {
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

  const flushMicro = (): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, 0));

  const startConnection = async (onPoke?: (feature: string) => void) => {
    const conn = createManagedBattleMapConnection({
      relayUrl: 'wss://relay.example',
      campaignCode: 'CODE',
      battleMapId: 'map-1',
      store: new ElementStore(),
      clientId: 'dm-1',
      tokenRequest: { role: 'dm', battleMapId: 'map-1', dmId: 'dm-1' },
      onStatus: s => statuses.push(s),
      onPoke,
      transportFactory: () => fakeTransport,
    });
    await flushMicro();
    return conn;
  };

  const sentPresenceData = (sent: string[]): unknown[] =>
    sent
      .map(m => JSON.parse(m) as { op: { kind: string; data?: unknown } })
      .filter(e => e.op.kind === 'presence')
      .map(e => e.op.data);

  const laserPayload = {
    kind: 'laser',
    points: [
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ],
    color: '#F4C430',
    width: 3,
    fadeMs: 1200,
  };

  it('sendPresence delivers only while live and drops (never queues) otherwise', async () => {
    const conn = await startConnection();

    conn.sendPresence(laserPayload); // still connecting — dropped
    expect(sentPresenceData(fakeTransport.sent)).toEqual([]);

    fakeTransport.emitMessage(snapshotEnvelope('dm-1', []));
    conn.sendPresence(laserPayload);
    expect(sentPresenceData(fakeTransport.sent)).toEqual([laserPayload]);

    // Transient drop: offline until the resync snapshot lands again.
    fakeTransport.emitClose(1006);
    conn.sendPresence({ ...laserPayload, points: [{ x: 9, y: 9 }] });
    fakeTransport.emitReconnect();
    conn.sendPresence({ ...laserPayload, points: [{ x: 8, y: 8 }] });
    fakeTransport.emitMessage(snapshotEnvelope('dm-1', []));

    // Nothing produced while offline/connecting ever reaches the wire.
    expect(sentPresenceData(fakeTransport.sent)).toEqual([laserPayload]);
    conn.stop();
  });

  it('laser presence and hub pokes coexist: onPoke still fires, onPresence sees both, leave delivers the sender key', async () => {
    const pokes: string[] = [];
    const presence: [string, unknown][] = [];
    const leaves: string[] = [];
    const conn = await startConnection(feature => pokes.push(feature));
    conn.onPresence((from, data) => presence.push([from, data]));
    conn.onPresenceLeave(from => leaves.push(from));
    fakeTransport.emitMessage(snapshotEnvelope('dm-1', []));

    // A hub poke arrives as a presence frame with the server-owned sender.
    fakeTransport.emitMessage(
      JSON.stringify({
        from: 'hub',
        op: { kind: 'presence', data: { kind: 'poke', feature: 'players' } },
      })
    );
    // A remote laser trail arrives from a relay connection id.
    fakeTransport.emitMessage(
      JSON.stringify({
        from: 'conn-42',
        op: { kind: 'presence', data: laserPayload },
      })
    );
    fakeTransport.emitMessage(
      JSON.stringify({ from: 'conn-42', op: { kind: 'presence-leave' } })
    );

    expect(pokes).toEqual(['players']); // poke parsing undisturbed
    expect(presence).toEqual([
      ['hub', { kind: 'poke', feature: 'players' }],
      ['conn-42', laserPayload],
    ]);
    expect(leaves).toEqual(['conn-42']);
    conn.stop();
  });

  it('poke + laser + ping presence coexist over the real attachments: each overlay renders only its kind, nothing persists, leave clears both', async () => {
    // RemotePingOverlay/RemoteLaserOverlay animate via raf; keep them inert.
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1)
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const { attachRemotePings } = await import(
      '@/components/ui/campaign/location-map/pingSync'
    );
    const { attachRemoteLaserTrails } = await import(
      '@/components/ui/campaign/location-map/laserSync'
    );

    const overlays: ((ctx: CanvasRenderingContext2D) => void)[] = [];
    const vp = {
      registerOverlay(draw: (ctx: CanvasRenderingContext2D) => void) {
        overlays.push(draw);
        return () => {
          const index = overlays.indexOf(draw);
          if (index >= 0) overlays.splice(index, 1);
        };
      },
      requestRender: vi.fn(),
    };

    const store = new ElementStore();
    const pokes: string[] = [];
    const conn = createManagedBattleMapConnection({
      relayUrl: 'wss://relay.example',
      campaignCode: 'CODE',
      battleMapId: 'map-1',
      store,
      clientId: 'player-1',
      tokenRequest: { role: 'player', battleMapId: 'map-1', playerId: 'p1' },
      onStatus: s => statuses.push(s),
      onPoke: feature => pokes.push(feature),
      transportFactory: () => fakeTransport,
    });
    await flushMicro();
    const cleanupPings = attachRemotePings(vp, conn);
    const cleanupLasers = attachRemoteLaserTrails(vp, conn);
    fakeTransport.emitMessage(snapshotEnvelope('player-1', []));

    fakeTransport.emitMessage(
      JSON.stringify({
        from: 'hub',
        op: { kind: 'presence', data: { kind: 'poke', feature: 'players' } },
      })
    );
    fakeTransport.emitMessage(
      JSON.stringify({
        from: 'conn-dm',
        op: { kind: 'presence', data: laserPayload },
      })
    );
    fakeTransport.emitMessage(
      JSON.stringify({
        from: 'conn-dm',
        op: {
          kind: 'presence',
          data: { kind: 'ping', x: 100, y: 200, color: '#F4C430' },
        },
      })
    );

    // Count what each overlay draws: pings fill a center dot, lasers stroke
    // segments — a mock 2d context distinguishes them.
    const counts = () => {
      let fills = 0;
      let strokes = 0;
      const ctx = {
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(() => (strokes += 1)),
        fill: vi.fn(() => (fills += 1)),
        globalAlpha: 1,
        strokeStyle: '',
        fillStyle: '',
        lineWidth: 0,
        lineCap: '',
        lineJoin: '',
      } as unknown as CanvasRenderingContext2D;
      for (const draw of [...overlays]) draw(ctx);
      return { fills, strokes };
    };

    expect(pokes).toEqual(['players']); // poke parsing undisturbed
    const drawn = counts();
    expect(drawn.fills).toBe(1); // exactly one ping pulse
    expect(drawn.strokes).toBeGreaterThan(0); // laser trail rendered
    // Ephemerality: presence never touches the element store.
    expect(store.snapshot()).toEqual([]);

    // Presence-leave clears both overlays for that sender immediately.
    fakeTransport.emitMessage(
      JSON.stringify({ from: 'conn-dm', op: { kind: 'presence-leave' } })
    );
    const afterLeave = counts();
    expect(afterLeave.fills).toBe(0);
    expect(afterLeave.strokes).toBe(0);

    cleanupPings();
    cleanupLasers();
    expect(overlays).toHaveLength(0);
    conn.stop();
  });

  it('presence unsubscribe stops delivery', async () => {
    const seen: unknown[] = [];
    const conn = await startConnection();
    const unsubscribe = conn.onPresence((_from, data) => seen.push(data));
    fakeTransport.emitMessage(snapshotEnvelope('dm-1', []));

    fakeTransport.emitMessage(
      JSON.stringify({
        from: 'conn-1',
        op: { kind: 'presence', data: laserPayload },
      })
    );
    expect(seen).toEqual([laserPayload]);

    unsubscribe();
    fakeTransport.emitMessage(
      JSON.stringify({
        from: 'conn-1',
        op: { kind: 'presence', data: laserPayload },
      })
    );
    expect(seen).toEqual([laserPayload]);
    conn.stop();
  });
});
