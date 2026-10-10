import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  Camera,
  ElementStore,
  LayerManager,
  type Viewport,
} from '@fieldnotes/core';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MAP_LAYER_ID } from '@/components/ui/campaign/location-map/layerContract';
import { TableRepository } from '@/lib/table/repository';
import type { SceneImageUploader } from '@/lib/table/sceneImage';
import {
  createTableSceneAdapter,
  type TableSceneAdapter,
} from '@/lib/table/sceneAdapter';
import { useBattleMapStore } from '@/store/battleMapStore';
import { assetProxyUrl } from '@/utils/assetProxyUrl';

const grid = vi.hoisted(() => ({
  add: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  fog: { getState: vi.fn(() => null) },
}));
vi.mock('@/lib/fieldnotesVtt', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/fieldnotesVtt')>()),
  getVttGridController: () => grid,
  getViewportFogManager: () => grid.fog,
}));

import { TableEditMapControl } from './TableEditMapControl';

const AT = '2026-10-08T00:00:00.000Z';
let repository: TableRepository;
let adapter: TableSceneAdapter;

function viewport() {
  const store = new ElementStore();
  const layerManager = new LayerManager(store);
  const camera = new Camera();
  return {
    store,
    layerManager,
    camera,
    getCanvasSize: () => ({ w: 800, h: 600 }),
    getVisibleRect: () => camera.getVisibleRect(800, 600),
    requestRender: vi.fn(),
  } as unknown as Viewport;
}

