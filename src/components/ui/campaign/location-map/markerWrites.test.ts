import { describe, it, expect } from 'vitest';

import { ElementStore, createHtmlElement } from '@fieldnotes/core';
import type { CanvasElement, HtmlElement } from '@fieldnotes/core';

import {
  MARKER_HTML_TYPE,
  MARKER_TITLE_MAX_CODE_POINTS,
  buildMarkerData,
  capCodePoints,
  parseMarkerData,
} from './markerData';
import { createMarkerRemovalTracker } from './markerRemovalTracker';
import {
  cloneMarkerForMap,
  cloneMarkerToMap,
  createMarker,
  deleteMarker,
  editMarkerDetail,
  findMarkerDetail,
  gcOrphanMarkerDetails,
  markerRefForElement,
  guardLocalMarkerAdd,
  markerSiblingIds,
  noteMarkerRemoval,
  setMarkerAudienceForRef,
} from './markerWrites';
import type { MarkerElementStoreLike, MarkerWriteDeps } from './markerWrites';

import type { MarkerDetail } from '@/types/battlemap';

const FIXED_NOW = '2026-02-03T04:05:06.000Z';

interface Harness {
  deps: MarkerWriteDeps;
  /**
   * Every MUTATING dependency call, in order. Reads are recorded separately in
   * `reads` on purpose: several tests assert that an operation performed **no
   * write of any kind** by requiring `calls` to still be `[]`, and that
   * assertion would be meaningless if the getters the operation must call in
   * order to decide also landed in this array.
   */
  calls: string[];
  reads: string[];
  setMarkersArgs: MarkerDetail[][];
  setDmOnlyArgs: Array<[string, boolean]>;
  bulkArgs: Array<Record<string, boolean>>;
  updatedIds: string[];
  removedIds: string[];
  nowCalls: number;
  state: {
    markers: MarkerDetail[];
    dmOnlyElements: Record<string, boolean>;
    elements: Map<string, CanvasElement>;
  };
  /** Seeds the canvas WITHOUT recording a call, so `calls` stays a pure record
   *  of what the code under test did. */
  seedElement: (element: CanvasElement) => void;
  /** Seeds product state WITHOUT recording a call. */
  seedMarker: (detail: MarkerDetail) => void;
  seedDmOnly: (elementId: string, dmOnly: boolean) => void;
}

function makeHarness(
  options: { failAdd?: boolean; idPrefix?: string } = {}
): Harness {
  const prefix = options.idPrefix ?? 'ref';
  const calls: string[] = [];
  const reads: string[] = [];
  const setMarkersArgs: MarkerDetail[][] = [];
  const setDmOnlyArgs: Array<[string, boolean]> = [];
  const bulkArgs: Array<Record<string, boolean>> = [];
  const updatedIds: string[] = [];
  const removedIds: string[] = [];
  const state = {
    markers: [] as MarkerDetail[],
    dmOnlyElements: {} as Record<string, boolean>,
    elements: new Map<string, CanvasElement>(),
  };
  let idCounter = 0;

  const harness: Harness = {
    calls,
    reads,
    setMarkersArgs,
    setDmOnlyArgs,
    bulkArgs,
    updatedIds,
    removedIds,
    nowCalls: 0,
    state,
    seedElement: element => {
      state.elements.set(element.id, element);
    },
    seedMarker: detail => {
      state.markers = [...state.markers, detail];
    },
    seedDmOnly: (elementId, dmOnly) => {
      if (dmOnly) state.dmOnlyElements[elementId] = true;
      else delete state.dmOnlyElements[elementId];
    },
    deps: {
      store: {
        add: element => {
          calls.push('store.add');
          if (options.failAdd) throw new Error('store.add exploded');
          state.elements.set(element.id, element);
        },
        remove: id => {
          calls.push('store.remove');
          removedIds.push(id);
          state.elements.delete(id);
        },
        update: (id, partial) => {
          calls.push('store.update');
          updatedIds.push(id);
          const existing = state.elements.get(id);
          if (existing) {
            state.elements.set(id, {
              ...existing,
              ...partial,
            } as CanvasElement);
          }
        },
        getAll: () => {
          reads.push('store.getAll');
          return [...state.elements.values()];
        },
        getById: id => {
          reads.push('store.getById');
          return state.elements.get(id);
        },
      } satisfies MarkerElementStoreLike,
      transaction: operation => {
        calls.push('transaction');
        return operation();
      },
      getMarkers: () => {
        reads.push('getMarkers');
        return state.markers;
      },
      setMarkers: next => {
        calls.push('setMarkers');
        setMarkersArgs.push(next);
        state.markers = next;
      },
      getDmOnlyElements: () => {
        reads.push('getDmOnlyElements');
        return state.dmOnlyElements;
      },
      // Required on `MarkerWriteDeps`: an in-memory harness always has its map
      // in hand, and saying so explicitly is the point — the field used to
      // default to "readable", which is fail-open in the one path that must
      // not assume it. Individual tests override it to `() => false` to drive
      // the unreadable-map case.
      isMapReadable: () => true,
      setDmOnly: (elementId, dmOnly) => {
        calls.push('setDmOnly');
        setDmOnlyArgs.push([elementId, dmOnly]);
        if (dmOnly) state.dmOnlyElements[elementId] = true;
        else delete state.dmOnlyElements[elementId];
      },
      setDmOnlyBulk: updates => {
        calls.push('setDmOnlyBulk');
        bulkArgs.push({ ...updates });
        for (const [elementId, dmOnly] of Object.entries(updates)) {
          if (dmOnly) state.dmOnlyElements[elementId] = true;
          else delete state.dmOnlyElements[elementId];
        }
      },
      newId: () => {
        idCounter += 1;
        return `${prefix}-${idCounter}`;
      },
      now: () => {
        harness.nowCalls += 1;
        return FIXED_NOW;
      },
    },
  };

  return harness;
}

/** A marker element built the way the app builds them, added straight to the
 *  fake canvas (no recorded write). */
function seedMarkerElement(
  harness: Harness,
  ref: string,
  overrides: { kind?: 'door' | 'trap'; label?: string } = {}
): HtmlElement {
  const element = createHtmlElement({
    position: { x: 0, y: 0 },
    size: { w: 40, h: 40 },
    layerId: 'layer-1',
    htmlType: MARKER_HTML_TYPE,
    data: {
      ...buildMarkerData({
        kind: overrides.kind ?? 'door',
        ref,
        label: overrides.label,
      }),
    },
  });
  harness.seedElement(element);
  return element;
}

function detail(overrides: Partial<MarkerDetail> & { id: string }) {
  return { title: '', body: '', dmNotes: '', ...overrides };
}

function canvasJson(elements: unknown[]): string {
  return JSON.stringify({
    version: 1,
    camera: { position: { x: 0, y: 0 }, zoom: 1 },
    elements,
  });
}

function canvasMarkerElement(
  ref: string,
  dataOverrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: `el-${ref}`,
    type: 'html',
    htmlType: MARKER_HTML_TYPE,
    position: { x: 0, y: 0 },
    size: { w: 40, h: 40 },
    zIndex: 0,
    locked: false,
    layerId: 'layer-1',
    data: { v: 1, kind: 'door', ref, ...dataOverrides },
  };
}

const CREATE_INPUT = {
  kind: 'door' as const,
  color: 'red' as const,
  label: 'Front gate',
  position: { x: 10, y: 20 },
  size: { w: 40, h: 40 },
  layerId: 'layer-1',
  title: 'Front gate',
  body: 'Locked, DC 15.',
  dmNotes: 'Key is on the goblin.',
};

