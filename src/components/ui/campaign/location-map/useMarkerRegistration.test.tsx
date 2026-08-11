import { StrictMode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import {
  createHtmlElement,
  createNote,
  createShape,
  resolveHtmlRouting,
  HtmlPainterRegistry,
  type ActivationOptions,
  type CanvasElement,
  type ElementActivationEvent,
  type HtmlPainter,
} from '@fieldnotes/core';

import {
  useMarkerRegistration,
  type MarkerRegistrationViewport,
} from './useMarkerRegistration';
import { MARKER_HTML_TYPE, buildMarkerData } from './markerData';

afterEach(() => {
  cleanup();
});

/**
 * Recording double for `MarkerRegistrationViewport`. `expectCanvasHtmlTypes`
 * and `registerHtmlPainter` delegate to a REAL `HtmlPainterRegistry` so
 * routing can be asserted for real via `resolveHtmlRouting` — zero
 * `@fieldnotes` module mocks, per CONSTRAINTS-B. `setActivation` and
 * `onElementActivate` have no SDK-side counterpart reachable without a real
 * canvas/Viewport, so they are recorded directly.
 *
 * Every call is pushed onto one shared `calls` array, in order, so
 * declaration-before-registration can be asserted both by call order and by
 * observed registry state at the moment of registration.
 */
function createViewportDouble() {
  const registry = new HtmlPainterRegistry();
  const calls: string[] = [];
  const observedCanvasTypesAtRegister: boolean[] = [];
  const releaseDeclarationSpies: ReturnType<typeof vi.fn>[] = [];
  const unregisterPainterSpies: ReturnType<typeof vi.fn>[] = [];
  const disposeActivationSpies: ReturnType<typeof vi.fn>[] = [];
  const offActivateSpies: ReturnType<typeof vi.fn>[] = [];
  const activationOptionsCalls: (ActivationOptions | null)[] = [];
  const activateListeners = new Set<(event: ElementActivationEvent) => void>();

  const viewport: MarkerRegistrationViewport = {
    expectCanvasHtmlTypes(htmlTypes: Iterable<string>) {
      calls.push('expectCanvasHtmlTypes');
      const release = registry.expect(htmlTypes);
      const spy = vi.fn(() => release());
      releaseDeclarationSpies.push(spy);
      return spy;
    },
    registerHtmlPainter(htmlType: string, painter: HtmlPainter) {
      calls.push('registerHtmlPainter');
      observedCanvasTypesAtRegister.push(
        registry.canvasTypes.has(MARKER_HTML_TYPE)
      );
      const unregister = registry.register(htmlType, painter);
      const spy = vi.fn(() => unregister());
      unregisterPainterSpies.push(spy);
      return spy;
    },
    setActivation(options: ActivationOptions | null) {
      calls.push('setActivation');
      activationOptionsCalls.push(options);
      const spy = vi.fn(() => {});
      disposeActivationSpies.push(spy);
      return spy;
    },
    onElementActivate(listener: (event: ElementActivationEvent) => void) {
      calls.push('onElementActivate');
      activateListeners.add(listener);
      const spy = vi.fn(() => {
        activateListeners.delete(listener);
      });
      offActivateSpies.push(spy);
      return spy;
    },
  };

  return {
    viewport,
    registry,
    calls,
    observedCanvasTypesAtRegister,
    releaseDeclarationSpies,
    unregisterPainterSpies,
    disposeActivationSpies,
    offActivateSpies,
    activationOptionsCalls,
    activateListeners,
  };
}

function markerHtmlElement() {
  return createHtmlElement({
    position: { x: 0, y: 0 },
    size: { w: 40, h: 40 },
    htmlType: MARKER_HTML_TYPE,
    data: { ...buildMarkerData({ kind: 'door', ref: 'ref-1' }) },
  });
}

function activationEvent(
  element: CanvasElement,
  gesture: 'single' | 'double' = 'single'
): ElementActivationEvent {
  return { element, world: { x: 0, y: 0 }, pointerType: 'mouse', gesture };
}

function emitToAll(
  listeners: Set<(event: ElementActivationEvent) => void>,
  event: ElementActivationEvent
): void {
  for (const listener of [...listeners]) {
    listener(event);
  }
}

describe('useMarkerRegistration', () => {
  it('declares MARKER_HTML_TYPES before registering the painter', () => {
    const d = createViewportDouble();

    renderHook(() =>
      useMarkerRegistration({ viewport: d.viewport, gesture: 'single' })
    );

    // (a) call order.
    expect(d.calls.slice(0, 2)).toEqual([
      'expectCanvasHtmlTypes',
      'registerHtmlPainter',
    ]);
    // (b) observed registry state at the moment of registration — the
    // assertion a reordered implementation cannot satisfy.
    expect(d.observedCanvasTypesAtRegister).toEqual([true]);
  });

  it('passes the configured gesture to setActivation: double', () => {
    const d = createViewportDouble();

    renderHook(() =>
      useMarkerRegistration({ viewport: d.viewport, gesture: 'double' })
    );

    expect(d.activationOptionsCalls.length).toBe(1);
    expect(d.activationOptionsCalls[0]?.gesture).toBe('double');
  });

  it('passes the configured gesture to setActivation: single', () => {
    const d = createViewportDouble();

    renderHook(() =>
      useMarkerRegistration({ viewport: d.viewport, gesture: 'single' })
    );

    expect(d.activationOptionsCalls.length).toBe(1);
    expect(d.activationOptionsCalls[0]?.gesture).toBe('single');
  });

  it('gesture null never calls setActivation but keeps onElementActivate subscribed; gesture single is the positive control', () => {
    const dNull = createViewportDouble();
    renderHook(() =>
      useMarkerRegistration({ viewport: dNull.viewport, gesture: null })
    );

    expect(dNull.calls.includes('setActivation')).toBe(false);
    expect(dNull.calls.includes('onElementActivate')).toBe(true);
    expect(dNull.activateListeners.size).toBe(1);

    // Positive control: same double shape, gesture 'single' DOES call
    // setActivation — proves the negative assertion above is discriminating.
    const dSingle = createViewportDouble();
    renderHook(() =>
      useMarkerRegistration({ viewport: dSingle.viewport, gesture: 'single' })
    );
    expect(dSingle.calls.includes('setActivation')).toBe(true);
  });

  it('routes a marker element to canvas while mounted, and back to dom after unmount', () => {
    const d = createViewportDouble();
    const element = markerHtmlElement();

    expect(resolveHtmlRouting(element, d.registry)).toBe('dom');

    const { unmount } = renderHook(() =>
      useMarkerRegistration({ viewport: d.viewport, gesture: 'single' })
    );
    expect(resolveHtmlRouting(element, d.registry)).toBe('canvas');

    unmount();
    expect(resolveHtmlRouting(element, d.registry)).toBe('dom');
  });

  it('disposes all four registrations on unmount, asserted individually; none has run before unmount (positive control)', () => {
    const d = createViewportDouble();

    const { unmount } = renderHook(() =>
      useMarkerRegistration({ viewport: d.viewport, gesture: 'single' })
    );

    const release = d.releaseDeclarationSpies[0];
    const unregister = d.unregisterPainterSpies[0];
    const disposeActivation = d.disposeActivationSpies[0];
    const offActivate = d.offActivateSpies[0];
    expect(release).toBeDefined();
    expect(unregister).toBeDefined();
    expect(disposeActivation).toBeDefined();
    expect(offActivate).toBeDefined();
    if (!release || !unregister || !disposeActivation || !offActivate) {
      throw new Error('expected all four disposers to be recorded');
    }

    expect(release).not.toHaveBeenCalled();
    expect(unregister).not.toHaveBeenCalled();
    expect(disposeActivation).not.toHaveBeenCalled();
    expect(offActivate).not.toHaveBeenCalled();

    unmount();

    expect(release).toHaveBeenCalledTimes(1);
    expect(unregister).toHaveBeenCalledTimes(1);
    expect(disposeActivation).toHaveBeenCalledTimes(1);
    expect(offActivate).toHaveBeenCalledTimes(1);
  });

  it('survives StrictMode mount -> cleanup -> remount with the painter still active and routing canvas', () => {
    const d = createViewportDouble();
    const element = markerHtmlElement();

    // Positive/negative control: the very same routing helper and element on
    // a registry nothing has ever mounted against reads 'dom' — proving the
    // 'canvas' assertion below cannot pass by construction.
    expect(resolveHtmlRouting(element, d.registry)).toBe('dom');

    renderHook(
      () => useMarkerRegistration({ viewport: d.viewport, gesture: 'single' }),
      {
        wrapper: ({ children }) => <StrictMode>{children}</StrictMode>,
      }
    );

    expect(d.registry.getActivePainter(MARKER_HTML_TYPE)).toBeDefined();
    expect(resolveHtmlRouting(element, d.registry)).toBe('canvas');
  });

  it('two viewports mounted simultaneously each keep their own registration; unmounting one leaves the other at canvas', () => {
    const d1 = createViewportDouble();
    const d2 = createViewportDouble();
    const el1 = markerHtmlElement();
    const el2 = markerHtmlElement();

    const h1 = renderHook(() =>
      useMarkerRegistration({ viewport: d1.viewport, gesture: 'single' })
    );
    renderHook(() =>
      useMarkerRegistration({ viewport: d2.viewport, gesture: 'single' })
    );

    expect(resolveHtmlRouting(el1, d1.registry)).toBe('canvas');
    expect(resolveHtmlRouting(el2, d2.registry)).toBe('canvas');

    h1.unmount();

    expect(resolveHtmlRouting(el1, d1.registry)).toBe('dom');
    expect(resolveHtmlRouting(el2, d2.registry)).toBe('canvas');
  });

  it('a changed onActivateMarker identity does not re-register, but the new callback still receives the next event; a changed gesture DOES re-register (positive control)', () => {
    const d = createViewportDouble();
    const first = vi.fn<(event: ElementActivationEvent) => void>();

    const { rerender } = renderHook(
      (props: {
        gesture: 'single' | 'double';
        onActivateMarker: (event: ElementActivationEvent) => void;
      }) =>
        useMarkerRegistration({
          viewport: d.viewport,
          gesture: props.gesture,
          onActivateMarker: props.onActivateMarker,
        }),
      { initialProps: { gesture: 'single', onActivateMarker: first } }
    );

    expect(d.calls.length).toBe(4);

    const second = vi.fn<(event: ElementActivationEvent) => void>();
    rerender({ gesture: 'single', onActivateMarker: second });

    // No second expectCanvasHtmlTypes/registerHtmlPainter/setActivation/
    // onElementActivate cycle — the call log is byte-identical.
    expect(d.calls.length).toBe(4);

    const event = activationEvent(markerHtmlElement());
    emitToAll(d.activateListeners, event);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledWith(event);

    // Positive control: changing `gesture` DOES tear down and re-create the
    // registration — proves the unchanged-call-count assertion above isn't
    // vacuous (e.g. an effect that never re-runs at all would also pass it).
    rerender({ gesture: 'double', onActivateMarker: second });
    expect(d.calls.length).toBe(8);
    expect(
      d.activationOptionsCalls[d.activationOptionsCalls.length - 1]?.gesture
    ).toBe('double');
  });

  it('the activation listener forwards only marker-element events to onActivateMarker; a marker event is the positive control', () => {
    const d = createViewportDouble();
    const onActivateMarker = vi.fn<(event: ElementActivationEvent) => void>();

    renderHook(() =>
      useMarkerRegistration({
        viewport: d.viewport,
        gesture: 'single',
        onActivateMarker,
      })
    );

    const nonMarkerEvent = activationEvent(
      createNote({ position: { x: 0, y: 0 } })
    );
    emitToAll(d.activateListeners, nonMarkerEvent);
    expect(onActivateMarker).not.toHaveBeenCalled();

    const markerEvent = activationEvent(markerHtmlElement());
    emitToAll(d.activateListeners, markerEvent);
    expect(onActivateMarker).toHaveBeenCalledTimes(1);
    expect(onActivateMarker).toHaveBeenCalledWith(markerEvent);
  });

  it('isActivatable accepts unsupported and invalid marker data, and rejects a note element and a non-marker html element', () => {
    const d = createViewportDouble();

    renderHook(() =>
      useMarkerRegistration({ viewport: d.viewport, gesture: 'single' })
    );

    const options = d.activationOptionsCalls[0];
    expect(options).toBeTruthy();
    const isActivatable = options?.isActivatable;
    expect(isActivatable).toBeDefined();
    if (!isActivatable) {
      throw new Error('expected isActivatable to be set on ActivationOptions');
    }

    const unsupportedElement = createHtmlElement({
      position: { x: 0, y: 0 },
      size: { w: 40, h: 40 },
      htmlType: MARKER_HTML_TYPE,
      data: { v: 2, kind: 'door', ref: 'r1' },
    });
    const invalidElement = createHtmlElement({
      position: { x: 0, y: 0 },
      size: { w: 40, h: 40 },
      htmlType: MARKER_HTML_TYPE,
      data: { v: 1, kind: 'door' }, // missing ref
    });

    expect(isActivatable(unsupportedElement)).toBe(true);
    expect(isActivatable(invalidElement)).toBe(true);

    const noteElement = createNote({ position: { x: 0, y: 0 } });
    expect(isActivatable(noteElement)).toBe(false);

    const otherHtmlElement = createHtmlElement({
      position: { x: 0, y: 0 },
      size: { w: 40, h: 40 },
      htmlType: 'some-other-type',
      data: {},
    });
    expect(isActivatable(otherHtmlElement)).toBe(false);

    // Sanity: a shape element (a third element "shape") is also rejected —
    // the predicate isn't merely "not a note".
    const shapeElement = createShape({
      position: { x: 0, y: 0 },
      size: { w: 10, h: 10 },
      shape: 'ellipse',
    });
    expect(isActivatable(shapeElement)).toBe(false);
  });
});
