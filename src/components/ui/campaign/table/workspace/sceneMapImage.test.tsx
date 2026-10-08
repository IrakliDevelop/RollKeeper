import { act, cleanup, renderHook } from '@testing-library/react';
import {
  ElementStore,
  createImage,
  type CanvasElement,
} from '@fieldnotes/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

/**
 * CI leak guard: every interval, and every timeout of 5 s or longer, created
 * by a test must be cleared once the test's trees are unmounted — a live
 * one fires after this file's jsdom is gone and crashes React in a later
 * file of the same worker.
 */
const realTimers = {
  setInterval: globalThis.setInterval,
  clearInterval: globalThis.clearInterval,
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
};
const liveTimers = new Set<unknown>();
function trackTimers() {
  liveTimers.clear();
  globalThis.setInterval = ((handler: () => void, delay?: number) => {
    const id = realTimers.setInterval(handler, delay);
    liveTimers.add(id);
    return id;
  }) as typeof setInterval;
  globalThis.clearInterval = ((id: Parameters<typeof clearInterval>[0]) => {
    liveTimers.delete(id);
    realTimers.clearInterval(id);
  }) as typeof clearInterval;
  globalThis.setTimeout = ((handler: () => void, delay?: number) => {
    const id = realTimers.setTimeout(() => {
      liveTimers.delete(id);
      handler();
    }, delay);
    if ((delay ?? 0) >= 5_000) liveTimers.add(id);
    return id;
  }) as typeof setTimeout;
  globalThis.clearTimeout = ((id: Parameters<typeof clearTimeout>[0]) => {
    liveTimers.delete(id);
    realTimers.clearTimeout(id);
  }) as typeof clearTimeout;
}
function expectNoLiveTimers() {
  const live = liveTimers.size;
  Object.assign(globalThis, realTimers);
  expect(live, 'timers left running after the test').toBe(0);
}

beforeEach(() => trackTimers());
afterEach(() => {
  cleanup();
  expectNoLiveTimers();
});

const images = (store: ElementStore) => mapLayerImages(store);
/** F6: every add/replace is probed through the proxied URL first. */
const loads = vi.fn(async () => ({ w: 10, h: 10 }));

describe('R3-F3 ensure map image (real ElementStore)', () => {
  it('adds exactly one locked, proxied, public image for a never-opened map', async () => {
    const store = new ElementStore();
    const result = await ensureSceneMapImage(
      { store },
      { mapImageUrl: S3, mapImageSize: { w: 1200, h: 800 } },
      writes(),
      loads
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
        writes(),
        loads
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
        writes(),
        loads
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
        writes(),
        loads
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
      write,
      loads
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
          decode: loads,
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
          decode: loads,
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
          decode: loads,
        })
      );
    });
    expect(images(store)).toHaveLength(1);
  });
});

describe('F6 probe the map image before adding it', () => {
  it('adds nothing and reports when the image cannot be loaded', async () => {
    const store = new ElementStore();
    const write = writes();
    const onUnavailable = vi.fn();
    await expect(
      ensureSceneMapImage(
        { store },
        { mapImageUrl: S3, mapImageSize: { w: 10, h: 10 } },
        { ...write, onUnavailable },
        async () => {
          throw new Error('404');
        }
      )
    ).resolves.toBe('failed');
    expect(store.getAll()).toEqual([]);
    expect(onUnavailable).toHaveBeenCalledTimes(1);
  });

  it('probes through the proxied URL', async () => {
    const decode = vi.fn(async () => ({ w: 4, h: 4 }));
    await ensureSceneMapImage(
      { store: new ElementStore() },
      { mapImageUrl: S3, mapImageSize: { w: 10, h: 10 } },
      writes(),
      decode
    );
    expect(decode).toHaveBeenCalledWith(S3);
  });
});

