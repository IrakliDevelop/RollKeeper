import { describe, it, expect } from 'vitest';
import {
  MARKER_HTML_TYPE,
  MARKER_HTML_TYPES,
  MARKER_KINDS,
  MARKER_COLOR_KEYS,
  MARKER_LABEL_MAX_CODE_POINTS,
  DM_AUDIENCE,
  normalizeMarkerLabel,
  buildMarkerData,
  parseMarkerData,
  type MarkerElementDataV1,
} from './markerData';

/** Base fixture for a well-formed v1 payload. Every negative test below
 * mutates exactly one field off this fixture, and has a sibling positive
 * assertion showing the same fixture (with the field corrected) is valid. */
function fixture(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    v: 1,
    kind: 'door',
    ref: 'abc-123',
    label: 'A wooden door',
    color: 'red',
    ...overrides,
  };
}

/** Returns a shallow copy of `payload` with `key` removed. Used to build
 * missing-field fixtures without destructuring-and-discarding a binding. */
function omit(
  payload: Record<string, unknown>,
  key: string
): Record<string, unknown> {
  const copy = { ...payload };
  delete copy[key];
  return copy;
}

describe('module constants', () => {
  it('MARKER_HTML_TYPE and MARKER_HTML_TYPES agree', () => {
    expect(MARKER_HTML_TYPE).toBe('rk-marker');
    expect(MARKER_HTML_TYPES.has('rk-marker')).toBe(true);
    expect(MARKER_HTML_TYPES.size).toBe(1);
  });

  it('DM_AUDIENCE is the dm literal', () => {
    expect(DM_AUDIENCE).toBe('dm');
  });
});

describe('normalizeMarkerLabel', () => {
  it('trims leading and trailing whitespace', () => {
    expect(normalizeMarkerLabel('  hello  ')).toBe('hello');
  });

  it('returns undefined for an empty string', () => {
    expect(normalizeMarkerLabel('')).toBeUndefined();
  });

  it('returns undefined for a whitespace-only string', () => {
    expect(normalizeMarkerLabel('   ')).toBeUndefined();
  });

  it('returns a 40-code-point input unchanged', () => {
    const input = 'a'.repeat(40);
    expect(normalizeMarkerLabel(input)).toBe(input);
  });

  it('returns a 39-code-point input unchanged (positive control)', () => {
    const input = 'a'.repeat(39);
    expect(normalizeMarkerLabel(input)).toBe(input);
  });

  it('caps a 100-code-point astral-plane string to exactly 40 code points', () => {
    const input = '😀'.repeat(100); // 100 code points, 200 UTF-16 units
    const expected = '😀'.repeat(40);
    const result = normalizeMarkerLabel(input);
    expect(result).toBe(expected);
    expect(Array.from(result as string).length).toBe(40);
  });

  it('caps a mixed BMP + astral label at 40 code points with no unpaired surrogate', () => {
    // The BMP prefix is an ODD length (21) so that a naive UTF-16
    // `slice(0, 40)` — which counts code *units*, not code points — lands
    // mid-surrogate-pair: 21 BMP units + 19 more units is an odd number of
    // units into the emoji run, i.e. a lone high surrogate at the cut. A
    // correct code-point-aware cap never produces that, so this only passes
    // when the surrogate-pair-safe implementation is in place.
    const input = 'a'.repeat(21) + '😀'.repeat(30); // 51 code points total
    const result = normalizeMarkerLabel(input) as string;
    expect(result).toBe('a'.repeat(21) + '😀'.repeat(19));
    expect(Array.from(result).length).toBe(40);
    // A cut that split a surrogate pair would leave a lone high surrogate
    // (0xD800-0xDBFF) as the last UTF-16 code unit.
    const lastCodeUnit = result.charCodeAt(result.length - 1);
    expect(lastCodeUnit).toBeGreaterThanOrEqual(0xdc00); // low surrogate, valid pair end
    expect(lastCodeUnit).toBeLessThanOrEqual(0xdfff);
  });
});

