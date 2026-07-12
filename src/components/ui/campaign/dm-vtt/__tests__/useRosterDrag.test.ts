import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import {
  useRosterDrag,
  stampAtScreenPoint,
} from '@/components/ui/campaign/dm-vtt/useRosterDrag';
import * as combatantToken from '@/components/ui/campaign/dm-vtt/combatantToken';

import type { CanvasElement, ToolContext, Viewport } from '@fieldnotes/core';
import type { EncounterEntity } from '@/types/encounter';

function makeEntity(overrides: Partial<EncounterEntity> = {}): EncounterEntity {
  return {
    id: 'e1',
    type: 'monster',
    name: 'Goblin',
    initiative: null,
    initiativeModifier: 0,
    currentHp: 7,
    maxHp: 7,
    tempHp: 0,
    armorClass: 15,
    conditions: [],
    ...overrides,
  } as EncounterEntity;
}

function fakeCanvasEl(rect: Partial<DOMRect>): HTMLElement {
  const el = document.createElement('div');
  el.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: 1000,
      bottom: 1000,
      width: 1000,
      height: 1000,
      x: 0,
      y: 0,
      toJSON: () => ({}),
      ...rect,
    }) as DOMRect;
  return el;
}

function fakeViewport(overrides: Partial<ToolContext> = {}): {
  vp: Viewport;
  added: CanvasElement[];
} {
  const added: CanvasElement[] = [];
  const toolContext = {
    camera: { screenToWorld: (p: { x: number; y: number }) => p },
    store: { add: vi.fn((el: CanvasElement) => added.push(el)) },
    requestRender: vi.fn(),
    gridSize: 40,
    gridType: 'square',
    activeLayerId: 'dm-layer',
    snapToGrid: false,
    ...overrides,
  } as unknown as ToolContext;
  const vp = {
    camera: toolContext.camera,
    toolContext,
  } as unknown as Viewport;
  return { vp, added };
}

function pointerEvent(type: string, x: number, y: number): PointerEvent {
  return new PointerEvent(type, {
    clientX: x,
    clientY: y,
    bubbles: true,
  });
}

describe('stampAtScreenPoint', () => {
  it('converts screen -> canvas-relative -> world using rect offset + identity camera', () => {
    const { vp, added } = fakeViewport();
    const canvasEl = fakeCanvasEl({ left: 100, top: 50 });
    const entity = makeEntity();

    stampAtScreenPoint(vp, canvasEl, entity, { x: 150, y: 90 });

    expect(added).toHaveLength(1);
    expect(added[0].position).toEqual({ x: 30, y: 20 }); // world (50,40) - half cell (20,20)
  });

  it('uses entity.color over the disposition color when set', () => {
    const { vp, added } = fakeViewport();
    const canvasEl = fakeCanvasEl({ left: 0, top: 0 });
    const entity = makeEntity({ color: '#a855f7', avatarUrl: undefined });

    stampAtScreenPoint(vp, canvasEl, entity, { x: 10, y: 10 });

    expect(added).toHaveLength(1);
    expect((added[0] as unknown as { fillColor?: string }).fillColor).toBe(
      '#a855f7'
    );
  });
});

