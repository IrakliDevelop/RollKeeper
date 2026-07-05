import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Viewport } from '@fieldnotes/core';
import type { FieldNotesCanvasRef } from '@fieldnotes/react';
import { useDmLocationEditor } from '../DmLocationEditor.hooks';
import type { LocationMap } from '@/types/location';

// AutoSave touches storage adapters / timers we don't need here — stub it,
// keep the rest of @fieldnotes/core real (tools, types).
vi.mock('@fieldnotes/core', async importOriginal => {
  const actual = await importOriginal<typeof import('@fieldnotes/core')>();
  return {
    ...actual,
    AutoSave: class {
      start = vi.fn();
      stop = vi.fn();
      clear = vi.fn(async () => {});
    },
  };
});

/**
 * Minimal viewport stub covering only what `handleReady` (with empty
 * canvasState + empty mapImageUrl, so both load paths are skipped) and
 * `handleToggleDmOnly` touch.
 */
function makeStubViewport() {
  const selectTool = { name: 'select', selectedIds: ['el-1'] };
  const store = {
    on: vi.fn(() => vi.fn()),
    onChange: vi.fn(() => vi.fn()),
    getById: vi.fn((id: string) =>
      id === 'el-1' ? { id: 'el-1', type: 'shape' } : undefined
    ),
    update: vi.fn(),
    getAll: vi.fn(() => []),
    getElementsByType: vi.fn(() => []),
    snapshot: vi.fn(() => []),
    count: 0,
    clear: vi.fn(),
  };
  const layerManager = {
    getLayers: vi.fn(() => [{ id: 'layer-1', name: 'Layer 1' }]),
    createLayer: vi.fn(() => ({ id: 'layer-2', name: 'Annotations' })),
    renameLayer: vi.fn(),
    setLayerLocked: vi.fn(),
    setActiveLayer: vi.fn(),
    moveElementToLayer: vi.fn(),
    activeLayerId: 'layer-1',
  };
  const vp = {
    store,
    layerManager,
    // No parentElement → handleReady skips the pointer listeners; selection
    // is driven by the direct syncSelection() call at the end of handleReady.
    domLayer: document.createElement('div'),
    toolManager: {
      getTool: vi.fn(() => selectTool),
      onChange: vi.fn(),
      activeTool: { name: 'select' },
    },
    camera: {
      setZoom: vi.fn(),
      moveTo: vi.fn(),
      screenToWorld: vi.fn(() => ({ x: 0, y: 0 })),
    },
    loadJSON: vi.fn(),
    exportJSON: vi.fn(() => '{}'),
    addImage: vi.fn(),
    removeGrid: vi.fn(),
    addGrid: vi.fn(),
    updateGrid: vi.fn(),
    requestRender: vi.fn(),
  };
  return { vp: vp as unknown as Viewport, store };
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

async function setup(mode: 'location' | 'battlemap') {
  const { vp, store } = makeStubViewport();
  const onSave = vi.fn();
  const { result } = renderHook(() =>
    useDmLocationEditor({
      location: baseLocation,
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
  expect(result.current.selectedElementId).toBe('el-1');
  return { store, result };
}

describe('useDmLocationEditor — handleToggleDmOnly mode gating', () => {
  const savedRelayUrl = process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;

  beforeEach(() => {
    // Ensure handleReady never starts a live sync connection in tests.
    delete process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;
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
    const { store, result } = await setup('battlemap');

    act(() => {
      result.current.handleToggleDmOnly();
    });

    expect(store.update).toHaveBeenCalledTimes(1);
    expect(store.update).toHaveBeenCalledWith('el-1', {});
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
