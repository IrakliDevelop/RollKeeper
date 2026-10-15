import { createFogPluginHandle, FogManager } from '@fieldnotes/vtt';
import { createFogAuthorityClientExtension } from '@fieldnotes/vtt/sync';
import { describe, expect, it, vi } from 'vitest';

import { validateAuthorityState } from '@/lib/tableServer/authorityAdmin';

import { canvasStateToAuthorityState } from './authorityLifecycle';
import {
  restoreAuthorityFork,
  sceneCheckpointToViewportState,
} from './checkpoint';
import { authorityFogToEditorFog, editorFogToAuthorityFog } from './fogShape';
import type { JsonObject } from './schema';

/** A covered map with two revealed areas, exactly as the editor exports it. */
function editorFog() {
  const manager = new FogManager();
  manager.initialize({
    bounds: { x: 0, y: 0, w: 4000, h: 3000 },
    base: 'covered',
    cellSize: 10,
  });
  manager.applyRegion(
    { kind: 'rectangle', from: { x: 2600, y: 100 }, to: { x: 3000, y: 400 } },
    'reveal'
  );
  manager.applyRegion(
    { kind: 'rectangle', from: { x: 100, y: 1400 }, to: { x: 500, y: 1500 } },
    'reveal'
  );
  const state = manager.getState()!;
  expect(state.tiles.length).toBeGreaterThan(1);
  return JSON.parse(JSON.stringify(state)) as {
    definition: { generation: string };
    tiles: Array<{ x: number; y: number; data: string }>;
  };
}

const fogValid = (data: unknown) =>
  createFogAuthorityClientExtension().validate(data);

function editorCanvas(fogData: unknown): JsonObject {
  return {
    version: 4,
    camera: { position: { x: 0, y: 0 }, zoom: 1 },
    elements: [],
    layers: [
      {
        id: 'layer-map',
        name: 'Map',
        visible: true,
        locked: true,
        order: 0,
        opacity: 1,
      },
    ],
    activeLayerId: 'layer-map',
    extensions: { fog: { version: 1, data: fogData } },
  } as JsonObject;
}

describe('editor fog → authority fog (repair 10 G1)', () => {
  it('converts the editor shape into a valid, sorted authority snapshot', () => {
    const fog = editorFog();
    const converted = editorFogToAuthorityFog(
      { ...fog, tiles: [...fog.tiles].reverse() },
      'dm-1'
    ) as { meta: unknown; tiles: Array<{ x: number; y: number }> };
    expect(converted.meta).toEqual({
      version: 1,
      editor: 'dm-1',
      definition: fog.definition,
    });
    expect(converted.tiles).toEqual(
      [...fog.tiles]
        .sort((a, b) => (a.x !== b.x ? a.x - b.x : a.y - b.y))
        .map(tile => ({
          generation: fog.definition.generation,
          x: tile.x,
          y: tile.y,
          version: 1,
          editor: 'dm-1',
          data: tile.data,
        }))
    );
    expect(fogValid(converted)).toBe(true);
  });

  it('keeps a tile without data as a data-less record and drops malformed tiles', () => {
    const fog = editorFog();
    const [first] = fog.tiles;
    const converted = editorFogToAuthorityFog(
      {
        ...fog,
        tiles: [
          { x: first!.x, y: first!.y },
          { x: 'nope', y: 0, data: first!.data },
        ],
      },
      'dm-1'
    ) as { tiles: unknown[] };
    expect(converted.tiles).toEqual([
      {
        generation: fog.definition.generation,
        x: first!.x,
        y: first!.y,
        version: 1,
        editor: 'dm-1',
      },
    ]);
    expect(fogValid(converted)).toBe(true);
  });

  it('passes null, missing and authority-shaped fog through', () => {
    expect(editorFogToAuthorityFog(null, 'dm-1')).toBeNull();
    expect(editorFogToAuthorityFog(undefined, 'dm-1')).toBeNull();
    const authority = editorFogToAuthorityFog(editorFog(), 'dm-1');
    expect(editorFogToAuthorityFog(authority, 'other')).toEqual(authority);
  });

  it('makes a fogged editor canvas a state the server accepts (the Reapply and Go live 400)', async () => {
    const state = canvasStateToAuthorityState(
      editorCanvas(editorFog()),
      'dm-1'
    );
    expect(
      await validateAuthorityState(JSON.parse(JSON.stringify(state)))
    ).not.toBeNull();
    const unfogged = canvasStateToAuthorityState(editorCanvas(null), 'dm-1');
    expect(
      await validateAuthorityState(JSON.parse(JSON.stringify(unfogged)))
    ).not.toBeNull();
  });
});

