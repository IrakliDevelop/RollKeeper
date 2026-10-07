import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ElementStore } from '@fieldnotes/core';
import { FogManager } from '@fieldnotes/vtt';

import { TableDisplayShell } from '../TableDisplayShell';
import type { TableDisplayDeps } from '../tableDisplayController';
import { displayStorageKey } from '../displayCredentialStore';
import {
  DISPLAY_EXPIRED,
  DISPLAY_IN_USE,
  DISPLAY_WAITING,
} from '../displayMessages';
import type { ManagedConnectionOptions } from '@/lib/battlemapSync';

const canvas = vi.hoisted(() => ({
  mounts: 0,
  unmounts: 0,
  plugins: [] as unknown[],
  viewports: [] as unknown[],
  make: null as null | (() => unknown),
}));
vi.mock('@fieldnotes/react', () => ({
  FieldNotesCanvas: (props: {
    onReady: (vp: unknown) => void;
    options: { plugins: unknown[] };
  }) => {
    React.useEffect(() => {
      canvas.mounts += 1;
      canvas.plugins.push(props.options.plugins[0]);
      const vp = canvas.make!();
      canvas.viewports.push(vp);
      props.onReady(vp);
      return () => {
        canvas.unmounts += 1;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return null;
  },
}));
const markers = vi.hoisted(() => ({ register: vi.fn() }));
vi.mock('@/components/ui/campaign/location-map/useMarkerRegistration', () => ({
  useMarkerRegistration: markers.register,
}));
const focus = vi.hoisted(() => ({ attach: vi.fn() }));
vi.mock('@/components/ui/campaign/location-map/focusSync', () => ({
  attachFocusReceiver: focus.attach,
}));

const CODE = 'CAMP1';
const CAPABILITY = 'Cap5Synthetic_display-capability_0123456789';
const NONCE = 'Nonce5Synthetic_012345';
const EPOCH = '19a12345-1234-4123-8123-123456789abc';

interface FakeViewport {
  store: ElementStore;
  hooks: Set<{ afterAll?: () => void }>;
  renderHooks: {
    viewport: { register(hooks: { afterAll?: () => void }): () => void };
  };
  requestRender: ReturnType<typeof vi.fn>;
  frame(): void;
}

function fakeViewport(): FakeViewport {
  const hooks = new Set<{ afterAll?: () => void }>();
  return {
    store: new ElementStore(),
    hooks,
    renderHooks: {
      viewport: {
        register(entry) {
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
}

interface FakeConnection {
  options: ManagedConnectionOptions;
  stop: ReturnType<typeof vi.fn>;
}

type Descriptor = {
  displayGeneration: number;
  epoch: string;
  presentation: { sceneId: string | null; revision: number; blanked: boolean };
  scene: { sceneId: string; sourceMapId: string; label: string } | null;
};

const scene = (sceneId: string, revision: number): Descriptor => ({
  displayGeneration: 7,
  epoch: EPOCH,
  presentation: { sceneId, revision, blanked: false },
  scene: {
    sceneId,
    sourceMapId: `map-${sceneId}`,
    label: sceneId === 'tavern' ? 'Tavern' : 'Forest',
  },
});
const waiting = (revision: number, blanked = false): Descriptor => ({
  displayGeneration: 7,
  epoch: EPOCH,
  presentation: { sceneId: null, revision, blanked },
  scene: null,
});

let connections: FakeConnection[];
let descriptors: Array<Descriptor | Response | Promise<Response>>;
let lastDescriptor: Descriptor;
let acks: Array<Record<string, unknown>>;
let ackReply: () => Response;
let fetchMock: ReturnType<typeof vi.fn>;
let fetchLog: Array<{ url: string; at: number; status?: number }>;
let deps: TableDisplayDeps;
let views: Map<string, unknown>;

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });

function setDescriptor(next: Descriptor) {
  lastDescriptor = next;
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'Date',
    ],
  });
  canvas.mounts = 0;
  canvas.unmounts = 0;
  canvas.plugins = [];
  canvas.viewports = [];
  canvas.make = fakeViewport;
  connections = [];
  descriptors = [];
  acks = [];
  views = new Map();
  lastDescriptor = waiting(1);
  ackReply = () => json({ receivedAt: 1 });
  fetchLog = [];
  window.sessionStorage.clear();
  window.sessionStorage.setItem(
    displayStorageKey(CODE),
    JSON.stringify({ capability: CAPABILITY, nonce: NONCE })
  );
  process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL = 'wss://relay.test';
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    fetchLog.push({ url, at: Date.now() });
    if (url.endsWith('/table/display/descriptor')) {
      const next = descriptors.shift();
      if (next instanceof Promise) return next;
      if (next instanceof Response) return next;
      return json(next ?? lastDescriptor);
    }
    if (url.endsWith('/table/display/ack')) {
      acks.push(JSON.parse(String(init?.body)));
      const reply = ackReply();
      fetchLog.at(-1)!.status = reply.status;
      return reply;
    }
    return json({ fogAppearance: 'solid', updatedAt: null });
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(window, 'open');
  deps = {
    createConnection: vi.fn((options: ManagedConnectionOptions) => {
      const connection = { options, stop: vi.fn() };
      connections.push(connection);
      return { ...connection, stop: connection.stop } as never;
    }),
    prepareViewport: vi.fn(),
    startFogAppearance: vi.fn(() => () => {}),
    captureView: vi.fn(() => ({ x: 1, y: 2, w: 3, h: 4 })),
    applyView: vi.fn((_vp, view) => views.set('applied', view)),
    fitView: vi.fn(),
    createFogPlugin: vi.fn(() => {
      const manager = new FogManager();
      return { manager } as never;
    }),
  };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;
});

const cover = () =>
  screen.queryByTestId('table-display-cover')?.textContent ?? null;
const descriptorCalls = () =>
  fetchMock.mock.calls.filter(call =>
    String(call[0]).endsWith('/table/display/descriptor')
  );

async function flush() {
  await act(async () => {
    for (let index = 0; index < 8; index += 1) await Promise.resolve();
  });
}
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}
async function mount() {
  render(<TableDisplayShell code={CODE} deps={deps} />);
  await flush();
}
/** Delivers live + fog checkpoint + two frames for the latest attach. */
async function goLive(connection = connections.at(-1)!, members = 0) {
  const vp = canvas.viewports.at(-1) as FakeViewport;
  await act(async () => {
    for (let index = 0; index < members; index += 1)
      vp.store.add({
        id: `member-${index}`,
        type: 'shape',
        position: { x: index, y: 0 },
        size: { w: 1, h: 1 },
      } as never);
    connection.options.onStatus?.('live');
    connection.options.fog!.manager.loadState(null, { origin: 'remote' });
  });
  await advance(0);
  await act(async () => vp.frame());
  await act(async () => vp.frame());
  await flush();
}

