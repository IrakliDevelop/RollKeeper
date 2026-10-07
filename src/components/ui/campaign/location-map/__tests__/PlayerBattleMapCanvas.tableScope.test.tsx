import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { SelectTool, Viewport, createShape } from '@fieldnotes/core';

import { PlayerBattleMapCanvas } from '../PlayerBattleMapCanvas';
import { PLAYER_BAND_ORDER } from '../layerContract';

/**
 * PR02 R4 client scope on the player surface: with Table v1 required, the
 * map-pinned side channels (marker details, loot, shop, fog appearance) stay
 * neutral until the server-resolved scene is this route's own map, a scene
 * change rebuilds the canvas with a visible notice, the own player band is
 * published only in its canonical form, and control-bearing tokens offer no
 * delete action. Harness copied from PlayerBattleMapCanvas.presence.test.tsx.
 */

vi.mock('@fieldnotes/react', async importOriginal => {
  const actual = await importOriginal<typeof import('@fieldnotes/react')>();
  return {
    ...actual,
    FieldNotesCanvas: vi.fn(() => null),
    useActiveTool: () => ['select', vi.fn()] as const,
  };
});

import { FieldNotesCanvas } from '@fieldnotes/react';

vi.mock('../BattleMapMinimap', () => ({ BattleMapMinimap: () => null }));
vi.mock('../BattleMapExportControl', () => ({
  BattleMapExportControl: () => null,
}));

const connections: Array<{
  stop: ReturnType<typeof vi.fn>;
  publishLayerUpsert: ReturnType<typeof vi.fn>;
}> = [];

vi.mock('@/lib/battlemapSync', () => ({
  createManagedBattleMapConnection: vi.fn(() => {
    const connection = {
      stop: vi.fn(),
      sendPresence: vi.fn(),
      publishLayerUpsert: vi.fn(),
      publishLayerRemove: vi.fn(),
      onPresence: vi.fn(() => () => {}),
      onPresenceLeave: vi.fn(() => () => {}),
    };
    connections.push(connection);
    return connection;
  }),
}));

vi.mock('../fog/fogAppearancePoll', () => ({
  applyFogAppearanceMetadata: vi.fn(),
  fetchAndApplyFogAppearance: vi.fn(),
  getAppliedFogAppearance: vi.fn(() => 'solid'),
  startFogAppearancePoll: vi.fn(() => () => {}),
}));

vi.mock('@/components/ui/campaign/location-map/laserSync', () => ({
  attachRemoteLaserTrails: vi.fn(() => () => {}),
}));
vi.mock('@/components/ui/campaign/location-map/pingSync', () => ({
  attachRemotePings: vi.fn(() => ({ dispose: vi.fn(), overlay: {} })),
}));
vi.mock('@/components/ui/campaign/location-map/measureSync', () => ({
  attachRemoteMeasurements: vi.fn(() => ({ dispose: vi.fn() })),
}));
vi.mock('@/components/ui/campaign/location-map/focusSync', () => ({
  attachFocusReceiver: vi.fn(() => ({ dispose: vi.fn() })),
}));
vi.mock('@/components/ui/campaign/location-map/pathSync', () => ({
  attachPathBroadcast: vi.fn(() => ({ setSharing: vi.fn(), dispose: vi.fn() })),
  attachRemotePaths: vi.fn(() => ({ dispose: vi.fn(), overlay: {} })),
}));
vi.mock('@/components/ui/campaign/location-map/awarenessSync', () => ({
  attachAwarenessSync: vi.fn(() => ({
    roster: {},
    cursorPeers: vi.fn(() => []),
    announce: vi.fn(),
    setShareCursor: vi.fn(),
    setShowPlayerCursors: vi.fn(),
    setIdentity: vi.fn(),
    dispose: vi.fn(),
  })),
}));

import { createManagedBattleMapConnection } from '@/lib/battlemapSync';
import {
  fetchAndApplyFogAppearance,
  startFogAppearancePoll,
} from '../fog/fogAppearancePoll';

const viewports: Viewport[] = [];

