import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SelectTool, createImage } from '@fieldnotes/core';
import { PlayerHandTool } from '@/components/ui/campaign/location-map/PlayerHandTool';

import type {
  CanvasElement,
  PointerState,
  ToolContext,
} from '@fieldnotes/core';

const OWN_LAYER = 'player-char-1';
const DM_LAYER = 'dm-layer';

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

  it('an element-level lock also pans', () => {
    const el = { ...ownToken(0, 0), locked: true };
    const ctx = fakeCtx([el]);
    const tool = new PlayerHandTool(selectTool);
    tool.onPointerDown(down(20, 20), ctx);
    expect(ctx.switchTool).not.toHaveBeenCalled();
  });
});