describe('F3 ensure runs locally when a configured relay is not live', () => {
  const map = { mapImageUrl: S3, mapImageSize: { w: 10, h: 10 } };

  it('runs after the local load when the relay is offline, without a duplicate on live', async () => {
    const store = new ElementStore();
    const { rerender } = renderHook(
      ({ status }: { status: string }) =>
        useEnsureSceneMapImage({
          viewport: { store },
          relayConfigured: true,
          relayStatus: status,
          map,
          writes: writes(),
          decode: loads,
        }),
      { initialProps: { status: 'offline' } }
    );
    await act(async () => {});
    expect(images(store)).toHaveLength(1);
    const local = store.snapshot();
    await act(async () => {
      rerender({ status: 'live' });
      store.loadSnapshot(structuredClone(local), { origin: 'remote' });
    });
    expect(images(store)).toHaveLength(1);
  });

  it('runs after a bounded wait while still connecting', async () => {
    vi.useFakeTimers();
    try {
      const store = new ElementStore();
      // The canvas viewport is one stable object per mount.
      const viewport = { store };
      renderHook(() =>
        useEnsureSceneMapImage({
          viewport,
          relayConfigured: true,
          relayStatus: 'connecting',
          map,
          writes: writes(),
          decode: loads,
        })
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4_000);
      });
      expect(images(store)).toHaveLength(0);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_500);
      });
      expect(images(store)).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe('review 02 N3–N5', () => {
  const map = { mapImageUrl: S3, mapImageSize: { w: 10, h: 10 } };
  const roomImage = () =>
    ({
      ...createImage({
        position: { x: 0, y: 0 },
        size: { w: 10, h: 10 },
        src: '/room.webp',
        layerId: MAP_LAYER_ID,
      }),
      locked: true,
    }) as CanvasElement;

  it('N4: re-checks after the probe and adds nothing when a snapshot arrived meanwhile', async () => {
    const store = new ElementStore();
    const probe = deferred<{ w: number; h: number }>();
    const pending = ensureSceneMapImage(
      { store },
      map,
      writes(),
      () => probe.promise
    );
    store.loadSnapshot([roomImage()], { origin: 'remote' });
    probe.resolve({ w: 10, h: 10 });
    await expect(pending).resolves.toBe('present');
    expect(images(store)).toHaveLength(1);
    expect(images(store)[0]!.src).toBe('/room.webp');
  });

  it('N3: removes the unconfirmed local image when the live room already has another', async () => {
    vi.useFakeTimers();
    try {
      const store = new ElementStore();
      const viewport = { store };
      const { rerender } = renderHook(
        ({ status }: { status: string }) =>
          useEnsureSceneMapImage({
            viewport,
            relayConfigured: true,
            relayStatus: status,
            map,
            writes: writes(),
            decode: loads,
          }),
        { initialProps: { status: 'connecting' } }
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_500);
      });
      const [local] = images(store);
      expect(local).toBeDefined();
      const room = roomImage();
      await act(async () => {
        rerender({ status: 'live' });
        // The room's snapshot plus the replayed local draft upsert.
        store.loadSnapshot([room, structuredClone(local!)], {
          origin: 'remote',
        });
      });
      expect(images(store).map(image => image.id)).toEqual([room.id]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('N3: keeps the local image when the live room has no other map image', async () => {
    vi.useFakeTimers();
    try {
      const store = new ElementStore();
      const viewport = { store };
      const { rerender } = renderHook(
        ({ status }: { status: string }) =>
          useEnsureSceneMapImage({
            viewport,
            relayConfigured: true,
            relayStatus: status,
            map,
            writes: writes(),
            decode: loads,
          }),
        { initialProps: { status: 'connecting' } }
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_500);
      });
      const [local] = images(store);
      await act(async () => {
        rerender({ status: 'live' });
        store.loadSnapshot([structuredClone(local!)], { origin: 'remote' });
      });
      expect(images(store).map(image => image.id)).toEqual([local!.id]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('N5: a probe settling after a scene switch neither notifies nor adds', async () => {
    const first = { store: new ElementStore() };
    const second = { store: new ElementStore() };
    const probe = deferred<{ w: number; h: number }>();
    const onUnavailable = vi.fn();
    const decode = vi.fn(() => probe.promise);
    const { rerender } = renderHook(
      ({ viewport }: { viewport: { store: ElementStore } }) =>
        useEnsureSceneMapImage({
          viewport,
          relayConfigured: false,
          relayStatus: 'connecting',
          map:
            viewport === first
              ? map
              : { mapImageUrl: '', mapImageSize: { w: 0, h: 0 } },
          writes: { ...writes(), onUnavailable },
          decode,
        }),
      { initialProps: { viewport: first } }
    );
    await act(async () => {});
    expect(decode).toHaveBeenCalledTimes(1);
    rerender({ viewport: second });
    await act(async () => {
      probe.reject(new Error('404'));
      await Promise.resolve();
    });
    expect(onUnavailable).not.toHaveBeenCalled();

    const late = deferred<{ w: number; h: number }>();
    const third = { store: new ElementStore() };
    const fourth = { store: new ElementStore() };
    const { rerender: switchAgain } = renderHook(
      ({ viewport }: { viewport: { store: ElementStore } }) =>
        useEnsureSceneMapImage({
          viewport,
          relayConfigured: false,
          relayStatus: 'connecting',
          map:
            viewport === third
              ? map
              : { mapImageUrl: '', mapImageSize: { w: 0, h: 0 } },
          writes: writes(),
          decode: () => late.promise,
        }),
      { initialProps: { viewport: third } }
    );
    await act(async () => {});
    switchAgain({ viewport: fourth });
    await act(async () => {
      late.resolve({ w: 10, h: 10 });
      await Promise.resolve();
    });
    expect(images(third.store)).toEqual([]);
  });
});
