import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ElementStore } from '@fieldnotes/core';
import { FogManager } from '@fieldnotes/vtt';

import type { ManagedConnectionOptions } from '@/lib/battlemapSync';
import type { TableDisplayDeps } from '@/components/ui/campaign/table/display/tableDisplayController';
import {
  DISPLAY_EXPIRED,
  DISPLAY_IN_USE,
  DISPLAY_NOTHING_SHOWN,
  DISPLAY_WAITING,
} from '@/components/ui/campaign/table/display/displayMessages';
import { displayStorageKey } from '@/components/ui/campaign/table/display/displayCredentialStore';

/**
 * PR05 E8 (R4-F3, C5-4, C5-6) map-pinned display under Table v1: the old
 * `?dk=` URL is consumed into this tab's session storage and scrubbed
 * before any request, the descriptor binds the nonce before any mint, and
 * the page shows only a presented scene adopted from THIS map; anything
 * else is the neutral cover. Same E9 attach rules as the campaign shell.
 */
const hoisted = vi.hoisted(() => ({
  deps: null as unknown,
  viewports: [] as unknown[],
  mounts: 0,
}));
vi.mock('next/navigation', async importOriginal => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useParams: () => ({ code: 'CAMP01', id: 'map-m' }),
  useSearchParams: () => {
    throw new Error('the page must not read the credential from the query');
  },
}));
vi.mock('@fieldnotes/react', () => ({
  FieldNotesCanvas: (props: { onReady: (vp: unknown) => void }) => {
    React.useEffect(() => {
      hoisted.mounts += 1;
      const hooks = new Set<{ afterAll?: () => void }>();
      const vp = {
        store: new ElementStore(),
        hooks,
        renderHooks: {
          viewport: {
            register(entry: { afterAll?: () => void }) {
              hooks.add(entry);
              return () => hooks.delete(entry);
            },
          },
        },
        requestRender: vi.fn(),
        frame() {
          for (const entry of [...hooks]) entry.afterAll?.();
        },
      };
      hoisted.viewports.push(vp);
      props.onReady(vp);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return null;
  },
}));
vi.mock('@/components/ui/campaign/table/display/tableDisplayDeps', () => ({
  defaultTableDisplayDeps: () => hoisted.deps,
}));
vi.mock('@/components/ui/campaign/location-map/useMarkerRegistration', () => ({
  useMarkerRegistration: vi.fn(),
}));
const helpers = vi.hoisted(() => ({
  focus: vi.fn(),
  awareness: vi.fn(),
}));
vi.mock('@/components/ui/campaign/location-map/focusSync', () => ({
  attachFocusReceiver: helpers.focus,
}));
vi.mock('@/components/ui/campaign/location-map/awarenessSync', () => ({
  attachAwarenessSync: helpers.awareness,
}));

import BattleMapDisplayPage from '../page';

const CAPABILITY = 'Cap5Synthetic_display-capability_0123456789';
const EPOCH = '19a12345-1234-4123-8123-123456789abc';
const PATH = '/dm/campaign/CAMP01/battlemaps/map-m/display';

type Descriptor = {
  displayGeneration: number;
  epoch: string;
  presentation: { sceneId: string | null; revision: number; blanked: boolean };
  scene: { sceneId: string; sourceMapId: string; label: string } | null;
};
const presented = (sceneId: string, sourceMapId: string, revision: number) =>
  ({
    displayGeneration: 3,
    epoch: EPOCH,
    presentation: { sceneId, revision, blanked: false },
    scene: { sceneId, sourceMapId, label: 'Label' },
  }) satisfies Descriptor;
const nothing = (revision: number, blanked = false): Descriptor => ({
  displayGeneration: 3,
  epoch: EPOCH,
  presentation: { sceneId: null, revision, blanked },
  scene: null,
});

let current: Descriptor | Response;
let connections: Array<{
  options: ManagedConnectionOptions;
  stop: ReturnType<typeof vi.fn>;
}>;
let calls: string[];
let deps: TableDisplayDeps;

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
  });
  process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED = 'true';
  process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL = 'wss://relay.test';
  window.sessionStorage.clear();
  window.history.replaceState(null, '', `${PATH}?dk=${CAPABILITY}`);
  hoisted.viewports = [];
  hoisted.mounts = 0;
  connections = [];
  calls = [];
  current = nothing(1);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      calls.push(`${url} @ ${window.location.search}`);
      if (url.endsWith('/table/display/descriptor'))
        return current instanceof Response
          ? current
          : new Response(JSON.stringify(current));
      return new Response(JSON.stringify({ receivedAt: 1 }));
    })
  );
  deps = {
    createConnection: vi.fn((options: ManagedConnectionOptions) => {
      const connection = { options, stop: vi.fn() };
      connections.push(connection);
      return connection as never;
    }),
    prepareViewport: vi.fn(),
    startFogAppearance: vi.fn(() => () => {}),
    captureView: vi.fn(() => ({ x: 0, y: 0, w: 1, h: 1 })),
    applyView: vi.fn(),
    fitView: vi.fn(),
    createFogPlugin: vi.fn(() => ({ manager: new FogManager() }) as never),
  };
  hoisted.deps = deps;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED;
  delete process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;
  window.history.replaceState(null, '', '/');
});

