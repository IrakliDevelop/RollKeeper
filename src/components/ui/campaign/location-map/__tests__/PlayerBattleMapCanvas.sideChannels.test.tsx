import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { SelectTool, Viewport } from '@fieldnotes/core';

import { PlayerBattleMapCanvas } from '../PlayerBattleMapCanvas';

/**
 * PR04 P7/Q2(b) on the player surface: side channels are addressed by the
 * resolved scene id, cleared on a scene change before any new fetch, a 404 is
 * a neutral empty state (never stale data), and markers refresh every 10 s.
 * Harness copied from PlayerBattleMapCanvas.tableScope.test.tsx.
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
const registered = vi.hoisted(() => ({ markers: [] as unknown[][] }));
vi.mock('../useMarkerRegistration', () => ({
  useMarkerRegistration: (options: { markerDetails?: unknown[] }) => {
    registered.markers.push(options.markerDetails ?? []);
  },
}));
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

const MARKERS_X =
  '/api/campaign/CAMP01/battlemaps/scene-x/markers?role=player&playerId=char-a';
const lastMarkers = () => registered.markers.at(-1) ?? [];
const markerTitles = () =>
  (lastMarkers() as Array<{ title?: string }>).map(marker => marker.title);

describe('PlayerBattleMapCanvas: scene-keyed side channels (PR04)', () => {
  const saved = {
    relay: process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL,
    table: process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED,
  };
  let markerResponses: Array<() => Response>;

  beforeEach(() => {
    registered.markers.length = 0;
    connections.length = 0;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
    process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL = 'wss://relay.test';
    process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED = 'true';
    markerResponses = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      (
        markerResponses.shift() ??
        (() => Response.json({ markers: [{ id: 'm1', title: 'Chest' }] }))
      )()
    );
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
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

  it('clears scene markers on a scene change before any new fetch, and a 404 stays neutral', async () => {
    stubCanvas();
    renderPlayer();
    fireReady(makeViewport());
    await act(async () => lastOptions().onSceneResolved?.('scene-x'));
    await vi.waitFor(() => expect(markerTitles()).toEqual(['Chest']));
    const before = fetchedUrls().length;
    await act(async () =>
      lastOptions().onSceneChange?.({
        previousSceneId: 'scene-x',
        sceneId: 'scene-y',
        discardedOperationIds: [],
      })
    );
    expect(markerTitles()).toEqual([]);
    expect(fetchedUrls().length).toBe(before);
    fireReady(makeViewport());
    markerResponses.push(() =>
      Response.json({ error: 'Not found' }, { status: 404 })
    );
    await act(async () => lastOptions().onSceneResolved?.('scene-y'));
    await vi.waitFor(() =>
      expect(fetchedUrls()).toContain(
        '/api/campaign/CAMP01/battlemaps/scene-y/markers?role=player&playerId=char-a'
      )
    );
    expect(markerTitles()).toEqual([]);
  });

  it('a 404 after markers were shown clears them (never stale data)', async () => {
    stubCanvas();
    renderPlayer();
    fireReady(makeViewport());
    await act(async () => lastOptions().onSceneResolved?.('scene-x'));
    await vi.waitFor(() => expect(markerTitles()).toEqual(['Chest']));
    markerResponses.push(() =>
      Response.json({ error: 'Not found' }, { status: 404 })
    );
    await act(async () => lastOptions().onPoke?.('markers'));
    await vi.waitFor(() => expect(markerTitles()).toEqual([]));
  });

  it('refreshes scene markers every 10 s while side channels are enabled', async () => {
    vi.useFakeTimers({
      toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'],
    });
    stubCanvas();
    const { unmount } = renderPlayer();
    fireReady(makeViewport());
    await act(async () => lastOptions().onSceneResolved?.('scene-x'));
    const count = () => fetchedUrls().filter(url => url === MARKERS_X).length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const first = count();
    expect(first).toBeGreaterThanOrEqual(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(count()).toBe(first + 1);
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(count()).toBe(first + 1);
  });
});
