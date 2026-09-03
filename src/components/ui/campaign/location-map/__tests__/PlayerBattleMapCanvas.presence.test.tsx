import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { Viewport } from '@fieldnotes/core';

import { PlayerBattleMapCanvas } from '../PlayerBattleMapCanvas';
import { useCharacterStore } from '@/store/characterStore';
import type { CharacterState } from '@/types/character';

/**
 * Task 9 — shared presence on the player battle-map surface, mirroring the
 * DM coverage in DmBattleMapCanvas.hooks.test.ts (Tasks 7-8): the player
 * always publishes its cursor (no share toggle), draws only the DM's cursor
 * (awarenessSync CURSOR_RULES.player), renders no PresenceControl UI, and
 * the re-attach/unmount teardown order disposes connection-scoped handles
 * (awareness included) BEFORE stopping the connection.
 *
 * Mount scaffolding (mocked FieldNotesCanvas + a real Viewport driven
 * through a manually-fired onReady) is copied from
 * PlayerBattleMapCanvas.markers.test.tsx. The connection-scoped sync
 * helpers + awarenessSync are mocked the way
 * DmBattleMapCanvas.hooks.test.ts mocks them (Task 7/8 precedent) so
 * `attachConnectionScope`'s real dispose/stop ordering is exercised against
 * these mocks rather than the network.
 */

let mockActiveTool = 'hand';

vi.mock('@fieldnotes/react', async importOriginal => {
  const actual = await importOriginal<typeof import('@fieldnotes/react')>();
  return {
    ...actual,
    // jsdom has no live canvas rendering pipeline — onReady is invoked
    // manually below with a REAL Viewport built against a stubbed canvas 2D
    // context (see stubCanvas()), same precedent as the markers test file.
    FieldNotesCanvas: vi.fn(() => null),
    useActiveTool: () => [mockActiveTool, vi.fn()] as const,
  };
});

import { FieldNotesCanvas } from '@fieldnotes/react';

vi.mock('../BattleMapMinimap', () => ({ BattleMapMinimap: () => null }));
vi.mock('../BattleMapExportControl', () => ({
  BattleMapExportControl: () => null,
}));

const callOrder: string[] = [];

vi.mock('@/lib/battlemapSync', () => ({
  createManagedBattleMapConnection: vi.fn(() => ({
    stop: () => {
      callOrder.push('connection.stop');
    },
    sendPresence: vi.fn(),
    publishLayerUpsert: vi.fn(),
    publishLayerRemove: vi.fn(),
  })),
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
  attachFocusReceiver: vi.fn(() => ({
    dispose: vi.fn(),
    receiver: {},
    animator: {},
  })),
}));

vi.mock('@/components/ui/campaign/location-map/pathSync', () => ({
  attachPathBroadcast: vi.fn(() => ({
    setSharing: vi.fn(),
    dispose: () => {
      callOrder.push('pathBroadcast.dispose');
    },
  })),
  attachRemotePaths: vi.fn(() => ({
    dispose: () => {
      callOrder.push('remotePaths.dispose');
    },
    overlay: {},
  })),
}));

vi.mock('@/components/ui/campaign/location-map/layerSync', () => ({
  makeApplyRemoteLayer: vi.fn(() => vi.fn()),
  publishOwnedLayers: vi.fn(),
}));

const awarenessHandle = {
  roster: {} as never,
  cursorPeers: vi.fn(() => []),
  announce: vi.fn(),
  setShareCursor: vi.fn(),
  setShowPlayerCursors: vi.fn(),
  setIdentity: vi.fn(),
  dispose: () => {
    callOrder.push('awareness.dispose');
  },
};
vi.mock('@/components/ui/campaign/location-map/awarenessSync', () => ({
  attachAwarenessSync: vi.fn(() => awarenessHandle),
}));

import { attachAwarenessSync } from '@/components/ui/campaign/location-map/awarenessSync';
import { createManagedBattleMapConnection } from '@/lib/battlemapSync';

/** jsdom has no canvas 2D context — stub it so constructing a real
 * `Viewport` doesn't throw. Duplicated (not imported) from
 * PlayerBattleMapCanvas.markers.test.tsx: stub the browser API, never an
 * @fieldnotes module. */
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
  // FieldNotesCanvas (mocked out — see above) is what normally registers
  // the `tools` prop's tools onto the viewport before calling onReady; a
  // bare real Viewport has none registered. Register a minimal stand-in for
  // the 'path' tool so the movement-commit wiring and (crucially for this
  // file) the player's own path-broadcast attach both see a truthy
  // `getTool<PathTool>('path')`, matching the DM hook test's
  // `makeFakeMovementTool()` precedent.
  vp.toolManager.register({
    name: 'path',
    onCommit: vi.fn(() => vi.fn()),
  } as unknown as Parameters<typeof vp.toolManager.register>[0]);
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

function seedCharacter(overrides: Partial<CharacterState> = {}) {
  const base = useCharacterStore.getState().character;
  useCharacterStore.setState({ character: { ...base, ...overrides } });
}

function renderPlayer(
  overrides: Partial<React.ComponentProps<typeof PlayerBattleMapCanvas>> = {}
) {
  return render(
    <PlayerBattleMapCanvas
      campaignCode="CAMP01"
      battleMapId="bm-1"
      characterId="char-a"
      onExportError={() => {}}
      {...overrides}
    />
  );
}

