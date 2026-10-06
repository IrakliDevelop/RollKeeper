import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { SelectTool, Viewport } from '@fieldnotes/core';

import { PlayerBattleMapCanvas } from '../PlayerBattleMapCanvas';

/**
 * PR02 R4 review F1: a real presentation switch on the player surface with
 * the real battlemapSync/battlemapAuthority stack (only the SDK managed
 * connection is faked). After the switch the page rebuilds, every old
 * connection is stopped, nothing keeps minting and the new live status is
 * never overwritten by a stale connection.
 */

interface FakeInstance {
  resolveUrl: () => Promise<unknown> | unknown;
  state: { status: string; document: unknown; operations: unknown[] };
  listeners: Set<() => void>;
  stop: ReturnType<typeof vi.fn>;
  publish(): void;
}

const fake = vi.hoisted(() => ({ instances: [] as FakeInstance[] }));

vi.mock('@fieldnotes/sync', async importOriginal => ({
  ...(await importOriginal<typeof import('@fieldnotes/sync')>()),
  createManagedAuthorityConnection: (options: {
    resolveUrl: () => unknown;
  }) => {
    const instance: FakeInstance = {
      resolveUrl: options.resolveUrl,
      state: { status: 'connecting', document: null, operations: [] },
      listeners: new Set(),
      stop: vi.fn(),
      publish() {
        for (const listener of [...this.listeners]) listener();
      },
    };
    fake.instances.push(instance);
    return {
      getState: () => instance.state,
      subscribe: (listener: () => void) => {
        instance.listeners.add(listener);
        return () => instance.listeners.delete(listener);
      },
      stop: instance.stop,
      submit: vi.fn(() => ({ status: 'admitted', clientOperationId: 'x' })),
      captureBarrier: vi.fn(),
      waitForAcknowledgements: vi.fn(),
      requestCheckpoint: vi.fn(),
      releaseBarrier: vi.fn(),
    };
  },
}));

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

const ROOM_X = '423e4567-e89b-42d3-a456-426614174000';
const ROOM_M = '523e4567-e89b-42d3-a456-426614174000';
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

async function flush() {
  for (let index = 0; index < 5; index += 1) await Promise.resolve();
}

const liveDocument = {
  elements: [],
  layers: [],
  extensions: { fog: { pluginName: 'fog', version: 1, data: null } },
};

async function goLive(instance: FakeInstance) {
  await act(async () => {
    await instance.resolveUrl();
    await flush();
  });
  await act(async () => {
    instance.state = { status: 'live', document: liveDocument, operations: [] };
    instance.publish();
    await flush();
  });
}

describe('PlayerBattleMapCanvas: real presentation switch (R4)', () => {
  const saved = {
    relay: process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL,
    table: process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED,
  };
  let presented = { room: ROOM_X, sceneId: 'scene-x' };
  let mints = 0;

  beforeEach(() => {
    fake.instances.length = 0;
    mints = 0;
    presented = { room: ROOM_X, sceneId: 'scene-x' };
    process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL = 'wss://relay.test';
    process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED = 'true';
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      if (String(input).includes('/battlemap-token')) {
        mints += 1;
        return new Response(
          JSON.stringify({ token: 'token', authority: 1, ...presented }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ markers: [] }), { status: 200 });
    });
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

  it('stops every old connection, stops minting and keeps the new live status', async () => {
    stubCanvas();
    render(
      <PlayerBattleMapCanvas
        campaignCode="CAMP01"
        battleMapId="map-m"
        characterId="legacy-a"
        onExportError={() => {}}
      />
    );
    fireReady(makeViewport());
    await act(async () => {
      await fake.instances[0]!.resolveUrl();
      await flush();
    });
    await goLive(fake.instances[1]!);
    expect(
      screen.queryByTestId('battlemap-bootstrap-privacy-cover')
    ).toBeNull();

    presented = { room: ROOM_M, sceneId: 'map-m' };
    await act(async () => {
      await fake.instances[1]!.resolveUrl();
      await flush();
    });
    expect(screen.getByRole('status')).toHaveTextContent(/scene changed/i);
    const before = fake.instances.length;
    fireReady(makeViewport());
    await act(async () => {
      await fake.instances[before]!.resolveUrl();
      await flush();
    });
    const current = fake.instances.at(-1)!;
    await goLive(current);
    expect(
      screen.queryByTestId('battlemap-bootstrap-privacy-cover')
    ).toBeNull();

    for (const instance of fake.instances.slice(0, -1)) {
      expect(instance.stop).toHaveBeenCalled();
    }
    expect(current.stop).not.toHaveBeenCalled();
    const mintCount = mints;
    await act(async () => {
      for (const instance of fake.instances.slice(0, -1)) {
        await expect(instance.resolveUrl()).resolves.toBeNull();
        instance.state = { ...instance.state, status: 'offline' };
        instance.publish();
      }
      await flush();
    });
    expect(mints).toBe(mintCount);
    expect(
      screen.queryByTestId('battlemap-bootstrap-privacy-cover')
    ).toBeNull();
  });
});