describe('capCodePoints', () => {
  it('returns a string shorter than the cap unchanged', () => {
    expect(capCodePoints('hello', 10)).toBe('hello');
  });

  it('returns a string exactly at the cap unchanged', () => {
    expect(capCodePoints('a'.repeat(10), 10)).toBe('a'.repeat(10));
  });

  it('truncates a 10-code-point string to max=9, discriminating from an off-by-one', () => {
    // The earlier "exactly at the cap unchanged" case above does NOT
    // distinguish `codePoints.length <= max` from a `< max` off-by-one: when
    // length === max, `slice(0, max)` on either branch reproduces the same
    // string, so that mutant is invisible there. Cutting one code point
    // SHORT of the input length is: expect exactly 9 code points back, not
    // 10 (untouched) and not 8 (over-truncated).
    const result = capCodePoints('a'.repeat(10), 9);
    expect(result).toBe('a'.repeat(9));
    expect(Array.from(result).length).toBe(9);
  });

  it('caps an astral-plane string on code points, never mid-surrogate-pair', () => {
    // 21 BMP chars + emoji: a naive UTF-16 `.slice(0, 40)` lands an odd number
    // of code units into the emoji run and leaves a lone high surrogate.
    const input = 'a'.repeat(21) + '😀'.repeat(30);
    const result = capCodePoints(input, 40);
    expect(result).toBe('a'.repeat(21) + '😀'.repeat(19));
    expect(Array.from(result).length).toBe(40);
    const lastCodeUnit = result.charCodeAt(result.length - 1);
    expect(lastCodeUnit).toBeGreaterThanOrEqual(0xdc00); // low surrogate = intact pair
    expect(lastCodeUnit).toBeLessThanOrEqual(0xdfff);
  });
});

describe('createMarker — §6.7 write ordering', () => {
  it('writes the detail, marks DM-only, then adds the element inside a transaction', () => {
    const harness = makeHarness();

    const result = createMarker(harness.deps, CREATE_INPUT);

    // The DM-only mark MUST precede store.add: the first outbound upsert is
    // emitted by the add, and it can only carry the DM audience if the flag
    // already exists in product state.
    expect(harness.calls).toEqual([
      'setMarkers',
      'setDmOnly',
      'transaction',
      'store.add',
    ]);
    expect(harness.setDmOnlyArgs).toEqual([[result.elementId, true]]);
    expect(harness.state.dmOnlyElements).toEqual({ [result.elementId]: true });
  });

  it('persists the detail under the new ref with capped fields', () => {
    const harness = makeHarness();

    const result = createMarker(harness.deps, {
      ...CREATE_INPUT,
      title: '😀'.repeat(200),
    });

    expect(result.ref).toBe('ref-1');
    expect(harness.state.markers).toHaveLength(1);
    const stored = harness.state.markers[0] as MarkerDetail;
    expect(stored.id).toBe('ref-1');
    expect(Array.from(stored.title).length).toBe(MARKER_TITLE_MAX_CODE_POINTS);
    expect(stored.body).toBe('Locked, DC 15.');
    expect(stored.dmNotes).toBe('Key is on the goblin.');
    expect(stored.deletedAt).toBeUndefined();
  });

  it('builds an element whose data parses as a valid marker pointing at the new ref', () => {
    const harness = makeHarness();

    const result = createMarker(harness.deps, CREATE_INPUT);

    const element = harness.state.elements.get(result.elementId);
    expect(element).toBeDefined();
    expect(element?.type).toBe('html');
    const html = element as HtmlElement;
    expect(html.htmlType).toBe(MARKER_HTML_TYPE);
    expect(html.position).toEqual({ x: 10, y: 20 });
    expect(html.layerId).toBe('layer-1');
    const parsed = parseMarkerData(html.data);
    expect(parsed.status).toBe('valid');
    if (parsed.status === 'valid') {
      expect(parsed.data.ref).toBe(result.ref);
      expect(parsed.data.kind).toBe('door');
      expect(parsed.data.color).toBe('red');
      expect(parsed.data.label).toBe('Front gate');
    }
  });

  it('defaults every unsupplied detail field to an empty string', () => {
    const harness = makeHarness();

    createMarker(harness.deps, {
      kind: 'note',
      position: { x: 0, y: 0 },
      size: { w: 40, h: 40 },
      layerId: 'layer-1',
    });

    expect(harness.state.markers[0]).toEqual({
      id: 'ref-1',
      title: '',
      body: '',
      dmNotes: '',
    });
  });

  it('rolls back the dmOnlyElements entry and rethrows when store.add throws, keeping the detail', () => {
    const harness = makeHarness({ failAdd: true });

    expect(() => createMarker(harness.deps, CREATE_INPUT)).toThrow(
      'store.add exploded'
    );

    expect(harness.setDmOnlyArgs).toHaveLength(2);
    const elementId = (harness.setDmOnlyArgs[0] as [string, boolean])[0];
    expect(harness.setDmOnlyArgs).toEqual([
      [elementId, true],
      [elementId, false],
    ]);
    // No stray audience entry survives a failed add.
    expect(Object.keys(harness.state.dmOnlyElements)).toEqual([]);
    // The detail stays: a harmless recoverable orphan, never rolled back.
    expect(harness.state.markers).toHaveLength(1);
    expect(harness.state.markers[0]?.id).toBe('ref-1');
  });

  it('positive control: the successful path leaves the dmOnlyElements entry in place', () => {
    const harness = makeHarness();

    const result = createMarker(harness.deps, CREATE_INPUT);

    expect(harness.state.dmOnlyElements[result.elementId]).toBe(true);
    expect(harness.setDmOnlyArgs).toEqual([[result.elementId, true]]);
  });
});

describe('createMarker — fails closed when the DM-only mark cannot land', () => {
  it('throws without adding the element when setDmOnly no-ops (the map is absent from the store)', () => {
    const harness = makeHarness();
    const setDmOnlyCalls: Array<[string, boolean]> = [];
    // Simulates battleMapStore/locationStore's setDmOnly: both silently
    // return the unchanged state (no-op) when the map is missing.
    harness.deps.setDmOnly = (elementId, dmOnly) => {
      harness.calls.push('setDmOnly');
      setDmOnlyCalls.push([elementId, dmOnly]);
    };

    expect(() => createMarker(harness.deps, CREATE_INPUT)).toThrow(
      /DM-only mark/
    );

    // The element never reached the canvas at all.
    expect(harness.calls).toEqual(['setMarkers', 'setDmOnly']);
    expect(harness.calls).not.toContain('transaction');
    expect(harness.calls).not.toContain('store.add');
    expect(harness.state.elements.size).toBe(0);
    // The catch/rollback path never fires: only the one forward mark attempt
    // was recorded, no rollback-to-false call.
    expect(setDmOnlyCalls).toHaveLength(1);
    expect(setDmOnlyCalls[0]?.[1]).toBe(true);
    // The detail persists as a harmless recoverable orphan.
    expect(harness.state.markers).toHaveLength(1);
  });

  it('positive control: the same fixture with a working setDmOnly does add the element', () => {
    const harness = makeHarness();

    const result = createMarker(harness.deps, CREATE_INPUT);

    expect(harness.calls).toContain('store.add');
    expect(harness.state.elements.has(result.elementId)).toBe(true);
  });
});

describe('deleteMarker', () => {
  it('removes the element inside a transaction but keeps the detail and the DM-only entry', () => {
    const harness = makeHarness();
    const created = createMarker(harness.deps, CREATE_INPUT);
    harness.calls.length = 0;

    deleteMarker(harness.deps, created.elementId);

    expect(harness.calls).toEqual(['transaction', 'store.remove']);
    expect(harness.removedIds).toEqual([created.elementId]);
    expect(harness.state.elements.has(created.elementId)).toBe(false);
    // §6.8: undo restores the pin, so the record must still be there…
    expect(harness.state.markers).toHaveLength(1);
    expect(harness.state.markers[0]?.id).toBe(created.ref);
    expect(harness.state.markers[0]?.deletedAt).toBeUndefined();
    // …and it must come back still DM-only (fail closed).
    expect(harness.state.dmOnlyElements[created.elementId]).toBe(true);
  });
});