describe('PlayerBattleMapCanvas: shared presence', () => {
  const savedRelayUrl = process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;

  beforeEach(() => {
    mockActiveTool = 'hand';
    process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL = 'wss://relay.test';
    callOrder.length = 0;
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError('marker endpoint unavailable')
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    if (savedRelayUrl === undefined) {
      delete process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;
    } else {
      process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL = savedRelayUrl;
    }
  });

  it('attaches awareness as player: cursor always on, name from playerName, announce on live, no share/viewer UI, dispose before stop on unmount', () => {
    stubCanvas();
    seedCharacter({ id: 'char-a', name: 'Aria', playerName: 'Sam' });
    const vp = makeViewport();

    const { unmount } = renderPlayer({
      characterId: 'char-a',
      characterName: 'Aria',
    });
    fireReady(vp);

    const [, , options] = vi.mocked(attachAwarenessSync).mock.calls[0]!;
    expect(options.identity).toEqual({
      id: 'char-a',
      name: 'Sam',
      role: 'player',
    });
    expect(options.shareCursor).toBe(true);
    expect(options.showPlayerCursors).toBe(true);
    expect(options.colorFor).toBeUndefined();

    const onStatus = vi.mocked(createManagedBattleMapConnection).mock
      .calls[0]![0].onStatus!;
    act(() => onStatus('live'));
    expect(awarenessHandle.announce).toHaveBeenCalledTimes(1);

    expect(
      screen.queryByRole('switch', { name: /share my cursor/i })
    ).toBeNull();
    expect(screen.queryByRole('button', { name: /viewers/i })).toBeNull();

    unmount();
    expect(callOrder.indexOf('awareness.dispose')).toBeGreaterThanOrEqual(0);
    expect(callOrder.indexOf('awareness.dispose')).toBeLessThan(
      callOrder.indexOf('connection.stop')
    );
    vp.destroy();
  });

  it('RE-ATTACH: a second onReady disposes the old attachment before stopping the old connection', () => {
    stubCanvas();
    seedCharacter({ id: 'char-a', name: 'Aria', playerName: 'Sam' });
    const vp1 = makeViewport();
    const vp2 = makeViewport();

    const { unmount } = renderPlayer({ characterId: 'char-a' });
    fireReady(vp1);
    callOrder.length = 0;

    fireReady(vp2);

    expect(callOrder.indexOf('awareness.dispose')).toBeGreaterThanOrEqual(0);
    expect(callOrder.indexOf('remotePaths.dispose')).toBeGreaterThanOrEqual(0);
    expect(callOrder.indexOf('pathBroadcast.dispose')).toBeGreaterThanOrEqual(
      0
    );
    expect(callOrder.indexOf('awareness.dispose')).toBeLessThan(
      callOrder.indexOf('connection.stop')
    );
    expect(callOrder.indexOf('remotePaths.dispose')).toBeLessThan(
      callOrder.indexOf('connection.stop')
    );
    expect(callOrder.filter(c => c === 'connection.stop')).toHaveLength(1);
    expect(vi.mocked(attachAwarenessSync)).toHaveBeenCalledTimes(2);

    unmount();
    vp1.destroy();
    vp2.destroy();
  });

  it('ATTACH FAULT: awareness throwing disposes the earlier helpers (remotePaths/pathBroadcast), stops the new connection, surfaces the error; unmount does not stop twice', () => {
    stubCanvas();
    seedCharacter({ id: 'char-a', name: 'Aria', playerName: 'Sam' });
    const vp = makeViewport();

    vi.mocked(attachAwarenessSync).mockImplementationOnce(() => {
      throw new Error('awareness boom');
    });

    const { unmount } = renderPlayer({ characterId: 'char-a' });
    expect(() => fireReady(vp)).toThrow('awareness boom');

    expect(callOrder.indexOf('remotePaths.dispose')).toBeGreaterThanOrEqual(0);
    expect(callOrder.indexOf('pathBroadcast.dispose')).toBeGreaterThanOrEqual(
      0
    );
    expect(callOrder.indexOf('pathBroadcast.dispose')).toBeLessThan(
      callOrder.indexOf('connection.stop')
    );
    expect(callOrder.filter(c => c === 'connection.stop')).toHaveLength(1);

    callOrder.length = 0;
    unmount();
    expect(callOrder).not.toContain('connection.stop');
    expect(callOrder).not.toContain('pathBroadcast.dispose');

    vp.destroy();
  });

  it('falls back to the character name when playerName is empty and updates identity when the name changes', () => {
    stubCanvas();
    seedCharacter({ id: 'char-a', name: 'Aria', playerName: '' });
    const vp = makeViewport();

    const { unmount } = renderPlayer({
      characterId: 'char-a',
      characterName: 'Aria',
    });
    fireReady(vp);

    const [, , options] = vi.mocked(attachAwarenessSync).mock.calls[0]!;
    expect(options.identity).toEqual({
      id: 'char-a',
      name: 'Aria',
      role: 'player',
    });

    act(() => {
      seedCharacter({ id: 'char-a', name: 'Aria', playerName: 'Sam' });
    });

    expect(awarenessHandle.setIdentity).toHaveBeenCalledWith({
      id: 'char-a',
      name: 'Sam',
      role: 'player',
    });

    unmount();
    vp.destroy();
  });
});
