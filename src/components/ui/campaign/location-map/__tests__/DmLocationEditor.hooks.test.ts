import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  ElementStore,
  LayerManager,
  createHtmlElement,
  createShape,
  FogManager,
} from '@fieldnotes/core';
import type { CanvasElement, Viewport } from '@fieldnotes/core';
import type { FieldNotesCanvasRef } from '@fieldnotes/react';
import { useDmLocationEditor } from '../DmLocationEditor.hooks';
import { MARKER_HTML_TYPE, buildMarkerData } from '../markerData';
import { useLocationStore } from '@/store/locationStore';
import type { LocationMap } from '@/types/location';

const autoSaveClear = vi.hoisted(() => vi.fn(async () => {}));

// AutoSave touches storage adapters / timers we don't need here — stub it,
// keep the rest of @fieldnotes/core real (tools, types).
vi.mock('@fieldnotes/core', async importOriginal => {
  const actual = await importOriginal<typeof import('@fieldnotes/core')>();
  return {
    ...actual,
    AutoSave: class {
      start = vi.fn();
      stop = vi.fn();
      clear = autoSaveClear;
    },
  };
});

/**
 * Viewport stub covering what `handleReady` (with empty canvasState + empty
 * mapImageUrl, so both load paths are skipped) and `handleToggleDmOnly`
 * touch. `store`/`layerManager` are the real SDK classes (not hand-mocked)
 * because `handleReady` now runs `ensureCanonicalLayers` /
 * `migrateCanvasToContract` / `subscribePinCanonicalLayers` unconditionally —
 * see layerContract.test.ts, which exercises those against the same real
 * classes.
 */
function makeStubViewport() {
  const store = new ElementStore();
  const layerManager = new LayerManager(store);

  // One pre-existing element so syncSelection (via getSelectedIds()) and
  // handleToggleDmOnly (`store.getById` guard) have something real to
  // select. The id is SDK-generated, not a fixed string.
  const el = createShape({ position: { x: 0, y: 0 }, size: { w: 10, h: 10 } });
  store.add(el);
  const elementId = el.id;
  vi.spyOn(store, 'update');

  // Mirrors the real Viewport's persistent selection emitter: `selectedIds`
  // is mutable (delete flows below reassign it) so `getSelectedIds()` always
  // reflects the current selection, same guarantee the real SDK makes.
  const selectionState = { selectedIds: [elementId] as string[] };
  const selectionListeners = new Set<() => void>();
  // handleReady (battlemap mode) now unconditionally wires a local camera
  // animator via the REAL focusSync.createLocalCameraAnimator (this file
  // does not mock focusSync) — it reads `domLayer.parentElement`, so the
  // stub needs an actual wrapper, not a detached node.
  const wrapper = document.createElement('div');
  const domLayer = document.createElement('div');
  wrapper.appendChild(domLayer);
  const vp = {
    store,
    layerManager,
    domLayer,
    fog: new FogManager(),
    toolManager: {
      // Only 'select' resolves to a fake tool; other names (e.g. 'path',
      // requested unconditionally by the movement-commit wiring in
      // battlemap mode) return undefined, same as a real ToolManager when
      // that tool was never registered/requested in this stub.
      getTool: vi.fn((name: string) =>
        name === 'select'
          ? { name: 'select', selectedIds: selectionState.selectedIds }
          : undefined
      ),
      register: vi.fn(),
      onChange: vi.fn(),
      activeTool: { name: 'select' },
    },
    setTool: vi.fn(),
    getSelectedIds: vi.fn(() => selectionState.selectedIds),
    onSelectionChange: vi.fn((listener: () => void) => {
      selectionListeners.add(listener);
      return () => selectionListeners.delete(listener);
    }),
    camera: {
      setZoom: vi.fn(),
      moveTo: vi.fn(),
      screenToWorld: vi.fn(() => ({ x: 0, y: 0 })),
    },
    loadJSON: vi.fn(),
    exportJSON: vi.fn(() => '{}'),
    // jsdom has no canvas 2D context, so the real exportImage cannot run.
    // handleSyncToPlayers already tolerates this (it catches and falls
    // through to the JSON payload), and the marker projection must be built
    // from exportJSON regardless of whether a snapshot was produced.
    exportImage: vi.fn(async () => {
      throw new Error('exportImage unavailable in jsdom');
    }),
    addImage: vi.fn(),
    removeGrid: vi.fn(),
    addGrid: vi.fn(),
    updateGrid: vi.fn(),
    // The hook now registers the marker painter + activation on every
    // viewport, unconditionally (task B10). A real Viewport carries these;
    // this stub only ever lacked them. No assertion here depends on them —
    // see DmLocationEditor.hooks.markers.test.ts for the marker coverage.
    expectCanvasHtmlTypes: vi.fn(() => () => {}),
    registerHtmlPainter: vi.fn(() => () => {}),
    setActivation: vi.fn(() => () => {}),
    onElementActivate: vi.fn(() => () => {}),
    transaction: <T>(operation: () => T): T => operation(),
    removeElements: vi.fn((ids: Iterable<string>) => {
      let removed = 0;
      for (const id of new Set(ids)) {
        if (!store.getById(id)) continue;
        store.remove(id);
        removed += 1;
      }
      selectionState.selectedIds = selectionState.selectedIds.filter(id =>
        store.getById(id)
      );
      for (const listener of selectionListeners) listener();
      return removed;
    }),
    requestRender: vi.fn(),
  };
  return { vp: vp as unknown as Viewport, store, elementId };
}