describe('editMarkerDetail', () => {
  it('updates one record that every sibling pin sharing the ref observes', () => {
    const harness = makeHarness();
    const created = createMarker(harness.deps, CREATE_INPUT);
    const sibling = seedMarkerElement(harness, created.ref);
    harness.calls.length = 0;

    const applied = editMarkerDetail(harness.deps, created.ref, {
      title: 'Reinforced gate',
      dmNotes: 'The key moved to the chest.',
    });

    expect(applied).toBe(true);
    // One product-state write, no canvas write at all.
    expect(harness.calls).toEqual(['setMarkers']);

    // Resolve the detail the way each pin would: parse its own data, then look
    // the record up by the parsed ref.
    const pins = [harness.state.elements.get(created.elementId), sibling];
    expect(pins).toHaveLength(2);
    for (const pin of pins) {
      const parsed = parseMarkerData((pin as HtmlElement).data);
      expect(parsed.status).toBe('valid');
      if (parsed.status !== 'valid') continue;
      const found = findMarkerDetail(harness.state.markers, parsed.data.ref);
      expect(found?.title).toBe('Reinforced gate');
      expect(found?.dmNotes).toBe('The key moved to the chest.');
      // Unpatched fields survive.
      expect(found?.body).toBe('Locked, DC 15.');
    }
    // Both pins really did resolve to the same single record.
    expect(harness.state.markers).toHaveLength(1);
  });

  it('caps patched fields at persist time', () => {
    const harness = makeHarness();
    const created = createMarker(harness.deps, CREATE_INPUT);

    editMarkerDetail(harness.deps, created.ref, { title: '😀'.repeat(300) });

    const stored = harness.state.markers[0] as MarkerDetail;
    expect(Array.from(stored.title).length).toBe(MARKER_TITLE_MAX_CODE_POINTS);
  });

  it('returns false and writes nothing when no detail carries that id', () => {
    const harness = makeHarness();
    createMarker(harness.deps, CREATE_INPUT);
    harness.calls.length = 0;

    const applied = editMarkerDetail(harness.deps, 'not-a-ref', {
      title: 'nope',
    });

    expect(applied).toBe(false);
    expect(harness.calls).toEqual([]);
  });

  it('refuses to patch a soft-deleted record and writes nothing', () => {
    const harness = makeHarness();
    const created = createMarker(harness.deps, CREATE_INPUT);
    // Soft-delete directly on state, as GC would.
    harness.state.markers = harness.state.markers.map(marker =>
      marker.id === created.ref ? { ...marker, deletedAt: FIXED_NOW } : marker
    );
    harness.calls.length = 0;

    const applied = editMarkerDetail(harness.deps, created.ref, {
      title: 'Should not land',
    });

    expect(applied).toBe(false);
    expect(harness.calls).toEqual([]);
    expect(harness.state.markers[0]?.title).toBe('Front gate');
    expect(harness.state.markers[0]?.deletedAt).toBe(FIXED_NOW);
  });

  it('positive control: the same fixture patches a live record', () => {
    const harness = makeHarness();
    const created = createMarker(harness.deps, CREATE_INPUT);
    harness.calls.length = 0;

    const applied = editMarkerDetail(harness.deps, created.ref, {
      title: 'Now live',
    });

    expect(applied).toBe(true);
    expect(harness.state.markers[0]?.title).toBe('Now live');
  });
});

describe('findMarkerDetail', () => {
  it('finds a live record and ignores a soft-deleted one', () => {
    const markers: MarkerDetail[] = [
      detail({ id: 'live', title: 'Live' }),
      detail({ id: 'gone', title: 'Gone', deletedAt: FIXED_NOW }),
    ];
    expect(findMarkerDetail(markers, 'live')?.title).toBe('Live');
    expect(findMarkerDetail(markers, 'gone')).toBeUndefined();
    expect(findMarkerDetail(markers, 'missing')).toBeUndefined();
  });
});

describe('markerRefForElement', () => {
  it('returns the ref for a valid marker element', () => {
    const harness = makeHarness();
    const element = seedMarkerElement(harness, 'ref-a');
    expect(markerRefForElement(element)).toBe('ref-a');
  });

  it('returns null for null, a non-marker element, and a marker with unreadable data', () => {
    expect(markerRefForElement(null)).toBeNull();
    expect(markerRefForElement(undefined)).toBeNull();

    const shape = createHtmlElement({
      position: { x: 0, y: 0 },
      size: { w: 40, h: 40 },
      htmlType: 'not-a-marker',
      data: { ...buildMarkerData({ kind: 'door', ref: 'ref-b' }) },
    });
    expect(markerRefForElement(shape)).toBeNull();

    const unreadable = createHtmlElement({
      position: { x: 0, y: 0 },
      size: { w: 40, h: 40 },
      htmlType: MARKER_HTML_TYPE,
      data: { v: 2, kind: 'door', ref: 'ref-c' },
    });
    expect(markerRefForElement(unreadable)).toBeNull();
  });
});

describe('markerSiblingIds', () => {
  it('collects only valid marker elements pointing at the ref', () => {
    const harness = makeHarness();
    const a = seedMarkerElement(harness, 'shared-ref');
    const b = seedMarkerElement(harness, 'shared-ref');
    seedMarkerElement(harness, 'other-ref');
    // An html element of a different type carrying the same ref must not count.
    harness.seedElement(
      createHtmlElement({
        position: { x: 0, y: 0 },
        size: { w: 10, h: 10 },
        htmlType: 'something-else',
        data: { v: 1, kind: 'door', ref: 'shared-ref' },
      })
    );
    // A marker whose data does not parse must not count either.
    harness.seedElement(
      createHtmlElement({
        position: { x: 0, y: 0 },
        size: { w: 10, h: 10 },
        htmlType: MARKER_HTML_TYPE,
        data: { v: 1, kind: 'door', ref: 'shared-ref', color: 'chartreuse' },
      })
    );

    expect(markerSiblingIds(harness.deps.store, 'shared-ref').sort()).toEqual(
      [a.id, b.id].sort()
    );
  });
});

