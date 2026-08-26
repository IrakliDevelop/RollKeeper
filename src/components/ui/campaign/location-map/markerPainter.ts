/**
 * Canvas painter for DM-authored map markers (door / trap / loot / npc /
 * secret / note). Registered against a `@fieldnotes/core` `HtmlPainterRegistry`
 * keyed by `MARKER_HTML_TYPE`; every surface (DM editors, player canvas,
 * display page, exports) shares this one implementation.
 *
 * Pure canvas: no React, no Zustand, no store or DOM side effects. `element.data`
 * is untrusted (spec §6.2) and is re-validated with `parseMarkerData` on every
 * paint — this module never reads `element.data.<field>` directly.
 */
import {
  HtmlPainterRegistry,
  type HtmlPainter,
  type HtmlPaintContext,
} from '@fieldnotes/core';

import {
  MARKER_HTML_TYPE,
  MARKER_HTML_TYPES,
  parseMarkerData,
  type MarkerColorKey,
  type MarkerDataResult,
  type MarkerElementDataV1,
  type MarkerKind,
} from './markerData';
import type { MarkerStatus } from '@/types/battlemap';

/** Icon disc diameter as a fraction of min(w, h). */
export const MARKER_ICON_SCALE = 0.62;
/** Label font size in WORLD units = min(w, h) * this. */
export const MARKER_LABEL_FONT_RATIO = 0.24;
/** Below this rendered size in CSS pixels the label is dropped entirely. */
export const MARKER_LABEL_MIN_CSS_PX = 9;

/** Palette KEY -> CSS colour. Fixed hexes, not CSS custom properties: this
 * paints onto a canvas over a map image, where `var(--…)` does not resolve
 * and an unresolvable `fillStyle` is silently ignored (leaving the previous
 * element's colour). Chosen to read on both light and dark maps. */
export const MARKER_COLOR_CSS: Readonly<Record<MarkerColorKey, string>> = {
  red: '#ef4444',
  blue: '#3b82f6',
  purple: '#a855f7',
  amber: '#f59e0b',
  emerald: '#10b981',
  orange: '#f97316',
};

/** Used when `color` is absent from a valid marker. */
export const MARKER_DEFAULT_COLOR_KEY: MarkerColorKey = 'blue';

/** The fallback glyph's disc colour, for `unsupported` and `invalid` data. */
export const MARKER_NEUTRAL_CSS = '#6b7280';

/** Light foreground used for glyphs and labels, legible over every disc colour. */
const MARKER_GLYPH_CSS = '#f8fafc';

export interface MarkerDataIssue {
  elementId: string;
  status: 'unsupported' | 'invalid';
  /** Present only for 'invalid'. */
  reason?: string;
  /** Present only for 'unsupported' when the payload carried a numeric `v`. */
  version?: number;
}

export interface MarkerPainterOptions {
  onMarkerDataIssue?: (issue: MarkerDataIssue) => void;
  /** Resolves product-state workflow data without copying it into the canvas. */
  resolveMarkerStatus?: (ref: string) => MarkerStatus | undefined;
}

export const MARKER_STATE_COLORS = {
  armed: '#f59e0b',
  triggered: '#ef4444',
  disarmed: '#10b981',
} as const;

/**
 * Draws the disc backdrop, shared by every status. The `min(w, h)` radius rule
 * lives in `discGeometry` below, which is the single owner of the geometry.
 */
function drawDisc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  fillColor: string
): void {
  ctx.fillStyle = fillColor;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
}