const baseLocation: LocationMap = {
  id: 'loc-1',
  campaignCode: 'TEST01',
  name: 'Test Map',
  mapImageUrl: '', // skip _initializeBackground's image path
  mapImageSize: { w: 100, h: 100 },
  canvasState: '', // skip the loadJSON path
  dmOnlyElements: {},
  gridEnabled: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

async function setup(
  mode: 'location' | 'battlemap',
  location: LocationMap = baseLocation
) {
  const { vp, store, elementId } = makeStubViewport();
  const onSave = vi.fn();
  const { result } = renderHook(() =>
    useDmLocationEditor({
      location,
      campaignCode: 'TEST01',
      dmId: 'dm-1',
      mode,
      onSave,
      onSyncToPlayers: vi.fn(),
    })
  );
  // getVp() reads canvasRef.current.viewport — no real canvas in this test.
  result.current.canvasRef.current = {
    viewport: vp,
  } as unknown as FieldNotesCanvasRef;
  await act(async () => {
    await result.current.handleReady(vp);
  });
  // Sanity: syncSelection picked up the stub's single selected element.
  expect(result.current.selectedElementId).toBe(elementId);
  return { vp, store, result, elementId };
}

describe('useDmLocationEditor — handleToggleDmOnly mode gating', () => {
  const savedRelayUrl = process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;

  beforeEach(() => {
    // Ensure handleReady never starts a live sync connection in tests.
    delete process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;
    autoSaveClear.mockClear();
  });

  it('preserves Fieldnotes autosave recovery after canonical canvas load', async () => {
    await setup('location', {
      ...baseLocation,
      canvasState: JSON.stringify({ elements: [], camera: {} }),
    });

    expect(autoSaveClear).not.toHaveBeenCalled();
  });

  afterEach(() => {
    if (savedRelayUrl !== undefined) {
      process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL = savedRelayUrl;
    }
    vi.clearAllMocks();
  });

  it('location mode: toggling visibility does NOT touch the canvas store (no dirty/save side effects)', async () => {
    const { store, result } = await setup('location');

    act(() => {
      result.current.handleToggleDmOnly();
    });

    expect(store.update).not.toHaveBeenCalled();
  });

  it('battlemap mode: toggling visibility re-emits the element so the sync client re-stamps its audience', async () => {
    const { store, result, elementId } = await setup('battlemap');

    act(() => {
      result.current.handleToggleDmOnly();
    });

    expect(store.update).toHaveBeenCalledTimes(1);
    expect(store.update).toHaveBeenCalledWith(elementId, {});
  });
});

describe('useDmLocationEditor — handleOpenTvDisplay popup-blocker survival', () => {
  const savedRelayUrl = process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;
  let openSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;
  });

  afterEach(() => {
    if (savedRelayUrl !== undefined) {
      process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL = savedRelayUrl;
    }
    openSpy?.mockRestore();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('opens the tab synchronously, before the display-key fetch resolves (survives transient-activation loss)', async () => {
    const fakeWin = { location: { href: '' } } as unknown as Window;
    openSpy = vi.spyOn(window, 'open').mockReturnValue(fakeWin);

    let resolveFetch!: (value: unknown) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise(resolve => {
          resolveFetch = resolve;
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    const { result } = await setup('location');

    const displayPromise = result.current.handleOpenTvDisplay();

    // window.open must have fired already, synchronously, before the fetch
    // (still pending) resolves — otherwise Safari drops the user gesture.
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith('', '_blank');
    expect(fakeWin.location.href).toBe('');

    resolveFetch({
      ok: true,
      json: async () => ({ displayKey: 'dk-123' }),
    });
    await act(async () => {
      await displayPromise;
    });

    expect(fakeWin.location.href).toContain('dk=dk-123');
    expect(openSpy).toHaveBeenCalledTimes(1); // no second window.open call
  });

  it('falls back to window.open(url) when the popup was blocked', async () => {
    openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ displayKey: 'dk-9' }),
      }))
    );

    const { result } = await setup('location');
    await act(async () => {
      await result.current.handleOpenTvDisplay();
    });

    expect(openSpy).toHaveBeenCalledTimes(2);
    expect(openSpy).toHaveBeenLastCalledWith(
      expect.stringContaining('dk=dk-9'),
      '_blank'
    );
  });
});

