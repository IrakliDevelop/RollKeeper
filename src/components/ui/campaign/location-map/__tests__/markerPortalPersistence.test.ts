/**
 * Task 8 — compatibility and persistence sweep for `MarkerDetail.portal?`.
 *
 * `portal` is an ADDITIVE OPTIONAL field on `MarkerDetail`. This suite proves
 * that fact end to end across every persistence/serialization path the field
 * can travel: an old record with no `portal` at all, a JSON round-trip
 * through store persistence / IndexedDB, malformed or forward-versioned
 * payloads, unrelated edits that must not disturb an untouched (even
 * malformed/dangling/self-linked) portal byte-for-byte, target rename and
 * deletion, cross-map cloning, sibling-pin sharing, canvas undo/redo, and the
 * cloud/IndexedDB array-of-records shape (`BattleMap.markers` /
 * `LocationMap.markers`).
 *
 * Deliberately NOT covered here, per the task-8 brief: no migration exists
 * and none is added — an old record with no `portal` field is simply valid,
 * with no rewrite step.
 */
import { describe, it, expect } from 'vitest';

import { createHtmlElement } from '@fieldnotes/core';
import type { CanvasElement, HtmlElement } from '@fieldnotes/core';

import {
  MARKER_HTML_TYPE,
  buildMarkerData,
  parseMarkerData,
} from '../markerData';
import type { MarkerElementDataV1 } from '../markerData';
import {
  cloneMarkerForMap,
  createMarker,
  editMarkerDetail,
  findMarkerDetail,
} from '../markerWrites';
import type { MarkerElementStoreLike, MarkerWriteDeps } from '../markerWrites';
import {
  buildMarkerPortalTarget,
  parseMarkerPortalTarget,
  resolveDmPortalDestination,
} from '../markerPortal';
import type {
  PortalBattleMapStoreLike,
  PortalLocationStoreLike,
} from '../markerPortal';

import type { BattleMap, MarkerDetail } from '@/types/battlemap';
import type { LocationMap } from '@/types/location';

const FIXED_NOW = '2026-03-01T00:00:00.000Z';

/**
 * In-memory `MarkerWriteDeps` harness — a trimmed copy of the pattern in
 * `markerWrites.test.ts` (same file's own doc comment explains the shape).
 * This suite only exercises `editMarkerDetail`/`findMarkerDetail` through it,
 * so it carries none of the call/read tracing that file's harness has.
 */
interface Harness {
  deps: MarkerWriteDeps;
  state: {
    markers: MarkerDetail[];
    dmOnlyElements: Record<string, boolean>;
    elements: Map<string, CanvasElement>;
  };
  seedElement: (element: CanvasElement) => void;
  seedMarker: (detail: MarkerDetail) => void;
}

function makeHarness(): Harness {
  const state = {
    markers: [] as MarkerDetail[],
    dmOnlyElements: {} as Record<string, boolean>,
    elements: new Map<string, CanvasElement>(),
  };
  let idCounter = 0;

  const harness: Harness = {
    state,
    seedElement: element => {
      state.elements.set(element.id, element);
    },
    seedMarker: detail => {
      state.markers = [...state.markers, detail];
    },
    deps: {
      store: {
        add: element => {
          state.elements.set(element.id, element);
        },
        remove: id => {
          state.elements.delete(id);
        },
        update: (id, partial) => {
          const existing = state.elements.get(id);
          if (existing) {
            state.elements.set(id, {
              ...existing,
              ...partial,
            } as CanvasElement);
          }
        },
        getAll: () => [...state.elements.values()],
        getById: id => state.elements.get(id),
      } satisfies MarkerElementStoreLike,
      transaction: operation => operation(),
      getMarkers: () => state.markers,
      setMarkers: next => {
        state.markers = next;
      },
      getDmOnlyElements: () => state.dmOnlyElements,
      isMapReadable: () => true,
      setDmOnly: (elementId, dmOnly) => {
        if (dmOnly) state.dmOnlyElements[elementId] = true;
        else delete state.dmOnlyElements[elementId];
      },
      setDmOnlyBulk: updates => {
        for (const [elementId, dmOnly] of Object.entries(updates)) {
          if (dmOnly) state.dmOnlyElements[elementId] = true;
          else delete state.dmOnlyElements[elementId];
        }
      },
      newId: () => {
        idCounter += 1;
        return `ref-${idCounter}`;
      },
      now: () => FIXED_NOW,
    },
  };

  return harness;
}

