/**
 * Marker element data — the schema and untrusted-input parser for
 * DM-authored map markers (door / trap / loot / npc / secret / note).
 *
 * Markers ride the existing `@fieldnotes/core` `html` canvas element; this
 * module owns the shape of that element's `data` field and nothing else. It
 * is pure data: no React, no Zustand, no store or SDK side effects. Every
 * downstream consumer (painter, writes, publication, panel) imports the
 * types and `parseMarkerData` from here rather than trusting element data
 * directly, per spec §6.2: remote and persisted data is untrusted and must
 * be re-validated before every use (paint, activation, publication, detail
 * lookup) — a stale in-memory `valid` result is never assumed to still hold.
 */

/** The `htmlType` RollKeeper stamps on marker elements. */
export const MARKER_HTML_TYPE = 'rk-marker';

/** Canvas types expected to have a registered painter (see
 * `expectCanvasHtmlTypes` / `expectedCanvasTypes` in the fieldnotes SDK). */
export const MARKER_HTML_TYPES: ReadonlySet<string> = new Set([
  MARKER_HTML_TYPE,
]);

/** The audience value RollKeeper stamps on DM-only elements. This is the
 * single production source of that value: both `resolveAudience` call sites
 * (`DmLocationEditor.hooks.ts` and `dm-vtt/DmBattleMapCanvas.hooks.ts`) import
 * it rather than repeating the literal, so the surfaces and this constant
 * cannot drift apart — which is what makes the assertion pinning it to `'dm'`
 * more than a tautology over an unused export. */
export const DM_AUDIENCE = 'dm';

export const MARKER_KINDS = [
  'door',
  'trap',
  'loot',
  'npc',
  'secret',
  'note',
] as const;
export type MarkerKind = (typeof MARKER_KINDS)[number];

/** Palette KEYS, not CSS colour strings — resolved to CSS at paint time
 * (spec §6.2: an invalid `fillStyle` string is silently ignored by canvas
 * and would otherwise inherit the previous element's colour). These names
 * match the app's semantic accent tokens. */
export const MARKER_COLOR_KEYS = [
  'red',
  'blue',
  'purple',
  'amber',
  'emerald',
  'orange',
] as const;
export type MarkerColorKey = (typeof MARKER_COLOR_KEYS)[number];

export const MARKER_LABEL_MAX_CODE_POINTS = 40;

/** Detail-record caps, enforced at persist time (spec §6.2). These bound the
 * product-state record, not the element payload — nothing here travels the
 * canvas wire. */
export const MARKER_TITLE_MAX_CODE_POINTS = 120;
export const MARKER_BODY_MAX_CODE_POINTS = 4000;
export const MARKER_DM_NOTES_MAX_CODE_POINTS = 4000;

/**
 * Its own focused tests (including the astral-plane boundary case) live in
 * `markerWrites.test.ts`, not here — see the `describe('capCodePoints')`
 * block there.
 *
 * Caps a string to `max` Unicode CODE POINTS. Deliberately iterates via
 * `Array.from`, which splits on code points (surrogate pairs stay intact) —
 * never `.slice`/`.length`, which operate on UTF-16 code units and would
 * truncate an astral-plane character (e.g. most emoji) in half, leaving a lone
 * surrogate. This is the single home of the code-point rule; every cap in the
 * marker feature goes through it.
 */
export function capCodePoints(value: string, max: number): string {
  const codePoints = Array.from(value);
  if (codePoints.length <= max) return value;
  return codePoints.slice(0, max).join('');
}

export interface MarkerElementDataV1 {
  v: 1;
  kind: MarkerKind;
  ref: string;
  label?: string;
  color?: MarkerColorKey;
}

export type MarkerDataResult =
  | { status: 'valid'; data: MarkerElementDataV1 }
  | { status: 'unsupported'; version?: number }
  | { status: 'invalid'; reason: string };

/**
 * Trims and caps a label to 40 Unicode CODE POINTS, delegating the cap to
 * `capCodePoints` so the surrogate-pair-safe rule lives in exactly one place.
 * Grapheme clustering via `Intl.Segmenter` is deliberately rejected by spec
 * §6.2 as disproportionate; the cap is documented in code-point terms.
 */
