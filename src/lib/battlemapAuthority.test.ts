import { cleanup } from '@testing-library/react';
import {
  createShape,
  ElementStore,
  type CanvasElement,
} from '@fieldnotes/core';
import type { AuthorityClientStatus } from '@fieldnotes/sync';
import { FogManager } from '@fieldnotes/vtt';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authority = vi.hoisted(() => {
  let listener: (() => void) | null = null;
  let state: { status: string; document: unknown; operations?: unknown[] } = {
    status: 'connecting',
    document: null,
    operations: [],
  };
  const submit = vi.fn(() => ({ status: 'admitted', clientOperationId: 'op' }));
  return {
    submit,
    reset() {
      listener = null;
      state = { status: 'connecting', document: null, operations: [] };
      submit.mockReset();
      submit.mockImplementation(() => ({
        status: 'admitted',
        clientOperationId: 'op',
      }));
    },
    install(document: unknown) {
      state = { status: 'live', document, operations: [] };
      listener?.();
    },
    installState(next: {
      status: string;
      document: unknown;
      operations: unknown[];
    }) {
      state = next;
      listener?.();
    },
    connection: {
      getState: () => state,
      subscribe: (next: () => void) => {
        listener = next;
        return () => {
          listener = null;
        };
      },
      stop: vi.fn(),
      submit,
      captureBarrier: vi.fn(),
      waitForAcknowledgements: vi.fn(),
      requestCheckpoint: vi.fn(),
      releaseBarrier: vi.fn(() => true),
      releaseOperation: vi.fn(() => true),
    },
  };
});

vi.mock('@fieldnotes/sync', async importOriginal => ({
  ...(await importOriginal<typeof import('@fieldnotes/sync')>()),
  createManagedAuthorityConnection: () => authority.connection,
}));

import { serializeAuthorityFrame } from '@fieldnotes/sync';
import { createTableRosterCanvas } from '@/components/ui/campaign/table/tableRosterCanvas';
import { pinGridToMapLayer } from '@/components/ui/campaign/location-map/gridPin';
import {
  fieldnotesElementRegistry,
  getVttGridController,
} from '@/lib/fieldnotesVtt';
import {
  mountRealViewport,
  type RealViewportHarness,
} from '@/test/realViewport';
import {
  createManagedBattleMapAuthorityConnection,
  HELD_EDIT_LIMIT,
  HELD_OVERFLOW_MESSAGE,
  HELD_STALE_MESSAGE,
  withoutUndefined,
} from './battlemapAuthority';

const definition = {
  version: 1 as const,
  generation: 'fog-generation',
  bounds: { x: 0, y: 0, w: 1024, h: 1024 },
  cellSize: 8,
  tileCells: 128 as const,
  base: 'covered' as const,
};

function documentWithFog(metaVersion: number, tiles: unknown[] = []) {
  return {
    elements: [],
    layers: [],
    extensions: {
      fog: {
        pluginName: 'fog',
        version: 1,
        data: {
          meta: { version: metaVersion, editor: 'remote', definition },
          tiles,
        },
      },
    },
  };
}

function start(
  fog: FogManager,
  callbacks: {
    onStatus?: (status: AuthorityClientStatus) => void;
    onDiagnostic?: (message: string) => void;
  } = {}
) {
  return createManagedBattleMapAuthorityConnection({
    relayUrl: 'wss://relay.example',
    campaignCode: 'CODE',
    battleMapId: 'scene-a',
    clientId: 'dm-a',
    store: new ElementStore(),
    tokenRequest: { role: 'dm', battleMapId: 'map-a', sceneId: 'scene-a' },
    fog: { manager: fog },
    mint: async () => ({ token: 'token', authority: 1, room: 'room-a' }),
    onStatus: callbacks.onStatus,
    onDiagnostic: callbacks.onDiagnostic,
  });
}

