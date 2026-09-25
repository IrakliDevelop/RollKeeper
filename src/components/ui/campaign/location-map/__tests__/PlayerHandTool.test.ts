import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SelectTool, createImage } from '@fieldnotes/core';
import { createTemplate, templateElementTypeDefinition } from '@fieldnotes/vtt';
import { PlayerHandTool } from '@/components/ui/campaign/location-map/PlayerHandTool';
import { isCombatantToken } from '@/components/ui/campaign/dm-vtt/combatantToken';

import type {
  CanvasElement,
  PointerState,
  ToolContext,
} from '@fieldnotes/core';

const OWN_LAYER = 'player-char-1';
const DM_LAYER = 'dm-layer';

function combatantToken(x = 0, y = 0): CanvasElement {
  return {
    ...createImage({
      position: { x, y },
      size: { w: 40, h: 40 },
      src: 'data:image/png;base64,',
      layerId: OWN_LAYER,
    }),
    entityId: 'entity-1',
    tokenKind: 'combatant',
  } as CanvasElement;
}

function ownToken(x = 0, y = 0): CanvasElement {
  return createImage({
    position: { x, y },
    size: { w: 40, h: 40 },
    src: 'data:image/png;base64,',
    layerId: OWN_LAYER,
  });
}

function dmElement(x = 0, y = 0): CanvasElement {
  return createImage({
    position: { x, y },
    size: { w: 400, h: 400 },
    src: 'data:image/png;base64,',
    layerId: DM_LAYER,
  });
}

function fakeCtx(elements: CanvasElement[]) {
  return {
    camera: {
      screenToWorld: (p: { x: number; y: number }) => p,
      pan: vi.fn(),
    },
    store: { snapshot: () => elements },
    requestRender: vi.fn(),
    switchTool: vi.fn(),
    setCursor: vi.fn(),
    isLayerVisible: () => true,
    isLayerLocked: (id: string) => id === DM_LAYER,
  } as unknown as ToolContext;
}

const down = (x: number, y: number) =>
  ({ x, y, buttons: 1 }) as unknown as PointerState;

const move = (x: number, y: number) =>
  ({ x, y, buttons: 1 }) as unknown as PointerState;

const up = (x: number, y: number) =>
  ({ x, y, buttons: 0 }) as unknown as PointerState;