function stubCanvas(): void {
  const origCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = origCreate(tag);
    if (tag === 'canvas') {
      const canvas = el as HTMLCanvasElement;
      vi.spyOn(canvas, 'getContext').mockReturnValue({
        canvas,
        save: vi.fn(),
        restore: vi.fn(),
        scale: vi.fn(),
        translate: vi.fn(),
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        rect: vi.fn(),
        clip: vi.fn(),
        arc: vi.fn(),
        arcTo: vi.fn(),
        ellipse: vi.fn(),
        quadraticCurveTo: vi.fn(),
        bezierCurveTo: vi.fn(),
        drawImage: vi.fn(),
        setTransform: vi.fn(),
        setLineDash: vi.fn(),
        roundRect: vi.fn(),
        fillText: vi.fn(),
        measureText: vi.fn().mockReturnValue({ width: 40 }),
        createLinearGradient: vi.fn(),
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 0,
        globalAlpha: 1,
        font: '',
        textBaseline: '',
        textAlign: '',
        lineCap: '',
        lineJoin: '',
      } as unknown as CanvasRenderingContext2D);
    }
    return el;
  });
}

function makeViewport(): Viewport {
  const container = document.createElement('div');
  Object.defineProperty(container, 'clientWidth', {
    value: 800,
    configurable: true,
  });
  Object.defineProperty(container, 'clientHeight', {
    value: 600,
    configurable: true,
  });
  document.body.appendChild(container);
  const vp = new Viewport(container);
  viewports.push(vp);
  vp.toolManager.register(new SelectTool());
  vp.toolManager.register({
    name: 'path',
    onCommit: vi.fn(() => vi.fn()),
  } as unknown as Parameters<typeof vp.toolManager.register>[0]);
  return vp;
}

function fireReady(vp: Viewport): void {
  const onReady = vi.mocked(FieldNotesCanvas).mock.calls.at(-1)?.[0]?.onReady;
  if (!onReady) throw new Error('FieldNotesCanvas has no onReady');
  act(() => onReady(vp));
}

type ConnectionOptions = Parameters<typeof createManagedBattleMapConnection>[0];
function lastOptions(): ConnectionOptions {
  const call = vi.mocked(createManagedBattleMapConnection).mock.calls.at(-1);
  if (!call) throw new Error('no connection created');
  return call[0];
}

function fetchedUrls(): string[] {
  return vi.mocked(globalThis.fetch).mock.calls.map(([input]) => String(input));
}

function renderPlayer() {
  return render(
    <PlayerBattleMapCanvas
      campaignCode="CAMP01"
      battleMapId="bm-1"
      characterId="char-a"
      onExportError={() => {}}
    />
  );
}

