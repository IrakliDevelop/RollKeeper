import { describe, expect, it, vi } from 'vitest';

import { createHtmlElement, createShape } from '@fieldnotes/core';
import type { CanvasElement, HtmlElement } from '@fieldnotes/core';

import {
  MARKER_HTML_TYPE,
  buildMarkerData,
  parseMarkerData,
} from './markerData';
import type { MarkerKind } from './markerData';
import { buildPublicMarkerDetails } from './markerPublication';

import type { MarkerDetail } from '@/types/battlemap';

/**
 * Fixtures use the REAL `createHtmlElement` and the REAL `buildMarkerData`, and
 * serialize the way `viewport.exportJSON()` does (`{ version, camera, elements }`).
 * There is deliberately no `@fieldnotes` module mock in this file: the whole
 * point of the projection is that it reads an authentic canvas payload.
 */
function pin(input: {
  kind?: MarkerKind;
  ref: string;
  label?: string;
}): HtmlElement {
  return createHtmlElement({
    position: { x: 0, y: 0 },
    size: { w: 40, h: 40 },
    layerId: 'markers',
    htmlType: MARKER_HTML_TYPE,
    data: {
      ...buildMarkerData({
        kind: input.kind ?? 'door',
        ref: input.ref,
        label: input.label,
      }),
    },
  });
}

/** A marker-typed element carrying hand-written (untrusted) `data`. */
function rawPin(data: Record<string, unknown>): HtmlElement {
  return createHtmlElement({
    position: { x: 0, y: 0 },
    size: { w: 40, h: 40 },
    layerId: 'markers',
    htmlType: MARKER_HTML_TYPE,
    data,
  });
}

function canvas(elements: readonly CanvasElement[]): string {
  return JSON.stringify({
    version: 1,
    camera: { position: { x: 0, y: 0 }, zoom: 1 },
    elements,
  });
}

/**
 * The same envelope as `canvas`, but for deliberately ill-formed payloads that
 * no factory can produce and that therefore cannot be typed as `CanvasElement`.
 * Persisted and relayed canvas JSON is untrusted (§6.2), so these ARE shapes
 * `pinIdsByRef` can be handed at runtime.
 */
function rawCanvas(elements: readonly unknown[]): string {
  return JSON.stringify({
    version: 1,
    camera: { position: { x: 0, y: 0 }, zoom: 1 },
    elements,
  });
}

function detail(
  id: string,
  overrides: Partial<MarkerDetail> = {}
): MarkerDetail {
  return {
    id,
    title: `title-${id}`,
    body: `body-${id}`,
    dmNotes: `dmNotes-${id}`,
    ...overrides,
  };
}