describe('authority fog → editor fog (repair 10)', () => {
  it('a saved checkpoint opens with fog the editor fog plugin accepts', () => {
    const fog = editorFog();
    const authority = canvasStateToAuthorityState(editorCanvas(fog), 'dm-1');
    const viewport = sceneCheckpointToViewportState({
      protocolVersion: 1,
      generation: 'room-1',
      revision: 3,
      capturedAt: '2026-10-15T00:00:00.000Z',
      state: {
        ...authority,
        cursor: {
          generation: 'room-1',
          streamId: '0123456789abcdef0123456789abcdef',
          revision: 3,
        },
      } as JsonObject,
    });
    const data = (viewport.extensions as { fog: { data: unknown } }).fog.data;
    const handle = createFogPluginHandle(new FogManager());
    expect(() => handle.validateState!(data)).not.toThrow();
    expect(data).toEqual({
      definition: fog.definition,
      tiles: [...fog.tiles].sort((a, b) =>
        a.x !== b.x ? a.x - b.x : a.y - b.y
      ),
    });
  });

  it('a relay-shaped fog checkpoint used to reach the editor as is, which its fog plugin refuses', () => {
    const fog = editorFog();
    const relayFog = {
      meta: { version: 4, editor: 'dm-1', definition: fog.definition },
      tiles: fog.tiles.map(tile => ({
        generation: fog.definition.generation,
        ...tile,
        version: 4,
        editor: 'dm-1',
      })),
    };
    const viewport = sceneCheckpointToViewportState({
      protocolVersion: 1,
      generation: 'room-1',
      revision: 3,
      capturedAt: '2026-10-15T00:00:00.000Z',
      state: {
        elements: [],
        layers: [],
        extensions: { fog: { pluginName: 'fog', version: 1, data: relayFog } },
        cursor: {
          generation: 'room-1',
          streamId: '0123456789abcdef0123456789abcdef',
          revision: 3,
        },
      } as JsonObject,
    });
    const data = (viewport.extensions as { fog: { data: unknown } }).fog.data;
    expect(() =>
      createFogPluginHandle(new FogManager()).validateState!(data)
    ).not.toThrow();
  });

  it('round-trips and leaves editor-shaped and empty fog alone', () => {
    const fog = editorFog();
    expect(
      authorityFogToEditorFog(editorFogToAuthorityFog(fog, 'dm-1'))
    ).toEqual({
      definition: fog.definition,
      tiles: [...fog.tiles].sort((a, b) =>
        a.x !== b.x ? a.x - b.x : a.y - b.y
      ),
    });
    expect(authorityFogToEditorFog(fog)).toEqual(fog);
    expect(authorityFogToEditorFog(null)).toBeNull();
    expect(
      authorityFogToEditorFog({ meta: { version: 2, editor: 'dm' }, tiles: [] })
    ).toBeNull();
  });
});

describe('Reapply with a fogged draft (repair 10 G1)', () => {
  it('sends the room a state it accepts', async () => {
    const fetcher = vi.fn<typeof fetch>(async input =>
      String(input).endsWith('/checkpoint')
        ? Response.json({ generation: 'current', casToken: 'current-cas' })
        : Response.json({ status: 'provisioned' })
    );
    const result = await restoreAuthorityFork({
      campaignCode: 'CAMP',
      dmId: 'dm-1',
      sceneId: 'scene-1',
      lease: { holderSessionId: 'session-1', expectedFence: 1 },
      checkpoint: {
        protocolVersion: 1,
        generation: 'offline:scene-1',
        revision: 4,
        capturedAt: '2026-10-15T00:00:00.000Z',
        state: editorCanvas(editorFog()),
      },
      fetcher,
    });
    expect(result).toEqual({ status: 'restored' });
    const [, init] = fetcher.mock.calls.find(([input]) =>
      String(input).endsWith('/initialize-if-empty')
    )!;
    const body = JSON.parse(String(init?.body)) as { state: unknown };
    expect(await validateAuthorityState(body.state)).not.toBeNull();
  });
});