describe('setMarkerAudienceForRef', () => {
  function seedThreeSiblings(harness: Harness, dmOnly: boolean): string[] {
    const ids = [
      seedMarkerElement(harness, 'shared-ref').id,
      seedMarkerElement(harness, 'shared-ref').id,
      seedMarkerElement(harness, 'shared-ref').id,
    ];
    for (const id of ids) harness.seedDmOnly(id, dmOnly);
    return ids;
  }

  it('shared → DM-only: one bulk action covering every sibling, then one re-emit each', () => {
    const harness = makeHarness();
    const ids = seedThreeSiblings(harness, false);

    const result = setMarkerAudienceForRef(harness.deps, 'shared-ref', true);

    expect(result.status).toBe('applied');
    if (result.status === 'applied') {
      expect(result.elementIds.sort()).toEqual([...ids].sort());
      expect(result.dmOnly).toBe(true);
    }
    expect(harness.bulkArgs).toHaveLength(1);
    expect(harness.bulkArgs[0]).toEqual({
      [ids[0] as string]: true,
      [ids[1] as string]: true,
      [ids[2] as string]: true,
    });
    // Exactly one product-state action, never one per sibling.
    expect(harness.calls.filter(c => c === 'setDmOnlyBulk')).toHaveLength(1);
    expect(harness.calls.filter(c => c === 'setDmOnly')).toHaveLength(0);
    // One re-emit per sibling so the sync client re-stamps the audience.
    expect(harness.calls.filter(c => c === 'store.update')).toHaveLength(3);
    expect(harness.updatedIds.sort()).toEqual([...ids].sort());
    expect(harness.calls[0]).toBe('setDmOnlyBulk');
    for (const id of ids) expect(harness.state.dmOnlyElements[id]).toBe(true);
  });

  it('DM-only → shared: one bulk action covering every sibling, then one re-emit each', () => {
    const harness = makeHarness();
    const ids = seedThreeSiblings(harness, true);

    const result = setMarkerAudienceForRef(harness.deps, 'shared-ref', false);

    expect(result.status).toBe('applied');
    if (result.status === 'applied') {
      expect(result.elementIds.sort()).toEqual([...ids].sort());
      expect(result.dmOnly).toBe(false);
    }
    expect(harness.bulkArgs).toHaveLength(1);
    expect(harness.bulkArgs[0]).toEqual({
      [ids[0] as string]: false,
      [ids[1] as string]: false,
      [ids[2] as string]: false,
    });
    expect(harness.calls.filter(c => c === 'setDmOnlyBulk')).toHaveLength(1);
    expect(harness.calls.filter(c => c === 'setDmOnly')).toHaveLength(0);
    expect(harness.calls.filter(c => c === 'store.update')).toHaveLength(3);
    expect(harness.updatedIds.sort()).toEqual([...ids].sort());
    expect(harness.state.dmOnlyElements).toEqual({});
  });

  it('refuses a mixed-audience sibling set and writes nothing at all', () => {
    const harness = makeHarness();
    const hidden = seedMarkerElement(harness, 'shared-ref');
    const shown = seedMarkerElement(harness, 'shared-ref');
    harness.seedDmOnly(hidden.id, true);
    const dmOnlyBefore = { ...harness.state.dmOnlyElements };

    const result = setMarkerAudienceForRef(harness.deps, 'shared-ref', true);

    expect(result.status).toBe('refused');
    if (result.status === 'refused') {
      expect(result.reason).toBe('mixed-audience');
      expect(result.elementIds.sort()).toEqual([hidden.id, shown.id].sort());
    }
    // Not one write of any kind was recorded.
    expect(harness.calls).toEqual([]);
    expect(harness.state.dmOnlyElements).toEqual(dmOnlyBefore);
    expect(harness.updatedIds).toEqual([]);
  });

  it('positive control: the same two-sibling fixture with a uniform audience applies and records writes', () => {
    const harness = makeHarness();
    const first = seedMarkerElement(harness, 'shared-ref');
    const second = seedMarkerElement(harness, 'shared-ref');
    harness.seedDmOnly(first.id, true);
    harness.seedDmOnly(second.id, true);

    const result = setMarkerAudienceForRef(harness.deps, 'shared-ref', false);

    expect(result.status).toBe('applied');
    expect(harness.calls).toEqual([
      'setDmOnlyBulk',
      'store.update',
      'store.update',
    ]);
    expect(harness.state.dmOnlyElements).toEqual({});
  });

  it('refuses with no-siblings and writes nothing when the ref has no pins', () => {
    const harness = makeHarness();
    seedMarkerElement(harness, 'another-ref');

    const result = setMarkerAudienceForRef(harness.deps, 'shared-ref', true);

    expect(result.status).toBe('refused');
    if (result.status === 'refused') {
      expect(result.reason).toBe('no-siblings');
      expect(result.elementIds).toEqual([]);
    }
    expect(harness.calls).toEqual([]);
  });
});

/**
 * The re-emit gate (task B10 §7). The `store.update(id, {})` re-emit exists
 * solely so a LIVE SYNC client re-stamps each sibling's audience. Location
 * mode has no relay, so re-emitting there would only fire the surfaces'
 * `store.on('update')` save listener and flip the sync indicator on a pure
 * visibility toggle — the same reasoning already shipped for the per-element
 * toggle in `DmLocationEditor.hooks.ts` handleToggleDmOnly.
 *
 * Both directions are asserted on the SAME recorded-calls array so the two
 * cases cannot drift apart: the bulk product-state write is identical, and
 * only the `store.update` calls differ.
 */
describe('setMarkerAudienceForRef — the re-emit gate', () => {
  function seedTwoShared(harness: Harness): string[] {
    const ids = [
      seedMarkerElement(harness, 'shared-ref').id,
      seedMarkerElement(harness, 'shared-ref').id,
    ];
    for (const id of ids) harness.seedDmOnly(id, false);
    return ids;
  }

  it('reemitAudience: false still writes every sibling in one bulk action but issues ZERO store.update calls', () => {
    const harness = makeHarness();
    const ids = seedTwoShared(harness);

    const result = setMarkerAudienceForRef(
      { ...harness.deps, reemitAudience: false },
      'shared-ref',
      true
    );

    expect(result.status).toBe('applied');
    // The product-state write is untouched by the gate...
    expect(harness.calls.filter(c => c === 'setDmOnlyBulk')).toHaveLength(1);
    expect(harness.bulkArgs[0]).toEqual({
      [ids[0] as string]: true,
      [ids[1] as string]: true,
    });
    expect(harness.state.dmOnlyElements).toEqual({
      [ids[0] as string]: true,
      [ids[1] as string]: true,
    });
    // ...only the canvas re-emit is suppressed.
    expect(harness.calls.filter(c => c === 'store.update')).toHaveLength(0);
    expect(harness.updatedIds).toEqual([]);
    expect(harness.calls).toEqual(['setDmOnlyBulk']);
  });

  it('reemitAudience: true issues exactly one store.update per sibling on the identical fixture', () => {
    const harness = makeHarness();
    const ids = seedTwoShared(harness);

    const result = setMarkerAudienceForRef(
      { ...harness.deps, reemitAudience: true },
      'shared-ref',
      true
    );

    expect(result.status).toBe('applied');
    expect(harness.calls.filter(c => c === 'setDmOnlyBulk')).toHaveLength(1);
    expect(harness.bulkArgs[0]).toEqual({
      [ids[0] as string]: true,
      [ids[1] as string]: true,
    });
    expect(harness.state.dmOnlyElements).toEqual({
      [ids[0] as string]: true,
      [ids[1] as string]: true,
    });
    expect(harness.calls.filter(c => c === 'store.update')).toHaveLength(2);
    expect(harness.updatedIds.sort()).toEqual([...ids].sort());
    expect(harness.calls).toEqual([
      'setDmOnlyBulk',
      'store.update',
      'store.update',
    ]);
  });

  it('an omitted reemitAudience defaults to re-emitting (the shipped battlemap behaviour)', () => {
    const harness = makeHarness();
    const ids = seedTwoShared(harness);

    setMarkerAudienceForRef(harness.deps, 'shared-ref', true);

    expect(harness.calls.filter(c => c === 'store.update')).toHaveLength(2);
    expect(harness.updatedIds.sort()).toEqual([...ids].sort());
  });
});

