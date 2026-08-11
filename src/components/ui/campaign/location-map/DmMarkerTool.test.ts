import { describe, it, expect, vi } from 'vitest';
import { Camera, ElementStore, createShape } from '@fieldnotes/core';
import type { PointerState, Tool, ToolContext } from '@fieldnotes/core';
import {
  DmMarkerTool,
  MARKER_TOOL_NAME,
  MARKER_TOOL_SLOP_PX,
  type PlaceMarkerRequest,
} from '@/components/ui/campaign/location-map/DmMarkerTool';
import type { MarkerKind, MarkerColorKey } from './markerData';

const down = (x: number, y: number) =>
  ({
    x,
    y,
    pressure: 1,
    pointerType: 'mouse',
    shiftKey: false,
  }) as PointerState;

/**
 * Builds a real ToolContext backed by real fieldnotes Camera/ElementStore
 * instances (per brief: zero @fieldnotes module mocks). `overrides` layers
 * on top for grid settings the tool reads directly.
 */
function realCtx(overrides: Partial<ToolContext> = {}) {
  const camera = new Camera();
  const store = new ElementStore();
  const requestRender = vi.fn();
  const switchTool = vi.fn();
  const ctx = {
    camera,
    store,
    requestRender,
    switchTool,
    gridSize: 40,
    gridType: 'square',
    activeLayerId: 'dm-1',
    snapToGrid: false,
    ...overrides,
  } as unknown as ToolContext;
  return { ctx, camera, store, requestRender, switchTool };
}