/** The `?` fallback glyph, used for both `unsupported` and `invalid` data. */
function drawNeutralGlyph(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number
): void {
  ctx.fillStyle = MARKER_GLYPH_CSS;
  ctx.font = `${radius}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', cx, cy);
}

/** Each kind gets its own distinguishable shape, drawn inside the disc. */
function drawKindGlyph(
  ctx: CanvasRenderingContext2D,
  kind: MarkerKind,
  cx: number,
  cy: number,
  radius: number
): void {
  ctx.fillStyle = MARKER_GLYPH_CSS;
  ctx.strokeStyle = MARKER_GLYPH_CSS;
  ctx.lineWidth = Math.max(1, radius * 0.12);

  switch (kind) {
    case 'door': {
      ctx.beginPath();
      ctx.rect(cx - radius * 0.35, cy - radius * 0.5, radius * 0.7, radius);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + radius * 0.18, cy, radius * 0.08, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    case 'trap': {
      // Canvas adaptation of Lucide TriangleAlert.
      ctx.beginPath();
      ctx.moveTo(cx, cy - radius * 0.5);
      ctx.lineTo(cx + radius * 0.5, cy + radius * 0.4);
      ctx.lineTo(cx - radius * 0.5, cy + radius * 0.4);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - radius * 0.18);
      ctx.lineTo(cx, cy + radius * 0.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy + radius * 0.25, radius * 0.045, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    case 'loot': {
      // Canvas adaptation of Lucide Gem, including its facet lines.
      ctx.beginPath();
      ctx.moveTo(cx - radius * 0.48, cy - radius * 0.12);
      ctx.lineTo(cx - radius * 0.28, cy - radius * 0.48);
      ctx.lineTo(cx + radius * 0.28, cy - radius * 0.48);
      ctx.lineTo(cx + radius * 0.48, cy - radius * 0.12);
      ctx.lineTo(cx, cy + radius * 0.5);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - radius * 0.48, cy - radius * 0.12);
      ctx.lineTo(cx + radius * 0.48, cy - radius * 0.12);
      ctx.moveTo(cx - radius * 0.18, cy - radius * 0.48);
      ctx.lineTo(cx, cy + radius * 0.5);
      ctx.moveTo(cx + radius * 0.18, cy - radius * 0.48);
      ctx.lineTo(cx, cy + radius * 0.5);
      ctx.stroke();
      return;
    }
    case 'npc': {
      ctx.beginPath();
      ctx.arc(cx, cy - radius * 0.25, radius * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy + radius * 0.4, radius * 0.35, Math.PI, Math.PI * 2);
      ctx.fill();
      return;
    }
    case 'secret': {
      // Canvas adaptation of Lucide KeyRound.
      ctx.beginPath();
      ctx.arc(
        cx + radius * 0.22,
        cy - radius * 0.22,
        radius * 0.24,
        0,
        Math.PI * 2
      );
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + radius * 0.05, cy - radius * 0.05);
      ctx.lineTo(cx - radius * 0.42, cy + radius * 0.42);
      ctx.lineTo(cx - radius * 0.42, cy + radius * 0.18);
      ctx.moveTo(cx - radius * 0.2, cy + radius * 0.2);
      ctx.lineTo(cx - radius * 0.05, cy + radius * 0.35);
      ctx.stroke();
      return;
    }
    case 'note': {
      // Canvas adaptation of Lucide StickyNote with folded corner.
      ctx.beginPath();
      ctx.moveTo(cx - radius * 0.42, cy - radius * 0.48);
      ctx.lineTo(cx + radius * 0.42, cy - radius * 0.48);
      ctx.lineTo(cx + radius * 0.42, cy + radius * 0.16);
      ctx.lineTo(cx + radius * 0.1, cy + radius * 0.48);
      ctx.lineTo(cx - radius * 0.42, cy + radius * 0.48);
      ctx.closePath();
      ctx.moveTo(cx + radius * 0.1, cy + radius * 0.48);
      ctx.lineTo(cx + radius * 0.1, cy + radius * 0.16);
      ctx.lineTo(cx + radius * 0.42, cy + radius * 0.16);
      ctx.stroke();
      return;
    }
  }
}

/** A small badge in the disc's top-right corner. Trap badges deliberately use
 * shapes as well as colour so their meaning survives colour-vision variance. */
function drawTrapStateDecoration(
  ctx: CanvasRenderingContext2D,
  status: MarkerStatus | undefined,
  cx: number,
  cy: number,
  radius: number
): void {
  if (status !== 'armed' && status !== 'triggered' && status !== 'disarmed') {
    return;
  }

  const badgeX = cx + radius * 0.68;
  const badgeY = cy - radius * 0.68;
  const badgeRadius = radius * 0.34;
  ctx.fillStyle = MARKER_STATE_COLORS[status];
  ctx.strokeStyle = MARKER_GLYPH_CSS;
  ctx.lineWidth = Math.max(1, radius * 0.1);
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = MARKER_GLYPH_CSS;
  ctx.lineWidth = Math.max(1, radius * 0.12);
  ctx.beginPath();
  if (status === 'armed') {
    ctx.arc(badgeX, badgeY, badgeRadius * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = MARKER_GLYPH_CSS;
    ctx.fill();
  } else if (status === 'triggered') {
    ctx.moveTo(badgeX - badgeRadius * 0.4, badgeY - badgeRadius * 0.4);
    ctx.lineTo(badgeX + badgeRadius * 0.4, badgeY + badgeRadius * 0.4);
    ctx.moveTo(badgeX + badgeRadius * 0.4, badgeY - badgeRadius * 0.4);
    ctx.lineTo(badgeX - badgeRadius * 0.4, badgeY + badgeRadius * 0.4);
    ctx.stroke();
  } else {
    ctx.moveTo(badgeX - badgeRadius * 0.45, badgeY);
    ctx.lineTo(badgeX - badgeRadius * 0.1, badgeY + badgeRadius * 0.35);
    ctx.lineTo(badgeX + badgeRadius * 0.5, badgeY - badgeRadius * 0.4);
    ctx.stroke();
  }
}

/** Draws the label, centred at `w / 2`, beneath the disc — only when legible. */
function drawLabel(
  ctx: CanvasRenderingContext2D,
  cx: number,
  labelY: number,
  fontWorld: number,
  zoom: number,
  label: string
): void {
  if (fontWorld * zoom < MARKER_LABEL_MIN_CSS_PX) {
    return;
  }
  ctx.fillStyle = MARKER_GLYPH_CSS;
  ctx.font = `${fontWorld}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(label, cx, labelY);
}

/** `JSON.stringify` replacer that sorts object keys alphabetically (applied
 * at every nesting level, since the replacer runs per key) so two
 * semantically identical payloads with different key insertion order
 * serialise to the same string. */