describe('gcOrphanMarkerDetails', () => {
  /** markers: one referenced by the canvas, one orphan. */
  function seedTwoDetails(harness: Harness): void {
    harness.seedMarker(detail({ id: 'kept', title: 'Kept' }));
    harness.seedMarker(detail({ id: 'orphan', title: 'Orphan' }));
  }

  function expectUntouched(harness: Harness): void {
    expect(harness.calls).toEqual([]);
    expect(harness.state.markers).toHaveLength(2);
    for (const record of harness.state.markers) {
      expect(record.deletedAt).toBeUndefined();
    }
  }

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['empty string', ''],
    ['whitespace only', '   '],
  ])('skips as absent for %s canvas state', (_label, canvasState) => {
    const harness = makeHarness();
    seedTwoDetails(harness);

    const result = gcOrphanMarkerDetails(harness.deps, canvasState);

    expect(result).toEqual({ status: 'skipped', reason: 'absent' });
    expectUntouched(harness);
  });

  it('skips as unparseable for malformed JSON', () => {
    const harness = makeHarness();
    seedTwoDetails(harness);

    const result = gcOrphanMarkerDetails(harness.deps, '{');

    expect(result).toEqual({ status: 'skipped', reason: 'unparseable' });
    expectUntouched(harness);
  });

  it.each([
    ['an object with no elements array', '{"nope":1}'],
    ['a top-level array', '[]'],
    ['a JSON scalar', '42'],
    ['elements that is not an array', '{"elements":{"0":{}}}'],
    // The ONE case that reaches the root-shape guard's `parsedState === null`
    // sub-guard: `typeof null === 'object'` and `Array.isArray(null)` is
    // false, so without it the very next line dereferences null and this
    // throws a TypeError instead of skipping. Every other row above is
    // already caught by the `elements`-is-an-array check that follows.
    ['JSON null', 'null'],
  ])('skips as unexpected-shape for %s', (_label, canvasState) => {
    const harness = makeHarness();
    seedTwoDetails(harness);

    const result = gcOrphanMarkerDetails(harness.deps, canvasState);

    expect(result).toEqual({ status: 'skipped', reason: 'unexpected-shape' });
    expectUntouched(harness);
  });

  it('skips as unreadable-markers when any marker element fails to parse (v: 2 alongside a valid one)', () => {
    const harness = makeHarness();
    seedTwoDetails(harness);
    const canvasState = canvasJson([
      canvasMarkerElement('kept'),
      canvasMarkerElement('unknown-to-us', { v: 2 }),
    ]);

    const result = gcOrphanMarkerDetails(harness.deps, canvasState);

    expect(result).toEqual({
      status: 'skipped',
      reason: 'unreadable-markers',
    });
    expectUntouched(harness);
  });

  it('skips as unreadable-markers when a marker element is structurally invalid', () => {
    const harness = makeHarness();
    seedTwoDetails(harness);
    const canvasState = canvasJson([
      canvasMarkerElement('kept'),
      canvasMarkerElement('ignored', { ref: 42 }),
    ]);

    const result = gcOrphanMarkerDetails(harness.deps, canvasState);

    expect(result).toEqual({
      status: 'skipped',
      reason: 'unreadable-markers',
    });
    expectUntouched(harness);
  });

  it('positive control: soft-deletes only the orphan on a well-formed canvas', () => {
    const harness = makeHarness();
    seedTwoDetails(harness);
    const canvasState = canvasJson([
      canvasMarkerElement('kept'),
      // Non-marker elements are ignored, even unreadable ones.
      { id: 'shape-1', type: 'shape', position: { x: 0, y: 0 } },
      {
        id: 'html-1',
        type: 'html',
        htmlType: 'not-a-marker',
        data: { garbage: true },
      },
    ]);

    const result = gcOrphanMarkerDetails(harness.deps, canvasState);

    expect(result).toEqual({ status: 'ran', softDeleted: ['orphan'] });
    expect(harness.calls).toEqual(['setMarkers']);
    // Never a hard delete.
    expect(harness.state.markers).toHaveLength(2);
    // A RAW `.find`, not `findMarkerDetail`: the latter filters tombstones,
    // so a `kept` that HAD been soft-deleted would come back `undefined` and
    // `undefined?.deletedAt` is still `undefined` — the assertion could not
    // fail. Same shape as the `orphan` lookup two lines below.
    const kept = harness.state.markers.find(m => m.id === 'kept');
    expect(kept?.deletedAt).toBe(undefined);
    const orphan = harness.state.markers.find(m => m.id === 'orphan');
    expect(orphan?.deletedAt).toBe(FIXED_NOW);
    expect(harness.nowCalls).toBeGreaterThan(0);
  });

  it('runs with no soft-deletions and writes nothing when every detail is referenced', () => {
    const harness = makeHarness();
    harness.seedMarker(detail({ id: 'kept' }));
    const canvasState = canvasJson([canvasMarkerElement('kept')]);

    const result = gcOrphanMarkerDetails(harness.deps, canvasState);

    expect(result).toEqual({ status: 'ran', softDeleted: [] });
    expect(harness.calls).toEqual([]);
  });

  it('leaves an already soft-deleted orphan alone rather than re-stamping it', () => {
    const harness = makeHarness();
    harness.seedMarker(
      detail({ id: 'orphan', deletedAt: '2020-01-01T00:00:00.000Z' })
    );
    const canvasState = canvasJson([]);

    const result = gcOrphanMarkerDetails(harness.deps, canvasState);

    expect(result).toEqual({ status: 'ran', softDeleted: [] });
    expect(harness.calls).toEqual([]);
    expect(harness.state.markers[0]?.deletedAt).toBe(
      '2020-01-01T00:00:00.000Z'
    );
  });
});

describe('gcOrphanMarkerDetails — real ElementStore round-trip', () => {
  // Every fixture above is hand-built JSON matching the ASSUMED shape of a
  // canvas element. This test instead builds a real `ElementStore`, adds a
  // marker via the real `createHtmlElement` factory, and serializes it the
  // way the app persists `canvasState` (a `{ version, camera, elements }`
  // envelope around `store.getAll()`). If a core upgrade ever moved
  // `htmlType` (e.g. under `data`), the hand-built fixtures above would keep
  // passing — they hardcode the old shape — while this test would catch the
  // drift: the ref scan would match zero markers and tombstone every detail.
  it('soft-deletes only the genuine orphan when fed a real, serialized canvas element', () => {
    const harness = makeHarness();
    harness.seedMarker(detail({ id: 'kept', title: 'Kept' }));
    harness.seedMarker(detail({ id: 'orphan', title: 'Orphan' }));

    const store = new ElementStore();
    store.add(
      createHtmlElement({
        position: { x: 5, y: 5 },
        size: { w: 40, h: 40 },
        layerId: 'layer-1',
        htmlType: MARKER_HTML_TYPE,
        data: { ...buildMarkerData({ kind: 'door', ref: 'kept' }) },
      })
    );

    const serialized = JSON.stringify({
      version: 1,
      camera: { position: { x: 0, y: 0 }, zoom: 1 },
      elements: store.getAll(),
    });

    const result = gcOrphanMarkerDetails(harness.deps, serialized);

    expect(result).toEqual({ status: 'ran', softDeleted: ['orphan'] });
    // A RAW `.find`, not `findMarkerDetail`: the latter filters tombstones, so
    // a `kept` that HAD been soft-deleted would come back `undefined` and
    // `undefined?.deletedAt` is still `undefined` — the assertion could not
    // fail. Same shape as the `orphan` lookup below.
    const kept = harness.state.markers.find(m => m.id === 'kept');
    expect(kept?.deletedAt).toBeUndefined();
    const orphan = harness.state.markers.find(m => m.id === 'orphan');
    expect(orphan?.deletedAt).toBe(FIXED_NOW);
  });
});

