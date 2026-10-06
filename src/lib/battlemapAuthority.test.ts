import { ElementStore } from '@fieldnotes/core';
import type { AuthorityClientStatus } from '@fieldnotes/sync';
import { FogManager } from '@fieldnotes/vtt';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authority = vi.hoisted(() => {
  let listener: (() => void) | null = null;
  let state: { status: string; document: unknown; operations?: unknown[] } = {
    status: 'connecting',
    document: null,
  };
  const submit = vi.fn(() => ({ status: 'admitted', clientOperationId: 'op' }));
  return {
    submit,
    reset() {
      listener = null;
      state = { status: 'connecting', document: null };
      submit.mockClear();
    },
    install(document: unknown) {
      state = { status: 'live', document };
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
      releaseBarrier: vi.fn(),
    },
  };
});

vi.mock('@fieldnotes/sync', async importOriginal => ({
  ...(await importOriginal<typeof import('@fieldnotes/sync')>()),
  createManagedAuthorityConnection: () => authority.connection,
}));

import { createManagedBattleMapAuthorityConnection } from './battlemapAuthority';

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
