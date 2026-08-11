import { describe, it, expect } from 'vitest';

import { createHtmlElement } from '@fieldnotes/core';
import type { CanvasElement, HtmlElement } from '@fieldnotes/core';

import {
  MARKER_HTML_TYPE,
  MARKER_TITLE_MAX_CODE_POINTS,
  buildMarkerData,
  capCodePoints,
  parseMarkerData,
} from './markerData';
import {
  cloneMarkerForMap,
  cloneMarkerToMap,
  createMarker,
  deleteMarker,
  editMarkerDetail,
  findMarkerDetail,
  gcOrphanMarkerDetails,
  markerSiblingIds,
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
    expect(harness.calls.indexOf('setDmOnly')).toBeLessThan(
      harness.calls.indexOf('store.add')
    );
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
    expect(findMarkerDetail(harness.state.markers, 'kept')?.deletedAt).toBe(
      undefined
    );
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