beforeEach(async () => {
  grid.add.mockClear();
  grid.update.mockClear();
  grid.remove.mockClear();
  repository = new TableRepository({
    factory: new IDBFactory(),
    selection: {
      account: { kind: 'guest' },
      workspace: { localWorkspaceId: 'w1', sourceCampaignCode: 'CAMP' },
    },
    broadcastChannel: null,
    events: null,
  });
  await repository.start();
  await repository.mutateWorkspace(0, 'seed', {
    scenes: {
      put: [
        {
          schemaVersion: 1,
          workspaceKey: repository.workspaceIdentity,
          sceneId: 'scene-forest',
          originalMapId: null,
          map: {
            name: 'Forest',
            mapImageUrl: '',
            mapImageSize: { w: 0, h: 0 },
            gridEnabled: false,
            gridSettings: null,
            markers: [],
            dmOnlyElements: {},
          },
          canvasCheckpoint: null,
          members: [],
          arrivalPoint: null,
          createdAt: AT,
          updatedAt: AT,
        },
      ],
    },
  });
  adapter = createTableSceneAdapter({
    repository,
    sceneId: 'scene-forest',
    campaignCode: 'CAMP',
  });
});
afterEach(() => {
  cleanup();
  adapter.dispose();
  repository.dispose();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const stored = () => {
  const current = repository.getCurrent();
  if (current?.status !== 'ready') throw new Error('not ready');
  return current.snapshot.scenes[0]!;
};

function setup(
  vp = viewport(),
  presentedHere = false,
  upload = vi.fn(
    async () => 'https://bucket.s3.eu-west-1.amazonaws.com/maps/forest.webp'
  ),
  probe: (url: string) => Promise<{ w: number; h: number }> = async () => ({
    w: 1000,
    h: 500,
  }),
  scaleVerifiedHere = false
) {
  const storeWrite = vi.spyOn(useBattleMapStore, 'setState');
  const localWrite = vi.spyOn(Storage.prototype, 'setItem');
  const fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  render(
    <TableEditMapControl
      adapter={adapter}
      viewport={vp}
      presentedHere={presentedHere}
      scaleVerifiedHere={scaleVerifiedHere}
      upload={upload}
      decode={async () => ({ w: 1000, h: 500 })}
      probe={probe}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Edit map' }));
  return { vp, storeWrite, localWrite, fetchSpy, upload };
}

describe('W10 Edit map tools write only through the scene adapter', () => {
  it('is a tool choice: a disclosure with the private-notes hint (A5)', () => {
    setup();
    const toggle = screen.getByRole('button', { name: 'Edit map' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAttribute('aria-controls', 'table-edit-map-panel');
    expect(
      screen.getByText(
        'Notes and text marked DM-only stay private; players never receive them.'
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "You're editing the scene players see. Changes show right away."
      )
    ).not.toBeInTheDocument();
  });

  it('hints that a grid geometry change needs re-verification while the table reports verified (PR07 P9)', () => {
    setup(viewport(), true, undefined, undefined, true);
    expect(
      screen.getByText(
        'Changing the grid geometry requires re-verifying the table scale.'
      )
    ).toBeInTheDocument();
  });

  it('shows no scale hint otherwise', () => {
    setup(viewport(), true);
    expect(
      screen.queryByText(
        'Changing the grid geometry requires re-verifying the table scale.'
      )
    ).toBeNull();
  });

  it('says changes are live while editing the shown scene', () => {
    setup(viewport(), true);
    expect(
      screen.getByText(
        "You're editing the scene players see. Changes show right away."
      )
    ).toBeInTheDocument();
  });

  it('turns the grid on, adjusts it and turns it off through the adapter', async () => {
    const { storeWrite, localWrite, fetchSpy } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Grid: Off/u }));
    fireEvent.click(screen.getByTitle('Square grid'));
    expect(grid.add).toHaveBeenCalledWith(
      expect.objectContaining({ gridType: 'square', cellSize: 50 })
    );
    await adapter.flush();
    expect(stored().map).toMatchObject({
      gridEnabled: true,
      gridSettings: { gridType: 'square', cellSize: 50 },
    });
    fireEvent.change(screen.getByTitle('Grid cell size'), {
      target: { value: '70' },
    });
    expect(grid.update).toHaveBeenCalledWith(
      expect.objectContaining({ cellSize: 70 })
    );
    await adapter.flush();
    expect(stored().map.gridSettings).toMatchObject({ cellSize: 70 });
    fireEvent.click(screen.getByTitle('No grid'));
    expect(grid.remove).toHaveBeenCalled();
    await adapter.flush();
    expect(stored().map.gridEnabled).toBe(false);
    expect(storeWrite).not.toHaveBeenCalled();
    expect(localWrite).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sets the map image once (replace keeps one) through the adapter', async () => {
    const { vp, storeWrite, localWrite, upload } = setup();
    const input = screen.getByLabelText('Map image file');
    fireEvent.change(input, {
      target: {
        files: [
          new File([new Uint8Array(4)], 'forest.webp', { type: 'image/webp' }),
        ],
      },
    });
    await waitFor(() =>
      expect(stored().map.mapImageUrl).toBe(
        'https://bucket.s3.eu-west-1.amazonaws.com/maps/forest.webp'
      )
    );
    expect(stored().map.mapImageSize).toEqual({ w: 1000, h: 500 });
    const images = () =>
      vp.store
        .getAll()
        .filter(el => el.type === 'image' && el.layerId === MAP_LAYER_ID);
    expect(images()).toHaveLength(1);
    expect(images()[0]).toMatchObject({
      src: assetProxyUrl(
        'https://bucket.s3.eu-west-1.amazonaws.com/maps/forest.webp'
      ),
      locked: true,
    });
    upload.mockResolvedValueOnce('https://example.test/forest-2.webp');
    fireEvent.change(screen.getByLabelText('Map image file'), {
      target: {
        files: [
          new File([new Uint8Array(4)], 'forest2.webp', { type: 'image/webp' }),
        ],
      },
    });
    await waitFor(() =>
      expect(stored().map.mapImageUrl).toBe(
        'https://example.test/forest-2.webp'
      )
    );
    expect(images()).toHaveLength(1);
    expect(storeWrite).not.toHaveBeenCalled();
    expect(localWrite).not.toHaveBeenCalled();
  });

  it('shows an upload error and changes nothing', async () => {
    const failing = vi.fn(async () => {
      throw new Error('Failed to upload asset to S3');
    });
    const { vp } = setup(viewport(), false, failing);
    fireEvent.change(screen.getByLabelText('Map image file'), {
      target: {
        files: [
          new File([new Uint8Array(4)], 'a.webp', { type: 'image/webp' }),
        ],
      },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Upload failed: Failed to upload asset to S3'
    );
    expect(vp.store.getAll()).toEqual([]);
    expect(stored().map.mapImageUrl).toBe('');
  });

  it('fits the camera to the map', () => {
    const vp = viewport();
    vp.store.add({
      id: 'map-1',
      type: 'image',
      layerId: MAP_LAYER_ID,
      position: { x: 0, y: 0 },
      size: { w: 1600, h: 1200 },
      src: '/m.webp',
      zIndex: 0,
      locked: true,
    } as never);
    setup(vp);
    fireEvent.click(screen.getByRole('button', { name: 'Fit to map' }));
    const rect = vp.camera.getVisibleRect(800, 600);
    expect(rect.w).toBeGreaterThanOrEqual(1600 - 1);
    expect(rect.h).toBeGreaterThanOrEqual(1200 - 1);
  });

  it('adds or replaces nothing when the uploaded image cannot be loaded (F6)', async () => {
    const { vp } = setup(viewport(), false, undefined, async () => {
      throw new Error('broken');
    });
    fireEvent.change(screen.getByLabelText('Map image file'), {
      target: {
        files: [
          new File([new Uint8Array(4)], 'a.webp', { type: 'image/webp' }),
        ],
      },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Map image could not be loaded'
    );
    expect(vp.store.getAll()).toEqual([]);
    await adapter.flush();
    expect(stored().map.mapImageUrl).toBe('');
  });

  it('reports in-flight image work to the switch machine (F9)', async () => {
    const onBusyChange = vi.fn();
    let finish!: (url: string) => void;
    const upload = vi.fn(
      () =>
        new Promise<string>(resolve => {
          finish = resolve;
        })
    );
    vi.stubGlobal('fetch', vi.fn());
    render(
      <TableEditMapControl
        adapter={adapter}
        viewport={viewport()}
        presentedHere={false}
        upload={upload}
        decode={async () => ({ w: 10, h: 10 })}
        probe={async () => ({ w: 10, h: 10 })}
        onBusyChange={onBusyChange}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit map' }));
    fireEvent.change(screen.getByLabelText('Map image file'), {
      target: {
        files: [
          new File([new Uint8Array(4)], 'a.webp', { type: 'image/webp' }),
        ],
      },
    });
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(true));
    finish('https://example.test/a.webp');
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false));
  });
});

describe('FU-1 Edit map panel focus, dismissal and placement', () => {
  const observers: Array<{
    callback: ResizeObserverCallback;
    targets: Element[];
    disconnected: boolean;
  }> = [];
  let anchorBottom = 100;
  beforeEach(() => {
    observers.length = 0;
    anchorBottom = 100;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        entry: (typeof observers)[number];
        constructor(callback: ResizeObserverCallback) {
          this.entry = { callback, targets: [], disconnected: false };
          observers.push(this.entry);
        }
        observe(target: Element) {
          this.entry.targets.push(target);
        }
        unobserve() {}
        disconnect() {
          this.entry.disconnected = true;
        }
      }
    );
  });

  function mount(
    upload: SceneImageUploader = vi.fn(async () => 'https://x.test/a.webp')
  ) {
    vi.stubGlobal('fetch', vi.fn());
    render(
      <div data-testid="dm-vtt-command-dock">
        <button type="button">Before</button>
        <div>
          <TableEditMapControl
            adapter={adapter}
            viewport={viewport()}
            presentedHere={false}
            upload={upload}
            decode={async () => ({ w: 10, h: 10 })}
            probe={async () => ({ w: 10, h: 10 })}
          />
        </div>
        <button type="button">Next tool</button>
      </div>
    );
    const toggle = screen.getByRole('button', { name: 'Edit map' });
    vi.spyOn(toggle.parentElement!, 'getBoundingClientRect').mockImplementation(
      () =>
        ({
          top: anchorBottom - 44,
          bottom: anchorBottom,
          left: 600,
          right: 700,
          width: 100,
          height: 44,
        }) as DOMRect
    );
    fireEvent.click(toggle);
    return toggle;
  }
  const panel = () => screen.queryByRole('group', { name: 'Edit map' });

  it('focuses the first visible control; Shift+Tab returns to Edit map', () => {
    const toggle = mount();
    const first = screen.getByRole('button', { name: 'Set map image' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(toggle);
    expect(panel()).toBeInTheDocument();
  });

  it('Tab from the last control closes the panel and moves on past Edit map', () => {
    mount();
    const last = screen.getByRole('button', { name: 'Fit to map' });
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(panel()).not.toBeInTheDocument();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Next tool' })
    );
  });

  it('Escape closes an open grid popover first, then the panel, returning focus', () => {
    const toggle = mount();
    const gridButton = screen.getByRole('button', { name: /Grid:/u });
    fireEvent.click(gridButton);
    expect(gridButton).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(gridButton, { key: 'Escape' });
    expect(gridButton).toHaveAttribute('aria-expanded', 'false');
    expect(panel()).toBeInTheDocument();
    fireEvent.keyDown(gridButton, { key: 'Escape' });
    expect(panel()).not.toBeInTheDocument();
    expect(document.activeElement).toBe(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on an outside click, but not while image work is in flight', async () => {
    let finish!: (url: string) => void;
    mount(
      vi.fn(
        () =>
          new Promise<string>(resolve => {
            finish = resolve;
          })
      )
    );
    fireEvent.change(screen.getByLabelText('Map image file'), {
      target: {
        files: [
          new File([new Uint8Array(4)], 'a.webp', { type: 'image/webp' }),
        ],
      },
    });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Set map image' })
      ).toBeDisabled()
    );
    fireEvent.pointerDown(document.body);
    expect(panel()).toBeInTheDocument();
    finish('https://x.test/a.webp');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Replace map image' })
      ).toBeEnabled()
    );
    fireEvent.pointerDown(document.body);
    expect(panel()).not.toBeInTheDocument();
  });

  it('reads busy synchronously: an outside click right after the work settles closes (R4-3)', async () => {
    let finish!: (url: string) => void;
    mount(
      vi.fn(
        () =>
          new Promise<string>(resolve => {
            finish = resolve;
          })
      )
    );
    fireEvent.change(screen.getByLabelText('Map image file'), {
      target: {
        files: [
          new File([new Uint8Array(4)], 'a.webp', { type: 'image/webp' }),
        ],
      },
    });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Set map image' })
      ).toBeDisabled()
    );
    finish('https://x.test/a.webp');
    // Microtasks only: the work settles, but React has not re-rendered
    // (nor run passive effects) yet.
    for (let step = 0; step < 50; step += 1) await Promise.resolve();
    expect(
      screen.getByRole('button', { name: 'Set map image' })
    ).toBeDisabled();
    fireEvent.pointerDown(document.body);
    expect(panel()).not.toBeInTheDocument();
  });

  it('removes its scroll, resize and document listeners on close and unmount (R4-4 / FU1i)', () => {
    const windowRemove = vi.spyOn(window, 'removeEventListener');
    const documentRemove = vi.spyOn(document, 'removeEventListener');
    const toggle = mount();
    const added = (type: string) =>
      windowRemove.mock.calls.filter(([name]) => name === type);
    fireEvent.click(toggle);
    expect(panel()).not.toBeInTheDocument();
    expect(added('scroll')).toEqual([['scroll', expect.any(Function), true]]);
    expect(added('resize')).toEqual([['resize', expect.any(Function)]]);
    expect(documentRemove.mock.calls.map(([name]) => name)).toEqual(
      expect.arrayContaining(['pointerdown', 'focusin'])
    );
    fireEvent.click(toggle);
    windowRemove.mockClear();
    cleanup();
    expect(added('scroll')).toHaveLength(1);
    expect(added('resize')).toHaveLength(1);
  });

  it('stays open while focus moves away during image work, closes once it settles (R5-2 / FA1d)', async () => {
    let finish!: (url: string) => void;
    mount(
      vi.fn(
        () =>
          new Promise<string>(resolve => {
            finish = resolve;
          })
      )
    );
    fireEvent.change(screen.getByLabelText('Map image file'), {
      target: {
        files: [
          new File([new Uint8Array(4)], 'a.webp', { type: 'image/webp' }),
        ],
      },
    });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Set map image' })
      ).toBeDisabled()
    );
    const next = screen.getByRole('button', { name: 'Next tool' });
    act(() => next.focus());
    expect(document.activeElement).toBe(next);
    expect(panel()).toBeInTheDocument();
    finish('https://x.test/a.webp');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Replace map image' })
      ).toBeEnabled()
    );
    act(() =>
      screen.getByRole('button', { name: 'Replace map image' }).focus()
    );
    expect(panel()).toBeInTheDocument();
    act(() => next.focus());
    expect(panel()).not.toBeInTheDocument();
  });

  it('Tab from Edit map while open moves into the panel (FA1)', () => {
    const toggle = mount();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Set map image' }), {
      key: 'Tab',
      shiftKey: true,
    });
    expect(document.activeElement).toBe(toggle);
    fireEvent.keyDown(toggle, { key: 'Tab' });
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Set map image' })
    );
    expect(panel()).toBeInTheDocument();
  });

  it('closes when focus leaves the button and the panel for another control (FA1)', () => {
    const toggle = mount();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Set map image' }), {
      key: 'Tab',
      shiftKey: true,
    });
    const next = screen.getByRole('button', { name: 'Next tool' });
    act(() => next.focus());
    expect(panel()).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(next);
  });

  it('follows a pure position shift of the anchor without a resize callback (FA2)', () => {
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrame = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      nextFrame += 1;
      frames.set(nextFrame, callback);
      return nextFrame;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
    const flush = () =>
      act(() => {
        const due = [...frames.values()];
        frames.clear();
        due.forEach(callback => callback(0));
      });
    const toggle = mount();
    flush();
    expect(panel()).toHaveStyle({ top: '104px' });
    anchorBottom = 445;
    flush();
    expect(panel()).toHaveStyle({ top: '449px' });
    fireEvent.click(toggle);
    flush();
    expect(frames.size).toBe(0);
  });

  it('follows the anchor when the header grows, and disposes observers on close', () => {
    const toggle = mount();
    expect(panel()).toHaveStyle({ top: '104px' });
    const dock = screen.getByTestId('dm-vtt-command-dock');
    const watching = observers.filter(entry => !entry.disconnected);
    expect(watching.flatMap(entry => entry.targets)).toEqual(
      expect.arrayContaining([toggle.parentElement, dock])
    );
    anchorBottom = 160;
    act(() =>
      watching.forEach(entry =>
        entry.callback([], entry as unknown as ResizeObserver)
      )
    );
    expect(panel()).toHaveStyle({ top: '164px' });
    anchorBottom = 120;
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(panel()).toHaveStyle({ top: '124px' });
    fireEvent.click(toggle);
    expect(observers.every(entry => entry.disconnected)).toBe(true);
    anchorBottom = 300;
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(panel()).not.toBeInTheDocument();
  });
});