describe('TableDisplayShell bootstrap (E8)', () => {
  it('scrubs the fragment into sessionStorage before the first request', async () => {
    window.sessionStorage.clear();
    window.history.replaceState(
      null,
      '',
      `/table-display/${CODE}#k=${CAPABILITY}`
    );
    let hashAtFirstFetch: string | null = null;
    fetchMock.mockImplementationOnce(async () => {
      hashAtFirstFetch = window.location.hash;
      return json(waiting(1));
    });
    await mount();
    expect(hashAtFirstFetch).toBe('');
    expect(window.location.href).not.toContain(CAPABILITY);
    const stored = JSON.parse(
      window.sessionStorage.getItem(displayStorageKey(CODE))!
    );
    expect(stored.capability).toBe(CAPABILITY);
    const body = JSON.parse(String(descriptorCalls()[0]![1]!.body));
    expect(body).toEqual({ capability: CAPABILITY, nonce: stored.nonce });
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({
      referrerPolicy: 'no-referrer',
    });
  });

  it('re-scrubs after a router history sync restores the fragment, before the first request (review 01 C19)', async () => {
    window.sessionStorage.clear();
    const url = `/table-display/${CODE}#k=${CAPABILITY}`;
    window.history.replaceState(null, '', url);
    const original = window.history.replaceState.bind(window.history);
    let calls = 0;
    vi.spyOn(window.history, 'replaceState').mockImplementation(
      (data, unused, next) => {
        original(data, unused, next);
        // The first (hydration-time) scrub is undone by a router sync.
        if ((calls += 1) === 1) original(null, '', url);
      }
    );
    let hashAtFirstFetch: string | null = null;
    fetchMock.mockImplementationOnce(async () => {
      hashAtFirstFetch = window.location.hash;
      return json(waiting(1));
    });
    await mount();
    expect(window.location.hash).toBe('');
    expect(hashAtFirstFetch).toBe('');
  });

  it('reuses the stored nonce on reload and asks for Open display without any credential', async () => {
    await mount();
    expect(JSON.parse(String(descriptorCalls()[0]![1]!.body)).nonce).toBe(
      NONCE
    );
    cleanup();
    window.sessionStorage.clear();
    fetchMock.mockClear();
    await mount();
    expect(cover()).toBe('Open the display from the DM screen (Open display)');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows a notice and keeps an in-memory credential when sessionStorage is blocked', async () => {
    window.history.replaceState(
      null,
      '',
      `/table-display/${CODE}#k=${CAPABILITY}`
    );
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    await mount();
    expect(screen.getByTestId('table-display-notice').textContent).toBe(
      'This browser blocks session storage — reloading will need Open display again'
    );
    expect(descriptorCalls()).toHaveLength(1);
  });

  it('clears storage and covers with the exact text only on credential 403 bodies', async () => {
    descriptors.push(json({ error: 'Scene is unavailable' }, 403));
    descriptors.push(json({ error: 'stale' }, 409));
    descriptors.push(json({ error: 'Live authority is unavailable' }, 503));
    await mount();
    await advance(2_000);
    await advance(2_000);
    expect(
      window.sessionStorage.getItem(displayStorageKey(CODE))
    ).not.toBeNull();
    expect(cover()).toBe(DISPLAY_WAITING);
    descriptors.push(json({ error: 'Display link expired' }, 403));
    await advance(2_000);
    expect(cover()).toBe(DISPLAY_EXPIRED);
    expect(window.sessionStorage.getItem(displayStorageKey(CODE))).toBeNull();
    const calls = descriptorCalls().length;
    await advance(30_000);
    expect(descriptorCalls()).toHaveLength(calls);
  });

  it('shows the in-use text for a second screen', async () => {
    descriptors.push(
      json({ error: 'Display link is in use on another screen' }, 403)
    );
    await mount();
    expect(cover()).toBe(DISPLAY_IN_USE);
  });
});

