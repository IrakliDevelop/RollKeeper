import {
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
  })
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
      screen.queryByText('Editing the shown scene — changes are live')
    ).not.toBeInTheDocument();
  });

  it('says changes are live while editing the shown scene', () => {
    setup(viewport(), true);
    expect(
      screen.getByText('Editing the shown scene — changes are live')
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