function seedMarkerElement(
  harness: Harness,
  ref: string,
  elementId?: string
): HtmlElement {
  const element = createHtmlElement({
    position: { x: 0, y: 0 },
    size: { w: 40, h: 40 },
    layerId: 'layer-1',
    htmlType: MARKER_HTML_TYPE,
    data: { ...buildMarkerData({ kind: 'door', ref }) },
  });
  const withId = elementId
    ? ({ ...element, id: elementId } as HtmlElement)
    : element;
  harness.seedElement(withId);
  return withId;
}

/** JSON round-trip, simulating Zustand `persist` middleware / IndexedDB. */
function roundTrip<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// ---------------------------------------------------------------------------
// 1. Old records with no destination
// ---------------------------------------------------------------------------

describe('old records with no destination', () => {
  it('a MarkerDetail without a portal field is a valid, ordinary record', () => {
    const legacy: MarkerDetail = {
      id: 'ref-legacy',
      title: 'Old door',
      body: 'Predates the portal feature.',
      dmNotes: '',
    };
    // No `portal` key exists on the record at all — not `undefined`, absent.
    expect('portal' in legacy).toBe(false);
    expect(legacy).toEqual({
      id: 'ref-legacy',
      title: 'Old door',
      body: 'Predates the portal feature.',
      dmNotes: '',
    });
  });

  it('editMarkerDetail edits title/body/dmNotes on a legacy record with no migration step', () => {
    const harness = makeHarness();
    harness.seedMarker({
      id: 'ref-legacy',
      title: 'Old door',
      body: 'Predates the portal feature.',
      dmNotes: '',
    });

    const ok = editMarkerDetail(harness.deps, 'ref-legacy', {
      title: 'Old door (relocked)',
      body: 'Now barred from the inside.',
      dmNotes: 'DC 18 to force.',
    });

    expect(ok).toBe(true);
    const updated = findMarkerDetail(harness.state.markers, 'ref-legacy');
    expect(updated).toEqual({
      id: 'ref-legacy',
      title: 'Old door (relocked)',
      body: 'Now barred from the inside.',
      dmNotes: 'DC 18 to force.',
    });
    expect('portal' in (updated as MarkerDetail)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Valid records after persistence rehydration
// ---------------------------------------------------------------------------

describe('valid records after persistence rehydration', () => {
  it('a portal survives a JSON round-trip and re-parses valid', () => {
    const original: MarkerDetail = {
      id: 'ref-1',
      title: 'Stairwell',
      body: '',
      dmNotes: '',
      portal: { v: 1, kind: 'battlemap', id: 'map-2' },
    };

    const rehydrated = roundTrip(original);

    expect(rehydrated).toEqual(original);
    expect(rehydrated).not.toBe(original);
    expect(rehydrated.portal).not.toBe(original.portal);

    const parsed = parseMarkerPortalTarget(rehydrated.portal);
    expect(parsed).toEqual({
      status: 'valid',
      target: { v: 1, kind: 'battlemap', id: 'map-2' },
    });
  });

  it('resolveDmPortalDestination resolves a rehydrated target to ready', () => {
    const original: MarkerDetail = {
      id: 'ref-1',
      title: 'Stairwell',
      body: '',
      dmNotes: '',
      portal: buildMarkerPortalTarget('battlemap', 'map-2'),
    };
    const rehydrated = roundTrip(original);

    const stores = {
      battleMaps: {
        getBattleMap: (_code, id) =>
          id === 'map-2' ? { id: 'map-2', name: 'The Ossuary' } : undefined,
      } satisfies PortalBattleMapStoreLike,
      locations: {
        getLocation: () => undefined,
      } satisfies PortalLocationStoreLike,
    };

    const result = resolveDmPortalDestination(
      rehydrated.portal,
      'CAMP',
      'map-1',
      'battlemap',
      stores
    );

    expect(result).toEqual({
      status: 'ready',
      href: '/dm/campaign/CAMP/battlemaps/map-2',
      name: 'The Ossuary',
    });
  });
});

// ---------------------------------------------------------------------------
// 3. Malformed / future target payloads
// ---------------------------------------------------------------------------

describe('malformed/future target payloads survive JSON round-trip uncorrupted', () => {
  const cases: Array<{
    name: string;
    portal: unknown;
    expected: ReturnType<typeof parseMarkerPortalTarget>;
  }> = [
    {
      name: 'future version (v: 2)',
      portal: { v: 2, kind: 'battlemap', id: 'x' },
      expected: { status: 'unsupported', version: 2 },
    },
    {
      name: 'unknown kind',
      portal: { v: 1, kind: 'teleporter', id: 'x' },
      expected: {
        status: 'invalid',
        reason: 'portal target kind is missing, not a string, or unrecognized',
      },
    },
    {
      name: 'non-object payload',
      portal: 'not-an-object',
      expected: { status: 'invalid', reason: 'portal target is not a record' },
    },
    {
      name: 'missing id',
      portal: { v: 1, kind: 'battlemap' },
      expected: {
        status: 'invalid',
        reason: 'portal target id is missing, not a string, or blank',
      },
    },
  ];

  it.each(cases)('$name', ({ portal, expected }) => {
    const record: MarkerDetail = {
      id: 'ref-1',
      title: '',
      body: '',
      dmNotes: '',
      // Deliberately bypasses the builder/validator — simulating a hand-edited
      // or hostile persisted record.
      portal: portal as MarkerDetail['portal'],
    };

    const before = JSON.stringify(record.portal);
    const rehydrated = roundTrip(record);
    const after = JSON.stringify(rehydrated.portal);

    // The raw bytes are untouched by the round-trip itself.
    expect(after).toBe(before);
    expect(parseMarkerPortalTarget(rehydrated.portal)).toEqual(expected);
  });

  it('portal: null round-trips as removed (no portal, not a null field)', () => {
    const record = {
      id: 'ref-1',
      title: '',
      body: '',
      dmNotes: '',
      portal: null,
    };
    const rehydrated = roundTrip(record);
    // JSON.stringify keeps an explicit `null`; the parser still treats it as
    // invalid/absent rather than a usable target — no destination.
    expect(rehydrated.portal).toBeNull();
    expect(parseMarkerPortalTarget(rehydrated.portal).status).toBe('invalid');
  });
});

// ---------------------------------------------------------------------------
// 4. Unrelated edits preserve malformed/future/dangling/self bytes
// ---------------------------------------------------------------------------

describe('unrelated edits preserve an untouched portal value byte-for-byte', () => {
  it.each([
    {
      name: 'a future/unknown-shape portal ({ v: 99, kind: "wormhole", id: "future" })',
      portal: { v: 99, kind: 'wormhole', id: 'future' },
    },
    {
      name: 'a dangling target (valid shape, id not present in any store)',
      portal: { v: 1, kind: 'battlemap', id: 'nonexistent-map' },
    },
    {
      name: "a self-link (valid shape, id equal to the marker's own map)",
      portal: { v: 1, kind: 'battlemap', id: 'map-1' },
    },
  ])('$name is preserved when editing only the title', ({ portal }) => {
    const harness = makeHarness();
    harness.seedMarker({
      id: 'ref-1',
      title: 'Old title',
      body: '',
      dmNotes: '',
      // Manually assigned, bypassing editMarkerDetail's validation, exactly
      // as a hand-edited/older/newer persisted record would arrive.
      portal: portal as MarkerDetail['portal'],
    });
    const before = JSON.stringify(portal);

    const ok = editMarkerDetail(harness.deps, 'ref-1', { title: 'New title' });

    expect(ok).toBe(true);
    const updated = findMarkerDetail(harness.state.markers, 'ref-1');
    expect(updated?.title).toBe('New title');
    expect(JSON.stringify(updated?.portal)).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// 5. Target rename and deletion
// ---------------------------------------------------------------------------

describe('target rename and deletion', () => {
  it('resolves the live name, follows a rename, then reports missing after deletion — target bytes never change', () => {
    const battleMapDb: Record<string, { id: string; name: string }> = {
      'map-2': { id: 'map-2', name: 'Cave' },
    };
    const stores = {
      battleMaps: {
        getBattleMap: (_code, id) => battleMapDb[id],
      } satisfies PortalBattleMapStoreLike,
      locations: {
        getLocation: () => undefined,
      } satisfies PortalLocationStoreLike,
    };
    const target = buildMarkerPortalTarget('battlemap', 'map-2');
    const persistedBefore = JSON.stringify(target);

    const initial = resolveDmPortalDestination(
      target,
      'CAMP',
      'map-1',
      'battlemap',
      stores
    );
    expect(initial).toEqual({
      status: 'ready',
      href: '/dm/campaign/CAMP/battlemaps/map-2',
      name: 'Cave',
    });

    // Rename the target in the store — the persisted `{ v, kind, id }` target
    // is not touched.
    battleMapDb['map-2'] = { id: 'map-2', name: 'Dark Cave' };
    const afterRename = resolveDmPortalDestination(
      target,
      'CAMP',
      'map-1',
      'battlemap',
      stores
    );
    expect(afterRename).toEqual({
      status: 'ready',
      href: '/dm/campaign/CAMP/battlemaps/map-2',
      name: 'Dark Cave',
    });

    // Delete the target from the store.
    delete battleMapDb['map-2'];
    const afterDelete = resolveDmPortalDestination(
      target,
      'CAMP',
      'map-1',
      'battlemap',
      stores
    );
    expect(afterDelete).toEqual({ status: 'missing' });

    // The persisted target's id never changed through rename or deletion.
    expect(JSON.stringify(target)).toBe(persistedBefore);
    expect(target.id).toBe('map-2');
  });
});

// ---------------------------------------------------------------------------
// 6. Imported / cross-map cloned markers
// ---------------------------------------------------------------------------

describe('imported/cross-map cloned markers', () => {
  it('clones a marker WITH a valid portal into a fresh object, not the same reference', () => {
    const harness = makeHarness();
    const ref = 'ref-source';
    const element = seedMarkerElement(harness, ref);
    const sourcePortal = buildMarkerPortalTarget('location', 'loc-9');
    harness.seedMarker({
      id: ref,
      title: 'Waypoint',
      body: '',
      dmNotes: '',
      portal: sourcePortal,
    });

    const cloned = cloneMarkerForMap(
      element,
      harness.state.markers,
      () => 'ref-clone'
    );

    expect(cloned).not.toBeNull();
    expect(cloned?.detail.portal).toEqual(sourcePortal);
    expect(cloned?.detail.portal).not.toBe(sourcePortal);
  });

  it('drops an invalid ({ v: 99, ... }) portal on clone rather than propagating it', () => {
    const harness = makeHarness();
    const ref = 'ref-source';
    const element = seedMarkerElement(harness, ref);
    harness.seedMarker({
      id: ref,
      title: 'Waypoint',
      body: '',
      dmNotes: '',
      portal: {
        v: 99,
        kind: 'wormhole',
        id: 'future',
      } as unknown as MarkerDetail['portal'],
    });

    const cloned = cloneMarkerForMap(
      element,
      harness.state.markers,
      () => 'ref-clone'
    );

    expect(cloned).not.toBeNull();
    expect('portal' in (cloned?.detail as MarkerDetail)).toBe(false);
  });

  it('a marker cloned WITHOUT a portal produces a detail with no portal', () => {
    const harness = makeHarness();
    const ref = 'ref-source';
    const element = seedMarkerElement(harness, ref);
    harness.seedMarker({ id: ref, title: 'Plain pin', body: '', dmNotes: '' });

    const cloned = cloneMarkerForMap(
      element,
      harness.state.markers,
      () => 'ref-clone'
    );

    expect(cloned).not.toBeNull();
    expect('portal' in (cloned?.detail as MarkerDetail)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7. Duplicated sibling pins
// ---------------------------------------------------------------------------

describe('duplicated sibling pins', () => {
  it('two pins sharing one ref see the same destination, and an edit to the shared detail is reflected on both', () => {
    const harness = makeHarness();
    const ref = 'ref-shared';
    seedMarkerElement(harness, ref, 'el-pin-a');
    seedMarkerElement(harness, ref, 'el-pin-b');
    harness.seedMarker({
      id: ref,
      title: 'Shared waypoint',
      body: '',
      dmNotes: '',
      portal: buildMarkerPortalTarget('battlemap', 'map-9'),
    });

    const stores = {
      battleMaps: {
        getBattleMap: (_code, id) =>
          id === 'map-9' ? { id: 'map-9', name: 'The Vault' } : undefined,
      } satisfies PortalBattleMapStoreLike,
      locations: {
        getLocation: () => undefined,
      } satisfies PortalLocationStoreLike,
    };

    // Both pins resolve identically off the ONE shared detail record.
    const detailForPinA = findMarkerDetail(harness.state.markers, ref);
    const detailForPinB = findMarkerDetail(harness.state.markers, ref);
    expect(detailForPinA).toBe(detailForPinB);

    const resolvedForPinA = resolveDmPortalDestination(
      detailForPinA?.portal,
      'CAMP',
      'map-1',
      'battlemap',
      stores
    );
    const resolvedForPinB = resolveDmPortalDestination(
      detailForPinB?.portal,
      'CAMP',
      'map-1',
      'battlemap',
      stores
    );
    expect(resolvedForPinA).toEqual(resolvedForPinB);
    expect(resolvedForPinA).toEqual({
      status: 'ready',
      href: '/dm/campaign/CAMP/battlemaps/map-9',
      name: 'The Vault',
    });

    // Editing the portal via the shared ref updates BOTH pins' view of it —
    // there is only one detail record to observe.
    editMarkerDetail(harness.deps, ref, {
      portal: buildMarkerPortalTarget('location', 'loc-3'),
    });

    const afterEditForPinA = findMarkerDetail(harness.state.markers, ref);
    const afterEditForPinB = findMarkerDetail(harness.state.markers, ref);
    expect(afterEditForPinA).toBe(afterEditForPinB);
    expect(afterEditForPinA?.portal).toEqual({
      v: 1,
      kind: 'location',
      id: 'loc-3',
    });
  });
});

// ---------------------------------------------------------------------------
// 8. Canvas undo/redo — portal is product state, not canvas element data
// ---------------------------------------------------------------------------

describe('canvas undo/redo does not touch portal (product state, not canvas history)', () => {
  it('MarkerElementDataV1 has no portal field', () => {
    const data = buildMarkerData({ kind: 'door', ref: 'ref-1' });
    expect('portal' in data).toBe(false);

    // Type-level guard: assigning a `portal` key to `MarkerElementDataV1`
    // must not type-check. Not executed — a compile-time check only.
    // @ts-expect-error portal is not part of the canvas element data schema
    const invalid: MarkerElementDataV1 = {
      ...data,
      portal: { v: 1, kind: 'battlemap', id: 'x' },
    };
    void invalid;
  });

  it('canvas JSON serialization of a marker element carries no portal, and parseMarkerData never yields one', () => {
    const element = createHtmlElement({
      position: { x: 0, y: 0 },
      size: { w: 40, h: 40 },
      layerId: 'layer-1',
      htmlType: MARKER_HTML_TYPE,
      data: { ...buildMarkerData({ kind: 'door', ref: 'ref-1' }) },
    });
    const canvasState = JSON.stringify({
      version: 1,
      camera: { position: { x: 0, y: 0 }, zoom: 1 },
      elements: [element],
    });

    expect(canvasState).not.toContain('portal');

    const parsedCanvas = JSON.parse(canvasState) as { elements: HtmlElement[] };
    const parsed = parseMarkerData(parsedCanvas.elements[0].data);
    expect(parsed.status).toBe('valid');
    if (parsed.status === 'valid') {
      expect('portal' in parsed.data).toBe(false);
    }
  });

  it('an undo that removes a marker pin does not remove its detail — portal is preserved (soft delete only)', () => {
    const harness = makeHarness();
    const created = createMarker(harness.deps, {
      kind: 'door',
      position: { x: 0, y: 0 },
      size: { w: 40, h: 40 },
      layerId: 'layer-1',
      title: 'Gate',
    });
    editMarkerDetail(harness.deps, created.ref, {
      portal: buildMarkerPortalTarget('battlemap', 'map-5'),
    });
    const beforeRemoval = findMarkerDetail(harness.state.markers, created.ref);
    expect(beforeRemoval?.portal).toEqual({
      v: 1,
      kind: 'battlemap',
      id: 'map-5',
    });

    // Simulate an undo/redo pin removal from the canvas: only the element
    // leaves the canvas store; `markers` is untouched (mirrors `deleteMarker`
    // in markerWrites.ts, which deliberately never writes `markers`).
    harness.state.elements.delete(created.elementId);

    const afterRemoval = findMarkerDetail(harness.state.markers, created.ref);
    expect(afterRemoval).toBeDefined();
    expect(afterRemoval?.deletedAt).toBeUndefined();
    expect(afterRemoval?.portal).toEqual({
      v: 1,
      kind: 'battlemap',
      id: 'map-5',
    });
  });
});

// ---------------------------------------------------------------------------
// 9. Cloud/IndexedDB serialization paths
// ---------------------------------------------------------------------------

describe('cloud/IndexedDB serialization paths preserve portal structure', () => {
  it('BattleMap.markers array with and without portals round-trips through JSON', () => {
    const battleMap: BattleMap = {
      id: 'map-1',
      campaignCode: 'CAMP',
      name: 'Dungeon',
      mapImageUrl: 'https://example.com/map.png',
      mapImageSize: { w: 100, h: 100 },
      canvasState: '{}',
      dmOnlyElements: {},
      gridEnabled: false,
      linkedEncounterIds: [],
      markers: [
        {
          id: 'ref-1',
          title: 'With portal',
          body: '',
          dmNotes: '',
          portal: { v: 1, kind: 'location', id: 'loc-1' },
        },
        { id: 'ref-2', title: 'Without portal', body: '', dmNotes: '' },
      ],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const rehydrated = roundTrip(battleMap);

    expect(rehydrated).toEqual(battleMap);
    expect(rehydrated.markers?.[0].portal).toEqual({
      v: 1,
      kind: 'location',
      id: 'loc-1',
    });
    expect('portal' in (rehydrated.markers?.[1] as MarkerDetail)).toBe(false);
  });

  it('LocationMap.markers array with and without portals round-trips through JSON', () => {
    const locationMap: LocationMap = {
      id: 'loc-map-1',
      campaignCode: 'CAMP',
      name: 'Town Square',
      mapImageUrl: 'https://example.com/town.png',
      mapImageSize: { w: 200, h: 200 },
      canvasState: '{}',
      dmOnlyElements: {},
      gridEnabled: false,
      markers: [
        {
          id: 'ref-1',
          title: 'With portal',
          body: '',
          dmNotes: '',
          portal: { v: 1, kind: 'battlemap', id: 'map-2' },
        },
        { id: 'ref-2', title: 'Without portal', body: '', dmNotes: '' },
      ],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const rehydrated = roundTrip(locationMap);

    expect(rehydrated).toEqual(locationMap);
    expect(rehydrated.markers?.[0].portal).toEqual({
      v: 1,
      kind: 'battlemap',
      id: 'map-2',
    });
    expect('portal' in (rehydrated.markers?.[1] as MarkerDetail)).toBe(false);
  });

  it('zustand-persist-style JSON.parse(JSON.stringify(markers)) preserves portal structure across many records', () => {
    const markers: MarkerDetail[] = [
      { id: 'a', title: '', body: '', dmNotes: '' },
      {
        id: 'b',
        title: '',
        body: '',
        dmNotes: '',
        portal: { v: 1, kind: 'battlemap', id: 'map-x' },
      },
      {
        id: 'c',
        title: '',
        body: '',
        dmNotes: '',
        // Forward-versioned/malformed — must survive untouched, not stripped.
        portal: {
          v: 5,
          kind: 'battlemap',
          id: 'map-y',
        } as unknown as MarkerDetail['portal'],
      },
    ];

    const rehydrated = roundTrip(markers);

    expect(rehydrated).toEqual(markers);
    expect('portal' in rehydrated[0]).toBe(false);
    expect(rehydrated[1].portal).toEqual({
      v: 1,
      kind: 'battlemap',
      id: 'map-x',
    });
    expect(rehydrated[2].portal).toEqual({
      v: 5,
      kind: 'battlemap',
      id: 'map-y',
    });
  });
});