describe('cloneMarkerForMap / cloneMarkerToMap', () => {
  function seedSourceMarker(): {
    source: Harness;
    element: HtmlElement;
    ref: string;
  } {
    const source = makeHarness({ idPrefix: 'src' });
    const created = createMarker(source.deps, CREATE_INPUT);
    const element = source.state.elements.get(created.elementId) as HtmlElement;
    return { source, element, ref: created.ref };
  }

  it('clones the detail under a NEW ref and writes it with the create ordering', () => {
    const { source, element, ref } = seedSourceMarker();
    const target = makeHarness({ idPrefix: 'tgt' });

    const result = cloneMarkerToMap(
      target.deps,
      element,
      source.state.markers,
      { position: { x: 99, y: 98 }, layerId: 'layer-9' }
    );

    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.ref).toBe('tgt-1');
    expect(result.ref).not.toBe(ref);
    expect(result.elementId).not.toBe(element.id);

    // Same §6.7 ordering as createMarker.
    expect(target.calls).toEqual([
      'setMarkers',
      'setDmOnly',
      'transaction',
      'store.add',
    ]);
    expect(target.state.dmOnlyElements).toEqual({ [result.elementId]: true });

    const cloned = target.state.markers[0] as MarkerDetail;
    expect(cloned.id).toBe(result.ref);
    expect(cloned.title).toBe('Front gate');
    expect(cloned.body).toBe('Locked, DC 15.');
    expect(cloned.dmNotes).toBe('Key is on the goblin.');
    expect(cloned.deletedAt).toBeUndefined();

    const clonedElement = target.state.elements.get(
      result.elementId
    ) as HtmlElement;
    expect(clonedElement.position).toEqual({ x: 99, y: 98 });
    expect(clonedElement.layerId).toBe('layer-9');
    const parsed = parseMarkerData(clonedElement.data);
    expect(parsed.status).toBe('valid');
    if (parsed.status === 'valid') {
      expect(parsed.data.ref).toBe(result.ref);
      expect(parsed.data.ref).not.toBe(ref);
      expect(parsed.data.kind).toBe('door');
      expect(parsed.data.color).toBe('red');
      expect(parsed.data.label).toBe('Front gate');
    }
    // The source map is untouched by the clone.
    expect(source.state.markers).toHaveLength(1);
    expect(source.state.markers[0]?.id).toBe(ref);
  });

  it('clones with empty content when the source detail is missing, still rewriting the ref', () => {
    const { element, ref } = seedSourceMarker();
    const target = makeHarness({ idPrefix: 'tgt' });

    const result = cloneMarkerToMap(target.deps, element, []);

    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.ref).not.toBe(ref);
    expect(target.state.markers[0]).toEqual({
      id: result.ref,
      title: '',
      body: '',
      dmNotes: '',
    });
  });

  it('clears deletedAt: a soft-deleted source detail never produces a soft-deleted clone', () => {
    const { source, element } = seedSourceMarker();
    source.state.markers = source.state.markers.map(m => ({
      ...m,
      deletedAt: FIXED_NOW,
    }));

    const clone = cloneMarkerForMap(
      element,
      source.state.markers,
      () => 'new-ref'
    );

    expect(clone).not.toBeNull();
    expect(clone?.detail.deletedAt).toBeUndefined();
    expect(clone?.detail.id).toBe('new-ref');
    // A soft-deleted source is treated as MISSING (findMarkerDetail ignores
    // tombstones), so the clone gets empty content, never the tombstoned
    // text — content assertions, not just the id/deletedAt shape, so a
    // change that resurrected tombstone content would fail this test.
    expect(clone?.detail.title).toBe('');
    expect(clone?.detail.body).toBe('');
    expect(clone?.detail.dmNotes).toBe('');
  });

  it('returns null and writes nothing when the source element data is not valid', () => {
    const target = makeHarness({ idPrefix: 'tgt' });
    const broken = createHtmlElement({
      position: { x: 0, y: 0 },
      size: { w: 40, h: 40 },
      htmlType: MARKER_HTML_TYPE,
      data: { v: 1, kind: 'door' }, // no ref
    });

    expect(cloneMarkerForMap(broken, [], () => 'new-ref')).toBeNull();
    expect(cloneMarkerToMap(target.deps, broken, [])).toBeNull();
    expect(target.calls).toEqual([]);
    expect(target.state.markers).toEqual([]);
  });

  it('returns null for a non-marker element (positive control: the same element with marker data clones)', () => {
    const notAMarker = createHtmlElement({
      position: { x: 0, y: 0 },
      size: { w: 40, h: 40 },
      htmlType: 'not-a-marker',
      data: { ...buildMarkerData({ kind: 'trap', ref: 'src-ref' }) },
    });
    expect(cloneMarkerForMap(notAMarker, [], () => 'new-ref')).toBeNull();

    const isAMarker = createHtmlElement({
      position: { x: 0, y: 0 },
      size: { w: 40, h: 40 },
      htmlType: MARKER_HTML_TYPE,
      data: { ...buildMarkerData({ kind: 'trap', ref: 'src-ref' }) },
    });
    expect(cloneMarkerForMap(isAMarker, [], () => 'new-ref')).not.toBeNull();
  });
});

/**
 * The removal side of the undo/duplicate discriminator. The guard's own
 * behaviour is driven end-to-end on both DM surfaces; what is unit-tested here
 * is which removals are remembered at all, because a removal that is wrongly
 * remembered hands a later add the audience of something else.
 */
describe('noteMarkerRemoval', () => {
  it('remembers a LOCAL marker removal with the audience it had at removal time, so the undo restores it and keeps its ref', () => {
    const harness = makeHarness();
    harness.deps.removalTracker = createMarkerRemovalTracker();
    const element = seedMarkerElement(harness, 'ref-a');
    harness.seedDmOnly(element.id, true);

    expect(noteMarkerRemoval(harness.deps, element)).toBe(true);
    harness.seedDmOnly(element.id, false);
    harness.state.elements.delete(element.id);

    // The undo: same element, same id, same ref, no meta.
    harness.state.elements.set(element.id, element);
    expect(guardLocalMarkerAdd(harness.deps, element)).toEqual({
      status: 'restored',
      wasDmOnly: true,
    });
    expect(harness.state.dmOnlyElements[element.id]).toBe(true);
    expect(markerRefForElement(harness.state.elements.get(element.id))).toBe(
      'ref-a'
    );
    // No ref rewrite means no invented detail record either.
    expect(harness.state.markers).toEqual([]);
  });

  it('does NOT remember a REMOTE-origin removal: the identical local re-add falls through to the fail-closed path', () => {
    const harness = makeHarness();
    harness.deps.removalTracker = createMarkerRemovalTracker();
    const element = seedMarkerElement(harness, 'ref-a');

    expect(noteMarkerRemoval(harness.deps, element, { origin: 'remote' })).toBe(
      false
    );

    const result = guardLocalMarkerAdd(harness.deps, element);
    expect(result).toEqual({ status: 'marked', rewrittenRef: 'ref-1' });
    expect(harness.state.dmOnlyElements[element.id]).toBe(true);
    expect(markerRefForElement(harness.state.elements.get(element.id))).toBe(
      'ref-1'
    );
  });

  it('does not remember a non-marker removal, and reports it', () => {
    const harness = makeHarness();
    harness.deps.removalTracker = createMarkerRemovalTracker();
    const notAMarker = createHtmlElement({
      position: { x: 0, y: 0 },
      size: { w: 40, h: 40 },
      htmlType: 'not-a-marker',
      data: { ...buildMarkerData({ kind: 'door', ref: 'ref-a' }) },
    });

    expect(noteMarkerRemoval(harness.deps, notAMarker)).toBe(false);
    expect(harness.deps.removalTracker.size()).toBe(0);
  });
});

/**
 * The remembered audience is a fallback, not an answer: where the ref still
 * has live siblings, the restore ADOPTS their audience.
 *
 * The tracker snapshots ONE element's audience, but every audience decision
 * the DM can make is per-REF and moves the whole sibling set. Duplicate refs
 * within one map are legal (§6.8), so the two can go out of step between a
 * removal and its undo — and replaying the stale snapshot would publish a pin
 * the DM has since hidden, and leave the ref permanently mixed-audience.
 */