function sortKeysReplacer(_key: string, value: unknown): unknown {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((sorted, key) => {
        sorted[key] = (value as Record<string, unknown>)[key];
        return sorted;
      }, {});
  }
  return value;
}

/** Stable key for `onMarkerDataIssue` dedupe: status + a key-order-independent
 * serialisation of the raw element data, so two semantically identical bad
 * payloads never spuriously re-emit. Wrapped so a pathological payload
 * cannot throw out of the painter. */
function issueKey(status: string, rawData: unknown): string {
  try {
    return `${status}:${JSON.stringify(rawData, sortKeysReplacer)}`;
  } catch {
    return `${status}:unserializable`;
  }
}

function buildIssue(
  elementId: string,
  result: Exclude<MarkerDataResult, { status: 'valid' }>
): MarkerDataIssue {
  if (result.status === 'invalid') {
    return { elementId, status: 'invalid', reason: result.reason };
  }
  if (result.version !== undefined) {
    return { elementId, status: 'unsupported', version: result.version };
  }
  return { elementId, status: 'unsupported' };
}

interface DiscGeometry {
  minDim: number;
  radius: number;
  cx: number;
  cy: number;
}

/**
 * Shared disc geometry for both the valid and fallback paint paths, so a
 * future edit to one cannot silently misalign the other. Radius derives from
 * `min(w, h)` — never `max`, never `w` alone — so a 120x40 element gets the
 * same disc as a 40x40 one.
 */
function discGeometry(size: Readonly<{ w: number; h: number }>): DiscGeometry {
  const minDim = Math.min(size.w, size.h);
  const radius = (minDim * MARKER_ICON_SCALE) / 2;
  const cx = size.w / 2;
  const cy = radius;
  return { minDim, radius, cx, cy };
}

function paintValid(
  ctx: CanvasRenderingContext2D,
  size: Readonly<{ w: number; h: number }>,
  zoom: number,
  data: MarkerElementDataV1,
  status?: MarkerStatus
): void {
  const { minDim, radius, cx, cy } = discGeometry(size);

  drawDisc(
    ctx,
    cx,
    cy,
    radius,
    MARKER_COLOR_CSS[data.color ?? MARKER_DEFAULT_COLOR_KEY]
  );
  drawKindGlyph(ctx, data.kind, cx, cy, radius);
  if (data.kind === 'trap') {
    drawTrapStateDecoration(ctx, status, cx, cy, radius);
  }

  if (data.label !== undefined) {
    const fontWorld = minDim * MARKER_LABEL_FONT_RATIO;
    drawLabel(ctx, cx, cy + radius + 2, fontWorld, zoom, data.label);
  }
}

function paintFallback(
  ctx: CanvasRenderingContext2D,
  size: Readonly<{ w: number; h: number }>
): void {
  const { radius, cx, cy } = discGeometry(size);

  drawDisc(ctx, cx, cy, radius, MARKER_NEUTRAL_CSS);
  drawNeutralGlyph(ctx, cx, cy, radius);
}

/**
 * Builds a fresh `HtmlPainter` for markers. `onMarkerDataIssue` dedupe state
 * (per element id, keyed by status + a stable serialisation of the raw data)
 * lives in this closure, so each `createMarkerPainter()` call starts clean.
 */
export function createMarkerPainter(
  opts: MarkerPainterOptions = {}
): HtmlPainter {
  const lastIssueKey = new Map<string, string>();

  return function markerPainter(paint: HtmlPaintContext): void {
    const { ctx, element, size, zoom } = paint;
    const result = parseMarkerData(element.data);

    if (result.status === 'valid') {
      paintValid(
        ctx,
        size,
        zoom,
        result.data,
        opts.resolveMarkerStatus?.(result.data.ref)
      );
      return;
    }

    if (opts.onMarkerDataIssue) {
      const key = issueKey(result.status, element.data);
      if (lastIssueKey.get(element.id) !== key) {
        opts.onMarkerDataIssue(buildIssue(element.id, result));
      }
      lastIssueKey.set(element.id, key);
    }

    paintFallback(ctx, size);
  };
}

/**
 * A registry usable with no viewport mounted (exports, background paths).
 * Calls `expect(MARKER_HTML_TYPES)` FIRST, then `register(MARKER_HTML_TYPE, painter)`
 * — `expect()` before `register()`, or a marker would silently route to DOM
 * instead of failing loudly if registration were ever skipped.
 *
 * That ordering is not observable through the registry's accessors after the
 * fact (`canvasTypes` is `declared ∪ {types with a live painter}`), so it is
 * pinned by call order instead — see "declares the canvas type BEFORE
 * registering the painter" in `markerPainter.test.ts`.
 */
export function createStandaloneMarkerRegistry(
  opts?: MarkerPainterOptions
): HtmlPainterRegistry {
  const registry = new HtmlPainterRegistry();
  registry.expect(MARKER_HTML_TYPES);
  registry.register(MARKER_HTML_TYPE, createMarkerPainter(opts));
  return registry;
}
