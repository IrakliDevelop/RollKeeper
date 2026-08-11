import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  createHtmlElement,
  resolveHtmlRouting,
  HtmlPainterRegistry,
  type HtmlElement,
} from '@fieldnotes/core';
import {
  createMarkerPainter,
  createStandaloneMarkerRegistry,
  MARKER_COLOR_CSS,
  MARKER_NEUTRAL_CSS,
  type MarkerDataIssue,
} from './markerPainter';
import {
  MARKER_HTML_TYPE,
  MARKER_HTML_TYPES,
  MARKER_KINDS,
  buildMarkerData,
  type MarkerKind,
  type MarkerColorKey,
} from './markerData';

/**
 * Hand-built recording fake `CanvasRenderingContext2D`. jsdom has no canvas 2D
 * implementation, so this is the only way to observe what the painter drew:
 * every method call and every settable-property assignment is pushed onto
 * `calls` as a string, in the order they happened, and settable properties
 * also expose a live getter for tests that need "what is it now" (e.g. the
 * globalAlpha no-touch test).
 */
const RECORDED_METHODS = [
  'beginPath',
  'closePath',
  'fill',
  'stroke',
  'arc',
  'moveTo',
  'lineTo',
  'rect',
  'fillText',
  'save',
  'restore',
  'quadraticCurveTo',
  'bezierCurveTo',
  'ellipse',
] as const;

const RECORDED_PROPS = [
  'fillStyle',
  'strokeStyle',
  'font',
  'textAlign',
  'textBaseline',
  'lineWidth',
  'globalAlpha',
] as const;

function roundArg(value: unknown): unknown {
  return typeof value === 'number' ? Math.round(value * 1000) / 1000 : value;
}

function createFakeCtx(
  initial: Partial<Record<(typeof RECORDED_PROPS)[number], unknown>> = {}
): {
  ctx: CanvasRenderingContext2D;
  calls: string[];
} {
  const calls: string[] = [];
  const target: Record<string, unknown> = {};

  for (const method of RECORDED_METHODS) {
    target[method] = (...args: unknown[]) => {
      calls.push(`${method}(${args.map(roundArg).join(',')})`);
      return undefined;
    };
  }
  target.measureText = () => ({ width: 40 });

  const store: Record<string, unknown> = {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    lineWidth: 1,
    globalAlpha: 1,
    ...initial,
  };

  for (const prop of RECORDED_PROPS) {
    Object.defineProperty(target, prop, {
      enumerable: true,
      get() {
        return store[prop];
      },
      set(value: unknown) {
        store[prop] = value;
        calls.push(`set:${prop}=${String(value)}`);
      },
    });
  }

  return { ctx: target as unknown as CanvasRenderingContext2D, calls };
}

/** Every `set:<prop>=<value>` assignment recorded for `prop`, in order. */
function propAssignments(calls: string[], prop: string): string[] {
  const prefix = `set:${prop}=`;
  return calls
    .filter(call => call.startsWith(prefix))
    .map(call => call.slice(prefix.length));
}

/** Radius argument of the first recorded `arc(...)` call — the disc backdrop
 * is always the first shape drawn, so this is unambiguous even for glyphs
 * that also call `arc`. */
function firstArcRadius(calls: string[]): number {
  const call = calls.find(entry => entry.startsWith('arc('));
  if (call === undefined) {
    throw new Error('no arc() call recorded');
  }
  const inner = call.slice('arc('.length, -1);
  const parts = inner.split(',');
  const radiusStr = parts[2];
  if (radiusStr === undefined) {
    throw new Error(`arc() call had too few arguments: ${call}`);
  }
  return Number(radiusStr);
}

function markerElement(
  kind: MarkerKind,
  overrides: { ref?: string; label?: string; color?: MarkerColorKey } = {},
  size: { w: number; h: number } = { w: 40, h: 40 }
): HtmlElement {
  return createHtmlElement({
    position: { x: 0, y: 0 },
    size,
    htmlType: MARKER_HTML_TYPE,
    data: {
      ...buildMarkerData({
        kind,
        ref: overrides.ref ?? 'ref-1',
        label: overrides.label,
        color: overrides.color,
      }),
    },
  });
}

/** Untrusted/raw element data that never went through `buildMarkerData` —
 * simulates a stale or hostile remote payload landing directly on the wire. */
