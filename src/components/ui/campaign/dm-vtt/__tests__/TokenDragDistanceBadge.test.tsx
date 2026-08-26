import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { TokenDragDistanceBadge } from '@/components/ui/campaign/dm-vtt/TokenDragDistanceBadge';
import { COMBATANT_TOKEN_KIND } from '@/components/ui/campaign/dm-vtt/combatantToken';

import type { CanvasElement, Viewport } from '@fieldnotes/core';

type FakeElement = {
  id: string;
  position: { x: number; y: number };
  tokenKind?: typeof COMBATANT_TOKEN_KIND;
  entityId?: string;
};

/**
 * Minimal stand-in for the SDK's Viewport. `toolManager`/`store` are plain
 * objects (not the real classes, which have private fields) — cast to the
 * SDK types at the call site, matching this repo's other dm-vtt fakes.
 */
function makeFakeViewport() {
  let activeToolName: string | null = 'select';
  const elements = new Map<string, FakeElement>();
  let selectedIds: string[] = [];

  const viewport = {
    toolContext: { gridSize: 50, gridType: 'square' as const },
    toolManager: {
      get activeTool() {
        return activeToolName ? { name: activeToolName } : null;
      },
      getTool: <T,>(name: string): T | undefined => {
        if (name !== 'select') return undefined;
        return { selectedIds } as unknown as T;
      },
    },
    store: {
      getById: (id: string) => elements.get(id) as unknown as CanvasElement,
    },
  } as unknown as Viewport;

  return {
    viewport,
    setActiveTool: (name: string | null) => {
      activeToolName = name;
    },
    setSelectedIds: (ids: string[]) => {
      selectedIds = ids;
    },
    putElement: (el: FakeElement) => {
      elements.set(el.id, el);
    },
    moveElement: (id: string, position: { x: number; y: number }) => {
      const existing = elements.get(id);
      if (!existing) return;
      // Mirror the real ElementStore.update: replace the object rather than
      // mutate it in place, so a stale captured reference would go stale.
      elements.set(id, { ...existing, position });
    },
  };
}

function combatant(
  id: string,
  position: { x: number; y: number }
): FakeElement {
  return {
    id,
    position,
    tokenKind: COMBATANT_TOKEN_KIND,
    entityId: 'entity-1',
  };
}

function nonCombatant(
  id: string,
  position: { x: number; y: number }
): FakeElement {
  return { id, position };
}

function press(canvasEl: HTMLElement) {
  act(() => {
    canvasEl.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, clientX: 0, clientY: 0 })
    );
  });
}

function move(clientX: number, clientY: number) {
  act(() => {
    window.dispatchEvent(
      new PointerEvent('pointermove', { bubbles: true, clientX, clientY })
    );
  });
}

function release() {
  act(() => {
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  });
}

describe('TokenDragDistanceBadge', () => {
  let canvasEl: HTMLDivElement;

  beforeEach(() => {
    canvasEl = document.createElement('div');
    document.body.appendChild(canvasEl);
  });

  afterEach(() => {
    cleanup();
    canvasEl.remove();
  });

  it('engages and tracks distance from the original origin across multiple moves', () => {
    const fake = makeFakeViewport();
    fake.setActiveTool('select');
    fake.putElement(combatant('tok-1', { x: 0, y: 0 }));
    fake.setSelectedIds(['tok-1']);

    render(
      <TokenDragDistanceBadge viewport={fake.viewport} canvasEl={canvasEl} />
    );

    press(canvasEl);
    move(0, 0); // first move: captures origin at {0,0}, then computes distance (0 ft)

    expect(document.body.textContent).toContain('0 ft');

    // Move the element via the store, as the SDK's SelectTool would during drag.
    fake.moveElement('tok-1', { x: 100, y: 0 }); // 100px / 50px cell * 5ft = 10 ft
    move(50, 50);
    expect(document.body.textContent).toContain('10 ft');

    // Origin must NOT be re-captured: distance keeps growing from the
    // ORIGINAL {0,0} origin, not from the position at the second move.
    fake.moveElement('tok-1', { x: 200, y: 0 }); // 200px / 50px * 5ft = 20 ft
    move(100, 100);
    expect(document.body.textContent).toContain('20 ft');

    release();
  });

  it('simulates select-then-drag ordering: selection lands between pointerdown and the first pointermove', () => {
    const fake = makeFakeViewport();
    fake.setActiveTool('select');
    fake.putElement(combatant('tok-1', { x: 0, y: 0 }));
    // No selection yet at pointerdown time — the SDK hasn't processed the
    // click's selection. This pins Finding 2's fix: engagement must still
    // happen because detection runs on the first pointermove, not pointerdown.
    fake.setSelectedIds([]);

    render(
      <TokenDragDistanceBadge viewport={fake.viewport} canvasEl={canvasEl} />
    );

    press(canvasEl);
    // SDK processes the click's selection sometime between down and the
    // first move.
    fake.setSelectedIds(['tok-1']);

    // First move: origin capture reads the CURRENT (pre-drag) position —
    // this only succeeds because detection ran on pointermove, not on the
    // (pre-selection) pointerdown.
    move(0, 0);
    fake.moveElement('tok-1', { x: 100, y: 0 }); // 100px / 50px cell * 5ft = 10 ft
    move(10, 10);

    expect(document.body.textContent).toContain('10 ft');
  });

  it('does not show a badge when a non-select tool is active, even with a combatant selected', () => {
    const fake = makeFakeViewport();
    fake.setActiveTool('hand');
    fake.putElement(combatant('tok-1', { x: 0, y: 0 }));
    fake.setSelectedIds(['tok-1']);

    render(
      <TokenDragDistanceBadge viewport={fake.viewport} canvasEl={canvasEl} />
    );

    press(canvasEl);
    fake.moveElement('tok-1', { x: 100, y: 0 });
    move(10, 10);

    expect(document.body.textContent).not.toContain('ft');
  });

  it('does not show a badge when the selection is not a combatant token', () => {
    const fake = makeFakeViewport();
    fake.setActiveTool('select');
    fake.putElement(nonCombatant('deco-1', { x: 0, y: 0 }));
    fake.setSelectedIds(['deco-1']);

    render(
      <TokenDragDistanceBadge viewport={fake.viewport} canvasEl={canvasEl} />
    );

    press(canvasEl);
    move(10, 10);

    expect(document.body.textContent).not.toContain('ft');
  });

  it('hides and resets the drag state on pointerup', () => {
    const fake = makeFakeViewport();
    fake.setActiveTool('select');
    fake.putElement(combatant('tok-1', { x: 0, y: 0 }));
    fake.setSelectedIds(['tok-1']);

    render(
      <TokenDragDistanceBadge viewport={fake.viewport} canvasEl={canvasEl} />
    );

    press(canvasEl);
    move(0, 0); // captures origin at the pre-drag position
    fake.moveElement('tok-1', { x: 100, y: 0 }); // 100px / 50px cell * 5ft = 10 ft
    move(10, 10);
    expect(document.body.textContent).toContain('10 ft');

    release();
    expect(document.body.textContent).not.toContain('ft');

    // A move after release (no new press) must not re-show a stale badge.
    move(20, 20);
    expect(document.body.textContent).not.toContain('ft');
  });
});
