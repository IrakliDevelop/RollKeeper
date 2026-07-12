import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  COMBATANT_TOKEN_KIND,
  COMBATANT_TOKEN_ZINDEX,
  isCombatantToken,
  dispositionColor,
  stampCombatantToken,
  restampCombatantTokens,
  DmTokenTool,
  type DmTokenConfig,
} from '@/components/ui/campaign/dm-vtt/combatantToken';

import type {
  CanvasElement,
  ElementStore,
  PointerState,
  ToolContext,
} from '@fieldnotes/core';
import type { EncounterEntity } from '@/types/encounter';

function fakeCtx(overrides: Record<string, unknown> = {}) {
  const added: CanvasElement[] = [];
  const ctx = {
    camera: { screenToWorld: (p: { x: number; y: number }) => p },
    store: {
      add: vi.fn((el: CanvasElement) => {
        added.push(el);
        return el;
      }),
      remove: vi.fn(),
    },
    requestRender: vi.fn(),
    switchTool: vi.fn(),
    setCursor: vi.fn(),
    gridSize: 40,
    gridType: 'square',
    activeLayerId: 'dm-layer',
    snapToGrid: false,
    ...overrides,
  } as unknown as ToolContext;
  return { ctx, added };
}

const down = (x: number, y: number) => ({ x, y }) as PointerState;

describe('dispositionColor', () => {
  it('players are emerald regardless of disposition', () => {
    expect(dispositionColor({ type: 'player' })).toBe('#12855C');
  });
  it('legendary creatures are boss purple', () => {
    expect(
      dispositionColor({
        type: 'monster',
        legendaryActions: { count: 3, usedActions: 0, actions: [] },
      } as never)
    ).toBe('#7C4DBC');
  });
  it('allies blue, neutral gray, enemies (default) red', () => {
    expect(dispositionColor({ type: 'npc', playerDisposition: 'ally' })).toBe(
      '#2F6FD0'
    );
    expect(
      dispositionColor({ type: 'npc', playerDisposition: 'neutral' })
    ).toBe('#6B7280');
    expect(dispositionColor({ type: 'monster' })).toBe('#C0392B');
  });
});