describe('buildMarkerData', () => {
  it('returns v1 data with the given kind and ref', () => {
    const result = buildMarkerData({ kind: 'trap', ref: 'ref-1' });
    expect(result.v).toBe(1);
    expect(result.kind).toBe('trap');
    expect(result.ref).toBe('ref-1');
  });

  it('caps the label through the public constructor (astral case)', () => {
    const label = '😀'.repeat(100);
    const result = buildMarkerData({ kind: 'npc', ref: 'ref-2', label });
    expect(result.label).toBe('😀'.repeat(40));
    expect(Array.from(result.label as string).length).toBe(40);
  });

  it('omits label entirely for a blank/whitespace-only input', () => {
    const result = buildMarkerData({
      kind: 'note',
      ref: 'ref-3',
      label: '   ',
    });
    expect('label' in result).toBe(false);
  });

  it('includes a non-blank label', () => {
    const result = buildMarkerData({ kind: 'note', ref: 'ref-4', label: 'hi' });
    expect('label' in result).toBe(true);
    expect(result.label).toBe('hi');
  });

  it('omits color when not supplied', () => {
    const result = buildMarkerData({ kind: 'loot', ref: 'ref-5' });
    expect('color' in result).toBe(false);
  });

  it('includes color when supplied', () => {
    const result = buildMarkerData({
      kind: 'loot',
      ref: 'ref-6',
      color: 'amber',
    });
    expect('color' in result).toBe(true);
    expect(result.color).toBe('amber');
  });

  it('round-trips through parseMarkerData as valid with equal data', () => {
    const built = buildMarkerData({
      kind: 'secret',
      ref: 'ref-7',
      label: 'A secret door',
      color: 'purple',
    });
    const parsed = parseMarkerData(built);
    expect(parsed.status).toBe('valid');
    if (parsed.status === 'valid') {
      expect(parsed.data).toEqual(built);
    }
  });
});

