import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { Viewport } from '@fieldnotes/core';

import BattleMapDisplayPage from '../page';

/**
 * PR02 R4 on the map-pinned TV display: with Table v1 required the display
 * keeps its map-keyed fog-appearance companion neutral unless the resolved
 * presented scene is this map, and rebuilds its canvas when the resolved
 * scene changes. Harness copied from page.presence.test.tsx.
 */

vi.mock('next/navigation', async importOriginal => {
  const actual = await importOriginal<typeof import('next/navigation')>();
  return {
    ...actual,
    useParams: () => ({ code: 'CAMP01', id: 'bm-1' }),
    useSearchParams: () => new URLSearchParams({ dk: 'key' }),
  };
});

vi.mock('@fieldnotes/react', async importOriginal => {
  const actual = await importOriginal<typeof import('@fieldnotes/react')>();
  return { ...actual, FieldNotesCanvas: vi.fn(() => null) };
});

import { FieldNotesCanvas } from '@fieldnotes/react';

const stops: Array<ReturnType<typeof vi.fn>> = [];
vi.mock('@/lib/battlemapSync', () => ({
  createManagedBattleMapConnection: vi.fn(() => {
    const stop = vi.fn();
    stops.push(stop);
    return { stop, sendPresence: vi.fn() };
  }),
}));

vi.mock('@/components/ui/campaign/location-map/fog/fogAppearancePoll', () => ({
  applyFogAppearanceMetadata: vi.fn(),
  fetchAndApplyFogAppearance: vi.fn(),
  startFogAppearancePoll: vi.fn(() => () => {}),
}));
vi.mock('@/components/ui/campaign/location-map/laserSync', () => ({
  attachRemoteLaserTrails: vi.fn(() => vi.fn()),
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
  attachRemotePaths: vi.fn(() => ({ dispose: vi.fn(), overlay: {} })),
}));
vi.mock('@/components/ui/campaign/location-map/layerSync', () => ({
  makeApplyRemoteLayer: vi.fn(() => vi.fn()),
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
} from '@/components/ui/campaign/location-map/fog/fogAppearancePoll';

const viewports: Viewport[] = [];

function stubCanvas(): void {
  const origCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = origCreate(tag);
    if (tag === 'canvas') {
      const canvas = el as HTMLCanvasElement;
      vi.spyOn(canvas, 'getContext').mockReturnValue({
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
  // Destroyed in afterEach so no render frame outlives the canvas stub.
  viewports.push(vp);
  return vp;
}

/** Pulls the `onReady` callback the (mocked) `FieldNotesCanvas` most
 * recently received, and invokes it with a real `Viewport` inside `act`. */
function fireReady(vp: Viewport): void {
  const lastCall = vi.mocked(FieldNotesCanvas).mock.calls.at(-1);
  const onReady = lastCall?.[0]?.onReady;
  if (!onReady) {
    throw new Error('FieldNotesCanvas was not rendered with an onReady prop');
  }
  act(() => onReady(vp));
}

function lastOptions() {
  const call = vi.mocked(createManagedBattleMapConnection).mock.calls.at(-1);
  if (!call) throw new Error('no connection');
  return call[0];
}

describe('BattleMapDisplayPage: Table v1 resolved scene scope', () => {
  const saved = {
    relay: process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL,
    table: process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED,
  };

  beforeEach(() => {
    stops.length = 0;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
    process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL = 'wss://relay.test';
    process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED = 'true';
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

  it('polls fog appearance only while the resolved scene is this map', async () => {
    stubCanvas();
    render(<BattleMapDisplayPage />);
    fireReady(makeViewport());
    expect(startFogAppearancePoll).not.toHaveBeenCalled();
    const options = lastOptions();
    await act(async () => {
      options.onSceneResolved?.('scene-x');
      options.onPoke?.('fog-appearance');
    });
    expect(startFogAppearancePoll).not.toHaveBeenCalled();
    expect(fetchAndApplyFogAppearance).not.toHaveBeenCalled();
    await act(async () => options.onSceneResolved?.('bm-1'));
    expect(startFogAppearancePoll).toHaveBeenCalledTimes(1);
  });

  it('rebuilds the display canvas when the resolved scene changes', async () => {
    stubCanvas();
    render(<BattleMapDisplayPage />);
    fireReady(makeViewport());
    await act(async () =>
      lastOptions().onSceneChange?.({
        previousSceneId: 'bm-1',
        sceneId: 'scene-x',
        discardedOperationIds: [],
      })
    );
    expect(stops[0]).toHaveBeenCalled();
    fireReady(makeViewport());
    expect(createManagedBattleMapConnection).toHaveBeenCalledTimes(2);
  });
});
