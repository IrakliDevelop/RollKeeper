import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  ToolContext,
  PointerState,
  TemplateElement,
} from '@fieldnotes/core';
import {
  SpellTemplateTool,
  type SpellTemplateConfig,
} from '@/components/ui/campaign/player-vtt/SpellTemplateTool';

function fakeCtx() {
  const added: TemplateElement[] = [];
  const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];
  const ctx = {
    camera: { screenToWorld: (p: { x: number; y: number }) => p },
    store: {
      add: vi.fn((el: TemplateElement) => {
        added.push(el);
        return el;
      }),
      update: vi.fn((id: string, patch: Record<string, unknown>) => {
        updates.push({ id, patch });
      }),
    },
    requestRender: vi.fn(),
    switchTool: vi.fn(),
    setCursor: vi.fn(),
    gridSize: 40,
    activeLayerId: 'layer-1',
    snapToGrid: false, // smartSnap becomes identity without grid snap
  } as unknown as ToolContext;
  return { ctx, added, updates };
}

const down = (x: number, y: number) => ({ x, y }) as PointerState;

function armed(config: Partial<SpellTemplateConfig> = {}) {
  const onPlaced = vi.fn();
  const ref = {
    current: {
      shape: 'circle',
      sizeFeet: 20,
      onPlaced,
      ...config,
    } as SpellTemplateConfig,
  };
  return { tool: new SpellTemplateTool(ref), ref, onPlaced };
}

describe('SpellTemplateTool', () => {
  let f: ReturnType<typeof fakeCtx>;
  beforeEach(() => {
    f = fakeCtx();
  });

  it('places a circle sized from feet at the tap point (20ft radius @5ft/40px = 160px)', () => {
    const { tool, onPlaced } = armed({ shape: 'circle', sizeFeet: 20 });
    tool.onPointerDown(down(100, 200), f.ctx);
    expect(f.added).toHaveLength(1);
    const el = f.added[0];
    expect(el.templateShape).toBe('circle');
    expect(el.radius).toBe(160);
    expect(el.radiusFeet).toBe(20);
    expect(el.feetPerCell).toBe(5);
    expect(el.position).toEqual({ x: 100, y: 200 });
    tool.onPointerUp(down(100, 200), f.ctx);
    expect(f.ctx.switchTool).toHaveBeenCalledWith('select');
    expect(onPlaced).toHaveBeenCalledTimes(1);
  });

  it('squares use sizeFeet as the SIDE — the renderer draws side = radius (15ft cube @5ft/40px → radius 120px)', () => {
    // @fieldnotes/core draws squares as fillRect(cx - r/2, cy - r/2, r, r):
    // `radius` IS the full side length, so a 15ft cube spans 3 cells.
    const { tool } = armed({ shape: 'square', sizeFeet: 15 });
    tool.onPointerDown(down(0, 0), f.ctx);
    expect(f.added[0].templateShape).toBe('square');
    expect(f.added[0].radius).toBe(120);
  });

  it('cones aim by drag: angle updates on move, final on release', () => {
    const { tool, onPlaced } = armed({ shape: 'cone', sizeFeet: 15 });
    tool.onPointerDown(down(0, 0), f.ctx);
    expect(f.added[0].angle).toBe(0);
    tool.onPointerMove(down(10, 10), f.ctx);
    expect(f.updates).toHaveLength(1);
    expect(f.updates[0].patch.angle).toBeCloseTo(Math.PI / 4);
    tool.onPointerUp(down(10, 10), f.ctx);
    expect(onPlaced).toHaveBeenCalledTimes(1);
    expect(f.ctx.switchTool).toHaveBeenCalledWith('select');
  });

  it('does not update angle for circles on move', () => {
    const { tool } = armed({ shape: 'circle', sizeFeet: 20 });
    tool.onPointerDown(down(0, 0), f.ctx);
    tool.onPointerMove(down(50, 0), f.ctx);
    expect(f.updates).toHaveLength(0);
  });

  it('hex grids use the SDK cell unit √3·gridSize (20ft @hex/40px → radius 4·√3·40)', () => {
    // Mirrors TemplateTool/computeTemplateResize: snapUnit on hex grids is
    // √3 × gridSize. Using raw gridSize undersized templates by √3 and the
    // resize snap then read a "20 ft" circle back as 10 ft.
    (f.ctx as { gridType?: string }).gridType = 'hex';
    const { tool } = armed({ shape: 'circle', sizeFeet: 20 });
    tool.onPointerDown(down(0, 0), f.ctx);
    expect(f.added[0].radius).toBeCloseTo(4 * Math.sqrt(3) * 40, 6);
    expect(f.added[0].radiusFeet).toBe(20);
  });

  it('line spells place as RECTANGLE templates honoring widthFeet (100×10ft @5ft/40px)', () => {
    // core 0.48: rectangle = directional AoE with independent length/width —
    // finally renders Lightning-Bolt-style lines at their real width.
    const { tool } = armed({ shape: 'line', sizeFeet: 100, widthFeet: 10 });
    tool.onPointerDown(down(0, 0), f.ctx);
    const el = f.added[0];
    expect(el.templateShape).toBe('rectangle');
    expect(el.radius).toBe((100 / 5) * 40);
    expect(el.width).toBe((10 / 5) * 40);
    expect(el.radiusFeet).toBe(100);
  });

  it('line spells default to 5ft width (one cell)', () => {
    const { tool } = armed({ shape: 'line', sizeFeet: 60 });
    tool.onPointerDown(down(0, 0), f.ctx);
    expect(f.added[0].templateShape).toBe('rectangle');
    expect(f.added[0].width).toBe(40);
  });

  it('line (rectangle) placement aims by drag like cones', () => {
    const { tool, onPlaced } = armed({ shape: 'line', sizeFeet: 30 });
    tool.onPointerDown(down(0, 0), f.ctx);
    tool.onPointerMove(down(0, 10), f.ctx);
    expect(f.updates[0].patch.angle).toBeCloseTo(Math.PI / 2);
    tool.onPointerUp(down(0, 10), f.ctx);
    expect(onPlaced).toHaveBeenCalledTimes(1);
  });

  it('with a null config, bails to select without placing', () => {
    const ref = { current: null };
    const tool = new SpellTemplateTool(ref);
    tool.onPointerDown(down(0, 0), f.ctx);
    expect(f.added).toHaveLength(0);
    expect(f.ctx.switchTool).toHaveBeenCalledWith('select');
  });

  it('sets crosshair cursor on activate, default on deactivate', () => {
    const { tool } = armed();
    tool.onActivate?.(f.ctx);
    expect(f.ctx.setCursor).toHaveBeenCalledWith('crosshair');
    tool.onDeactivate?.(f.ctx);
    expect(f.ctx.setCursor).toHaveBeenCalledWith('default');
  });
});
