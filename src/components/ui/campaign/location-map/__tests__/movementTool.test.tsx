import { describe, it, expect, vi, afterEach } from 'vitest';
import { Viewport, createShape } from '@fieldnotes/core';
import type { ToolContext } from '@fieldnotes/core';

import {
  createMovementPathTool,
  MOVEMENT_DEFAULT_WALK_FEET,
} from '../movementTool';
import { PLAYER_TOKEN_KIND } from '../PlayerTokenTool';
import { COMBATANT_TOKEN_KIND } from '../tokenIdentity';
import {
  MOVEMENT_WITHIN_SPEED_COLOR,
  MOVEMENT_DASH_COLOR,
} from '../movementSpeed';

/**
 * jsdom has no canvas 2D context: stub `getContext` on any canvas the
 * Viewport creates so construction and its render loop don't throw. Copied
 * VERBATIM from selectionEvents.integration.test.tsx (same directory) —
 * stub the browser API, never an @fieldnotes module.
 */
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

function tokenAt(x: number, y: number, entityId: string) {
  return {
    ...createShape({
      position: { x, y },
      size: { w: 40, h: 40 },
      shape: 'ellipse',
      strokeColor: '#000',
      strokeWidth: 1,
      fillColor: '#c0392b',
    }),
    zIndex: 1000,
    tokenKind: COMBATANT_TOKEN_KIND,
    entityId,
  };
}

function makeViewport(): { vp: Viewport; container: HTMLDivElement } {
  stubCanvas();
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
  return { vp: new Viewport(container), container };
}

// ToolContext for resolveStart: only gridSize is read.
const ctx = { gridSize: 40 } as unknown as ToolContext;

describe('createMovementPathTool', () => {
  afterEach(() => vi.restoreAllMocks());

  it('anchors on a combatant token: centre origin, footprint, anchorKey, speed bands', () => {
    const { vp, container } = makeViewport();
    const token = tokenAt(80, 80, 'e-1');
    vp.store.add(token);
    const tool = createMovementPathTool({
      getViewport: () => vp,
      role: 'dm',
      resolveMovement: () => ({ name: 'Goblin', walkFeet: 25 }),
      isDashActive: () => true,
    });
    const anchor = tool.getOptions().resolveStart!({ x: 100, y: 100 }, ctx);
    expect(anchor).toEqual({
      origin: { x: 100, y: 100 },
      footprint: { w: 1, h: 1 },
      anchorKey: token.id,
    });
    expect(tool.getOptions().rangeBands).toEqual([
      { feet: 25, color: MOVEMENT_WITHIN_SPEED_COLOR },
      { feet: 50, color: MOVEMENT_DASH_COLOR },
    ]);
    vp.destroy();
    container.remove();
  });

  it('vetoes non-tokens and, for players, other identities', () => {
    const { vp, container } = makeViewport();
    vp.store.add(tokenAt(80, 80, 'e-1'));
    const playerTool = createMovementPathTool({
      getViewport: () => vp,
      role: 'player',
      characterId: 'c-9',
      resolveMovement: () => null,
      isDashActive: () => false,
    });
    // Combatant token is not the player's own token.
    expect(
      playerTool.getOptions().resolveStart!({ x: 100, y: 100 }, ctx)
    ).toBeNull();
    // Empty canvas spot.
    expect(
      playerTool.getOptions().resolveStart!({ x: 500, y: 500 }, ctx)
    ).toBeNull();
    vp.destroy();
    container.remove();
  });

  it('null resolveMovement falls back to the default walk speed band', () => {
    const { vp, container } = makeViewport();
    vp.store.add(tokenAt(80, 80, 'e-1'));
    const tool = createMovementPathTool({
      getViewport: () => vp,
      role: 'dm',
      resolveMovement: () => null,
      isDashActive: () => false,
    });
    tool.getOptions().resolveStart!({ x: 100, y: 100 }, ctx);
    expect(tool.getOptions().rangeBands).toEqual([
      { feet: MOVEMENT_DEFAULT_WALK_FEET, color: MOVEMENT_WITHIN_SPEED_COLOR },
    ]);
    vp.destroy();
    container.remove();
  });

  it('player token on a locked (mirrored) layer still resolves for the DM', () => {
    const { vp, container } = makeViewport();
    vp.layerManager.addLayerDirect({
      id: 'player-c9',
      name: 'p',
      visible: true,
      locked: true,
      order: 500,
      opacity: 1,
    });
    const lockedToken = {
      ...createShape({
        position: { x: 80, y: 80 },
        size: { w: 40, h: 40 },
        shape: 'ellipse',
        strokeColor: '#000',
        strokeWidth: 1,
        fillColor: '#2980b9',
        layerId: 'player-c9',
      }),
      zIndex: 1000,
      tokenKind: PLAYER_TOKEN_KIND,
      characterId: 'c9',
    };
    vp.store.add(lockedToken);
    const dmTool = createMovementPathTool({
      getViewport: () => vp,
      role: 'dm',
      resolveMovement: () => null,
      isDashActive: () => false,
    });
    const anchor = dmTool.getOptions().resolveStart!({ x: 100, y: 100 }, ctx);
    expect(anchor).toEqual({
      origin: { x: 100, y: 100 },
      footprint: { w: 1, h: 1 },
      anchorKey: lockedToken.id,
    });
    vp.destroy();
    container.remove();
  });

  it('player anchors on their own player token (unlocked layer)', () => {
    const { vp, container } = makeViewport();
    const ownToken = {
      ...createShape({
        position: { x: 80, y: 80 },
        size: { w: 40, h: 40 },
        shape: 'ellipse',
        strokeColor: '#000',
        strokeWidth: 1,
        fillColor: '#2980b9',
      }),
      zIndex: 1000,
      tokenKind: PLAYER_TOKEN_KIND,
      characterId: 'c-9',
    };
    vp.store.add(ownToken);
    const playerTool = createMovementPathTool({
      getViewport: () => vp,
      role: 'player',
      characterId: 'c-9',
      resolveMovement: () => ({ name: 'Hero', walkFeet: 30 }),
      isDashActive: () => false,
    });
    const anchor = playerTool.getOptions().resolveStart!(
      { x: 100, y: 100 },
      ctx
    );
    expect(anchor).toEqual({
      origin: { x: 100, y: 100 },
      footprint: { w: 1, h: 1 },
      anchorKey: ownToken.id,
    });
    vp.destroy();
    container.remove();
  });
});