function rawElement(
  data: Record<string, unknown>,
  size: { w: number; h: number } = { w: 40, h: 40 }
): HtmlElement {
  return createHtmlElement({
    position: { x: 0, y: 0 },
    size,
    htmlType: MARKER_HTML_TYPE,
    data,
  });
}

describe('createMarkerPainter', () => {
  it('draws a pairwise-distinguishable glyph trace for each of the six kinds, and none match the neutral trace', () => {
    const painter = createMarkerPainter();

    const traces = MARKER_KINDS.map(kind => {
      const element = markerElement(kind);
      const { ctx, calls } = createFakeCtx();
      painter({ ctx, element, size: element.size, zoom: 1 });
      return calls.join('|');
    });

    expect(new Set(traces).size).toBe(MARKER_KINDS.length);

    const neutralElement = rawElement({ v: 2, kind: 'door', ref: 'r1' });
    const { ctx: neutralCtx, calls: neutralCalls } = createFakeCtx();
    painter({
      ctx: neutralCtx,
      element: neutralElement,
      size: neutralElement.size,
      zoom: 1,
    });
    const neutralTrace = neutralCalls.join('|');

    for (const trace of traces) {
      expect(trace).not.toBe(neutralTrace);
    }
  });

  it('paints the neutral disc for unsupported and invalid data without throwing, matching traces; a valid marker is a distinguishable positive control', () => {
    const painter = createMarkerPainter();

    const unsupportedElement = rawElement({ v: 2, kind: 'door', ref: 'r1' });
    const invalidElement = rawElement({ v: 1, kind: 'door' }); // missing ref

    const unsupportedRec = createFakeCtx();
    expect(() =>
      painter({
        ctx: unsupportedRec.ctx,
        element: unsupportedElement,
        size: unsupportedElement.size,
        zoom: 1,
      })
    ).not.toThrow();
    expect(propAssignments(unsupportedRec.calls, 'fillStyle')).toContain(
      MARKER_NEUTRAL_CSS
    );
    expect(unsupportedRec.calls.some(call => call.startsWith('fill('))).toBe(
      true
    );

    const invalidRec = createFakeCtx();
    expect(() =>
      painter({
        ctx: invalidRec.ctx,
        element: invalidElement,
        size: invalidElement.size,
        zoom: 1,
      })
    ).not.toThrow();
    expect(propAssignments(invalidRec.calls, 'fillStyle')).toContain(
      MARKER_NEUTRAL_CSS
    );
    expect(invalidRec.calls.some(call => call.startsWith('fill('))).toBe(true);

    expect(invalidRec.calls.join('|')).toBe(unsupportedRec.calls.join('|'));

    // Positive control: a valid marker with a palette colour records that
    // colour, and never the neutral colour — proving the fillStyle
    // assertion above can actually distinguish the two paths.
    const validElement = markerElement('door', { color: 'red' });
    const validRec = createFakeCtx();
    painter({
      ctx: validRec.ctx,
      element: validElement,
      size: validElement.size,
      zoom: 1,
    });
    expect(propAssignments(validRec.calls, 'fillStyle')).toContain(
      MARKER_COLOR_CSS.red
    );
    expect(propAssignments(validRec.calls, 'fillStyle')).not.toContain(
      MARKER_NEUTRAL_CSS
    );
  });

  // Both arms below are, by design, the SAME path through the painter: it
  // never trusts the element's `data` and re-caps through `parseMarkerData`
  // at paint time (§6.2), so a locally-authored label and a hand-written one
  // are indistinguishable here. The value of the pair is exactly that — the
  // cap does not depend on provenance — NOT that `buildMarkerData`'s own
  // ingestion cap is covered; that lives in `markerData.test.ts`
  // (`capCodePoints` / `MARKER_LABEL_MAX_CODE_POINTS`).
  it('never records a fillText call whose text exceeds the 40 code point cap, whatever the provenance of the label: capped-at-ingestion and raw untrusted both re-validate at paint time', () => {
    const painter = createMarkerPainter();
    const longLabel = '\u{1F600}'.repeat(100); // 100 astral code points

    const viaBuild = markerElement('note', { label: longLabel });
    const viaBuildRec = createFakeCtx();
    painter({
      ctx: viaBuildRec.ctx,
      element: viaBuild,
      size: viaBuild.size,
      zoom: 1,
    });

    const viaRaw = rawElement({
      v: 1,
      kind: 'note',
      ref: 'r1',
      label: longLabel,
    });
    const rawRec = createFakeCtx();
    painter({ ctx: rawRec.ctx, element: viaRaw, size: viaRaw.size, zoom: 1 });

    for (const rec of [viaBuildRec, rawRec]) {
      const fillTextCalls = rec.calls.filter(call =>
        call.startsWith('fillText(')
      );
      expect(fillTextCalls.length).toBeGreaterThan(0);
      for (const call of fillTextCalls) {
        const textArg = call.slice('fillText('.length).split(',')[0];
        if (textArg === undefined) {
          throw new Error(`fillText call had no arguments: ${call}`);
        }
        expect(Array.from(textArg).length).toBeLessThanOrEqual(40);
      }
    }
  });

  it('drops the label below the legible CSS-pixel threshold, and draws it at the same fixture and zoom where it is legible', () => {
    const painter = createMarkerPainter();
    const element = markerElement(
      'note',
      { label: 'a door' },
      { w: 40, h: 40 }
    );

    const belowThreshold = createFakeCtx();
    painter({
      ctx: belowThreshold.ctx,
      element,
      size: element.size,
      zoom: 0.5,
    });
    expect(
      belowThreshold.calls.some(call => call.startsWith('fillText('))
    ).toBe(false);

    // Positive control: same element, same harness, legible zoom.
    const atThreshold = createFakeCtx();
    painter({ ctx: atThreshold.ctx, element, size: element.size, zoom: 1 });
    const fillTextCall = atThreshold.calls.find(call =>
      call.startsWith('fillText(')
    );
    expect(fillTextCall).toBeDefined();
    expect(fillTextCall).toContain('a door');
  });

  it('scales the icon disc to min(w, h), not max(w, h) or w alone', () => {
    const painter = createMarkerPainter();
    const expectedRadius = (40 * 0.62) / 2;

    const wide = markerElement('note', {}, { w: 120, h: 40 });
    const wideRec = createFakeCtx();
    painter({ ctx: wideRec.ctx, element: wide, size: wide.size, zoom: 1 });

    const square = markerElement('note', {}, { w: 40, h: 40 });
    const squareRec = createFakeCtx();
    painter({
      ctx: squareRec.ctx,
      element: square,
      size: square.size,
      zoom: 1,
    });

    const wideRadius = firstArcRadius(wideRec.calls);
    const squareRadius = firstArcRadius(squareRec.calls);

    expect(wideRadius).toBeCloseTo(expectedRadius, 3);
    expect(squareRadius).toBeCloseTo(expectedRadius, 3);
    expect(wideRadius).not.toBeCloseTo((120 * 0.62) / 2, 3);
  });

  it('dedupes onMarkerDataIssue per element until the bad payload changes, never fires for a valid marker, and omitting the callback does not throw', () => {
    const issues: MarkerDataIssue[] = [];
    const painter = createMarkerPainter({
      onMarkerDataIssue: issue => issues.push(issue),
    });

    const badElement = rawElement({ v: 1, kind: 'door' }); // missing ref -> invalid
    for (let i = 0; i < 3; i += 1) {
      painter({
        ctx: createFakeCtx().ctx,
        element: badElement,
        size: badElement.size,
        zoom: 1,
      });
    }
    expect(issues.length).toBe(1);
    expect(issues[0]).toMatchObject({
      elementId: badElement.id,
      status: 'invalid',
    });

    // Different bad payload on the SAME element id -> fires again.
    const changedBadElement: HtmlElement = {
      ...badElement,
      data: { v: 2, kind: 'door', ref: 'r1' },
    };
    painter({
      ctx: createFakeCtx().ctx,
      element: changedBadElement,
      size: changedBadElement.size,
      zoom: 1,
    });
    expect(issues.length).toBe(2);
    expect(issues[1]).toMatchObject({
      elementId: badElement.id,
      status: 'unsupported',
    });

    // A valid marker never invokes the callback.
    const validElement = markerElement('door');
    painter({
      ctx: createFakeCtx().ctx,
      element: validElement,
      size: validElement.size,
      zoom: 1,
    });
    expect(issues.length).toBe(2);

    // Omitting the callback entirely must not throw for bad data.
    const silentPainter = createMarkerPainter();
    expect(() =>
      silentPainter({
        ctx: createFakeCtx().ctx,
        element: badElement,
        size: badElement.size,
        zoom: 1,
      })
    ).not.toThrow();
  });

  it('dedupes onMarkerDataIssue across bad payloads with identical content but different key order, and still fires for a genuinely different payload', () => {
    const issues: MarkerDataIssue[] = [];
    const painter = createMarkerPainter({
      onMarkerDataIssue: issue => issues.push(issue),
    });

    // Missing `ref` -> invalid, regardless of key order or the extra field.
    const orderA = rawElement({ v: 1, kind: 'door', extra: 'x' });
    painter({
      ctx: createFakeCtx().ctx,
      element: orderA,
      size: orderA.size,
      zoom: 1,
    });
    expect(issues.length).toBe(1);

    // Same element id, byte-identical content, different key insertion order.
    const orderB: HtmlElement = {
      ...orderA,
      data: { extra: 'x', kind: 'door', v: 1 },
    };
    painter({
      ctx: createFakeCtx().ctx,
      element: orderB,
      size: orderB.size,
      zoom: 1,
    });
    expect(issues.length).toBe(1);

    // Positive control: a genuinely different payload on the same element id
    // fires again, proving the dedupe above isn't just deduping everything.
    const different: HtmlElement = {
      ...orderA,
      data: { v: 1, kind: 'door', extra: 'y' },
    };
    painter({
      ctx: createFakeCtx().ctx,
      element: different,
      size: different.size,
      zoom: 1,
    });
    expect(issues.length).toBe(2);
  });

  it('never touches globalAlpha, leaving the pre-set value untouched and unrecorded', () => {
    const painter = createMarkerPainter();
    const element = markerElement('door', { label: 'x' });
    const { ctx, calls } = createFakeCtx({ globalAlpha: 0.5 });

    painter({ ctx, element, size: element.size, zoom: 1 });

    expect(ctx.globalAlpha).toBe(0.5);
    expect(propAssignments(calls, 'globalAlpha').length).toBe(0);
  });
});