describe('parseMarkerData', () => {
  it('returns valid for a well-formed v1 payload, deep-equal to the expected object', () => {
    const result = parseMarkerData(fixture());
    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      const expected: MarkerElementDataV1 = {
        v: 1,
        kind: 'door',
        ref: 'abc-123',
        label: 'A wooden door',
        color: 'red',
      };
      expect(result.data).toEqual(expected);
    }
  });

  it('drops an extra unknown field on an otherwise well-formed payload (fail-closed field pick)', () => {
    const result = parseMarkerData(fixture({ extra: 'hostile-payload' }));
    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      expect('extra' in result.data).toBe(false);
      expect(Object.keys(result.data).sort()).toEqual([
        'color',
        'kind',
        'label',
        'ref',
        'v',
      ]);
    }
  });

  it('is unsupported for v: 2, with version === 2', () => {
    const result = parseMarkerData(fixture({ v: 2 }));
    expect(result.status).toBe('unsupported');
    if (result.status === 'unsupported') {
      expect(result.version).toBe(2);
    }
  });

  it('is unsupported for a well-formed payload with an unknown kind ("portal")', () => {
    const result = parseMarkerData(fixture({ kind: 'portal' }));
    expect(result.status).toBe('unsupported');
    if (result.status === 'unsupported') {
      expect('version' in result).toBe(false);
    }
  });

  it.each([null, undefined, 'string', []])(
    'is invalid for a non-record payload: %j',
    data => {
      const result = parseMarkerData(data);
      expect(result.status).toBe('invalid');
    }
  );

  it('is invalid for an array-shaped payload that is otherwise well-formed (array guard)', () => {
    // Array.isArray(arrayPayload) is true and typeof arrayPayload === 'object',
    // so only the `!Array.isArray(data)` clause in isRecord can reject this.
    // Every other field (v, kind, ref, label, color) is copied straight from
    // the well-formed fixture, so nothing downstream would reject it either.
    const arrayPayload = Object.assign([], fixture());
    const result = parseMarkerData(arrayPayload);
    expect(result.status).toBe('invalid');
  });

  it('is invalid for a function-shaped payload that is otherwise well-formed (typeof guard)', () => {
    // typeof a function is 'function', not 'object', so only the
    // `typeof data === 'object'` clause in isRecord can reject this. A
    // function can carry arbitrary own properties, so v/kind/ref/label/color
    // are all readable off it exactly as they would be off a plain record.
    const fnPayload = Object.assign(function marker() {}, fixture());
    const result = parseMarkerData(fnPayload);
    expect(result.status).toBe('invalid');
  });

  it('is invalid when v is missing', () => {
    expect(parseMarkerData(omit(fixture(), 'v')).status).toBe('invalid');
  });

  it('is valid when v is present (positive control for missing v)', () => {
    expect(parseMarkerData(fixture()).status).toBe('valid');
  });

  it('is invalid when v is a string', () => {
    expect(parseMarkerData(fixture({ v: '1' })).status).toBe('invalid');
  });

  it('is valid when v is the number 1 (positive control for string v)', () => {
    expect(parseMarkerData(fixture({ v: 1 })).status).toBe('valid');
  });

  it('is invalid when v is NaN', () => {
    expect(parseMarkerData(fixture({ v: NaN })).status).toBe('invalid');
  });

  it('is invalid when v is non-integer', () => {
    expect(parseMarkerData(fixture({ v: 1.5 })).status).toBe('invalid');
  });

  it('is invalid when v is less than 1 (0)', () => {
    expect(parseMarkerData(fixture({ v: 0 })).status).toBe('invalid');
  });

  it('is invalid when v is negative', () => {
    expect(parseMarkerData(fixture({ v: -1 })).status).toBe('invalid');
  });

  it('is invalid when ref is missing', () => {
    expect(parseMarkerData(omit(fixture(), 'ref')).status).toBe('invalid');
  });

  it('is valid when ref is present (positive control for missing ref)', () => {
    expect(parseMarkerData(fixture()).status).toBe('valid');
  });

  it('is invalid when ref is blank after trim ("   ")', () => {
    expect(parseMarkerData(fixture({ ref: '   ' })).status).toBe('invalid');
  });

  it('is valid when ref is non-blank (positive control for blank ref)', () => {
    expect(parseMarkerData(fixture({ ref: 'x' })).status).toBe('valid');
  });

  it('is invalid when ref is a number (42)', () => {
    expect(parseMarkerData(fixture({ ref: 42 })).status).toBe('invalid');
  });

  it('is valid when ref is a string (positive control for numeric ref)', () => {
    expect(parseMarkerData(fixture({ ref: '42' })).status).toBe('valid');
  });

  it('stores ref trimmed on a valid result', () => {
    const result = parseMarkerData(fixture({ ref: '  padded-ref  ' }));
    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      expect(result.data.ref).toBe('padded-ref');
    }
  });

  it('is invalid when kind is not a string (42)', () => {
    expect(parseMarkerData(fixture({ kind: 42 })).status).toBe('invalid');
  });

  it('is valid when kind is a valid string (positive control for numeric kind)', () => {
    expect(parseMarkerData(fixture({ kind: 'door' })).status).toBe('valid');
  });

  it('is invalid when label is not a string (42)', () => {
    expect(parseMarkerData(fixture({ label: 42 })).status).toBe('invalid');
  });

  it('is valid when label is a string (positive control for numeric label)', () => {
    expect(parseMarkerData(fixture({ label: 'a label' })).status).toBe('valid');
  });

  it('is invalid for color: "chartreuse" (not a palette key)', () => {
    expect(parseMarkerData(fixture({ color: 'chartreuse' })).status).toBe(
      'invalid'
    );
  });

  // Named for what it pins, not for a guard that does not exist separably:
  // `isMarkerColorKey`'s `typeof value === 'string'` is not a distinct check a
  // non-string can fail on its own — `MARKER_COLOR_KEYS.includes(7)` is
  // already false. The `typeof` is there to narrow `unknown` to `string` so
  // `includes` typechecks (and to mirror `isMarkerKind`); what this case
  // actually pins is that a non-string colour is rejected by the same
  // palette-membership rule as an unknown string.
  it('is invalid for color: 7 — a non-string colour fails palette membership like any other non-key', () => {
    expect(parseMarkerData(fixture({ color: 7 })).status).toBe('invalid');
  });

  it('is valid when color is a palette key (positive control for bad color)', () => {
    expect(parseMarkerData(fixture({ color: 'blue' })).status).toBe('valid');
  });

  it.each(MARKER_KINDS)('parses valid for every marker kind: %s', kind => {
    const result = parseMarkerData(fixture({ kind }));
    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      expect(result.data.kind).toBe(kind);
    }
  });

  it.each(MARKER_COLOR_KEYS)(
    'parses valid for every marker color key: %s',
    color => {
      const result = parseMarkerData(fixture({ color }));
      expect(result.status).toBe('valid');
      if (result.status === 'valid') {
        expect(result.data.color).toBe(color);
      }
    }
  );

  it('caps a valid result label to 40 code points when input carried 100', () => {
    const result = parseMarkerData(fixture({ label: '😀'.repeat(100) }));
    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      expect(result.data.label).toBe('😀'.repeat(40));
      expect(Array.from(result.data.label as string).length).toBe(
        MARKER_LABEL_MAX_CODE_POINTS
      );
    }
  });

  it('omits label from a valid result when the payload has no label', () => {
    const result = parseMarkerData(omit(fixture(), 'label'));
    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      expect('label' in result.data).toBe(false);
    }
  });

  it('omits label from a valid result when the payload label is blank after trim', () => {
    const result = parseMarkerData(fixture({ label: '   ' }));
    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      expect('label' in result.data).toBe(false);
    }
  });

  it('omits color from a valid result when the payload has no color', () => {
    const result = parseMarkerData(omit(fixture(), 'color'));
    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      expect('color' in result.data).toBe(false);
    }
  });
});
