import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen, cleanup } from '@testing-library/react';
import {
  Viewport,
  SelectTool,
  createShape,
  createImage,
} from '@fieldnotes/core';
import {
  ViewportContext,
  useSelectionOps,
  useSelectionStyleDetails,
} from '@fieldnotes/react';

// No @fieldnotes/core or @fieldnotes/react mocking anywhere in this file: a
// real Viewport, a real SelectTool, and the real published hooks run end to
// end. This is the product-level proof that hooks mounted before a select
// tool is registered still receive selection updates, and that deletion
// updates arrive purely from store mutation — no pointer event, no manual
// tick. It fails against 0.59.0 semantics, where the selection hooks only
// picked up events from an already-registered select tool.

/**
 * jsdom has no canvas 2D context: stub `getContext` on any canvas the
 * Viewport creates so construction and its render loop don't throw. Mirrors
 * the seam in `battleMapExport.integration.test.ts` — stub the browser API,
 * never an @fieldnotes module.
 */
function stubCanvas(): void {
  const origCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = origCreate(tag);
    if (tag === 'canvas') {
      const canvas = el as HTMLCanvasElement;
      vi.spyOn(canvas, 'getContext').mockReturnValue({
        save: vi.fn(),
        restore: vi.fn(),
        scale: vi.fn(),
        translate: vi.fn(),
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        rect: vi.fn(),
        clip: vi.fn(),
        arc: vi.fn(),
        arcTo: vi.fn(),
        ellipse: vi.fn(),
        quadraticCurveTo: vi.fn(),
        bezierCurveTo: vi.fn(),
        drawImage: vi.fn(),
        setTransform: vi.fn(),
        setLineDash: vi.fn(),
        roundRect: vi.fn(),
        fillText: vi.fn(),
        measureText: vi.fn().mockReturnValue({ width: 40 }),
        createLinearGradient: vi.fn(),
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 0,
        globalAlpha: 1,
        font: '',
        textBaseline: '',
        textAlign: '',
        lineCap: '',
        lineJoin: '',
      } as unknown as CanvasRenderingContext2D);
    }
    return el;
  });
}

/**
 * Reads the two selection hooks under test and exposes their live values as
 * text so assertions can read the DOM instead of reaching into React
 * internals. Rendered directly under `ViewportContext.Provider`, matching
 * how `DmSelectionOptions` consumes them in the product.
 */
function SelectionProbe() {
  const { selectedCount } = useSelectionOps();
  const [details] = useSelectionStyleDetails();
  return (
    <div>
      <span data-testid="selected-count">{selectedCount}</span>
      <span data-testid="mixed-fields">
        {details ? details.mixed.join(',') : ''}
      </span>
      <span data-testid="details-null">
        {details === null ? 'null' : 'set'}
      </span>
    </div>
  );
}

describe('selection eventing against the real SDK pipeline', () => {
  let container: HTMLDivElement | null = null;
  let viewport: Viewport | null = null;

  afterEach(() => {
    cleanup();
    viewport?.destroy();
    container?.remove();
    viewport = null;
    container = null;
    vi.restoreAllMocks();
  });

  it('selection count and style details update on deletion without pointer events', () => {
    stubCanvas();

    container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', {
      value: 800,
      configurable: true,
    });
    Object.defineProperty(container, 'clientHeight', {
      value: 600,
      configurable: true,
    });
    document.body.appendChild(container);

    viewport = new Viewport(container);

    // 1. Construct the Viewport and mount the probe FIRST — the hooks
    //    subscribe via viewport.onSelectionChange while no select tool is
    //    registered yet. Under 0.59.0 semantics this subscription target
    //    didn't exist until a select tool was present, so mounting in this
    //    order is the discriminator.
    render(
      <ViewportContext.Provider value={viewport}>
        <SelectionProbe />
      </ViewportContext.Provider>
    );

    expect(screen.getByTestId('selected-count').textContent).toBe('0');
    expect(screen.getByTestId('mixed-fields').textContent).toBe('');

    // 2. Register SelectTool only after the hooks are already subscribed.
    const selectTool = new SelectTool();
    act(() => {
      viewport?.toolManager.register(selectTool);
    });

    // 3. Add two shape elements with different stroke colors and select
    //    both directly through the tool (no pointer events).
    const a = createShape({
      position: { x: 0, y: 0 },
      size: { w: 10, h: 10 },
      strokeColor: '#ff0000',
    });
    const b = createShape({
      position: { x: 20, y: 20 },
      size: { w: 10, h: 10 },
      strokeColor: '#00ff00',
    });
    act(() => {
      viewport?.store.add(a);
      viewport?.store.add(b);
      selectTool.setSelection([a.id, b.id]);
    });

    // 4. Both hooks reflect the two-element, mixed-color selection.
    expect(screen.getByTestId('selected-count').textContent).toBe('2');
    expect(
      screen.getByTestId('mixed-fields').textContent?.split(',')
    ).toContain('color');

    // 5. Delete one of the selected elements via store mutation alone —
    //    no pointer event, no manual re-render tick.
    act(() => {
      viewport?.removeElements([a.id]);
    });

    // 6. The probe re-rendered from the deletion alone: one element remains
    //    selected and 'color' is no longer mixed (the surviving element is
    //    the sole source of style).
    expect(screen.getByTestId('selected-count').textContent).toBe('1');
    expect(
      screen.getByTestId('mixed-fields').textContent?.split(',')
    ).not.toContain('color');
  });

  it('selecting a style-less element (image) yields a non-empty count with null style details', () => {
    // Images have no style fields (see getElementStyle's default case), so
    // ElementStore.getSelectionStyleDetails() returns null for an
    // all-image selection even though the selection itself isn't empty.
    // DmSelectionOptions must still render its arrange ops (rotate, group,
    // lock, delete) in that case — this proves the real SDK produces the
    // details=null / selectedCount>0 combination that regressed.
    stubCanvas();

    container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', {
      value: 800,
      configurable: true,
    });
    Object.defineProperty(container, 'clientHeight', {
      value: 600,
      configurable: true,
    });
    document.body.appendChild(container);

    viewport = new Viewport(container);
    const selectTool = new SelectTool();
    act(() => {
      viewport?.toolManager.register(selectTool);
    });

    render(
      <ViewportContext.Provider value={viewport}>
        <SelectionProbe />
      </ViewportContext.Provider>
    );

    const image = createImage({
      position: { x: 0, y: 0 },
      size: { w: 10, h: 10 },
      src: 'data:image/png;base64,',
    });
    act(() => {
      viewport?.store.add(image);
      selectTool.setSelection([image.id]);
    });

    expect(screen.getByTestId('selected-count').textContent).toBe('1');
    expect(screen.getByTestId('details-null').textContent).toBe('null');
  });
});