describe('createStandaloneMarkerRegistry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('declares the canvas type BEFORE registering the painter', () => {
    // `HtmlPainterRegistry.canvasTypes` is `declared ∪ {types with a live
    // painter}`, so once `register()` has run the declaration is invisible to
    // every accessor: routing, `canvasTypes` and `getActivePainter` all read
    // the same for `expect(); register()`, for `register(); expect()`, and for
    // `register()` alone. Call ORDER is therefore the only observable, and it
    // is load-bearing: with the declaration missing at the moment routing is
    // first consulted, a marker resolves 'dom' and paints nothing silently
    // instead of raising `HtmlPainterMissingError`.
    //
    // The spies delegate to the real methods (no `mockImplementation`), so the
    // registry built here is the genuine article.
    const expectSpy = vi.spyOn(HtmlPainterRegistry.prototype, 'expect');
    const registerSpy = vi.spyOn(HtmlPainterRegistry.prototype, 'register');

    const registry = createStandaloneMarkerRegistry();

    const recorded = [
      ...expectSpy.mock.invocationCallOrder.map(order => ({
        name: 'expect',
        order,
      })),
      ...registerSpy.mock.invocationCallOrder.map(order => ({
        name: 'register',
        order,
      })),
    ]
      .sort((a, b) => a.order - b.order)
      .map(call => call.name);

    expect(recorded).toEqual(['expect', 'register']);
    expect(expectSpy).toHaveBeenCalledWith(MARKER_HTML_TYPES);
    // Positive control that the spies observed the real construction path and
    // not an inert object: the registry that came back is usable.
    expect(registry.getActivePainter(MARKER_HTML_TYPE)).toBeDefined();
  });

  it('routes a marker element to canvas, registers exactly one canvas type (the marker type), and exposes an active painter', () => {
    const registry = createStandaloneMarkerRegistry();
    const element = markerElement('door');

    expect(resolveHtmlRouting(element, registry)).toBe('canvas');
    expect(registry.canvasTypes.has(MARKER_HTML_TYPE)).toBe(true);
    expect(registry.canvasTypes.size).toBe(1);
    expect(registry.getActivePainter(MARKER_HTML_TYPE)).toBeDefined();
  });
});
