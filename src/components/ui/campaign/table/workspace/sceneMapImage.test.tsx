import { act, renderHook } from '@testing-library/react';
import {
  ElementStore,
  createImage,
  type CanvasElement,
} from '@fieldnotes/core';
import { describe, expect, it, vi } from 'vitest';

import { MAP_LAYER_ID } from '@/components/ui/campaign/location-map/layerContract';
import { assetProxyUrl } from '@/utils/assetProxyUrl';

import {
  ensureSceneMapImage,
  mapLayerImages,
  replaceSceneMapImage,
  useEnsureSceneMapImage,
  type SceneMapImageWrites,
} from './sceneMapImage';

const S3 = 'https://bucket.s3.eu-west-1.amazonaws.com/maps/tavern.webp';

function writes(dmOnly: Record<string, boolean> = {}) {
  const state = { ...dmOnly };
  const value: SceneMapImageWrites & { state: Record<string, boolean> } = {
    state,
    isDmOnly: id => state[id] === true,
    setDmOnly: vi.fn((id: string, next: boolean) => {
      if (next) state[id] = true;
      else delete state[id];
    }),
    writeSize: vi.fn(),
  };
  return value;
}

const images = (store: ElementStore) => mapLayerImages(store);

describe('R3-F3 ensure map image (real ElementStore)', () => {
  it('adds exactly one locked, proxied, public image for a never-opened map', async () => {
    const store = new ElementStore();
    const result = await ensureSceneMapImage(
      { store },
      { mapImageUrl: S3, mapImageSize: { w: 1200, h: 800 } },
      writes()
    );
    expect(result).toBe('added');
    const [image] = images(store);
    expect(images(store)).toHaveLength(1);
    expect(image).toMatchObject({
      type: 'image',
      layerId: MAP_LAYER_ID,
      locked: true,
      src: assetProxyUrl(S3),
      position: { x: 0, y: 0 },
      size: { w: 1200, h: 800 },
    });
    expect(assetProxyUrl(S3)).toBe(
      `/api/assets/proxy?url=${encodeURIComponent(S3)}`
    );
  });

  it('stays at one image across three remounts of the saved state', async () => {
    let state: CanvasElement[] = [];
    for (let mount = 0; mount < 3; mount += 1) {
      const store = new ElementStore();
      store.loadSnapshot(structuredClone(state));
      await ensureSceneMapImage(
        { store },
        { mapImageUrl: S3, mapImageSize: { w: 10, h: 10 } },
        writes()
      );
      state = store.snapshot();
    }
    expect(state.filter(element => element.type === 'image')).toHaveLength(1);
  });

  it('never duplicates an existing unlocked legacy map image', async () => {
    const store = new ElementStore();
    store.add(
      createImage({
        position: { x: 5, y: 5 },
        size: { w: 10, h: 10 },
        src: '/legacy.webp',
        layerId: MAP_LAYER_ID,
      })
    );
    await expect(
      ensureSceneMapImage(
        { store },
        { mapImageUrl: S3, mapImageSize: { w: 10, h: 10 } },
        writes()
      )
    ).resolves.toBe('present');
    expect(images(store)).toHaveLength(1);
  });

  it('does nothing for a blank scene', async () => {
    const store = new ElementStore();
    await expect(
      ensureSceneMapImage(
        { store },
        { mapImageUrl: '', mapImageSize: { w: 0, h: 0 } },
        writes()
      )
    ).resolves.toBe('none');
    expect(store.getAll()).toEqual([]);
  });

  it('decodes the natural size of a 0×0 scene and writes it through the adapter', async () => {
    const store = new ElementStore();
    const write = writes();
    await ensureSceneMapImage(
      { store },
      { mapImageUrl: S3, mapImageSize: { w: 0, h: 0 } },
      write,
      async () => ({ w: 300, h: 200 })
    );
    expect(write.writeSize).toHaveBeenCalledWith({ w: 300, h: 200 });
    expect(images(store)[0]!.size).toEqual({ w: 300, h: 200 });
  });

  it('keeps the ensured image public even while hidden placement is on', async () => {
    const store = new ElementStore();
    const write = writes();
    // The canvas' hidden-placement listener marks every local add DM-only.
    store.on('add', element => write.setDmOnly(element.id, true));
    const updates: string[] = [];
    store.on('update', event => updates.push(event.current.id));
    await ensureSceneMapImage(
      { store },
      { mapImageUrl: S3, mapImageSize: { w: 10, h: 10 } },
      write
    );
    const [image] = images(store);
    expect(write.isDmOnly(image!.id)).toBe(false);
    // Re-emitted so the sync client re-stamps a public audience.
    expect(updates).toContain(image!.id);
  });
});