describe('managed authority fog sequencing', () => {
  beforeEach(() => authority.reset());

  it('advances a local metadata edit past restored high metadata', () => {
    const fog = new FogManager();
    const connection = start(fog);
    authority.install(documentWithFog(700));

    fog.reset('revealed');

    expect(authority.submit).toHaveBeenLastCalledWith({
      kind: 'fog-meta',
      record: expect.objectContaining({ version: 701, editor: 'dm-a' }),
    });
    connection.stop();
  });

  it('publishes a newer tombstone when covering a restored tile back to base', () => {
    const source = new FogManager({ idFactory: () => definition.generation });
    source.initialize({
      bounds: definition.bounds,
      base: definition.base,
      cellSize: definition.cellSize,
    });
    source.applyRegion(
      { kind: 'rectangle', from: { x: 0, y: 0 }, to: { x: 1024, y: 1024 } },
      'reveal'
    );
    const restored = source.getState()!;
    const tile = restored.tiles[0]!;
    const fog = new FogManager();
    const connection = start(fog);
    authority.install(
      documentWithFog(4, [
        {
          generation: definition.generation,
          x: tile.x,
          y: tile.y,
          version: 900,
          editor: 'remote',
          data: tile.data,
        },
      ])
    );

    fog.applyRegion(
      { kind: 'rectangle', from: { x: 0, y: 0 }, to: { x: 1024, y: 1024 } },
      'conceal'
    );

    expect(fog.getState()?.tiles).toEqual([]);
    expect(authority.submit).toHaveBeenLastCalledWith({
      kind: 'fog-patch',
      generation: definition.generation,
      tiles: [
        {
          generation: definition.generation,
          x: tile.x,
          y: tile.y,
          version: 901,
          editor: 'dm-a',
        },
      ],
    });
    connection.stop();
  });

  it('fails closed visibly when restored fog exhausts safe sequencing', () => {
    const source = new FogManager({ idFactory: () => definition.generation });
    source.initialize({
      bounds: definition.bounds,
      base: definition.base,
      cellSize: definition.cellSize,
    });
    source.applyRegion(
      { kind: 'rectangle', from: { x: 0, y: 0 }, to: { x: 1024, y: 1024 } },
      'reveal'
    );
    const tile = source.getState()!.tiles[0]!;
    const fog = new FogManager();
    const statuses: string[] = [];
    const diagnostic = vi.fn();
    const connection = start(fog, {
      onStatus: status => statuses.push(status),
      onDiagnostic: diagnostic,
    });
    authority.install(
      documentWithFog(4, [
        {
          generation: definition.generation,
          x: tile.x,
          y: tile.y,
          version: Number.MAX_SAFE_INTEGER,
          editor: 'remote',
          data: tile.data,
        },
      ])
    );
    authority.submit.mockClear();

    fog.reset('covered');

    expect(authority.submit).not.toHaveBeenCalled();
    expect(statuses).toContain('denied');
    expect(diagnostic).toHaveBeenCalledWith(
      expect.stringMatching(/fog version.*safe integer/i)
    );
    connection.stop();
  });
});