describe('TableDisplayShell descriptor following (E9, E10)', () => {
  it('follows waiting → Tavern → Forest → blank in one tab with ACKs bound to each tuple', async () => {
    await mount();
    expect(cover()).toBe(DISPLAY_WAITING);
    expect(acks.at(-1)!.ack).toEqual({
      displayGeneration: 7,
      epoch: EPOCH,
      presentationRevision: 1,
      sceneId: null,
      blanked: false,
      phase: 'blank',
    });
    setDescriptor(scene('tavern', 2));
    await advance(2_000);
    expect(cover()).toBe(DISPLAY_WAITING);
    expect(connections).toHaveLength(1);
    expect(connections[0]!.options.tokenRequest).toEqual({
      role: 'display',
      battleMapId: 'map-tavern',
      sceneId: 'tavern',
      displayCapability: CAPABILITY,
      displaySession: NONCE,
    });
    expect(connections[0]!.options.battleMapId).toBe('map-tavern');
    expect(connections[0]!.options.clientId).toBe(`display-${CODE}`);
    await goLive();
    expect(cover()).toBeNull();
    expect(acks.at(-1)!.ack).toMatchObject({
      sceneId: 'tavern',
      presentationRevision: 2,
      phase: 'loaded',
    });
    setDescriptor(scene('forest', 3));
    await advance(2_000);
    expect(cover()).toBe(DISPLAY_WAITING);
    expect(connections[0]!.stop).toHaveBeenCalledTimes(1);
    await goLive();
    expect(cover()).toBeNull();
    expect(acks.at(-1)!.ack).toMatchObject({
      sceneId: 'forest',
      phase: 'loaded',
    });
    setDescriptor(waiting(4, true));
    await advance(2_000);
    expect(cover()).toBe(DISPLAY_WAITING);
    expect(connections[1]!.stop).toHaveBeenCalledTimes(1);
    expect(acks.at(-1)!.ack).toMatchObject({
      sceneId: null,
      blanked: true,
      phase: 'blank',
      presentationRevision: 4,
    });
    expect(window.open).not.toHaveBeenCalled();
    expect(screen.queryByText(/Tavern|Forest/u)).toBeNull();
  });

  it('never shows an old scene from a late or reordered descriptor', async () => {
    let releaseSlow!: (response: Response) => void;
    descriptors.push(
      new Promise<Response>(resolve => {
        releaseSlow = resolve;
      })
    );
    setDescriptor(scene('forest', 5));
    await mount();
    // The hung first request is aborted at 5 s; the next poll follows 2 s
    // after it settles.
    await advance(5_000);
    expect(connections).toHaveLength(0);
    await advance(2_000);
    expect(connections.map(item => item.options.tokenRequest.sceneId)).toEqual([
      'forest',
    ]);
    await act(async () => releaseSlow(json(scene('tavern', 4))));
    await flush();
    descriptors.push(scene('tavern', 4));
    await advance(2_000);
    expect(connections.map(item => item.options.tokenRequest.sceneId)).toEqual([
      'forest',
    ]);
    expect(connections[0]!.stop).not.toHaveBeenCalled();
  });

  it('a slow attach superseded by a newer target never uncovers and is released', async () => {
    setDescriptor(scene('tavern', 2));
    await mount();
    const tavern = connections[0]!;
    const tavernViewport = canvas.viewports[0] as FakeViewport;
    setDescriptor(scene('forest', 3));
    await advance(2_000);
    expect(tavern.stop).toHaveBeenCalledTimes(1);
    await act(async () => {
      tavern.options.onStatus?.('live');
      tavern.options.fog!.manager.loadState(null, { origin: 'remote' });
    });
    await advance(0);
    await act(async () => tavernViewport.frame());
    await act(async () => tavernViewport.frame());
    expect(cover()).toBe(DISPLAY_WAITING);
    expect(
      acks.some(item => (item.ack as { sceneId: string }).sceneId === 'tavern')
    ).toBe(false);
    expect(tavernViewport.hooks.size).toBe(0);
  });

  it('a late status from a superseded attach never touches the current one (review 01 C11)', async () => {
    setDescriptor(scene('tavern', 2));
    await mount();
    const tavern = connections[0]!;
    setDescriptor(scene('forest', 3));
    await advance(2_000);
    await goLive();
    expect(cover()).toBeNull();
    await act(async () => tavern.options.onStatus?.('offline'));
    await act(async () => tavern.options.onStatus?.('denied'));
    await advance(20_000);
    expect(cover()).toBeNull();
    expect(connections).toHaveLength(2);
    expect(connections[1]!.stop).not.toHaveBeenCalled();
  });

  it('requires live, a later tick, fog applied and a rendered frame before uncovering and ACKing', async () => {
    setDescriptor(scene('tavern', 2));
    await mount();
    const connection = connections[0]!;
    const vp = canvas.viewports[0] as FakeViewport;
    await act(async () => connection.options.onStatus?.('live'));
    await advance(0);
    act(() => vp.frame());
    expect(cover()).toBe(DISPLAY_WAITING);
    await act(async () =>
      connection.options.fog!.manager.loadState(null, { origin: 'remote' })
    );
    await advance(0);
    expect(vp.requestRender).toHaveBeenCalled();
    expect(cover()).toBe(DISPLAY_WAITING);
    const loadedAcks = () =>
      acks.filter(item => (item.ack as { phase: string }).phase === 'loaded');
    await act(async () => vp.frame());
    expect(cover()).toBeNull();
    expect(loadedAcks()).toHaveLength(0);
    await act(async () => vp.frame());
    await flush();
    expect(loadedAcks()).toHaveLength(1);
  });

  it('sends no loaded ACK when no frame is ever rendered (hidden tab)', async () => {
    setDescriptor(scene('tavern', 2));
    await mount();
    const connection = connections[0]!;
    await act(async () => {
      connection.options.onStatus?.('live');
      connection.options.fog!.manager.loadState(null, { origin: 'remote' });
    });
    await advance(10_000);
    expect(cover()).toBe(DISPLAY_WAITING);
    expect(
      acks.filter(item => (item.ack as { phase: string }).phase === 'loaded')
    ).toHaveLength(0);
  });

  it('heartbeats every 5 s, re-ACKs revision-only changes and re-polls on 409', async () => {
    setDescriptor(scene('tavern', 2));
    await mount();
    await goLive();
    const after = acks.length;
    await advance(5_000);
    expect(acks.length).toBeGreaterThan(after);
    setDescriptor({ ...scene('tavern', 3) });
    await advance(2_000);
    expect(connections).toHaveLength(1);
    expect(acks.at(-1)!.ack).toMatchObject({
      sceneId: 'tavern',
      presentationRevision: 3,
    });
    // A revision change re-ACKs inside the poll that delivered it; a 409
    // must re-poll at once (same instant), not on the next 2 s tick.
    ackReply = () => json({ error: 'stale' }, 409);
    setDescriptor({ ...scene('tavern', 4) });
    await advance(2_000);
    await flush();
    const stale = fetchLog.findIndex(entry => entry.status === 409);
    expect(stale).toBeGreaterThanOrEqual(0);
    const delivering = fetchLog
      .slice(0, stale)
      .filter(entry => entry.url.endsWith('/table/display/descriptor'))
      .at(-1)!;
    const repoll = fetchLog
      .slice(stale + 1)
      .find(entry => entry.url.endsWith('/table/display/descriptor'));
    expect(repoll?.at).toBe(delivering.at);
  });

  it('covers on any non-live status and uncovers only after readiness again', async () => {
    setDescriptor(scene('tavern', 2));
    await mount();
    await goLive();
    const connection = connections[0]!;
    const vp = canvas.viewports[0] as FakeViewport;
    for (const status of ['recovering', 'offline'] as const) {
      await act(async () => connection.options.onStatus?.(status));
      expect(cover()).toBe(DISPLAY_WAITING);
      const heartbeats = acks.length;
      await advance(5_000);
      expect(acks.length).toBe(heartbeats);
      await act(async () => connection.options.onStatus?.('live'));
      await advance(0);
      expect(cover()).toBe(DISPLAY_WAITING);
      await act(async () => vp.frame());
      expect(cover()).toBeNull();
      await act(async () => vp.frame());
    }
  });

  it('retries a denied attach with bounded backoff while staying covered', async () => {
    setDescriptor(scene('tavern', 2));
    await mount();
    const delays: number[] = [];
    for (let index = 0; index < 6; index += 1) {
      const before = connections.length;
      await act(async () => {
        connections.at(-1)!.options.onTokenDenied?.({
          status: 403,
          error: 'Scene is unavailable',
        });
      });
      let waited = 0;
      while (connections.length === before && waited < 20_000) {
        await advance(500);
        waited += 500;
      }
      delays.push(waited);
      expect(cover()).toBe(DISPLAY_WAITING);
    }
    expect(delays).toEqual([1_000, 2_000, 4_000, 8_000, 15_000, 15_000]);
    expect(
      window.sessionStorage.getItem(displayStorageKey(CODE))
    ).not.toBeNull();
  });

  it('a credential denial on the token mint clears the credential', async () => {
    setDescriptor(scene('tavern', 2));
    await mount();
    await act(async () =>
      connections[0]!.options.onTokenDenied?.({
        status: 403,
        error: 'Display link expired',
      })
    );
    expect(cover()).toBe(DISPLAY_EXPIRED);
    expect(connections[0]!.stop).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(displayStorageKey(CODE))).toBeNull();
  });
});