describe('W10(a) replace map image', () => {
  it('replaces the lowest-z locked map image and keeps exactly one', () => {
    const store = new ElementStore();
    const low = {
      ...createImage({
        position: { x: 0, y: 0 },
        size: { w: 10, h: 10 },
        src: '/old.webp',
        layerId: MAP_LAYER_ID,
      }),
      locked: true,
      zIndex: 1,
    } as CanvasElement;
    const unlocked = {
      ...createImage({
        position: { x: 50, y: 0 },
        size: { w: 10, h: 10 },
        src: '/other.webp',
        layerId: MAP_LAYER_ID,
      }),
      zIndex: 0,
    } as CanvasElement;
    store.add(low);
    store.add(unlocked);
    const result = replaceSceneMapImage(
      { store },
      S3,
      { w: 400, h: 300 },
      writes()
    );
    expect(result).toBe('replaced');
    expect(images(store)).toHaveLength(2);
    expect(store.getById(low.id)).toMatchObject({
      src: assetProxyUrl(S3),
      size: { w: 400, h: 300 },
      locked: true,
    });
    expect(store.getById(unlocked.id)).toMatchObject({ src: '/other.webp' });
  });

  it('adds the image when the map layer has none and un-hides a DM-only target', () => {
    const store = new ElementStore();
    const old = {
      ...createImage({
        position: { x: 0, y: 0 },
        size: { w: 10, h: 10 },
        src: '/old.webp',
        layerId: MAP_LAYER_ID,
      }),
      locked: true,
    } as CanvasElement;
    store.add(old);
    const write = writes({ [old.id]: true });
    replaceSceneMapImage({ store }, S3, { w: 5, h: 5 }, write);
    expect(write.isDmOnly(old.id)).toBe(false);

    const empty = new ElementStore();
    expect(
      replaceSceneMapImage({ store: empty }, S3, { w: 5, h: 5 }, writes())
    ).toBe('added');
    expect(images(empty)).toHaveLength(1);
  });
});

describe('C6-1 ensure runs after the applied live snapshot', () => {
  const map = { mapImageUrl: S3, mapImageSize: { w: 10, h: 10 } };

  it('does not duplicate an image the live room already has (status → loadSnapshot order)', async () => {
    const store = new ElementStore();
    const write = writes();
    const roomImage = {
      ...createImage({
        position: { x: 0, y: 0 },
        size: { w: 10, h: 10 },
        src: assetProxyUrl(S3),
        layerId: MAP_LAYER_ID,
      }),
      locked: true,
    } as CanvasElement;
    const { rerender } = renderHook(
      ({ status }: { status: string }) =>
        useEnsureSceneMapImage({
          viewport: { store },
          relayConfigured: true,
          relayStatus: status,
          map,
          writes: write,
        }),
      { initialProps: { status: 'connecting' } }
    );
    expect(store.getAll()).toEqual([]);
    await act(async () => {
      // battlemapAuthority: onStatus('live') then loadSnapshot, synchronously.
      rerender({ status: 'live' });
      store.loadSnapshot([roomImage], { origin: 'remote' });
    });
    expect(images(store)).toHaveLength(1);
    expect(images(store)[0]!.id).toBe(roomImage.id);
  });

  it('adds once after the live snapshot when the room has no image', async () => {
    const store = new ElementStore();
    const { rerender } = renderHook(
      ({ status }: { status: string }) =>
        useEnsureSceneMapImage({
          viewport: { store },
          relayConfigured: true,
          relayStatus: status,
          map,
          writes: writes(),
        }),
      { initialProps: { status: 'connecting' } }
    );
    await act(async () => {
      rerender({ status: 'live' });
      store.loadSnapshot([], { origin: 'remote' });
    });
    expect(images(store)).toHaveLength(1);
    await act(async () => {
      rerender({ status: 'offline' });
      rerender({ status: 'live' });
    });
    expect(images(store)).toHaveLength(1);
  });

  it('runs after the local load when no relay is configured', async () => {
    const store = new ElementStore();
    await act(async () => {
      renderHook(() =>
        useEnsureSceneMapImage({
          viewport: { store },
          relayConfigured: false,
          relayStatus: 'connecting',
          map,
          writes: writes(),
        })
      );
    });
    expect(images(store)).toHaveLength(1);
  });
});
