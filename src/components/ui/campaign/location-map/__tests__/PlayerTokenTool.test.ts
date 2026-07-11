import { describe, it, expect, vi } from 'vitest';
import { PlayerTokenTool } from '@/components/ui/campaign/location-map/PlayerTokenTool';

import type {
  CanvasElement,
  PointerState,
  ToolContext,
} from '@fieldnotes/core';

function fakeCtx(overrides: Record<string, unknown> = {}) {
  const added: CanvasElement[] = [];
  const ctx = {
    camera: { screenToWorld: (p: { x: number; y: number }) => p },
    store: {
      add: vi.fn((el: CanvasElement) => {
        added.push(el);
      }),
    },
    requestRender: vi.fn(),
    switchTool: vi.fn(),
    gridSize: 40,
    gridType: 'square',
    activeLayerId: 'player-1',
    snapToGrid: false,
    ...overrides,
  } as unknown as ToolContext;
  return { ctx, added };
}

const down = (x: number, y: number) => ({ x, y }) as PointerState;

describe('PlayerTokenTool sizing', () => {
  it('square grids: token fills one cell (gridSize px)', () => {
    const { ctx, added } = fakeCtx();
    const tool = new PlayerTokenTool('#12855C', { current: null });
    tool.onPointerDown(down(100, 100), ctx);
    const el = added[0] as CanvasElement & { size?: { w: number } };
    expect(el.size?.w).toBe(40);
  });

  it('hex grids: token fills one cell = √3 × gridSize (SDK cell unit)', () => {
    const { ctx, added } = fakeCtx({ gridType: 'hex' });
    const tool = new PlayerTokenTool('#12855C', { current: null });
    tool.onPointerDown(down(0, 0), ctx);
    const el = added[0] as CanvasElement & { size?: { w: number } };
    expect(el.size?.w).toBeCloseTo(Math.sqrt(3) * 40, 6);
  });

  it('avatar tokens size identically (image branch)', () => {
    const { ctx, added } = fakeCtx({ gridType: 'hex' });
    const tool = new PlayerTokenTool('#12855C', {
      current: 'https://x/avatar.png',
    });
    tool.onPointerDown(down(0, 0), ctx);
    const el = added[0] as CanvasElement & {
      size?: { w: number };
      type: string;
    };
    expect(el.type).toBe('image');
    expect(el.size?.w).toBeCloseTo(Math.sqrt(3) * 40, 6);
  });
});
