import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { SelectTool, Viewport } from '@fieldnotes/core';

import { PlayerBattleMapCanvas } from '../PlayerBattleMapCanvas';

/**
 * PR04 P10 / C4-1 on the player surface through the REAL
 * createManagedBattleMapConnection path: a token 403 "Scene is unavailable"
 * (unpresented, blanked, deleted or another scene) shows a neutral cover.
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

describe('PlayerBattleMapCanvas: audience neutrality (PR04 P10)', () => {
  const saved = {
    relay: process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL,
    table: process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED,
  };
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
    process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL = 'wss://relay.test';
    process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED = 'true';
    vi.spyOn(globalThis, 'fetch').mockImplementation(async input =>
      String(input).includes('/battlemap-token')
        ? Response.json({ error: 'Scene is unavailable' }, { status: 403 })
        : Response.json({ error: 'Not found' }, { status: 404 })
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

  it('a token 403 "Scene is unavailable" shows the neutral cover, not an access error', async () => {
    stubCanvas();
    renderPlayer();
    fireReady(makeViewport());
    await vi.waitFor(() =>
      expect(fetchedUrls().some(url => url.includes('/battlemap-token'))).toBe(
        true
      )
    );
    const cover = await screen.findByTestId(
      'battlemap-bootstrap-privacy-cover'
    );
    await vi.waitFor(() =>
      expect(cover).toHaveTextContent("The DM isn't showing this map right now")
    );
    expect(fetchedUrls().some(url => url.includes('/markers'))).toBe(false);
  });
});