describe('rejected player edits', () => {
  beforeEach(() => authority.reset());

  const confirmed = {
    id: 'party-a',
    type: 'shape',
    shape: 'ellipse',
    position: { x: 10, y: 10 },
    size: { w: 50, h: 50 },
    zIndex: 0,
    locked: false,
    layerId: 'player-player-a',
    strokeColor: '#000',
    strokeWidth: 2,
    fillColor: '#f00',
    tokenKind: 'player',
    characterId: 'player-a',
    sceneMemberId: 'member-a',
    ownerId: 'dm-a',
  };
  const documentWith = (elements: unknown[]) => ({
    elements,
    layers: [],
    extensions: { fog: { pluginName: 'fog', version: 1, data: null } },
  });
  const rejected = (id: string, mutation: unknown) => ({
    clientOperationId: id,
    status: 'rejected',
    proposal: { mutation },
  });

  function startPlayer(role: 'player' | 'dm' = 'player') {
    const store = new ElementStore();
    createManagedBattleMapAuthorityConnection({
      relayUrl: 'wss://relay.example',
      campaignCode: 'CODE',
      battleMapId: 'map-a',
      clientId: 'player-a',
      store,
      tokenRequest:
        role === 'player'
          ? { role, battleMapId: 'map-a', playerId: 'player-a' }
          : { role, battleMapId: 'map-a', dmId: 'player-a' },
      mint: async () => ({ token: 'token', authority: 1, room: 'room-a' }),
    });
    return store;
  }

  it('restores a rejected resize from the confirmed document without resubmitting', () => {
    const store = startPlayer();
    const document = documentWith([confirmed]);
    authority.installState({ status: 'live', document, operations: [] });
    store.update('party-a', {
      size: { w: 400, h: 400 },
      rotation: 1,
    } as never);
    authority.submit.mockClear();
    authority.installState({
      status: 'live',
      document,
      operations: [
        rejected('op-resize', {
          kind: 'upsert',
          element: { ...confirmed, size: { w: 400, h: 400 } },
        }),
      ],
    });
    const restored = store.getById('party-a') as unknown as Record<
      string,
      unknown
    >;
    expect(restored.size).toEqual({ w: 50, h: 50 });
    expect(restored.rotation).toBeUndefined();
    expect(restored.ownerId).toBeUndefined();
    expect(authority.submit).not.toHaveBeenCalled();
  });

  it('restores a rejected delete of a bound token', () => {
    const store = startPlayer();
    const document = documentWith([confirmed]);
    authority.installState({ status: 'live', document, operations: [] });
    store.remove('party-a');
    authority.installState({
      status: 'live',
      document,
      operations: [rejected('op-remove', { kind: 'remove', id: 'party-a' })],
    });
    expect(store.getById('party-a')).toMatchObject({
      tokenKind: 'player',
      sceneMemberId: 'member-a',
    });
  });

  it('leaves DM edits untouched (the DM keeps its local draft)', () => {
    const store = startPlayer('dm');
    const document = documentWith([confirmed]);
    authority.installState({ status: 'live', document, operations: [] });
    store.update('party-a', { size: { w: 400, h: 400 } } as never);
    authority.installState({
      status: 'live',
      document,
      operations: [
        rejected('op-dm', {
          kind: 'upsert',
          element: { ...confirmed, size: { w: 400, h: 400 } },
        }),
      ],
    });
    expect(
      (store.getById('party-a') as unknown as { size: unknown }).size
    ).toEqual({ w: 400, h: 400 });
  });
});

/**
 * PR07 acceptance A1: the SDK journal admits a proposal only if its frame
 * serializes as bounded JSON; an own `undefined` property (the wrapped
 * `vtt:grid` envelope carries `groupId`/`rotation: undefined`; every unset
 * patch writes `key: undefined`) made the real client refuse it silently.
 * The mocked connection applies the real SDK frame serializer.
 */
