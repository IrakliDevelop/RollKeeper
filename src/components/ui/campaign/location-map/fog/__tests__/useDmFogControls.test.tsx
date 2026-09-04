import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  FogManager,
  FogTool,
  ToolManager,
  type Viewport,
} from '@fieldnotes/core';
import { useDmFogControls } from '../useDmFogControls';

function viewportHarness() {
  const fog = new FogManager();
  const toolManager = new ToolManager();
  toolManager.register(new FogTool(fog));
  const setTool = vi.fn();
  return {
    fog,
    toolManager,
    setTool,
  } as unknown as Viewport & { setTool: ReturnType<typeof vi.fn> };
}

describe('useDmFogControls', () => {
  it('requires confirmation before first covered initialization', () => {
    const viewport = viewportHarness();
    const { result } = renderHook(() =>
      useDmFogControls({
        viewport,
        available: true,
        getBounds: () => ({ x: 10, y: 20, w: 600, h: 400 }),
      })
    );

    act(() => result.current.requestActivate());
    expect(result.current.pendingAction).toBe('enable');
    expect(viewport.fog.getState()).toBeNull();

    act(() => result.current.confirmAction());
    expect(viewport.fog.getState()?.definition.base).toBe('covered');
    expect(viewport.fog.getState()?.definition.bounds).toEqual({
      x: 10,
      y: 20,
      w: 600,
      h: 400,
    });
    expect(viewport.setTool).toHaveBeenCalledWith('fog');
  });

  it('updates the registered tool and keeps preview session-only', () => {
    const viewport = viewportHarness();
    viewport.fog.initialize({
      bounds: { x: 0, y: 0, w: 100, h: 100 },
      base: 'covered',
      cellSize: 8,
    });
    const { result, unmount } = renderHook(() =>
      useDmFogControls({
        viewport,
        available: true,
        getBounds: () => ({ x: 0, y: 0, w: 100, h: 100 }),
      })
    );

    act(() => {
      result.current.setOperation('conceal');
      result.current.setShape('rectangle');
      result.current.setRadius(72);
      result.current.setPreview(true);
    });
    expect(viewport.toolManager.getTool<FogTool>('fog')?.getOptions()).toEqual({
      operation: 'conceal',
      shape: 'rectangle',
      radius: 72,
    });
    expect(viewport.fog.getViewMode()).toBe('player');

    unmount();
    renderHook(() =>
      useDmFogControls({
        viewport,
        available: true,
        getBounds: () => ({ x: 0, y: 0, w: 100, h: 100 }),
      })
    );
    expect(viewport.fog.getViewMode()).toBe('editor');
  });

  it('uses confirmed history-bearing bulk operations and can disable fog', () => {
    const viewport = viewportHarness();
    viewport.fog.initialize({
      bounds: { x: 0, y: 0, w: 100, h: 100 },
      base: 'covered',
      cellSize: 8,
    });
    const reveal = vi.spyOn(viewport.fog, 'applyRegion');
    const reset = vi.spyOn(viewport.fog, 'reset');
    const { result } = renderHook(() =>
      useDmFogControls({
        viewport,
        available: true,
        getBounds: () => ({ x: 0, y: 0, w: 100, h: 100 }),
      })
    );

    act(() => result.current.requestAction('reveal-all'));
    act(() => result.current.confirmAction());
    expect(reveal).toHaveBeenCalledWith(
      {
        kind: 'rectangle',
        from: { x: 0, y: 0 },
        to: { x: 100, y: 100 },
      },
      'reveal'
    );

    act(() => result.current.requestAction('cover-all'));
    act(() => result.current.confirmAction());
    expect(reset).toHaveBeenCalledWith('covered');

    act(() => result.current.requestAction('disable'));
    act(() => result.current.confirmAction());
    expect(viewport.fog.getState()).toBeNull();
    expect(viewport.setTool).toHaveBeenLastCalledWith('select');
  });

  it('blocks activation with an actionable reason during map mutations', () => {
    const viewport = viewportHarness();
    const { result } = renderHook(() =>
      useDmFogControls({
        viewport,
        available: true,
        getBounds: () => ({ x: 0, y: 0, w: 100, h: 100 }),
        disabled: true,
        disabledReason: 'Finish arranging map images before editing fog.',
      })
    );
    act(() => result.current.requestActivate());
    expect(result.current.diagnostic).toMatch(/finish arranging/i);
    expect(viewport.setTool).not.toHaveBeenCalled();
  });
});