describe('buildPublicMarkerDetails — publishes', () => {
  it('publishes safe loot fields without transferable item definitions', () => {
    const result = buildPublicMarkerDetails({
      canvasState: canvas([pin({ ref: 'loot-1', kind: 'loot' })]),
      markers: [
        detail('loot-1', {
          loot: [
            {
              id: 'entry-1',
              itemKind: 'inventory',
              item: {
                id: 'private-item-id',
                name: 'Ruby',
                category: 'treasure',
                quantity: 1,
                description: 'A bright red gem',
                tags: ['SECRET-TAG'],
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
              },
              quantity: 3,
              claimedQuantity: 1,
            },
          ],
        }),
      ],
      dmOnlyElements: {},
    });

    expect(result[0].loot).toEqual([
      {
        id: 'entry-1',
        name: 'Ruby',
        itemKind: 'inventory',
        quantity: 3,
        remainingQuantity: 2,
        description: 'A bright red gem',
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('private-item-id');
    expect(JSON.stringify(result)).not.toContain('SECRET-TAG');
    expect('item' in (result[0].loot?.[0] ?? {})).toBe(false);
  });

  it('publishes operational status through the explicit safe projection', () => {
    const result = buildPublicMarkerDetails({
      canvasState: canvas([pin({ ref: 'ref-1' })]),
      markers: [detail('ref-1', { status: 'triggered' })],
      dmOnlyElements: {},
    });
    expect(result).toEqual([
      {
        id: 'ref-1',
        title: 'title-ref-1',
        body: 'body-ref-1',
        status: 'triggered',
      },
    ]);
  });
  it('publishes exactly one safe detail for a single valid shared marker', () => {
    const el = pin({ ref: 'ref-1' });

    const result = buildPublicMarkerDetails({
      canvasState: canvas([el]),
      markers: [detail('ref-1')],
      dmOnlyElements: {},
    });

    expect(result).toEqual([
      { id: 'ref-1', title: 'title-ref-1', body: 'body-ref-1' },
    ]);
  });

  it('publishes exactly one detail for multiple valid shared siblings sharing one ref', () => {
    const pins = [
      pin({ ref: 'ref-1' }),
      pin({ ref: 'ref-1', kind: 'trap' }),
      pin({ ref: 'ref-1', kind: 'loot', label: 'third' }),
    ];
    // Sanity: three distinct pins, one ref.
    expect(new Set(pins.map(p => p.id)).size).toBe(3);

    const result = buildPublicMarkerDetails({
      canvasState: canvas(pins),
      markers: [detail('ref-1')],
      dmOnlyElements: {},
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ref-1');
  });

  it('returns details in the order of the markers input', () => {
    const pins = [pin({ ref: 'c' }), pin({ ref: 'a' }), pin({ ref: 'b' })];

    const result = buildPublicMarkerDetails({
      canvasState: canvas(pins),
      markers: [detail('a'), detail('b'), detail('c')],
      dmOnlyElements: {},
    });

    expect(result.map(r => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('contributes no ref from a non-html element, a foreign htmlType or an id-less pin, while the genuine marker still publishes', () => {
    // Each of `pinIdsByRef`'s three structural guards gets an element that
    // ONLY that guard rejects, so each can be mutated away independently and
    // be seen to fail here.
    //
    // 1. `type !== 'html'`: a shape that also carries `htmlType` — the very
    //    next guard would otherwise catch it, leaving the type check inert.
    //    Untrusted JSON can carry any field combination; `createShape` can't,
    //    hence `rawCanvas`.
    const shapeWithMarkerFields = {
      ...createShape({
        position: { x: 0, y: 0 },
        size: { w: 40, h: 40 },
        layerId: 'markers',
      }),
      htmlType: MARKER_HTML_TYPE,
      data: { ...buildMarkerData({ kind: 'door', ref: 'ref-shape' }) },
    };
    // 2. `htmlType !== MARKER_HTML_TYPE`: a genuine html element that is not
    //    a marker but carries a marker-shaped payload.
    const foreignHtml = createHtmlElement({
      position: { x: 0, y: 0 },
      size: { w: 40, h: 40 },
      layerId: 'markers',
      htmlType: 'not-a-marker',
      data: { ...buildMarkerData({ kind: 'door', ref: 'ref-foreign' }) },
    });
    // 3. the id guard — the fail-OPEN one. Without an id there is nothing to
    //    look the pin's audience up BY: mutate the guard away and the pushed
    //    id is `undefined`, so `dmOnlyElements[undefined]` is `undefined`,
    //    `isShared` is `true`, and the detail publishes no matter what the DM
    //    chose. No `dmOnlyElements` seed can change that — an id-less pin is
    //    unreachable from that map by construction — which is exactly why the
    //    ref has to be dropped here rather than resolved later.
    const idless: Record<string, unknown> = { ...pin({ ref: 'ref-idless' }) };
    expect(typeof idless.id).toBe('string');
    delete idless.id;

    const genuine = pin({ ref: 'ref-genuine' });

    const result = buildPublicMarkerDetails({
      canvasState: rawCanvas([
        shapeWithMarkerFields,
        foreignHtml,
        idless,
        genuine,
      ]),
      markers: [
        detail('ref-shape'),
        detail('ref-foreign'),
        detail('ref-idless'),
        detail('ref-genuine'),
      ],
      dmOnlyElements: {},
    });

    // Positive control and negative assertion in one: only the real pin's ref
    // survives, and it survives off this same canvas — so the three omissions
    // are caused by the guards and not by an unreadable envelope.
    expect(result.map(r => r.id)).toEqual(['ref-genuine']);
  });
});

describe('buildPublicMarkerDetails — exclusions', () => {
  it('excludes an orphan ref no pin references', () => {
    const el = pin({ ref: 'ref-live' });

    const result = buildPublicMarkerDetails({
      canvasState: canvas([el]),
      markers: [detail('ref-live'), detail('ref-orphan')],
      dmOnlyElements: {},
    });

    expect(result.map(r => r.id)).toEqual(['ref-live']);
  });

  it('excludes a ref reachable only through a pin whose data is invalid', () => {
    // Unknown palette key => `invalid` (parseMarkerData fails closed on colour).
    const bad = rawPin({
      v: 1,
      kind: 'door',
      ref: 'ref-bad',
      color: 'chartreuse',
    });
    // Guard the fixture itself: if a future parser change made this parse
    // `valid`, the exclusion below would pass for the wrong reason.
    expect(parseMarkerData(bad.data).status).toBe('invalid');

    const result = buildPublicMarkerDetails({
      canvasState: canvas([bad]),
      markers: [detail('ref-bad')],
      dmOnlyElements: {},
    });

    expect(result).toEqual([]);
  });

  it('excludes an unsupported-version ref WITHOUT suppressing an unrelated valid shared marker', () => {
    const future = rawPin({ v: 2, kind: 'door', ref: 'ref-future' });
    expect(parseMarkerData(future.data).status).toBe('unsupported');
    const good = pin({ ref: 'ref-good' });

    const result = buildPublicMarkerDetails({
      canvasState: canvas([future, good]),
      markers: [detail('ref-future'), detail('ref-good')],
      dmOnlyElements: {},
    });

    // Unlike `gcOrphanMarkerDetails`, an unreadable pin does NOT abort the
    // whole operation — it only fails to contribute its own ref.
    expect(result.map(r => r.id)).toEqual(['ref-good']);
  });

  it('excludes wrong-map refs: this map’s markers against another map’s canvas', () => {
    const otherMapPins = [pin({ ref: 'other-1' }), pin({ ref: 'other-2' })];

    const result = buildPublicMarkerDetails({
      canvasState: canvas(otherMapPins),
      markers: [detail('mine-1'), detail('mine-2')],
      dmOnlyElements: {},
    });

    expect(result).toEqual([]);

    // Positive control on the same fixture: the other map's OWN details would
    // publish off that canvas, so the empty result above is caused by the ref
    // mismatch and not by a canvas the projection cannot read at all.
    expect(
      buildPublicMarkerDetails({
        canvasState: canvas(otherMapPins),
        markers: [detail('other-1'), detail('other-2')],
        dmOnlyElements: {},
      }).map(r => r.id)
    ).toEqual(['other-1', 'other-2']);
  });

  it('excludes a ref whose only pin is DM-only', () => {
    const el = pin({ ref: 'ref-1' });

    expect(
      buildPublicMarkerDetails({
        canvasState: canvas([el]),
        markers: [detail('ref-1')],
        dmOnlyElements: { [el.id]: true },
      })
    ).toEqual([]);

    // Positive control, same fixture: shared publishes.
    expect(
      buildPublicMarkerDetails({
        canvasState: canvas([el]),
        markers: [detail('ref-1')],
        dmOnlyElements: {},
      }).map(r => r.id)
    ).toEqual(['ref-1']);
  });

  it('excludes a mixed-audience ref and reports it, and publishes once every pin is shared', () => {
    const hidden = pin({ ref: 'ref-1' });
    const shown = pin({ ref: 'ref-1', kind: 'trap' });
    const onDroppedRef = vi.fn();

    const mixed = buildPublicMarkerDetails({
      canvasState: canvas([hidden, shown]),
      markers: [detail('ref-1')],
      dmOnlyElements: { [hidden.id]: true },
      onDroppedRef,
    });

    expect(mixed).toEqual([]);
    expect(onDroppedRef).toHaveBeenCalledTimes(1);
    expect(onDroppedRef).toHaveBeenCalledWith({
      ref: 'ref-1',
      reason: 'mixed-audience',
    });

    // Positive control, same fixture and same spy: flip the DM-only pin to
    // shared and the detail publishes with no drop reported.
    onDroppedRef.mockClear();
    const allShared = buildPublicMarkerDetails({
      canvasState: canvas([hidden, shown]),
      markers: [detail('ref-1')],
      dmOnlyElements: {},
      onDroppedRef,
    });

    expect(allShared.map(r => r.id)).toEqual(['ref-1']);
    expect(onDroppedRef).not.toHaveBeenCalled();
  });

  it('never publishes a soft-deleted detail', () => {
    const el = pin({ ref: 'ref-1' });

    expect(
      buildPublicMarkerDetails({
        canvasState: canvas([el]),
        markers: [detail('ref-1', { deletedAt: '2026-02-03T04:05:06.000Z' })],
        dmOnlyElements: {},
      })
    ).toEqual([]);

    // Positive control: the same fixture WITHOUT `deletedAt` publishes.
    expect(
      buildPublicMarkerDetails({
        canvasState: canvas([el]),
        markers: [detail('ref-1')],
        dmOnlyElements: {},
      }).map(r => r.id)
    ).toEqual(['ref-1']);
  });
});

describe('buildPublicMarkerDetails — the projection is the security boundary', () => {
  it('never emits dmNotes, for any published marker', () => {
    const pins = [pin({ ref: 'r1' }), pin({ ref: 'r2' }), pin({ ref: 'r3' })];
    const markers = [
      detail('r1', { dmNotes: 'SECRET-ALPHA the vault code is 4471' }),
      detail('r2', { dmNotes: 'SECRET-BRAVO the duke is a doppelganger' }),
      detail('r3', { dmNotes: 'SECRET-CHARLIE trapdoor under the rug' }),
    ];

    const result = buildPublicMarkerDetails({
      canvasState: canvas(pins),
      markers,
      dmOnlyElements: {},
    });

    // Positive control first: all three really did publish, so the absence
    // assertions below are about the projection and not an empty result.
    expect(result.map(r => r.id)).toEqual(['r1', 'r2', 'r3']);

    const serialized = JSON.stringify(result);
    for (const [index, marker] of markers.entries()) {
      expect('dmNotes' in result[index]).toBe(false);
      expect(serialized).not.toContain(marker.dmNotes);
      // ...while the public fields DID survive, proving the haystack is real.
      expect(serialized).toContain(marker.title);
      expect(serialized).toContain(marker.body);
    }
  });

  it('is an explicit three-field pick: an extra field on MarkerDetail cannot ride through', () => {
    const el = pin({ ref: 'ref-1' });
    const smuggler = {
      ...detail('ref-1'),
      futureSecretField: 'SMUGGLED-PAYLOAD',
    } as MarkerDetail;

    const result = buildPublicMarkerDetails({
      canvasState: canvas([el]),
      markers: [smuggler],
      dmOnlyElements: {},
    });

    expect(result).toHaveLength(1);
    expect(Object.keys(result[0]).sort()).toEqual(['body', 'id', 'title']);
    expect('futureSecretField' in result[0]).toBe(false);
    expect(JSON.stringify(result)).not.toContain('SMUGGLED-PAYLOAD');
  });
});

describe('buildPublicMarkerDetails — fail-closed canvas inputs', () => {
  // Every case below uses a marker list that WOULD publish given a good
  // canvas — asserted inside the test as a positive control — so an empty
  // result can only have been caused by the canvas guard.
  const cases: Array<{ name: string; canvasState: string | null | undefined }> =
    [
      { name: 'undefined', canvasState: undefined },
      { name: 'null', canvasState: null },
      { name: 'empty string', canvasState: '' },
      { name: 'whitespace only', canvasState: '   ' },
      { name: 'not JSON', canvasState: '{' },
      // The ONE case that reaches `readCanvasElements`'s `parsedState === null`
      // sub-guard: `typeof null === 'object'`, so without that guard the very
      // next line dereferences null and throws a TypeError instead of failing
      // closed. `'[]'` and `'{"nope":1}'` below are both caught later, by the
      // `elements`-is-an-array check.
      { name: 'JSON null', canvasState: 'null' },
      { name: 'object without elements', canvasState: '{"nope":1}' },
      { name: 'a top-level array', canvasState: '[]' },
    ];

  it.each(cases)('returns [] for $name', ({ canvasState }) => {
    const el = pin({ ref: 'ref-1' });
    const markers = [detail('ref-1')];
    const dmOnlyElements = {};

    // Positive control with the SAME markers/dmOnly: a good canvas publishes.
    expect(
      buildPublicMarkerDetails({
        canvasState: canvas([el]),
        markers,
        dmOnlyElements,
      })
    ).toHaveLength(1);

    expect(
      buildPublicMarkerDetails({ canvasState, markers, dmOnlyElements })
    ).toEqual([]);
  });
});
