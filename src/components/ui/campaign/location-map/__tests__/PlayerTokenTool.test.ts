import { describe, it, expect, vi } from 'vitest';
import { TemplateTool } from '@fieldnotes/core';
import {
  PlayerTokenTool,
  PlayerTemplateTool,
} from '@/components/ui/campaign/location-map/PlayerTokenTool';
import {
  TOKEN_ELEMENT_ZINDEX,
  TEMPLATE_ELEMENT_ZINDEX,
} from '@/components/ui/campaign/location-map/tokenSnap';

import type {
  CanvasElement,
  PointerState,
  ToolContext,
} from '@fieldnotes/core';

function fakeCtx(overrides: Record<string, unknown> = {}) {
  const added: CanvasElement[] = [];
  const elements: CanvasElement[] = [];
  const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];
  const ctx = {
    camera: { screenToWorld: (p: { x: number; y: number }) => p },
    store: {
      add: vi.fn((el: CanvasElement) => {
        added.push(el);
        elements.push(el);
      }),
      getAll: vi.fn(() => elements),
      update: vi.fn((id: string, patch: Record<string, unknown>) => {
        updates.push({ id, patch });
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
  return { ctx, added, elements, updates };
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

  it('centers the token in the CELL on square grids (not the old four-cell intersection)', () => {
    const { ctx, added } = fakeCtx({ snapToGrid: true });
    const tool = new PlayerTokenTool(
      '#12855C',
      { current: null },
      { current: 'char-1' }
    );
    tool.onPointerDown(down(55, 70), ctx);
    const el = added[0] as CanvasElement & {
      position?: { x: number; y: number };
      size?: { w: number; h: number };
    };
    // cell (40,40)-(80,80) center is (60,60); one-cell size is 40 → position
    // is the center minus half the size.
    expect(el.size).toEqual({ w: 40, h: 40 });
    expect(el.position).toEqual({ x: 40, y: 40 });
  });

  it('stamps TOKEN_ELEMENT_ZINDEX on the ellipse fallback (guarantees paint above the map background)', () => {
    const { ctx, added } = fakeCtx();
    const tool = new PlayerTokenTool(
      '#12855C',
      { current: null },
      { current: 'char-1' }
    );
    tool.onPointerDown(down(0, 0), ctx);
    const el = added[0] as CanvasElement & { zIndex?: number };
    expect(el.zIndex).toBe(TOKEN_ELEMENT_ZINDEX);
  });

  it('stamps TOKEN_ELEMENT_ZINDEX on avatar image tokens too', () => {
    const { ctx, added } = fakeCtx();
    const tool = new PlayerTokenTool(
      '#12855C',
      { current: 'https://x/a.png' },
      { current: 'char-1' }
    );
    tool.onPointerDown(down(0, 0), ctx);
    const el = added[0] as CanvasElement & { zIndex?: number };
    expect(el.zIndex).toBe(TOKEN_ELEMENT_ZINDEX);
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

describe('PlayerTemplateTool zIndex stamping', () => {
  it('stamps TEMPLATE_ELEMENT_ZINDEX on the newly created template, leaving pre-existing elements untouched', () => {
    const { ctx, elements, updates } = fakeCtx();
    const preExisting = {
      id: 'existing-1',
      type: 'template',
    } as unknown as CanvasElement;
    elements.push(preExisting);

    // The SDK base class has no zIndex option; simulate it creating a new
    // template element via the store, the way the real onPointerDown does.
    const spy = vi
      .spyOn(TemplateTool.prototype, 'onPointerDown')
      .mockImplementation((_state, c) => {
        c.store.add({
          id: 'new-template-1',
          type: 'template',
        } as unknown as CanvasElement);
      });

    const tool = new PlayerTemplateTool();
    tool.onPointerDown(down(10, 10), ctx);

    expect(updates).toEqual([
      { id: 'new-template-1', patch: { zIndex: TEMPLATE_ELEMENT_ZINDEX } },
    ]);

    spy.mockRestore();
  });
});