describe('A1 element submissions use JSON semantics', () => {
  const harnesses: RealViewportHarness[] = [];
  const refusedOnce = { value: false };
  beforeEach(() => {
    authority.reset();
    refusedOnce.value = false;
    authority.submit.mockImplementation(((mutation: unknown) => {
      if (refusedOnce.value) {
        refusedOnce.value = false;
        return { status: 'refused', reason: 'invalid' };
      }
      try {
        serializeAuthorityFrame({
          protocol: 'authority:1',
          kind: 'propose',
          generation: '723e4567-e89b-42d3-a456-426614174000',
          clientOperationId:
            'fn1:1791471900938:16ce41d4b9a87fa034d57dcaaad8e04f',
          mutation,
        } as never);
      } catch {
        return { status: 'refused', reason: 'invalid' };
      }
      return { status: 'admitted', clientOperationId: 'op' };
    }) as never);
  });
  afterEach(() => {
    for (const harness of harnesses.splice(0)) harness.destroy();
    cleanup();
  });

  function startDm(store: ElementStore, onDiagnostic = vi.fn()) {
    const connection = createManagedBattleMapAuthorityConnection({
      relayUrl: 'wss://relay.example',
      campaignCode: 'CODE',
      battleMapId: 'scene-a',
      clientId: 'dm-a',
      store,
      tokenRequest: { role: 'dm', battleMapId: 'map-a', sceneId: 'scene-a' },
      mint: async () => ({ token: 'token', authority: 1, room: 'room-a' }),
      onDiagnostic,
    });
    authority.install({
      elements: [],
      layers: [],
      extensions: { fog: { pluginName: 'fog', version: 1, data: null } },
    });
    return { connection, onDiagnostic };
  }
  const upserts = () =>
    (authority.submit.mock.calls as unknown as Array<[Record<string, unknown>]>)
      .map(([mutation]) => mutation)
      .filter(mutation => mutation.kind === 'upsert')
      .map(mutation => mutation.element as Record<string, unknown>);
  const results = () =>
    authority.submit.mock.results.map(
      result => (result.value as { status: string }).status
    );
  const hasUndefined = (value: unknown): boolean =>
    value !== null &&
    typeof value === 'object' &&
    Object.values(value).some(
      child => child === undefined || hasUndefined(child)
    );

  it('submits (and the SDK admits) the real grid from GridController.add and the map-layer pin', () => {
    const harness = mountRealViewport({
      elementRegistry: fieldnotesElementRegistry,
    });
    harnesses.push(harness);
    const { connection, onDiagnostic } = startDm(harness.viewport.store);
    getVttGridController(harness.viewport).add({
      gridType: 'square',
      cellSize: 50,
    });
    pinGridToMapLayer(harness.viewport);
    const grids = upserts().filter(element => element.type === 'extension');
    expect(grids.length).toBeGreaterThanOrEqual(2);
    expect(grids.at(-1)).toMatchObject({
      extensionType: 'vtt:grid',
      layerId: 'layer-map',
      locked: true,
      data: expect.objectContaining({ gridType: 'square', cellSize: 50 }),
    });
    for (const grid of grids) expect(hasUndefined(grid)).toBe(false);
    expect(results().every(status => status === 'admitted')).toBe(true);
    expect(onDiagnostic).not.toHaveBeenCalled();
    // The store's own element is never rewritten by the submission.
    const local = harness.viewport.store
      .getAll()
      .find(element => element.type === 'extension') as unknown as Record<
      string,
      unknown
    >;
    expect(Object.hasOwn(local, 'rotation')).toBe(true);
    connection.stop();
  });

  it('submits an unset patch without the key (control conversion and P10 digital)', () => {
    const store = new ElementStore();
    const { connection } = startDm(store);
    store.add({
      id: 'token-a',
      type: 'shape',
      shape: 'ellipse',
      position: { x: 0, y: 0 },
      size: { w: 10, h: 10 },
      zIndex: 1,
      locked: false,
      layerId: 'annotations',
      strokeColor: '#000',
      strokeWidth: 1,
      fillColor: '#fff',
      tokenKind: 'combatant',
      entityId: 'member-a',
      sceneMemberId: 'member-a',
      tableRepresentation: 'physical',
    } as unknown as CanvasElement);
    const canvas = createTableRosterCanvas({
      viewport: { store } as never,
      connection: null,
      onArm: vi.fn(),
    });
    canvas.applyTokenPatch('token-a', {
      set: { tokenKind: 'player', characterId: 'legacy-a' },
      unset: ['entityId'],
    });
    canvas.applyTokenPatch('token-a', {
      set: {},
      unset: ['tableRepresentation'],
    });
    const [converted, digital] = upserts().slice(-2);
    expect(Object.hasOwn(converted!, 'entityId')).toBe(false);
    expect(converted).toMatchObject({ tokenKind: 'player' });
    expect(Object.hasOwn(digital!, 'tableRepresentation')).toBe(false);
    expect(results().slice(-2)).toEqual(['admitted', 'admitted']);
    connection.stop();
  });

  it('surfaces a refused submission through onDiagnostic without the payload', () => {
    const store = new ElementStore();
    const { connection, onDiagnostic } = startDm(store);
    refusedOnce.value = true;
    store.add({
      id: 'secret-note-id',
      type: 'shape',
      shape: 'rectangle',
      position: { x: 0, y: 0 },
      size: { w: 1, h: 1 },
      zIndex: 0,
      locked: false,
      layerId: 'annotations',
      strokeColor: '#000',
      strokeWidth: 1,
      fillColor: '#fff',
    } as unknown as CanvasElement);
    expect(onDiagnostic).toHaveBeenCalledTimes(1);
    const message = String(onDiagnostic.mock.calls[0]![0]);
    expect(message).toMatch(/not sent/u);
    expect(message).not.toContain('secret-note-id');
    connection.stop();
  });

  it('turns array holes into null, keeps non-plain objects as-is and an own __proto__ key as data (review 02 N2)', () => {
    expect(withoutUndefined([, 1])).toEqual([null, 1]);
    const date = new Date(0);
    const map = new Map([['a', 1]]);
    const out = withoutUndefined({ date, map, keep: 1, drop: undefined });
    expect(out.date).toBe(date);
    expect(out.map).toBe(map);
    expect(Object.hasOwn(out, 'drop')).toBe(false);
    const parsed = JSON.parse('{"__proto__":{"x":1},"a":2}') as Record<
      string,
      unknown
    >;
    parsed.b = undefined;
    const safe = withoutUndefined(parsed);
    expect(Object.hasOwn(safe, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(safe)).toBe(Object.prototype);
    expect((safe as { x?: unknown }).x).toBeUndefined();
    expect(Object.hasOwn(safe, 'b')).toBe(false);
    const bare = Object.assign(Object.create(null) as object, {
      a: 1,
      b: undefined,
    });
    expect(withoutUndefined(bare)).toEqual({ a: 1 });
  });

  it('holds edits made before the room is live, keeps them on screen over the first snapshot, and admits them in order once live (PR08 DD1)', () => {
    const store = new ElementStore();
    const onDiagnostic = vi.fn();
    const connection = createManagedBattleMapAuthorityConnection({
      relayUrl: 'wss://relay.example',
      campaignCode: 'CODE',
      battleMapId: 'scene-a',
      clientId: 'dm-a',
      store,
      tokenRequest: { role: 'dm', battleMapId: 'map-a', sceneId: 'scene-a' },
      mint: async () => ({ token: 'token', authority: 1, room: 'room-a' }),
      onDiagnostic,
    });
    // Still connecting: the SDK would refuse (`not-ready`) or strand a draft.
    const token = {
      id: 'early',
      type: 'shape',
      shape: 'ellipse',
      position: { x: 1, y: 1 },
      size: { w: 4, h: 4 },
      zIndex: 1,
      locked: false,
      layerId: 'layer-a',
    } as unknown as CanvasElement;
    store.add(token);
    connection.publishLayerRemove('layer-x');
    expect(authority.submit).not.toHaveBeenCalled();
    expect(onDiagnostic).not.toHaveBeenCalled();
    // The room goes live with a checkpoint that lacks the early token.
    authority.install({ elements: [], layers: [], extensions: {} });
    expect(store.getById('early')).toBeDefined();
    const admitted = (
      authority.submit.mock.calls as unknown as Array<[{ kind: string }]>
    ).map(([mutation]) => mutation.kind);
    expect(admitted).toEqual(['upsert', 'layer-remove']);
    // Exactly once: a later change does not resend them.
    authority.install({ elements: [], layers: [], extensions: {} });
    expect(authority.submit).toHaveBeenCalledTimes(2);
    connection.stop();
  });

  const dmConnection = (onDiagnostic = vi.fn()) => {
    const store = new ElementStore();
    const connection = createManagedBattleMapAuthorityConnection({
      relayUrl: 'wss://relay.example',
      campaignCode: 'CODE',
      battleMapId: 'scene-a',
      clientId: 'dm-a',
      store,
      tokenRequest: { role: 'dm', battleMapId: 'map-a', sceneId: 'scene-a' },
      mint: async () => ({ token: 'token', authority: 1, room: 'room-a' }),
      onDiagnostic,
    });
    return { store, connection, onDiagnostic };
  };
  const emptyDoc = () => ({ elements: [], layers: [], extensions: {} });
  const shape = (id: string, x = 0) =>
    ({
      ...createShape({ position: { x, y: 0 }, size: { w: 4, h: 4 } }),
      id,
    }) as CanvasElement;
  const sent = () =>
    (
      authority.submit.mock.calls as unknown as Array<
        [{ kind: string; id?: string; element?: { id: string } }]
      >
    ).map(([mutation]) => mutation);

  it('EE3: the flush guard keeps order when a nested notify flushes while the first edit waits', () => {
    const { connection } = dmConnection();
    connection.publishLayerRemove('a');
    connection.publishLayerRemove('b');
    let first = true;
    const results: string[] = [];
    authority.submit.mockImplementation(((mutation: { id: string }) => {
      if (first) {
        first = false;
        // The SDK notifies inside submit, then this attempt hits capacity.
        authority.installState({
          status: 'live',
          document: emptyDoc(),
          operations: [],
        });
        results.push(`${mutation.id}:wait`);
        return { status: 'refused', reason: 'capacity' };
      }
      results.push(`${mutation.id}:sent`);
      return { status: 'admitted', clientOperationId: mutation.id };
    }) as never);
    authority.install(emptyDoc());
    authority.install(emptyDoc());
    expect(results).toEqual(['a:wait', 'a:sent', 'b:sent']);
    authority.submit.mockImplementation((() => ({
      status: 'admitted',
      clientOperationId: 'op',
    })) as never);
    connection.stop();
  });

  it('EE2: more than 64 held moves of one token become one upsert with the final position', () => {
    const { store, connection, onDiagnostic } = dmConnection();
    store.add(shape('t', 0));
    for (let x = 1; x <= 100; x += 1)
      store.update('t', { position: { x, y: 0 } });
    expect(authority.submit).not.toHaveBeenCalled();
    authority.install(emptyDoc());
    expect(sent()).toEqual([
      expect.objectContaining({
        kind: 'upsert',
        element: expect.objectContaining({
          id: 't',
          position: { x: 100, y: 0 },
        }),
      }),
    ]);
    expect(onDiagnostic).not.toHaveBeenCalled();
    connection.stop();
  });

  it('EE2: a remove supersedes held writes of the same element', () => {
    const { store, connection } = dmConnection();
    store.add(shape('gone'));
    store.add(shape('kept'));
    store.remove('gone');
    authority.install(emptyDoc());
    expect(sent().map(m => `${m.kind}:${m.element?.id ?? m.id}`)).toEqual([
      'upsert:kept',
      'remove:gone',
    ]);
    connection.stop();
  });

  it('EE2: the held queue is capped with a visible notice', () => {
    const { store, connection, onDiagnostic } = dmConnection();
    for (let index = 0; index <= HELD_EDIT_LIMIT; index += 1)
      store.add(shape(`s-${index}`));
    expect(onDiagnostic).toHaveBeenCalledWith(HELD_OVERFLOW_MESSAGE);
    authority.install(emptyDoc());
    expect(sent()).toHaveLength(HELD_EDIT_LIMIT);
    connection.stop();
  });

  it('EE2: capacity after live waits and retries on the next change in the same generation', () => {
    const { store, connection } = dmConnection();
    authority.installState({
      status: 'live',
      document: emptyDoc(),
      operations: [],
      generation: 'g1',
    } as never);
    authority.submit.mockImplementationOnce((() => ({
      status: 'refused',
      reason: 'capacity',
    })) as never);
    store.add(shape('busy'));
    expect(authority.submit).toHaveBeenCalledTimes(1);
    authority.installState({
      status: 'live',
      document: emptyDoc(),
      operations: [],
      generation: 'g1',
    } as never);
    expect(sent().map(m => m.element?.id)).toEqual(['busy', 'busy']);
    connection.stop();
  });

  it('EE1: a capacity-held edit is not replayed into another generation; it is dropped visibly', () => {
    const { store, connection, onDiagnostic } = dmConnection();
    authority.installState({
      status: 'live',
      document: emptyDoc(),
      operations: [],
      generation: 'g1',
    } as never);
    authority.submit.mockImplementationOnce((() => ({
      status: 'refused',
      reason: 'capacity',
    })) as never);
    store.add(shape('stale'));
    authority.installState({
      status: 'live',
      document: emptyDoc(),
      operations: [],
      generation: 'g2',
    } as never);
    expect(authority.submit).toHaveBeenCalledTimes(1);
    expect(onDiagnostic).toHaveBeenCalledWith(HELD_STALE_MESSAGE);
    connection.stop();
  });

  it('EE1: after the first live state, offline edits go to the SDK as drafts and are not replayed on reconnect', () => {
    const { store, connection } = dmConnection();
    authority.install(emptyDoc());
    authority.installState({
      status: 'offline',
      document: emptyDoc(),
      operations: [],
    });
    store.add(shape('offline-edit'));
    // Given to the SDK at once (it keeps a generation-tagged draft).
    expect(authority.submit).toHaveBeenCalledTimes(1);
    authority.installState({
      status: 'live',
      document: emptyDoc(),
      operations: [],
    });
    authority.install(emptyDoc());
    // No automatic replay by RollKeeper.
    expect(authority.submit).toHaveBeenCalledTimes(1);
    connection.stop();
  });

  it('EE1: a live DM edit goes straight to the SDK, as before', () => {
    const { store, connection } = dmConnection();
    authority.install(emptyDoc());
    store.add(shape('live-edit'));
    expect(sent()).toEqual([
      expect.objectContaining({
        kind: 'upsert',
        element: expect.objectContaining({ id: 'live-edit' }),
      }),
    ]);
    connection.stop();
  });

  it('releases settled operations after each change, never draft, pending or uncertain work, and pinned work only after its barrier (J1)', () => {
    const store = new ElementStore();
    const connection = createManagedBattleMapAuthorityConnection({
      relayUrl: 'wss://relay.example',
      campaignCode: 'CODE',
      battleMapId: 'scene-a',
      clientId: 'dm-a',
      store,
      tokenRequest: { role: 'dm', battleMapId: 'map-a', sceneId: 'scene-a' },
      mint: async () => ({ token: 'token', authority: 1, room: 'room-a' }),
    });
    const release = authority.connection.releaseOperation;
    release.mockClear();
    const op = (clientOperationId: string, status: string) => ({
      clientOperationId,
      status,
      proposal: { mutation: { kind: 'remove', id: clientOperationId } },
    });
    // 'accepted-pinned' is held by a barrier: the SDK refuses to release it.
    release.mockImplementation(
      ((id: string) => id !== 'accepted-pinned') as never
    );
    authority.installState({
      status: 'live',
      document: { elements: [], layers: [], extensions: {} },
      operations: [
        op('accepted', 'accepted'),
        op('accepted-pinned', 'accepted'),
        op('pending', 'pending'),
        op('draft', 'draft'),
        op('uncertain', 'uncertain'),
        op('rejected', 'rejected'),
      ],
    });
    const calls = () =>
      (release.mock.calls as unknown as Array<[string, unknown?]>).map(
        ([id, options]) => [id, options]
      );
    expect(calls()).toEqual([
      ['accepted', undefined],
      ['accepted-pinned', undefined],
      ['rejected', { discardDraft: true }],
    ]);
    // Releasing the barrier frees the pinned operation at once.
    release.mockClear();
    release.mockImplementation((() => true) as never);
    connection.releaseBarrier?.({} as never);
    expect(calls()).toEqual(
      expect.arrayContaining([['accepted-pinned', undefined]])
    );
    expect(calls().map(([id]) => id)).not.toContain('pending');
    expect(calls().map(([id]) => id)).not.toContain('draft');
    expect(calls().map(([id]) => id)).not.toContain('uncertain');
    connection.stop();
  });

  it('normalizes layer and fog-meta records; stopped stays silent, capacity waits and retries; clear forwards expectedState (review 02 N4, EE2)', () => {
    const fog = new FogManager();
    const onDiagnostic = vi.fn();
    const store = new ElementStore();
    const connection = createManagedBattleMapAuthorityConnection({
      relayUrl: 'wss://relay.example',
      campaignCode: 'CODE',
      battleMapId: 'scene-a',
      clientId: 'dm-a',
      store,
      tokenRequest: { role: 'dm', battleMapId: 'map-a', sceneId: 'scene-a' },
      fog: { manager: fog },
      mint: async () => ({ token: 'token', authority: 1, room: 'room-a' }),
      onDiagnostic,
    });
    authority.install({ ...documentWithFog(3), casToken: 'cas-token-1' });
    connection.publishLayerUpsert({
      id: 'layer-x',
      name: 'X',
      visible: true,
      locked: false,
      order: 1,
      opacity: 1,
      note: undefined,
    } as never);
    const layer = (
      authority.submit.mock.calls.at(-1) as unknown as [
        { layer: Record<string, unknown> },
      ]
    )[0];
    expect(Object.hasOwn(layer.layer, 'note')).toBe(false);
    const state = fog.getState()!;
    vi.spyOn(fog, 'getState').mockReturnValue({
      ...state,
      definition: { ...state.definition, note: undefined },
    } as never);
    fog.reset('revealed');
    const meta = (
      authority.submit.mock.calls.at(-1) as unknown as [
        { kind: string; record: { definition: Record<string, unknown> } },
      ]
    )[0];
    expect(meta.kind).toBe('fog-meta');
    expect(Object.hasOwn(meta.record.definition, 'note')).toBe(false);
    // `stopped` stays silent; `not-ready` is held (PR08 DD1, tested below).
    authority.submit.mockImplementationOnce((() => ({
      status: 'refused',
      reason: 'stopped',
    })) as never);
    connection.publishLayerRemove('layer-x');
    expect(onDiagnostic).not.toHaveBeenCalled();
    authority.submit.mockImplementationOnce((() => ({
      status: 'refused',
      reason: 'capacity',
    })) as never);
    connection.publishLayerRemove('layer-z');
    // EE2: capacity is transient (J1 releases settled work): it waits.
    expect(onDiagnostic).not.toHaveBeenCalled();
    authority.install({ ...documentWithFog(3), casToken: 'cas-token-1' });
    expect(authority.submit).toHaveBeenLastCalledWith({
      kind: 'layer-remove',
      id: 'layer-z',
      version: expect.any(Number),
      editor: 'dm-a',
    });
    store.clear();
    expect(authority.submit).toHaveBeenLastCalledWith(
      { kind: 'clear' },
      { expectedState: 'cas-token-1' }
    );
    connection.stop();
  });

  it('normalizes with JSON semantics: drops undefined properties, keeps null, never mutates', () => {
    const input = {
      a: 1,
      b: undefined,
      c: null,
      nested: { d: undefined, e: [1, undefined, { f: undefined, g: null }] },
    };
    const frozen = structuredClone(input);
    expect(withoutUndefined(input)).toEqual({
      a: 1,
      c: null,
      nested: { e: [1, null, { g: null }] },
    });
    expect(input).toEqual(frozen);
    expect(Object.hasOwn(input, 'b')).toBe(true);
  });
});