const cover = () =>
  screen.queryByTestId('table-display-cover')?.textContent ?? null;
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}
async function goLive() {
  const connection = connections.at(-1)!;
  const vp = hoisted.viewports.at(-1) as { frame(): void };
  await act(async () => {
    connection.options.onStatus?.('live');
    connection.options.fog!.manager.loadState(null, { origin: 'remote' });
  });
  await advance(0);
  await act(async () => vp.frame());
  await act(async () => vp.frame());
}

describe('map-pinned display under Table v1 (E8 outcome matrix)', () => {
  it('scrubs ?dk before the first request, binds via the descriptor and never mints first', async () => {
    render(<BattleMapDisplayPage />);
    await advance(0);
    expect(window.location.search).toBe('');
    expect(calls[0]).toBe('/api/campaign/CAMP01/table/display/descriptor @ ');
    expect(calls.some(call => call.includes('battlemap-token'))).toBe(false);
    const stored = JSON.parse(
      window.sessionStorage.getItem(displayStorageKey('CAMP01'))!
    );
    expect(stored.capability).toBe(CAPABILITY);
  });

  it('a pre-PR05 UUID key is expired without any request', async () => {
    window.history.replaceState(
      null,
      '',
      `${PATH}?dk=123e4567-e89b-42d3-a456-426614174000`
    );
    render(<BattleMapDisplayPage />);
    await advance(10_000);
    expect(cover()).toBe(DISPLAY_EXPIRED);
    expect(calls).toEqual([]);
    expect(window.location.search).toBe('');
  });

  it('a link bound by another screen shows the in-use text', async () => {
    current = new Response(
      JSON.stringify({ error: 'Display link is in use on another screen' }),
      { status: 403 }
    );
    render(<BattleMapDisplayPage />);
    await advance(0);
    expect(cover()).toBe(DISPLAY_IN_USE);
  });

  it.each([
    ['nothing shown', nothing(2)],
    ['blanked', nothing(2, true)],
    ['another map presented', presented('scene-x', 'map-x', 2)],
  ])('%s is the neutral cover with no connection', async (_label, value) => {
    current = value;
    render(<BattleMapDisplayPage />);
    await advance(0);
    expect(cover()).toBe(DISPLAY_NOTHING_SHOWN);
    expect(connections).toHaveLength(0);
  });

  it("shows this map's presented scene, then covers and tears down when it switches away (C5-6)", async () => {
    current = presented('scene-m', 'map-m', 2);
    render(<BattleMapDisplayPage />);
    await advance(0);
    expect(cover()).toBe(DISPLAY_WAITING);
    expect(connections[0]!.options.tokenRequest).toEqual({
      role: 'display',
      battleMapId: 'map-m',
      sceneId: 'scene-m',
      displayCapability: CAPABILITY,
      displaySession: expect.stringMatching(/^[A-Za-z0-9_-]{22}$/u),
    });
    await goLive();
    expect(cover()).toBeNull();
    current = presented('scene-x', 'map-x', 3);
    await advance(2_000);
    expect(cover()).toBe(DISPLAY_NOTHING_SHOWN);
    expect(connections[0]!.stop).toHaveBeenCalledTimes(1);
    const vp = hoisted.viewports[0] as { hooks: Set<unknown> };
    expect(vp.hooks.size).toBe(0);
    expect(connections).toHaveLength(1);
    current = presented('scene-m', 'map-m', 4);
    await advance(2_000);
    expect(connections).toHaveLength(2);
    expect(hoisted.mounts).toBe(2);
  });

  it('polls fog appearance for the scene id with header credentials (C5-2)', async () => {
    current = presented('scene-m', 'map-m', 2);
    render(<BattleMapDisplayPage />);
    await advance(0);
    await act(async () =>
      connections[0]!.options.onTokenMetadata?.({
        fogAppearance: 'cloudy',
        fogAppearanceUpdatedAt: '2026-10-07T00:00:00.000Z',
      })
    );
    const [, url, init, initial] = vi.mocked(deps.startFogAppearance).mock
      .calls[0]!;
    expect(url).toBe(
      '/api/campaign/CAMP01/battlemaps/scene-m/fog-appearance?role=display'
    );
    expect(init).toEqual({
      headers: {
        'x-rollkeeper-display-capability': CAPABILITY,
        'x-rollkeeper-display-session': expect.any(String),
        'x-rollkeeper-csrf': '1',
      },
    });
    expect(initial).toEqual({
      fogAppearance: 'cloudy',
      updatedAt: '2026-10-07T00:00:00.000Z',
    });
  });

  it('mounts no focus receiver or awareness and fits only once (E11)', async () => {
    current = presented('scene-m', 'map-m', 2);
    render(<BattleMapDisplayPage />);
    await advance(0);
    await goLive();
    for (let index = 0; index < 3; index += 1) {
      await act(async () => connections[0]!.options.onStatus?.('live'));
      await advance(0);
    }
    expect(deps.fitView).toHaveBeenCalledTimes(1);
    expect(helpers.focus).not.toHaveBeenCalled();
    expect(helpers.awareness).not.toHaveBeenCalled();
  });
});

describe('map-pinned display recovery (R3-1)', () => {
  it('retries a withdrawn attach on a 1/2/4/8/15/15 s schedule while covered', async () => {
    current = presented('scene-m', 'map-m', 2);
    render(<BattleMapDisplayPage />);
    await advance(0);
    const delays: number[] = [];
    for (let index = 0; index < 6; index += 1) {
      const before = connections.length;
      await act(async () => connections.at(-1)!.options.onStatus?.('denied'));
      let waited = 0;
      while (connections.length === before && waited < 20_000) {
        await advance(500);
        waited += 500;
      }
      delays.push(waited);
      expect(cover()).toBe(DISPLAY_WAITING);
    }
    expect(delays).toEqual([1_000, 2_000, 4_000, 8_000, 15_000, 15_000]);
  });

  it('disposes a pending retry on unmount: no new connection, no live timer', async () => {
    current = presented('scene-m', 'map-m', 2);
    const { unmount } = render(<BattleMapDisplayPage />);
    await advance(0);
    await act(async () => connections[0]!.options.onStatus?.('denied'));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    await advance(60_000);
    expect(connections).toHaveLength(1);
    expect(connections[0]!.stop).toHaveBeenCalledTimes(1);
  });
});