describe('TableDisplayShell without a relay (review 01 F5)', () => {
  it('keeps the not-configured cover and never starts attach or retry cycles', async () => {
    delete process.env.NEXT_PUBLIC_BATTLEMAP_RELAY_URL;
    setDescriptor(scene('tavern', 2));
    await mount();
    expect(cover()).toBe('Live display is not configured');
    for (let index = 0; index < 4; index += 1) {
      await advance(15_000);
      expect(cover()).toBe('Live display is not configured');
    }
    expect(connections).toHaveLength(0);
    expect(canvas.mounts).toBe(0);
  });
});

describe('TableDisplayShell locked camera (E11)', () => {
  it('fits once per scene, restores the remembered view and never fits on later live notifications', async () => {
    setDescriptor(scene('tavern', 2));
    await mount();
    await goLive();
    expect(deps.fitView).toHaveBeenCalledTimes(1);
    await act(async () => connections[0]!.options.onStatus?.('live'));
    await advance(0);
    expect(deps.fitView).toHaveBeenCalledTimes(1);
    setDescriptor(scene('forest', 3));
    await advance(2_000);
    await goLive();
    expect(deps.fitView).toHaveBeenCalledTimes(2);
    setDescriptor(scene('tavern', 4));
    await advance(2_000);
    await goLive();
    expect(deps.fitView).toHaveBeenCalledTimes(2);
    expect(deps.applyView).toHaveBeenCalledWith(canvas.viewports.at(-1), {
      x: 1,
      y: 2,
      w: 3,
      h: 4,
    });
    expect(focus.attach).not.toHaveBeenCalled();
  });

  it('has a Fit map button that fits and auto-hides after 3 s without pointer movement', async () => {
    setDescriptor(scene('tavern', 2));
    await mount();
    await goLive();
    fireEvent.pointerMove(window);
    const button = screen.getByRole('button', { name: 'Fit map' });
    fireEvent.click(button);
    expect(deps.fitView).toHaveBeenCalledTimes(2);
    expect(deps.captureView).toHaveBeenCalled();
    await advance(3_000);
    expect(screen.queryByRole('button', { name: 'Fit map' })).toBeNull();
  });
});