describe('guardLocalMarkerAdd — the restored audience adopts the ref live siblings', () => {
  it('restores DM-ONLY when a live sibling of the ref is DM-only, though the removal remembered SHARED', () => {
    const harness = makeHarness();
    harness.deps.removalTracker = createMarkerRemovalTracker();
    const a = seedMarkerElement(harness, 'ref-shared');
    const b = seedMarkerElement(harness, 'ref-shared');
    // Both shared when A leaves, so the snapshot says `wasDmOnly: false`.
    expect(noteMarkerRemoval(harness.deps, a)).toBe(true);
    harness.state.elements.delete(a.id);

    // The DM's most recent explicit instruction for this marker: hide it. Only
    // B is live, so the sibling set is [b] and the transition is uniform.
    expect(setMarkerAudienceForRef(harness.deps, 'ref-shared', true)).toEqual({
      status: 'applied',
      elementIds: [b.id],
      dmOnly: true,
    });

    // The undo: same element, same id, same ref, no meta.
    harness.state.elements.set(a.id, a);
    expect(guardLocalMarkerAdd(harness.deps, a)).toEqual({
      status: 'restored',
      wasDmOnly: true,
    });
    expect(harness.state.dmOnlyElements[a.id]).toBe(true);
    // The ref is still left alone — the ref match is what identified the undo.
    expect(markerRefForElement(harness.state.elements.get(a.id))).toBe(
      'ref-shared'
    );
    expect(harness.state.markers).toEqual([]);

    // And the set is uniform again, so the ref is not wedged: the next
    // transition is applied to BOTH pins rather than refused mixed-audience.
    const next = setMarkerAudienceForRef(harness.deps, 'ref-shared', false);
    expect(next.status).toBe('applied');
    if (next.status !== 'applied') return;
    expect(next.elementIds.sort()).toEqual([a.id, b.id].sort());
  });

  it('POSITIVE CONTROL: with every live sibling shared, the same undo restores it SHARED', () => {
    const harness = makeHarness();
    harness.deps.removalTracker = createMarkerRemovalTracker();
    const a = seedMarkerElement(harness, 'ref-shared');
    const b = seedMarkerElement(harness, 'ref-shared');
    expect(noteMarkerRemoval(harness.deps, a)).toBe(true);
    harness.state.elements.delete(a.id);
    // The one difference from the test above: nothing hides the ref.
    expect(harness.state.dmOnlyElements[b.id]).toBeUndefined();

    harness.state.elements.set(a.id, a);
    expect(guardLocalMarkerAdd(harness.deps, a)).toEqual({
      status: 'restored',
      wasDmOnly: false,
    });
    expect(harness.state.dmOnlyElements[a.id]).toBeUndefined();
    expect(harness.calls).toEqual([]);
    expect(markerRefForElement(harness.state.elements.get(a.id))).toBe(
      'ref-shared'
    );
    expect(harness.state.markers).toEqual([]);
  });

  it('a DM-only sibling of a DIFFERENT ref is not adopted', () => {
    const harness = makeHarness();
    harness.deps.removalTracker = createMarkerRemovalTracker();
    const a = seedMarkerElement(harness, 'ref-shared');
    const stranger = seedMarkerElement(harness, 'ref-other');
    harness.seedDmOnly(stranger.id, true);

    expect(noteMarkerRemoval(harness.deps, a)).toBe(true);
    harness.state.elements.delete(a.id);
    harness.state.elements.set(a.id, a);

    expect(guardLocalMarkerAdd(harness.deps, a)).toEqual({
      status: 'restored',
      wasDmOnly: false,
    });
    expect(harness.state.dmOnlyElements[a.id]).toBeUndefined();
  });
});

/**
 * `getDmOnlyElements()` answers `{}` for a map that is not in product state at
 * all, which is not the same fact as "this pin was shared". Remembering a
 * removal read in that window would hand a later undo the claim "restore this
 * to shared" about a pin that may have been a secret.
 */
describe('noteMarkerRemoval — an unreadable map is not "not DM-only"', () => {
  it('remembers nothing while the bound map is unreadable, so the re-add takes the fail-closed path', () => {
    const harness = makeHarness();
    harness.deps.removalTracker = createMarkerRemovalTracker();
    harness.deps.isMapReadable = () => false;
    // Exactly what a missing map looks like from inside these deps: the
    // audience read yields `{}` for an element that may well be DM-only.
    const element = seedMarkerElement(harness, 'ref-a');
    expect(harness.deps.getDmOnlyElements()[element.id]).toBeUndefined();

    expect(noteMarkerRemoval(harness.deps, element)).toBe(false);
    expect(harness.deps.removalTracker.size()).toBe(0);

    // The undo-shaped re-add is therefore treated as a duplicate: marked
    // DM-only and given its own ref.
    expect(guardLocalMarkerAdd(harness.deps, element)).toEqual({
      status: 'marked',
      rewrittenRef: 'ref-1',
    });
    expect(harness.state.dmOnlyElements[element.id]).toBe(true);
    expect(markerRefForElement(harness.state.elements.get(element.id))).toBe(
      'ref-1'
    );
  });

  it('POSITIVE CONTROL: the identical removal on a READABLE map is remembered and restores shared', () => {
    const harness = makeHarness();
    harness.deps.removalTracker = createMarkerRemovalTracker();
    harness.deps.isMapReadable = () => true;
    const element = seedMarkerElement(harness, 'ref-a');

    expect(noteMarkerRemoval(harness.deps, element)).toBe(true);
    expect(harness.deps.removalTracker.size()).toBe(1);

    expect(guardLocalMarkerAdd(harness.deps, element)).toEqual({
      status: 'restored',
      wasDmOnly: false,
    });
    expect(markerRefForElement(harness.state.elements.get(element.id))).toBe(
      'ref-a'
    );
  });
});

/**
 * The MIRROR of the sequence pinned above, and the one a one-directional floor
 * left open. Adopting the live sibling audience has to work in BOTH directions:
 * a remembered DM-only snapshot must be LOWERED to shared when the DM revealed
 * the ref while the pin was gone, exactly as a remembered shared snapshot is
 * raised when the DM hid it.
 *
 * The consequence of getting this wrong is not a leak but a permanent wedge:
 * `buildPublicMarkerDetails` is `every`, so the marker the DM just revealed
 * stops publishing, and `setMarkerAudienceForRef` refuses every later toggle
 * as `mixed-audience` with no repair affordance in the UI.
 *
 * The original (raise) direction is pinned by "restores DM-ONLY when a live
 * sibling of the ref is DM-only, though the removal remembered SHARED" above —
 * both directions must hold at once, which is why neither describe may be read
 * on its own.
 */