describe('stampCombatantToken', () => {
  it('stamps an avatar image token with linkage keys, sized to one cell', () => {
    const { ctx, added } = fakeCtx();
    stampCombatantToken(
      {
        entityId: 'e1',
        name: 'Goblin',
        avatarUrl: 'https://x/y.png',
        color: '#C0392B',
      },
      { x: 100, y: 100 },
      ctx
    );
    expect(added).toHaveLength(1);
    const el = added[0] as CanvasElement & {
      entityId?: string;
      tokenKind?: string;
      size?: { w: number };
      zIndex?: number;
    };
    expect(el.type).toBe('image');
    expect(el.entityId).toBe('e1');
    expect(el.tokenKind).toBe(COMBATANT_TOKEN_KIND);
    expect(el.size?.w).toBe(40); // one square cell
    expect(el.zIndex).toBe(COMBATANT_TOKEN_ZINDEX);
    expect(isCombatantToken(el)).toBe(true);
  });

  it('falls back to a tinted ellipse without an http avatar', () => {
    const { ctx, added } = fakeCtx();
    stampCombatantToken(
      { entityId: 'e2', name: 'Wolf', color: '#6B7280' },
      { x: 0, y: 0 },
      ctx
    );
    const el = added[0] as unknown as CanvasElement & {
      shape?: string;
      fillColor?: string;
      zIndex?: number;
    };
    expect(el.type).toBe('shape');
    expect(el.shape).toBe('ellipse');
    expect(el.fillColor).toBe('#6B7280');
    expect(el.zIndex).toBe(COMBATANT_TOKEN_ZINDEX);
    expect(isCombatantToken(el as CanvasElement)).toBe(true);
  });

  it('sizes to the hex cell unit on hex grids', () => {
    const { ctx, added } = fakeCtx({ gridType: 'hex' });
    stampCombatantToken(
      { entityId: 'e3', name: 'Ogre', color: '#C0392B' },
      { x: 0, y: 0 },
      ctx
    );
    const el = added[0] as CanvasElement & { size?: { w: number } };
    expect(el.size?.w).toBeCloseTo(Math.sqrt(3) * 40, 6);
  });

  it('a 1×1 token centers in the CELL (not the old four-cell intersection)', () => {
    const { ctx, added } = fakeCtx({ snapToGrid: true });
    stampCombatantToken(
      { entityId: 'e4', name: 'Goblin', color: '#C0392B' },
      { x: 55, y: 70 },
      ctx
    );
    const el = added[0] as CanvasElement & {
      position?: { x: number; y: number };
      size?: { w: number; h: number };
    };
    // cell (40,40)-(80,80) center is (60,60); one-cell size is 40 → position
    // is the center minus half the size.
    expect(el.size).toEqual({ w: 40, h: 40 });
    expect(el.position).toEqual({ x: 40, y: 40 });
  });

  it('a 2×2 token (tokenSize: 2) fills 80×80 and centers on the intersection', () => {
    const { ctx, added } = fakeCtx({ snapToGrid: true });
    stampCombatantToken(
      { entityId: 'e5', name: 'Ogre', color: '#C0392B', tokenSize: 2 },
      { x: 55, y: 70 },
      ctx
    );
    const el = added[0] as CanvasElement & {
      position?: { x: number; y: number };
      size?: { w: number; h: number };
    };
    // intersection nearest (55,70) is (40,80); 2-cell size is 80 → position
    // is the intersection minus half the size.
    expect(el.size).toEqual({ w: 80, h: 80 });
    expect(el.position).toEqual({ x: 0, y: 40 });
  });

  it('rejects a base64 data-URL avatar (strict guard) — falls back to ellipse', () => {
    const { ctx, added } = fakeCtx();
    stampCombatantToken(
      {
        entityId: 'e6',
        name: 'Sneaky',
        avatarUrl: 'data:image/png;base64,xyz',
        color: '#6B7280',
      },
      { x: 0, y: 0 },
      ctx
    );
    const el = added[0] as CanvasElement & { shape?: string };
    expect(el.type).toBe('shape');
    expect(el.shape).toBe('ellipse');
  });

  it('rejects a lookalike scheme like httpx:// (sharper than the old startsWith("http") guard) — falls back to ellipse', () => {
    const { ctx, added } = fakeCtx();
    stampCombatantToken(
      {
        entityId: 'e7',
        name: 'Sneakier',
        avatarUrl: 'httpx://evil',
        color: '#6B7280',
      },
      { x: 0, y: 0 },
      ctx
    );
    const el = added[0] as CanvasElement & { shape?: string };
    expect(el.type).toBe('shape');
    expect(el.shape).toBe('ellipse');
  });
});

describe('isCombatantToken', () => {
  it('rejects plain elements and wrong kinds', () => {
    const { ctx, added } = fakeCtx();
    stampCombatantToken(
      { entityId: 'e1', name: 'G', color: '#C0392B' },
      { x: 0, y: 0 },
      ctx
    );
    expect(isCombatantToken(added[0])).toBe(true);
    expect(
      isCombatantToken({
        ...added[0],
        tokenKind: 'other',
      } as unknown as CanvasElement)
    ).toBe(false);
    expect(
      isCombatantToken({
        ...added[0],
        entityId: undefined,
      } as unknown as CanvasElement)
    ).toBe(false);
  });
});

describe('DmTokenTool', () => {
  let onPlaced: ReturnType<typeof vi.fn>;
  let ref: { current: DmTokenConfig | null };

  beforeEach(() => {
    onPlaced = vi.fn(() => {});
    ref = {
      current: {
        entityId: 'e1',
        name: 'Goblin',
        color: '#C0392B',
        onPlaced: onPlaced as () => void,
      },
    };
  });

  it('places once, then hands to select and fires onPlaced', () => {
    const { ctx, added } = fakeCtx();
    const tool = new DmTokenTool(ref);
    tool.onPointerDown(down(10, 10), ctx);
    expect(added).toHaveLength(1);
    tool.onPointerUp(down(10, 10), ctx);
    expect(ctx.switchTool).toHaveBeenCalledWith('select');
    expect(onPlaced).toHaveBeenCalledTimes(1);
  });

  it('bails to select without placing when config is null', () => {
    const { ctx, added } = fakeCtx();
    const tool = new DmTokenTool({ current: null });
    tool.onPointerDown(down(10, 10), ctx);
    expect(added).toHaveLength(0);
    expect(ctx.switchTool).toHaveBeenCalledWith('select');
  });

  it('crosshair on activate, default on deactivate', () => {
    const { ctx } = fakeCtx();
    const tool = new DmTokenTool(ref);
    tool.onActivate?.(ctx);
    expect(ctx.setCursor).toHaveBeenCalledWith('crosshair');
    tool.onDeactivate?.(ctx);
    expect(ctx.setCursor).toHaveBeenCalledWith('default');
  });

  it('deactivation mid-gesture removes the in-flight token (Escape cancel)', () => {
    const { ctx, added } = fakeCtx();
    const tool = new DmTokenTool(ref);
    tool.onPointerDown(down(10, 10), ctx);
    expect(added).toHaveLength(1);
    tool.onDeactivate?.(ctx);
    expect(ctx.store.remove).toHaveBeenCalledWith(added[0].id);
  });

  it('deactivation after normal completion removes nothing', () => {
    const { ctx, added } = fakeCtx();
    const tool = new DmTokenTool(ref);
    tool.onPointerDown(down(10, 10), ctx);
    tool.onPointerUp(down(10, 10), ctx);
    tool.onDeactivate?.(ctx);
    expect(ctx.store.remove).not.toHaveBeenCalled();
    expect(onPlaced).toHaveBeenCalledTimes(1);
  });
});