describe('TableDisplayShell resource discipline', () => {
  it('30 switches with 100 members: one connection per attach, each stopped once, timers and listeners back to baseline', async () => {
    const baselineTimers = vi.getTimerCount();
    const added = vi.spyOn(window, 'addEventListener');
    const removed = vi.spyOn(window, 'removeEventListener');
    setDescriptor(scene('tavern', 1));
    await mount();
    await goLive(connections.at(-1), 100);
    for (let index = 0; index < 30; index += 1) {
      setDescriptor(scene(index % 2 === 0 ? 'forest' : 'tavern', index + 2));
      await advance(2_000);
      await goLive(connections.at(-1), 100);
      expect(cover()).toBeNull();
    }
    const fetches = descriptorCalls().length;
    expect(connections).toHaveLength(31);
    expect(canvas.mounts).toBe(31);
    expect(new Set(canvas.plugins).size).toBe(31);
    for (const connection of connections.slice(0, -1))
      expect(connection.stop).toHaveBeenCalledTimes(1);
    expect(connections.at(-1)!.stop).not.toHaveBeenCalled();
    // ~1 descriptor request per 2 s tick (30 ticks plus the first).
    expect(fetches).toBeLessThanOrEqual(33);
    cleanup();
    expect(connections.at(-1)!.stop).toHaveBeenCalledTimes(1);
    expect(canvas.unmounts).toBe(canvas.mounts);
    expect(vi.getTimerCount()).toBeLessThanOrEqual(baselineTimers);
    const count = (spy: typeof added) =>
      spy.mock.calls.reduce<Record<string, number>>((acc, call) => {
        acc[String(call[0])] = (acc[String(call[0])] ?? 0) + 1;
        return acc;
      }, {});
    expect(count(removed)).toEqual(count(added));
    for (const viewport of canvas.viewports)
      expect((viewport as FakeViewport).hooks.size).toBe(0);
  });
});