describe('guardLocalMarkerAdd — adoption is BOTH directions', () => {
  it('restores SHARED when every live sibling of the ref is shared, though the removal remembered DM-ONLY', () => {
    const harness = makeHarness();
    harness.deps.removalTracker = createMarkerRemovalTracker();
    const a = seedMarkerElement(harness, 'ref-secret');
    const b = seedMarkerElement(harness, 'ref-secret');
    // Both DM-only when A leaves, so the snapshot says `wasDmOnly: true`.
    harness.seedDmOnly(a.id, true);
    harness.seedDmOnly(b.id, true);
    expect(noteMarkerRemoval(harness.deps, a)).toBe(true);
    // `deleteMarker` deliberately leaves the dmOnlyElements entry in place, so
    // A arrives back MARKED — the write below has to actually clear it.
    harness.state.elements.delete(a.id);
    expect(harness.state.dmOnlyElements[a.id]).toBe(true);

    // The DM's most recent explicit instruction for this marker: reveal it.
    // Only B is live, so the sibling set is [b] and the transition is uniform.
    expect(setMarkerAudienceForRef(harness.deps, 'ref-secret', false)).toEqual({
      status: 'applied',
      elementIds: [b.id],
      dmOnly: false,
    });

    // The undo: same element, same id, same ref, no meta.
    harness.state.elements.set(a.id, a);
    expect(guardLocalMarkerAdd(harness.deps, a)).toEqual({
      status: 'restored',
      wasDmOnly: false,
    });
    expect(harness.state.dmOnlyElements[a.id]).toBeUndefined();
    expect(harness.setDmOnlyArgs).toContainEqual([a.id, false]);
    // The ref is still left alone — the ref match is what identified the undo.
    expect(markerRefForElement(harness.state.elements.get(a.id))).toBe(
      'ref-secret'
    );
    // No ref rewrite means no invented detail record either.
    expect(harness.state.markers).toEqual([]);

    // And the set is uniform again, so the ref is not wedged: the next
    // transition is applied to BOTH pins rather than refused mixed-audience.
    const next = setMarkerAudienceForRef(harness.deps, 'ref-secret', true);
    expect(next.status).toBe('applied');
    if (next.status !== 'applied') return;
    expect(next.elementIds.sort()).toEqual([a.id, b.id].sort());
  });

  it('POSITIVE CONTROL: on the same fixture a duplicate-shaped add — new id, same ref — is still marked DM-only and given its own ref', () => {
    const harness = makeHarness();
    harness.deps.removalTracker = createMarkerRemovalTracker();
    const a = seedMarkerElement(harness, 'ref-secret');
    const b = seedMarkerElement(harness, 'ref-secret');
    harness.seedDmOnly(a.id, true);
    harness.seedDmOnly(b.id, true);
    expect(noteMarkerRemoval(harness.deps, a)).toBe(true);
    harness.state.elements.delete(a.id);
    setMarkerAudienceForRef(harness.deps, 'ref-secret', false);

    // Everything the undo above had EXCEPT the id: a `mod+d` / paste clone
    // carrying the same ref. It must not read the remembered entry, and the
    // now-shared sibling must not make it shared either.
    const clone = seedMarkerElement(harness, 'ref-secret');
    expect(clone.id).not.toBe(a.id);

    expect(guardLocalMarkerAdd(harness.deps, clone)).toEqual({
      status: 'marked',
      rewrittenRef: 'ref-1',
    });
    expect(harness.state.dmOnlyElements[clone.id]).toBe(true);
    expect(markerRefForElement(harness.state.elements.get(clone.id))).toBe(
      'ref-1'
    );
    expect(harness.state.markers.map(m => m.id)).toEqual(['ref-1']);
  });

  it('with NO live sibling the remembered snapshot is used — a DM-only pin comes back DM-only', () => {
    const harness = makeHarness();
    harness.deps.removalTracker = createMarkerRemovalTracker();
    const only = seedMarkerElement(harness, 'ref-lonely');
    harness.seedDmOnly(only.id, true);

    expect(noteMarkerRemoval(harness.deps, only)).toBe(true);
    harness.state.elements.delete(only.id);
    // Nothing could have instructed anything meanwhile: with zero siblings
    // `setMarkerAudienceForRef` refuses and writes nothing.
    expect(setMarkerAudienceForRef(harness.deps, 'ref-lonely', false)).toEqual({
      status: 'refused',
      reason: 'no-siblings',
      elementIds: [],
    });

    harness.state.elements.set(only.id, only);
    expect(guardLocalMarkerAdd(harness.deps, only)).toEqual({
      status: 'restored',
      wasDmOnly: true,
    });
    expect(harness.state.dmOnlyElements[only.id]).toBe(true);
    expect(markerRefForElement(harness.state.elements.get(only.id))).toBe(
      'ref-lonely'
    );
  });

  it('with NO live sibling the remembered snapshot is used — a SHARED pin comes back shared', () => {
    const harness = makeHarness();
    harness.deps.removalTracker = createMarkerRemovalTracker();
    const only = seedMarkerElement(harness, 'ref-lonely');

    expect(noteMarkerRemoval(harness.deps, only)).toBe(true);
    harness.state.elements.delete(only.id);

    harness.state.elements.set(only.id, only);
    expect(guardLocalMarkerAdd(harness.deps, only)).toEqual({
      status: 'restored',
      wasDmOnly: false,
    });
    expect(harness.state.dmOnlyElements[only.id]).toBeUndefined();
    // The restored element is EXCLUDED from its own sibling scan: it is back in
    // the store before this runs, so a scan that counted it would find one
    // "shared" sibling here and adopt shared even for the DM-only case above.
    expect(harness.state.elements.has(only.id)).toBe(true);
    expect(harness.calls).toEqual([]);
  });

  it('fails closed when the live siblings DISAGREE: there is no instruction to adopt', () => {
    const harness = makeHarness();
    harness.deps.removalTracker = createMarkerRemovalTracker();
    const a = seedMarkerElement(harness, 'ref-mixed');
    const dmOnlySibling = seedMarkerElement(harness, 'ref-mixed');
    const sharedSibling = seedMarkerElement(harness, 'ref-mixed');
    // A already-mixed set, built directly: unreachable through
    // `setMarkerAudienceForRef` (it refuses one outright) but reachable
    // through the duplicate leak this guard exists to close.
    harness.seedDmOnly(dmOnlySibling.id, true);
    expect(harness.state.dmOnlyElements[sharedSibling.id]).toBeUndefined();

    expect(noteMarkerRemoval(harness.deps, a)).toBe(true);
    harness.state.elements.delete(a.id);
    harness.state.elements.set(a.id, a);

    expect(guardLocalMarkerAdd(harness.deps, a)).toEqual({
      status: 'restored',
      wasDmOnly: true,
    });
    expect(harness.state.dmOnlyElements[a.id]).toBe(true);
    expect(markerRefForElement(harness.state.elements.get(a.id))).toBe(
      'ref-mixed'
    );
  });

  it('reports restore-failed when the audience write silently no-ops (the map is absent from the store)', () => {
    const harness = makeHarness();
    harness.deps.removalTracker = createMarkerRemovalTracker();
    const a = seedMarkerElement(harness, 'ref-secret');
    const b = seedMarkerElement(harness, 'ref-secret');
    harness.seedDmOnly(a.id, true);
    harness.seedDmOnly(b.id, true);
    expect(noteMarkerRemoval(harness.deps, a)).toBe(true);
    harness.state.elements.delete(a.id);
    setMarkerAudienceForRef(harness.deps, 'ref-secret', false);
    harness.state.elements.set(a.id, a);

    // Simulates battleMapStore/locationStore's setDmOnly: both silently return
    // the unchanged state when the map is missing. Installed only now, so the
    // fixture above is built by the working one.
    const attempted: Array<[string, boolean]> = [];
    harness.deps.setDmOnly = (elementId, dmOnly) => {
      harness.calls.push('setDmOnly');
      attempted.push([elementId, dmOnly]);
    };

    expect(guardLocalMarkerAdd(harness.deps, a)).toEqual({
      status: 'restore-failed',
      intendedDmOnly: false,
    });
    expect(attempted).toEqual([[a.id, false]]);
    // The write is reported as not landed rather than assumed: A is still
    // marked, which is exactly what the caller must be able to see.
    expect(harness.state.dmOnlyElements[a.id]).toBe(true);
  });

  it('POSITIVE CONTROL: the identical fixture with a working setDmOnly reports restored', () => {
    const harness = makeHarness();
    harness.deps.removalTracker = createMarkerRemovalTracker();
    const a = seedMarkerElement(harness, 'ref-secret');
    const b = seedMarkerElement(harness, 'ref-secret');
    harness.seedDmOnly(a.id, true);
    harness.seedDmOnly(b.id, true);
    expect(noteMarkerRemoval(harness.deps, a)).toBe(true);
    harness.state.elements.delete(a.id);
    setMarkerAudienceForRef(harness.deps, 'ref-secret', false);
    harness.state.elements.set(a.id, a);

    expect(guardLocalMarkerAdd(harness.deps, a)).toEqual({
      status: 'restored',
      wasDmOnly: false,
    });
    expect(harness.state.dmOnlyElements[a.id]).toBeUndefined();
  });
});