describe('restampCombatantTokens', () => {
  const ctx = {
    gridSize: 40,
    gridType: 'square',
    snapToGrid: true,
  } as unknown as ToolContext;

  function fakeStore(seed: Record<string, unknown>[]) {
    const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];
    const added: Record<string, unknown>[] = [];
    const removed: string[] = [];
    return {
      store: {
        getAll: () => seed,
        update: (id: string, patch: Record<string, unknown>) =>
          updates.push({ id, patch }),
        add: (el: Record<string, unknown>) => added.push(el),
        remove: (id: string) => removed.push(id),
      } as unknown as ElementStore,
      updates,
      added,
      removed,
    };
  }

  const imageToken = {
    id: 'tok-1',
    type: 'image',
    position: { x: 40, y: 40 },
    size: { w: 40, h: 40 },
    layerId: 'l1',
    src: 'https://x/old.png',
    entityId: 'ent-1',
    tokenKind: 'combatant',
  };

  const entity = (o: Partial<EncounterEntity>): EncounterEntity =>
    ({
      id: 'ent-1',
      type: 'monster',
      name: 'Ogre',
      currentHp: 30,
      maxHp: 60,
      tempHp: 0,
      armorClass: 11,
      initiative: null,
      initiativeModifier: 0,
      conditions: [],
      ...o,
    }) as EncounterEntity;

  it('updates src, size, and re-snapped position in place for same-type', () => {
    const f = fakeStore([imageToken]);
    restampCombatantTokens(
      f.store,
      entity({ avatarUrl: 'https://x/new.png', tokenSize: 2 }),
      ctx
    );
    expect(f.removed).toHaveLength(0);
    expect(f.added).toHaveLength(0);
    expect(f.updates).toHaveLength(1);
    expect(f.updates[0].id).toBe('tok-1');
    // old center {60,60}; even footprint snaps to the nearest intersection:
    // Math.round(60/40)*40 = 80 → center {80,80}, size 80 → position {40,40}
    expect(f.updates[0].patch).toEqual({
      src: 'https://x/new.png',
      size: { w: 80, h: 80 },
      position: { x: 40, y: 40 },
      zIndex: COMBATANT_TOKEN_ZINDEX,
    });
  });

  it('removes + re-adds preserving keys/layer when ellipse gains a portrait', () => {
    const ellipse = {
      ...imageToken,
      type: 'shape',
      shape: 'ellipse',
      src: undefined,
    };
    const f = fakeStore([ellipse]);
    restampCombatantTokens(
      f.store,
      entity({ avatarUrl: 'https://x/new.png' }),
      ctx
    );
    expect(f.removed).toEqual(['tok-1']);
    expect(f.added).toHaveLength(1);
    const el = f.added[0] as Record<string, unknown>;
    expect(el.type).toBe('image');
    expect(el.entityId).toBe('ent-1');
    expect(el.tokenKind).toBe('combatant');
    expect(el.layerId).toBe('l1');
    expect(el.zIndex).toBe(COMBATANT_TOKEN_ZINDEX);
  });

  it('ignores tokens of other entities', () => {
    const f = fakeStore([{ ...imageToken, entityId: 'other' }]);
    restampCombatantTokens(f.store, entity({ tokenSize: 2 }), ctx);
    expect(f.updates).toHaveLength(0);
    expect(f.added).toHaveLength(0);
    expect(f.removed).toHaveLength(0);
  });
});