describe('DmMarkerTool placement', () => {
  it('a tap emits exactly one onPlaceMarker with position, size, kind and color', () => {
    const { ctx } = realCtx();
    const onPlaceMarker = vi.fn<(request: PlaceMarkerRequest) => void>();
    const tool = new DmMarkerTool(
      { current: 'door' },
      { current: 'red' },
      onPlaceMarker
    );

    tool.onPointerDown(down(100, 100), ctx);
    tool.onPointerUp(down(100, 100), ctx);

    expect(onPlaceMarker).toHaveBeenCalledTimes(1);
    expect(onPlaceMarker).toHaveBeenCalledWith({
      position: { x: 80, y: 80 },
      size: { w: 40, h: 40 },
      kind: 'door',
      color: 'red',
    });
  });

  it('sizes to the grid cell: square gridSize 60 -> 60', () => {
    const { ctx } = realCtx({ gridSize: 60, gridType: 'square' });
    const onPlaceMarker = vi.fn<(request: PlaceMarkerRequest) => void>();
    const tool = new DmMarkerTool(
      { current: 'trap' },
      { current: 'blue' },
      onPlaceMarker
    );
    tool.onPointerDown(down(0, 0), ctx);
    tool.onPointerUp(down(0, 0), ctx);
    expect(onPlaceMarker.mock.calls[0]?.[0]?.size).toEqual({ w: 60, h: 60 });
  });

  it('sizes to the grid cell: hex gridSize 60 -> sqrt(3) * 60', () => {
    const { ctx } = realCtx({ gridSize: 60, gridType: 'hex' });
    const onPlaceMarker = vi.fn<(request: PlaceMarkerRequest) => void>();
    const tool = new DmMarkerTool(
      { current: 'trap' },
      { current: 'blue' },
      onPlaceMarker
    );
    tool.onPointerDown(down(0, 0), ctx);
    tool.onPointerUp(down(0, 0), ctx);
    const size = onPlaceMarker.mock.calls[0]?.[0]?.size;
    expect(size?.w).toBeCloseTo(103.92304845413263, 6);
    expect(size?.h).toBeCloseTo(103.92304845413263, 6);
  });

  it('sizes to 40x40 when no grid is enabled (gridSize undefined)', () => {
    const { ctx } = realCtx({ gridSize: undefined, gridType: undefined });
    const onPlaceMarker = vi.fn<(request: PlaceMarkerRequest) => void>();
    const tool = new DmMarkerTool(
      { current: 'note' },
      { current: 'amber' },
      onPlaceMarker
    );
    tool.onPointerDown(down(0, 0), ctx);
    tool.onPointerUp(down(0, 0), ctx);
    expect(onPlaceMarker.mock.calls[0]?.[0]?.size).toEqual({ w: 40, h: 40 });
  });

  it('centers the marker on the pointer-down WORLD point, under a non-identity camera pan/zoom', () => {
    const { ctx, camera } = realCtx({ gridSize: 40, gridType: 'square' });
    // Non-identity pan + zoom: if the tool ever used the raw screen point
    // instead of camera.screenToWorld(), this would diverge from the
    // asserted position.
    camera.moveTo(37, -19);
    camera.setZoom(2.5);

    const onPlaceMarker = vi.fn<(request: PlaceMarkerRequest) => void>();
    const tool = new DmMarkerTool(
      { current: 'loot' },
      { current: 'purple' },
      onPlaceMarker
    );

    const screenPoint = { x: 210, y: 140 };
    const expectedWorld = camera.screenToWorld(screenPoint);
    // Sanity: this camera really does transform the point (otherwise the
    // test wouldn't be able to catch a "passes screen coords through" bug).
    expect(expectedWorld).not.toEqual(screenPoint);

    tool.onPointerDown(down(screenPoint.x, screenPoint.y), ctx);
    tool.onPointerUp(down(screenPoint.x, screenPoint.y), ctx);

    const request = onPlaceMarker.mock.calls[0]?.[0];
    expect(request?.size).toEqual({ w: 40, h: 40 });
    expect(request?.position).toEqual({
      x: expectedWorld.x - 20,
      y: expectedWorld.y - 20,
    });
  });

  it('a drag beyond slop emits nothing; a move within slop still emits (positive control); the drag flag is sticky', () => {
    const { ctx } = realCtx();

    // Negative case: move beyond slop, release -> zero calls.
    const beyondSlop = vi.fn<(request: PlaceMarkerRequest) => void>();
    const dragTool: Tool = new DmMarkerTool(
      { current: 'door' },
      { current: 'red' },
      beyondSlop
    );
    dragTool.onPointerDown(down(100, 100), ctx);
    dragTool.onPointerMove(down(100 + MARKER_TOOL_SLOP_PX + 1, 100), ctx);
    dragTool.onPointerUp(down(100 + MARKER_TOOL_SLOP_PX + 1, 100), ctx);
    expect(beyondSlop).toHaveBeenCalledTimes(0);

    // Positive control, same fixture/spy shape: a move just UNDER slop still
    // places. Proves the negative result above isn't vacuous (e.g. a tool
    // that never emits at all would also pass the negative case).
    const withinSlop = vi.fn<(request: PlaceMarkerRequest) => void>();
    const tapTool: Tool = new DmMarkerTool(
      { current: 'door' },
      { current: 'red' },
      withinSlop
    );
    tapTool.onPointerDown(down(100, 100), ctx);
    tapTool.onPointerMove(down(100 + MARKER_TOOL_SLOP_PX - 1, 100), ctx);
    tapTool.onPointerUp(down(100 + MARKER_TOOL_SLOP_PX - 1, 100), ctx);
    expect(withinSlop).toHaveBeenCalledTimes(1);

    // Sticky flag: once past slop, moving back to the down point must not
    // un-mark the gesture as a drag.
    const stickyCheck = vi.fn<(request: PlaceMarkerRequest) => void>();
    const stickyTool: Tool = new DmMarkerTool(
      { current: 'door' },
      { current: 'red' },
      stickyCheck
    );
    stickyTool.onPointerDown(down(100, 100), ctx);
    stickyTool.onPointerMove(down(100 + MARKER_TOOL_SLOP_PX + 5, 100), ctx);
    stickyTool.onPointerMove(down(100, 100), ctx); // back to the exact down point
    stickyTool.onPointerUp(down(100, 100), ctx);
    expect(stickyCheck).toHaveBeenCalledTimes(0);
  });

  it('never touches ctx.store — proven live against the real ElementStore in this context', () => {
    const { ctx, store } = realCtx();
    const addSpy = vi.spyOn(store, 'add');
    const updateSpy = vi.spyOn(store, 'update');
    const removeSpy = vi.spyOn(store, 'remove');

    const onPlaceMarker = vi.fn<(request: PlaceMarkerRequest) => void>();
    const tool = new DmMarkerTool(
      { current: 'secret' },
      { current: 'emerald' },
      onPlaceMarker
    );
    tool.onPointerDown(down(10, 10), ctx);
    tool.onPointerUp(down(10, 10), ctx);

    expect(addSpy).toHaveBeenCalledTimes(0);
    expect(updateSpy).toHaveBeenCalledTimes(0);
    expect(removeSpy).toHaveBeenCalledTimes(0);

    // Positive control: prove these spies are attached to the SAME store
    // instance the tool was handed, so the zero-calls assertion above is
    // meaningful rather than a spy watching nothing (the exact defect that
    // shipped in the previous phase of this project).
    const el = createShape({
      position: { x: 0, y: 0 },
      size: { w: 10, h: 10 },
      shape: 'ellipse',
      layerId: 'dm-1',
    });
    store.add(el);
    expect(addSpy).toHaveBeenCalledTimes(1);
    store.update(el.id, { zIndex: 5 });
    expect(updateSpy).toHaveBeenCalledTimes(1);
    store.remove(el.id);
    expect(removeSpy).toHaveBeenCalledTimes(1);
  });

  it('never calls ctx.switchTool — proven live against the same spy', () => {
    const { ctx, switchTool } = realCtx();
    const onPlaceMarker = vi.fn<(request: PlaceMarkerRequest) => void>();
    const tool = new DmMarkerTool(
      { current: 'npc' },
      { current: 'orange' },
      onPlaceMarker
    );
    tool.onPointerDown(down(10, 10), ctx);
    tool.onPointerUp(down(10, 10), ctx);

    expect(switchTool).toHaveBeenCalledTimes(0);

    // Positive control: the same spy DOES record a call when invoked
    // directly, so the zero-calls assertion above isn't vacuous.
    ctx.switchTool?.('select');
    expect(switchTool).toHaveBeenCalledTimes(1);
  });

  it('reads kind and color from the refs at placement time, not at construction time', () => {
    const { ctx } = realCtx();
    const kindRef: { current: MarkerKind } = { current: 'door' };
    const colorRef: { current: MarkerColorKey } = { current: 'red' };
    const onPlaceMarker = vi.fn<(request: PlaceMarkerRequest) => void>();
    const tool = new DmMarkerTool(kindRef, colorRef, onPlaceMarker);

    // Mutate the refs AFTER construction, before the gesture.
    kindRef.current = 'trap';
    colorRef.current = 'blue';

    tool.onPointerDown(down(0, 0), ctx);
    tool.onPointerUp(down(0, 0), ctx);

    expect(onPlaceMarker).toHaveBeenCalledTimes(1);
    const request = onPlaceMarker.mock.calls[0]?.[0];
    expect(request?.kind).toBe('trap');
    expect(request?.color).toBe('blue');
  });

  it('a pointer-up with no preceding pointer-down emits nothing', () => {
    const { ctx } = realCtx();
    const onPlaceMarker = vi.fn<(request: PlaceMarkerRequest) => void>();
    const tool = new DmMarkerTool(
      { current: 'door' },
      { current: 'red' },
      onPlaceMarker
    );
    tool.onPointerUp(down(50, 50), ctx);
    expect(onPlaceMarker).toHaveBeenCalledTimes(0);
  });

  it('two consecutive taps emit two separate requests — no state leaks between gestures', () => {
    const { ctx } = realCtx();
    const onPlaceMarker = vi.fn<(request: PlaceMarkerRequest) => void>();
    const tool = new DmMarkerTool(
      { current: 'door' },
      { current: 'red' },
      onPlaceMarker
    );

    tool.onPointerDown(down(10, 10), ctx);
    tool.onPointerUp(down(10, 10), ctx);
    tool.onPointerDown(down(200, 200), ctx);
    tool.onPointerUp(down(200, 200), ctx);

    expect(onPlaceMarker).toHaveBeenCalledTimes(2);
    expect(onPlaceMarker.mock.calls[0]?.[0]?.position).toEqual({
      x: -10,
      y: -10,
    });
    expect(onPlaceMarker.mock.calls[1]?.[0]?.position).toEqual({
      x: 180,
      y: 180,
    });
  });

  it('exposes the expected tool name', () => {
    const onPlaceMarker = vi.fn<(request: PlaceMarkerRequest) => void>();
    const tool = new DmMarkerTool(
      { current: 'door' },
      { current: 'red' },
      onPlaceMarker
    );
    expect(tool.name).toBe(MARKER_TOOL_NAME);
    expect(MARKER_TOOL_NAME).toBe('marker');
  });
});
