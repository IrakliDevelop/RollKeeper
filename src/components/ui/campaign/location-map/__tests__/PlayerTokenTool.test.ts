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
    const tool = new PlayerTokenTool(
      '#12855C',
      { current: null },
      { current: 'char-1' }
    );
    tool.onPointerDown(down(100, 100), ctx);
    const el = added[0] as CanvasElement & { size?: { w: number } };
    expect(el.size?.w).toBe(40);
  });

  it('hex grids: token fills one cell = √3 × gridSize (SDK cell unit)', () => {
    const { ctx, added } = fakeCtx({ gridType: 'hex' });
    const tool = new PlayerTokenTool(
      '#12855C',
      { current: null },
      { current: 'char-1' }
    );
    tool.onPointerDown(down(0, 0), ctx);
    const el = added[0] as CanvasElement & { size?: { w: number } };
    expect(el.size?.w).toBeCloseTo(Math.sqrt(3) * 40, 6);
  });

  it('avatar tokens size identically (image branch)', () => {
    const { ctx, added } = fakeCtx({ gridType: 'hex' });
    const tool = new PlayerTokenTool(
      '#12855C',
      {
        current: 'https://x/avatar.png',
      },
      { current: 'char-1' }
    );
    tool.onPointerDown(down(0, 0), ctx);
    const el = added[0] as CanvasElement & {
      size?: { w: number };
      type: string;
    };
    expect(el.type).toBe('image');
    expect(el.size?.w).toBeCloseTo(Math.sqrt(3) * 40, 6);
  });

  it('stamps characterId + tokenKind player on image tokens', () => {
    const { ctx, added } = fakeCtx();
    const tool = new PlayerTokenTool(
      '#ef4444',
      { current: 'https://x/a.png' },
      { current: 'char-1' }
    );
    tool.onPointerDown(down(0, 0), ctx);
    const el = added[0] as unknown as {
      characterId?: string;
      tokenKind?: string;
    };
    expect(el.characterId).toBe('char-1');
    expect(el.tokenKind).toBe('player');
  });

  it('stamps the keys on the ellipse fallback too', () => {
    const { ctx, added } = fakeCtx();
    const tool = new PlayerTokenTool(
      '#ef4444',
      { current: null },
      { current: 'char-1' }
    );
    tool.onPointerDown(down(0, 0), ctx);
    const el = added[0] as unknown as {
      characterId?: string;
      tokenKind?: string;
    };
    expect(el.characterId).toBe('char-1');
    expect(el.tokenKind).toBe('player');
  });

  it('places an unstamped token when no characterId is known', () => {
    const { ctx, added } = fakeCtx();
    const tool = new PlayerTokenTool(
      '#ef4444',
      { current: null },
      { current: null }
    );
    tool.onPointerDown(down(0, 0), ctx);
    const el = added[0] as unknown as {
      characterId?: string;
      tokenKind?: string;
    };
    expect(el.characterId).toBeUndefined();
    expect(el.tokenKind).toBeUndefined();
  });
});