describe('useDmLocationEditor — handleSyncToPlayers marker projection', () => {
  const savedRelayUrl = process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;
  const LOCATION_ENDPOINT = '/api/campaign/TEST01/locations/loc-1';

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;
    useLocationStore.setState({ locations: {} });
  });

  afterEach(() => {
    if (savedRelayUrl !== undefined) {
      process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL = savedRelayUrl;
    }
    useLocationStore.setState({ locations: {} });
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  function markerPin(ref: string) {
    return createHtmlElement({
      position: { x: 0, y: 0 },
      size: { w: 40, h: 40 },
      layerId: 'markers',
      htmlType: MARKER_HTML_TYPE,
      data: { ...buildMarkerData({ kind: 'door', ref }) },
    });
  }

  function canvasJson(elements: readonly CanvasElement[]): string {
    return JSON.stringify({
      version: 1,
      camera: { position: { x: 0, y: 0 }, zoom: 1 },
      elements,
    });
  }

  it('posts location.markers as the public projection, with no dmNotes anywhere in the body', async () => {
    const sharedPin = markerPin('ref-shared');
    const hiddenPin = markerPin('ref-hidden');

    useLocationStore.getState().addLocation('TEST01', {
      ...baseLocation,
      dmOnlyElements: { [hiddenPin.id]: true },
      markers: [
        {
          id: 'ref-shared',
          title: 'Rusty Door',
          body: 'The hinges shriek.',
          dmNotes: 'DMNOTES-SENTINEL-SHARED poison needle in the handle',
        },
        {
          id: 'ref-hidden',
          title: 'Hidden Cache',
          body: 'A loose flagstone.',
          dmNotes: 'DMNOTES-SENTINEL-HIDDEN 400gp and a map',
        },
      ],
    });

    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
    vi.stubGlobal('fetch', fetchMock);

    const { vp, result } = await setup('location');
    vi.spyOn(vp, 'exportJSON').mockReturnValue(
      canvasJson([sharedPin, hiddenPin])
    );

    await act(async () => {
      await result.current.handleSyncToPlayers();
    });

    const calls = fetchMock.mock.calls as unknown as Array<
      [string, { body: string }]
    >;
    const call = calls.find(args => args[0] === LOCATION_ENDPOINT);
    expect(call).toBeDefined();
    const rawBody = call?.[1].body ?? '';
    expect(rawBody).not.toBe('');
    const payload = JSON.parse(rawBody) as {
      location: { markers?: unknown; name?: string };
    };

    // The shared marker publishes exactly three fields; the DM-only one does
    // not publish at all.
    expect(payload.location.markers).toEqual([
      { id: 'ref-shared', title: 'Rusty Door', body: 'The hinges shriek.' },
    ]);

    // Assert on the wire bytes, not on React state: no dmNotes value survives
    // anywhere in the serialized payload...
    expect(rawBody).not.toContain('DMNOTES-SENTINEL-SHARED');
    expect(rawBody).not.toContain('DMNOTES-SENTINEL-HIDDEN');
    // ...while the published title/body DO, proving the haystack is real and
    // the assertions above are not passing against an empty body.
    expect(rawBody).toContain('Rusty Door');
    expect(rawBody).toContain('The hinges shriek.');
    // The whole hidden record stays behind, not just its notes.
    expect(rawBody).not.toContain('Hidden Cache');
  });

  it('keeps the previous publication and reports an error when a fog snapshot upload fails', async () => {
    vi.stubEnv('NEXT_PUBLIC_FOG_OF_WAR_ENABLED', 'true');
    useLocationStore.getState().addLocation('TEST01', baseLocation);
    const { vp, result } = await setup('location');
    vp.fog.initialize({
      bounds: { x: 0, y: 0, w: 100, h: 100 },
      base: 'covered',
      cellSize: 8,
    });
    vi.spyOn(vp, 'exportImage').mockResolvedValue(
      new Blob(['masked'], { type: 'image/jpeg' })
    );
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/assets/upload') {
        return { ok: false, status: 503, json: async () => ({}) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      await result.current.handleSyncToPlayers();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/assets/upload',
      expect.objectContaining({ method: 'POST' })
    );
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes('/locations/loc-1')
      )
    ).toBe(false);
    expect(result.current.syncError).toMatch(/masked snapshot upload failed/i);
    expect(result.current.hasUnsyncedChanges).toBe(true);
  });
});