describe('useRosterDrag', () => {
  it('does not set drag state on bare pointerdown (no ghost flicker before the tap threshold)', () => {
    const { vp } = fakeViewport();
    const canvasEl = fakeCanvasEl({});
    const onDropPlaced = vi.fn();

    const { result } = renderHook(() =>
      useRosterDrag({
        getViewport: () => vp,
        getCanvasEl: () => canvasEl,
        onDropPlaced,
      })
    );

    act(() => {
      result.current.startDrag(makeEntity(), {
        clientX: 100,
        clientY: 100,
      } as React.PointerEvent);
    });

    expect(result.current.drag).toBeNull();
  });

  it('does not stamp on a plain tap (movement below the 6px threshold)', () => {
    const { vp } = fakeViewport();
    const canvasEl = fakeCanvasEl({});
    const onDropPlaced = vi.fn();
    const spy = vi.spyOn(combatantToken, 'stampCombatantToken');

    const { result } = renderHook(() =>
      useRosterDrag({
        getViewport: () => vp,
        getCanvasEl: () => canvasEl,
        onDropPlaced,
      })
    );

    act(() => {
      result.current.startDrag(makeEntity(), {
        clientX: 100,
        clientY: 100,
      } as React.PointerEvent);
    });
    act(() => {
      window.dispatchEvent(pointerEvent('pointerup', 102, 101));
    });

    expect(spy).not.toHaveBeenCalled();
    expect(onDropPlaced).not.toHaveBeenCalled();
    expect(result.current.wasDrag()).toBe(false);
    expect(result.current.drag).toBeNull();
    spy.mockRestore();
  });

  it('stamps once and calls onDropPlaced when dropped inside canvas bounds', () => {
    const { vp, added } = fakeViewport();
    const canvasEl = fakeCanvasEl({
      left: 0,
      top: 0,
      right: 1000,
      bottom: 1000,
    });
    const onDropPlaced = vi.fn();
    const entity = makeEntity({ id: 'm1' });

    const { result } = renderHook(() =>
      useRosterDrag({
        getViewport: () => vp,
        getCanvasEl: () => canvasEl,
        onDropPlaced,
      })
    );

    act(() => {
      result.current.startDrag(entity, {
        clientX: 100,
        clientY: 100,
      } as React.PointerEvent);
    });
    act(() => {
      window.dispatchEvent(pointerEvent('pointermove', 130, 140));
    });
    expect(result.current.drag).toEqual({ entity, x: 130, y: 140 });

    act(() => {
      window.dispatchEvent(pointerEvent('pointerup', 130, 140));
    });

    expect(added).toHaveLength(1);
    expect(onDropPlaced).toHaveBeenCalledWith('m1');
    expect(onDropPlaced).toHaveBeenCalledTimes(1);
    expect(result.current.wasDrag()).toBe(true);
    expect(result.current.drag).toBeNull();
  });

  it('cancels (no stamp) when the drop lands outside the canvas bounds', () => {
    const { vp, added } = fakeViewport();
    const canvasEl = fakeCanvasEl({ left: 0, top: 0, right: 200, bottom: 200 });
    const onDropPlaced = vi.fn();
    const entity = makeEntity();

    const { result } = renderHook(() =>
      useRosterDrag({
        getViewport: () => vp,
        getCanvasEl: () => canvasEl,
        onDropPlaced,
      })
    );

    act(() => {
      result.current.startDrag(entity, {
        clientX: 100,
        clientY: 100,
      } as React.PointerEvent);
    });
    act(() => {
      window.dispatchEvent(pointerEvent('pointerup', 500, 500));
    });

    expect(added).toHaveLength(0);
    expect(onDropPlaced).not.toHaveBeenCalled();
    expect(result.current.wasDrag()).toBe(true);
    expect(result.current.drag).toBeNull();
  });

  it('removes window listeners after pointerup (a later stray move does nothing)', () => {
    const { vp } = fakeViewport();
    const canvasEl = fakeCanvasEl({});
    const onDropPlaced = vi.fn();

    const { result } = renderHook(() =>
      useRosterDrag({
        getViewport: () => vp,
        getCanvasEl: () => canvasEl,
        onDropPlaced,
      })
    );

    act(() => {
      result.current.startDrag(makeEntity(), {
        clientX: 100,
        clientY: 100,
      } as React.PointerEvent);
    });
    act(() => {
      window.dispatchEvent(pointerEvent('pointerup', 100, 100));
    });
    act(() => {
      window.dispatchEvent(pointerEvent('pointermove', 900, 900));
    });

    expect(result.current.drag).toBeNull();
  });

  it('cleans up window listeners on unmount (mid-drag unmount leaks no listeners)', () => {
    const { vp, added } = fakeViewport();
    const canvasEl = fakeCanvasEl({
      left: 0,
      top: 0,
      right: 1000,
      bottom: 1000,
    });
    const onDropPlaced = vi.fn();
    const spy = vi.spyOn(combatantToken, 'stampCombatantToken');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { result, unmount } = renderHook(() =>
      useRosterDrag({
        getViewport: () => vp,
        getCanvasEl: () => canvasEl,
        onDropPlaced,
      })
    );

    // Start drag and move beyond threshold
    act(() => {
      result.current.startDrag(makeEntity(), {
        clientX: 100,
        clientY: 100,
      } as React.PointerEvent);
    });
    act(() => {
      window.dispatchEvent(pointerEvent('pointermove', 130, 140));
    });
    expect(result.current.wasDrag()).toBe(true);
    expect(result.current.drag).not.toBeNull();

    // Unmount mid-drag
    act(() => {
      unmount();
    });

    // Dispatch window events after unmount — should have no effect
    act(() => {
      window.dispatchEvent(pointerEvent('pointermove', 150, 150));
    });
    act(() => {
      window.dispatchEvent(pointerEvent('pointerup', 150, 150));
    });

    // Verify: no stamp, no onDropPlaced, no errors; listeners were cleaned up
    expect(spy).not.toHaveBeenCalled();
    expect(onDropPlaced).not.toHaveBeenCalled();
    expect(added).toHaveLength(0);
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'pointermove',
      expect.any(Function)
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'pointerup',
      expect.any(Function)
    );

    spy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });
});
