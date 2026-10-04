import { ElementStore } from '@fieldnotes/core';
import type { AuthorityClientStatus } from '@fieldnotes/sync';
import { FogManager } from '@fieldnotes/vtt';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authority = vi.hoisted(() => {
  let listener: (() => void) | null = null;
  let state: { status: string; document: unknown } = {
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