describe('PlayerHandTool', () => {
  let selectTool: SelectTool;
  let selectDown: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    selectTool = new SelectTool();
    selectDown = vi
      .spyOn(selectTool, 'onPointerDown')
      .mockImplementation(() => {});
  });

  it('pointer-down on a movable (own-layer) element hands the gesture to select', () => {
    const ctx = fakeCtx([ownToken(0, 0)]);
    const tool = new PlayerHandTool(selectTool);
    tool.onPointerDown(down(20, 20), ctx);
    expect(ctx.switchTool).toHaveBeenCalledWith('select');
    expect(selectDown).toHaveBeenCalledTimes(1);
  });

  it('pointer-down on DM content (locked mirrored layer) pans instead', () => {
    const ctx = fakeCtx([dmElement(0, 0)]);
    const tool = new PlayerHandTool(selectTool);
    tool.onPointerDown(down(20, 20), ctx);
    expect(ctx.switchTool).not.toHaveBeenCalled();
    expect(selectDown).not.toHaveBeenCalled();
  });

  it('pointer-down on empty canvas pans (no switch)', () => {
    const ctx = fakeCtx([ownToken(500, 500)]);
    const tool = new PlayerHandTool(selectTool);
    tool.onPointerDown(down(20, 20), ctx);
    expect(ctx.switchTool).not.toHaveBeenCalled();
    expect(selectDown).not.toHaveBeenCalled();
  });

  it('pointer-down on an own TEMPLATE pans — only tokens grab-through', () => {
    // Templates often cover large map areas; treating them as grabbable made
    // panning nearly impossible after a big AoE was placed.
    const template = createTemplate({
      position: { x: 20, y: 20 },
      templateShape: 'circle',
      radius: 200,
      layerId: OWN_LAYER,
    });
    const ctx = fakeCtx([templateElementTypeDefinition.wrap(template)]);
    const tool = new PlayerHandTool(selectTool);
    tool.onPointerDown(down(20, 20), ctx);
    expect(ctx.switchTool).not.toHaveBeenCalled();
    expect(selectDown).not.toHaveBeenCalled();
  });

  it('an element-level lock also pans', () => {
    const el = { ...ownToken(0, 0), locked: true };
    const ctx = fakeCtx([el]);
    const tool = new PlayerHandTool(selectTool);
    tool.onPointerDown(down(20, 20), ctx);
    expect(ctx.switchTool).not.toHaveBeenCalled();
  });

  describe('with a custom isGrabbable predicate (e.g. DM canvas)', () => {
    it('pointer-down on an element matching the predicate hands off to select', () => {
      const ctx = fakeCtx([combatantToken(0, 0)]);
      const tool = new PlayerHandTool(selectTool, el => isCombatantToken(el));
      tool.onPointerDown(down(20, 20), ctx);
      expect(ctx.switchTool).toHaveBeenCalledWith('select');
      expect(selectDown).toHaveBeenCalledTimes(1);
    });

    it('pointer-down on a plain own-layer image (not matching the predicate) pans, even though it would be grabbable under the default predicate', () => {
      const ctx = fakeCtx([ownToken(0, 0)]);
      const tool = new PlayerHandTool(selectTool, el => isCombatantToken(el));
      tool.onPointerDown(down(20, 20), ctx);
      expect(ctx.switchTool).not.toHaveBeenCalled();
      expect(selectDown).not.toHaveBeenCalled();
    });
  });

  describe('pan dead zone (on empty canvas / DM content)', () => {
    it('press, small moves within 8px (including a 0-delta move), then release: camera.pan is never called', () => {
      const ctx = fakeCtx([dmElement(0, 0)]);
      const tool = new PlayerHandTool(selectTool);
      tool.onPointerDown(down(100, 100), ctx);
      tool.onPointerMove(move(100, 100), ctx); // 0-delta move
      tool.onPointerMove(move(103, 104), ctx); // dist 5, still in dead zone
      tool.onPointerMove(move(104, 105), ctx); // dist ~6.4, still in dead zone
      tool.onPointerMove(move(105, 105), ctx); // dist ~7.07, still within slop
      tool.onPointerUp(up(105, 105), ctx);
      expect(ctx.camera.pan).not.toHaveBeenCalled();
    });

    it('press, then move 20px: the camera ends up panned by the full 20px', () => {
      const ctx = fakeCtx([dmElement(0, 0)]);
      const tool = new PlayerHandTool(selectTool);
      tool.onPointerDown(down(100, 100), ctx);
      tool.onPointerMove(move(120, 100), ctx);
      const calls = (ctx.camera.pan as ReturnType<typeof vi.fn>).mock.calls;
      const totalDx = calls.reduce((sum, [dx]) => sum + dx, 0);
      const totalDy = calls.reduce((sum, [, dy]) => sum + dy, 0);
      expect(totalDx).toBe(20);
      expect(totalDy).toBe(0);
      tool.onPointerUp(up(120, 100), ctx);
    });

    it('after crossing the slop, further moves pan incrementally', () => {
      const ctx = fakeCtx([dmElement(0, 0)]);
      const tool = new PlayerHandTool(selectTool);
      tool.onPointerDown(down(100, 100), ctx);
      tool.onPointerMove(move(120, 100), ctx); // crosses slop, pans by 20
      expect(ctx.camera.pan).toHaveBeenCalledTimes(1);
      expect(ctx.camera.pan).toHaveBeenLastCalledWith(20, 0);
      tool.onPointerMove(move(125, 100), ctx); // incremental 5px
      expect(ctx.camera.pan).toHaveBeenCalledTimes(2);
      expect(ctx.camera.pan).toHaveBeenLastCalledWith(5, 0);
      tool.onPointerUp(up(125, 100), ctx);
    });

    it('never calls camera.pan with a zero delta once panning has started', () => {
      const ctx = fakeCtx([dmElement(0, 0)]);
      const tool = new PlayerHandTool(selectTool);
      tool.onPointerDown(down(100, 100), ctx);
      tool.onPointerMove(move(120, 100), ctx); // crosses slop, pans by 20
      expect(ctx.camera.pan).toHaveBeenCalledTimes(1);
      tool.onPointerMove(move(120, 100), ctx); // 0-delta move after slop crossed
      expect(ctx.camera.pan).toHaveBeenCalledTimes(1);
      tool.onPointerUp(up(120, 100), ctx);
    });

    it('resets dead-zone state on pointerup, so a fresh press needs to cross the slop again', () => {
      const ctx = fakeCtx([dmElement(0, 0)]);
      const tool = new PlayerHandTool(selectTool);
      tool.onPointerDown(down(100, 100), ctx);
      tool.onPointerMove(move(120, 100), ctx); // crosses slop, pans by 20
      tool.onPointerUp(up(120, 100), ctx);
      (ctx.camera.pan as ReturnType<typeof vi.fn>).mockClear();

      tool.onPointerDown(down(50, 50), ctx);
      tool.onPointerMove(move(53, 53), ctx); // dist ~4.2, within slop again
      expect(ctx.camera.pan).not.toHaveBeenCalled();
    });
  });
});