describe('PlayerBattleMapCanvas: Table v1 resolved scene scope', () => {
  const saved = {
    relay: process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL,
    table: process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED,
  };

  beforeEach(() => {
    connections.length = 0;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
    process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL = 'wss://relay.test';
    process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED = 'true';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ markers: [] }), { status: 200 })
    );
  });

  afterEach(() => {
    cleanup();
    viewports.splice(0).forEach(viewport => viewport.destroy());
    vi.restoreAllMocks();
    vi.clearAllMocks();
    for (const [key, value] of [
      ['NEXT_PUBLIC_BATTLEMAP_RELAY_URL', saved.relay],
      ['NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED', saved.table],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('PR04: addresses side channels by the RESOLVED scene id once resolved', async () => {
    stubCanvas();
    renderPlayer();
    fireReady(makeViewport());
    const options = lastOptions();
    expect(fetchedUrls().some(url => url.includes('/markers'))).toBe(false);
    expect(startFogAppearancePoll).not.toHaveBeenCalled();

    await act(async () => {
      options.onSceneResolved?.('scene-x');
    });
    expect(fetchedUrls()).toContain(
      '/api/campaign/CAMP01/battlemaps/scene-x/markers?role=player&playerId=char-a'
    );
    expect(fetchedUrls().some(url => url.includes('/bm-1/markers'))).toBe(
      false
    );
    expect(startFogAppearancePoll).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/campaign/CAMP01/battlemaps/scene-x/fog-appearance?role=player&playerId=char-a',
      })
    );
    await act(async () => options.onPoke?.('fog-appearance'));
    expect(fetchAndApplyFogAppearance).toHaveBeenCalledWith(
      expect.anything(),
      '/api/campaign/CAMP01/battlemaps/scene-x/fog-appearance?role=player&playerId=char-a'
    );
  });

  it('rebuilds the canvas with a visible notice when the presented scene changes', async () => {
    stubCanvas();
    renderPlayer();
    fireReady(makeViewport());
    expect(createManagedBattleMapConnection).toHaveBeenCalledTimes(1);
    const first = connections[0]!;
    await act(async () =>
      lastOptions().onSceneChange?.({
        previousSceneId: 'scene-x',
        sceneId: 'bm-1',
        discardedOperationIds: ['op-1'],
      })
    );
    expect(first.stop).toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(
      /scene changed.*1 unsent edit/i
    );
    fireReady(makeViewport());
    expect(createManagedBattleMapConnection).toHaveBeenCalledTimes(2);
  });

  it('publishes only the canonical own player band', () => {
    stubCanvas();
    renderPlayer();
    const vp = makeViewport();
    // A previously persisted/remote copy of the own band in a hiding shape.
    vp.layerManager.addLayerDirect({
      id: 'player-char-a',
      name: 'My elements',
      visible: false,
      locked: true,
      order: 777,
      opacity: 0.4,
    });
    fireReady(vp);
    const published = connections[0]!.publishLayerUpsert.mock.calls.map(
      ([definition]) => definition
    );
    expect(published).toEqual([
      expect.objectContaining({
        id: 'player-char-a',
        visible: true,
        locked: false,
        opacity: 1,
        order: PLAYER_BAND_ORDER,
      }),
    ]);
  });

  it('offers no delete action for a selected control-bearing token', () => {
    stubCanvas();
    renderPlayer();
    const vp = makeViewport();
    fireReady(vp);
    const token = {
      ...createShape({ position: { x: 0, y: 0 }, size: { w: 10, h: 10 } }),
      id: 'party-token',
      layerId: 'player-char-a',
      tokenKind: 'player',
      characterId: 'char-a',
      sceneMemberId: 'member-a',
    };
    const drawing = {
      ...createShape({ position: { x: 50, y: 50 }, size: { w: 10, h: 10 } }),
      id: 'own-drawing',
      layerId: 'player-char-a',
    };
    act(() => {
      vp.store.add(token);
      vp.store.add(drawing);
    });
    const select = vp.toolManager.getTool<SelectTool>('select')!;
    act(() => select.setSelection(['party-token']));
    expect(screen.queryByLabelText('Delete selected')).toBeNull();
    act(() => select.setSelection(['own-drawing']));
    expect(screen.getByLabelText('Delete selected')).toBeInTheDocument();
  });

  it('keeps delete for the own self-placed token in v1 (rule 12)', () => {
    stubCanvas();
    renderPlayer();
    const vp = makeViewport();
    fireReady(vp);
    const self = {
      ...createShape({ position: { x: 0, y: 0 }, size: { w: 10, h: 10 } }),
      id: 'self-token',
      layerId: 'player-char-a',
      tokenKind: 'player',
      characterId: 'char-a',
    };
    act(() => vp.store.add(self));
    const select = vp.toolManager.getTool<SelectTool>('select')!;
    act(() => select.setSelection(['self-token']));
    expect(screen.getByLabelText('Delete selected')).toBeInTheDocument();
  });

  it('keeps the legacy delete behavior outside Table v1', () => {
    delete process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED;
    stubCanvas();
    renderPlayer();
    const vp = makeViewport();
    fireReady(vp);
    const party = {
      ...createShape({ position: { x: 0, y: 0 }, size: { w: 10, h: 10 } }),
      id: 'party-token',
      layerId: 'player-char-a',
      tokenKind: 'player',
      characterId: 'char-a',
      sceneMemberId: 'member-a',
    };
    act(() => vp.store.add(party));
    const select = vp.toolManager.getTool<SelectTool>('select')!;
    act(() => select.setSelection(['party-token']));
    expect(screen.getByLabelText('Delete selected')).toBeInTheDocument();
  });
});