export function normalizeMarkerLabel(label: string): string | undefined {
  const trimmed = label.trim();
  if (trimmed === '') return undefined;
  return capCodePoints(trimmed, MARKER_LABEL_MAX_CODE_POINTS);
}

/**
 * Local-authorship constructor. `kind` and `color` are compile-time-
 * constrained by their types, so no runtime kind/colour validation happens
 * here — that is `parseMarkerData`'s job for untrusted data.
 */
export function buildMarkerData(input: {
  kind: MarkerKind;
  ref: string;
  label?: string;
  color?: MarkerColorKey;
}): MarkerElementDataV1 {
  const data: MarkerElementDataV1 = {
    v: 1,
    kind: input.kind,
    ref: input.ref,
  };
  if (input.label !== undefined) {
    const normalized = normalizeMarkerLabel(input.label);
    if (normalized !== undefined) {
      data.label = normalized;
    }
  }
  if (input.color !== undefined) {
    data.color = input.color;
  }
  return data;
}

function isRecord(data: unknown): data is Record<string, unknown> {
  return typeof data === 'object' && data !== null && !Array.isArray(data);
}

function isMarkerKind(value: unknown): value is MarkerKind {
  return (
    typeof value === 'string' &&
    (MARKER_KINDS as readonly string[]).includes(value)
  );
}

function isMarkerColorKey(value: unknown): value is MarkerColorKey {
  return (
    typeof value === 'string' &&
    (MARKER_COLOR_KEYS as readonly string[]).includes(value)
  );
}

/**
 * Tri-state parser for untrusted `data`: `valid` | `unsupported` | `invalid`.
 * Called before every use of a marker element's data (spec §6.2) — paint,
 * activation, publication, detail lookup — since remote and persisted data
 * cannot be trusted to still satisfy this shape.
 *
 * Deliberate asymmetry: an unknown `kind` is `unsupported` (a future version
 * may add kinds) but an unknown `color` is `invalid` (fail closed — the
 * painter must never be handed an unresolvable colour). Both paint the
 * neutral glyph and both refuse to open a normal detail panel upstream.
 *
 * On `valid`, `data` is a freshly constructed object with exactly the known
 * keys — never the caller's object, never a spread of it — so unknown extra
 * fields from a newer or hostile peer cannot ride through.
 */
export function parseMarkerData(data: unknown): MarkerDataResult {
  if (!isRecord(data)) {
    return { status: 'invalid', reason: 'marker data is not a record' };
  }

  const { v, kind, ref, label, color } = data;

  if (typeof v !== 'number' || !Number.isInteger(v)) {
    return { status: 'invalid', reason: 'marker data v is not an integer' };
  }
  if (v > 1) {
    return { status: 'unsupported', version: v };
  }
  if (v < 1) {
    return {
      status: 'invalid',
      reason: 'marker data v is below the minimum supported version',
    };
  }

  if (typeof kind !== 'string') {
    return { status: 'invalid', reason: 'marker data kind is not a string' };
  }
  if (!isMarkerKind(kind)) {
    return { status: 'unsupported' };
  }

  if (typeof ref !== 'string' || ref.trim() === '') {
    return {
      status: 'invalid',
      reason: 'marker data ref is missing, not a string, or blank',
    };
  }

  if (label !== undefined && typeof label !== 'string') {
    return { status: 'invalid', reason: 'marker data label is not a string' };
  }

  if (color !== undefined && !isMarkerColorKey(color)) {
    return {
      status: 'invalid',
      reason: 'marker data color is not a known palette key',
    };
  }

  const result: MarkerElementDataV1 = {
    v: 1,
    kind,
    ref: ref.trim(),
  };
  if (label !== undefined) {
    const normalized = normalizeMarkerLabel(label);
    if (normalized !== undefined) {
      result.label = normalized;
    }
  }
  if (color !== undefined) {
    result.color = color;
  }

  return { status: 'valid', data: result };
}
