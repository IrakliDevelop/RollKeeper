import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { Camera } from '@fieldnotes/core';
import { IDBFactory } from 'fake-indexeddb';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { registryServer } from '@/lib/table/controlServer.fixture';
import { TableRepository } from '@/lib/table/repository';
import type { TableSceneAdapter } from '@/lib/table/sceneAdapter';
import type {
  TableActorRecordV1,
  TableSceneRecordV1,
} from '@/lib/table/schema';

const AT = '2026-10-08T00:00:00.000Z';

const nav = vi.hoisted(() => {
  let entries = [''];
  let index = 0;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach(listener => listener());
  const searchOf = (href: string) => {
    const at = href.indexOf('?');
    return at === -1 ? '' : href.slice(at + 1);
  };
  return {
    search: () => entries[index]!,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    push: vi.fn((href: string) => {
      entries = entries.slice(0, index + 1);
      entries.push(searchOf(href));
      index += 1;
      emit();
    }),
    replace: vi.fn((href: string) => {
      entries[index] = searchOf(href);
      emit();
    }),
    back: () => {
      index = Math.max(0, index - 1);
      emit();
    },
    reset: (search: string) => {
      entries = [search];
      index = 0;
    },
  };
});

const mocks = vi.hoisted(() => ({
  repository: null as unknown,
  canvasMounts: 0,
  canvasUnmounts: 0,
  canvasProps: [] as Array<Record<string, unknown>>,
  combatMounts: 0,
  combatProps: [] as Array<Record<string, unknown>>,
  adapters: [] as Array<{
    adapter: TableSceneAdapter;
    disposed: number;
    flushes: number;
  }>,
  adapterOverride: null as null | ((adapter: TableSceneAdapter) => void),
  holds: 0,
  publishers: 0,
  viewports: new Map<string, { camera: Camera }>(),
}));

vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    useSearchParams: () =>
      new URLSearchParams(useSyncExternalStore(nav.subscribe, nav.search)),
    useRouter: () => ({ push: nav.push, replace: nav.replace }),
  };
});
vi.mock(
  '@/components/ui/campaign/table/useAuthenticatedTableWorkspace',
  async () => {
    const { useEffect, useState } = await import('react');
    return {
      useAuthenticatedTableWorkspace: () => {
        const repository = mocks.repository as TableRepository;
        const [revision, setRevision] = useState(0);
        useEffect(
          () => repository.subscribe(() => setRevision(value => value + 1)),
          [repository]
        );
        return { repository, revision, loading: false, error: null };
      },
    };
  }
);
vi.mock('@/store/dmStore', () => ({
  useDmStore: (selector: (state: { dmId: string }) => unknown) =>
    selector({ dmId: 'dm-1' }),
}));
vi.mock('@/lib/table/sceneAdapter', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@/lib/table/sceneAdapter')>();
  return {
    ...actual,
    createTableSceneAdapter: (
      options: Parameters<typeof actual.createTableSceneAdapter>[0]
    ) => {
      const adapter = actual.createTableSceneAdapter(options);
      const entry = { adapter, disposed: 0, flushes: 0 };
      const dispose = adapter.dispose;
      adapter.dispose = () => {
        entry.disposed += 1;
        dispose();
      };
      const flush = adapter.flush;
      adapter.flush = () => {
        entry.flushes += 1;
        return flush();
      };
      mocks.adapters.push(entry);
      mocks.adapterOverride?.(adapter);
      return adapter;
    },
  };
});
vi.mock('@/lib/table/combatPublisher', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@/lib/table/combatPublisher')>();
  return {
    ...actual,
    createCombatPublisher: (
      options: Parameters<typeof actual.createCombatPublisher>[0]
    ) => {
      mocks.publishers += 1;
      const publisher = actual.createCombatPublisher(options);
      const hold = publisher.hold.bind(publisher);
      publisher.hold = () => {
        mocks.holds += 1;
        hold();
      };
      return publisher;
    },
  };
});
vi.mock('@/components/ui/campaign/dm-vtt/DmBattleMapCanvas', async () => {
  const { useEffect } = await import('react');
  return {
    DmBattleMapCanvas: (props: {
      battleMapId: string;
      sessionControls: ReactNode;
      children?: ReactNode;
      onViewportReady?: (viewport: unknown) => void;
      onStatus?: (status: string) => void;
    }) => {
      mocks.canvasProps.push(props as unknown as Record<string, unknown>);
      const { battleMapId, onViewportReady } = props;
      useEffect(() => {
        mocks.canvasMounts += 1;
        // A real core camera behind a minimal viewport surface.
        const camera = new Camera();
        const viewport = {
          camera,
          getVisibleRect: () => camera.getVisibleRect(800, 600),
          getCanvasSize: () => ({ w: 800, h: 600 }),
          requestRender: () => {},
        };
        mocks.viewports.set(battleMapId, viewport);
        onViewportReady?.(viewport);
        return () => {
          mocks.canvasUnmounts += 1;
        };
      }, [battleMapId, onViewportReady]);
      return (
        <div data-testid="canvas" data-scene={battleMapId}>
          {props.sessionControls}
          {props.children}
        </div>
      );
    },
  };
});
vi.mock('@/components/ui/campaign/table/combat/TableCombatPanel', async () => {
  const { useEffect } = await import('react');
  return {
    TableCombatPanel: (props: Record<string, unknown>) => {
      mocks.combatProps.push(props);
      useEffect(() => {
        mocks.combatMounts += 1;
      }, []);
      return (
        <div data-testid="table-combat" data-scene={String(props.sceneId)} />
      );
    },
  };
});
vi.mock('@/components/ui/campaign/table/TableRosterPanel', () => ({
  TableRosterPanel: () => <div data-testid="table-roster" />,
}));
vi.mock('@/components/ui/campaign/dm-vtt/TokenPlacementController', () => ({
  TokenPlacementController: () => null,
}));

import { TableWorkspace } from './index';

let server: ReturnType<typeof registryServer>;
const requests: string[] = [];

function sceneRecord(
  workspaceKey: string,
  sceneId: string,
  name: string,
  members: TableSceneRecordV1['members'] = []
): TableSceneRecordV1 {
  return {
    schemaVersion: 1,
    workspaceKey,
    sceneId,
    originalMapId: null,
    map: {
      name,
      mapImageUrl: '',
      mapImageSize: { w: 0, h: 0 },
      gridEnabled: false,
      gridSettings: null,
      markers: [],
      dmOnlyElements: {},
    },
    canvasCheckpoint: null,
    members,
    arrivalPoint: null,
    createdAt: AT,
    updatedAt: AT,
  };
}

function actor(workspaceKey: string, actorId: string): TableActorRecordV1 {
  return {
    schemaVersion: 1,
    workspaceKey,
    actorId,
    actorKind: 'dm-managed',
    liveStats: {
      name: actorId,
      currentHp: 5,
      maxHp: 5,
      tempHp: 0,
      armorClass: 10,
      conditions: [],
    },
    playerReference: null,
    cachedPlayerData: null,
    playerConditionOverlay: null,
    createdAt: AT,
    updatedAt: AT,
  };
}

async function seedRepository() {
  const repository = new TableRepository({
    factory: new IDBFactory(),
    selection: {
      account: { kind: 'guest' },
      workspace: {
        localWorkspaceId: 'workspace-1',
        sourceCampaignCode: 'CAMP',
        routeCampaignCode: 'CAMP',
      },
    },
    broadcastChannel: null,
    events: null,
  });
  await repository.start();
  const key = repository.workspaceIdentity;
  const actors = Array.from({ length: 100 }, (_, index) =>
    actor(key, `actor-${index}`)
  );
  const seeded = await repository.mutateWorkspace(0, 'seed', {
    scenes: {
      put: [
        sceneRecord(key, 'scene-tavern', 'Tavern'),
        sceneRecord(
          key,
          'scene-big',
          'Big battle',
          actors.map((value, index) => ({
            actorId: value.actorId,
            tokenIds: [],
            sceneMemberId: `member-${index}`,
          }))
        ),
        sceneRecord(key, 'scene-forest', 'Forest'),
      ],
    },
    actors: { put: actors },
    encounters: {
      put: [
        {
          schemaVersion: 1,
          workspaceKey: key,
          runId: 'run-tavern',
          sceneId: 'scene-tavern',
          sourceEncounterId: null,
          runGeneration: 'run-tavern',
          participants: [],
          round: 0,
          currentActorId: null,
          isActive: false,
          createdAt: AT,
          updatedAt: AT,
          label: 'Bar fight',
        },
      ],
    },
  });
  if (seeded.status !== 'committed') throw new Error(JSON.stringify(seeded));
  return repository;
}

function routeFetch() {
  return vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    requests.push(`${init?.method ?? 'GET'} ${url}`);
    if (url.includes('/table/control') || url.includes('/authority/'))
      return server.fetcher(input, init);
    if (url.includes('/table/display/status'))
      return Response.json({ state: 'none', sceneId: null, ageMs: null });
    if (url.includes('/players')) return Response.json({ players: [] });
    return Response.json({});
  });
}

const presentationCommands = () =>
  server.commands.filter(command =>
    ['show', 'blank', 'unpresent', 'deletePresented'].includes(
      String(command.type)
    )
  );

const canvasScene = () => screen.queryByTestId('canvas')?.dataset.scene;

async function navigate(search: string) {
  await act(async () => {
    nav.push(`/dm/campaign/CAMP/table?${search}`);
  });
}

async function settled(sceneId: string) {
  await waitFor(() => expect(canvasScene()).toBe(sceneId));
  await waitFor(() =>
    expect(screen.queryByText('Switching scene…')).not.toBeInTheDocument()
  );
}

let repository: TableRepository;

beforeEach(async () => {
  mocks.canvasMounts = 0;
  mocks.canvasUnmounts = 0;
  mocks.canvasProps = [];
  mocks.combatMounts = 0;
  mocks.combatProps = [];
  mocks.adapters = [];
  mocks.adapterOverride = null;
  mocks.holds = 0;
  mocks.publishers = 0;
  mocks.viewports.clear();
  requests.length = 0;
  nav.push.mockClear();
  nav.replace.mockClear();
  server = registryServer();
  server.state.revision = 1;
  vi.stubGlobal('fetch', routeFetch());
  repository = await seedRepository();
  mocks.repository = repository;
});

afterEach(() => {
  cleanup();
  repository.dispose();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('W1 canonical selection', () => {
  it('opens ?scene= privately: one canvas, the scene registered, nothing presented', async () => {
    nav.reset('scene=scene-tavern');
    render(<TableWorkspace campaignCode="CAMP" />);
    await settled('scene-tavern');
    await waitFor(() =>
      expect(
        server.commands.filter(command => command.type === 'registerScene')
      ).toHaveLength(1)
    );
    expect(
      screen.getByText('Saved on this device — scene runs are local')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /back to campaign/i })
    ).toHaveAttribute('href', '/dm/campaign/CAMP');
    expect(presentationCommands()).toEqual([]);
  });

  it('shows a neutral notice for an unknown scene and prepares nothing', async () => {
    nav.reset('scene=scene-elsewhere');
    render(<TableWorkspace campaignCode="CAMP" />);
    expect(
      await screen.findByText('That scene is not available in this workspace')
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(server.commands.filter(c => c.type === 'acquire')).toHaveLength(1)
    );
    expect(canvasScene()).toBeUndefined();
    expect(
      server.commands.filter(command => command.type === 'registerScene')
    ).toEqual([]);
    expect(mocks.adapters).toHaveLength(0);
    expect(presentationCommands()).toEqual([]);
  });

  it('drops a run that is not in the selected scene with a replace', async () => {
    nav.reset('scene=scene-forest&run=run-tavern');
    render(<TableWorkspace campaignCode="CAMP" />);
    await settled('scene-forest');
    await waitFor(() =>
      expect(nav.replace).toHaveBeenCalledWith(
        '/dm/campaign/CAMP/table?scene=scene-forest',
        { scroll: false }
      )
    );
    expect(nav.push).not.toHaveBeenCalled();
    expect(mocks.combatProps.at(-1)?.requestedRunId ?? null).toBeNull();
  });

  it('passes a run of the selected scene to its combat panel', async () => {
    nav.reset('scene=scene-tavern&run=run-tavern');
    render(<TableWorkspace campaignCode="CAMP" />);
    await settled('scene-tavern');
    expect(mocks.combatProps.at(-1)).toMatchObject({
      sceneId: 'scene-tavern',
      requestedRunId: 'run-tavern',
    });
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('refuses an imported workspace that is not bound to this campaign route', async () => {
    const other = new TableRepository({
      factory: new IDBFactory(),
      selection: {
        account: { kind: 'guest' },
        workspace: {
          localWorkspaceId: 'imported-x',
          sourceCampaignCode: null,
          routeCampaignCode: 'OTHER',
        },
      },
      broadcastChannel: null,
      events: null,
    });
    await other.start();
    mocks.repository = other;
    nav.reset('scene=scene-tavern&tableWorkspace=imported-x');
    render(<TableWorkspace campaignCode="CAMP" />);
    expect(
      await screen.findByText(/not bound to this campaign route/u)
    ).toBeInTheDocument();
    expect(server.commands).toEqual([]);
    expect(
      requests.filter(request => request.includes('/table/control'))
    ).toEqual([]);
    other.dispose();
  });
});

describe('W3/W4 lifecycle (D8)', () => {
  it('switches 30 times with a 100-member scene on one session, publisher and display poll', async () => {
    const created = vi.spyOn(globalThis, 'setInterval');
    const cleared = vi.spyOn(globalThis, 'clearInterval');
    const windowAdd = vi.spyOn(window, 'addEventListener');
    const windowRemove = vi.spyOn(window, 'removeEventListener');
    const documentAdd = vi.spyOn(document, 'addEventListener');
    const documentRemove = vi.spyOn(document, 'removeEventListener');
    nav.reset('scene=scene-tavern');
    const view = render(<TableWorkspace campaignCode="CAMP" />);
    await settled('scene-tavern');
    await waitFor(() =>
      expect(screen.getByText('Live control held.')).toBeInTheDocument()
    );
    const holdsAfterAcquire = mocks.holds;
    const createdBeforeSwitches = created.mock.calls.length;
    const ids = ['scene-big', 'scene-forest', 'scene-tavern'];
    for (let index = 0; index < 30; index += 1) {
      const id = ids[index % ids.length]!;
      await navigate(`scene=${id}`);
      await settled(id);
    }
    expect(server.commands.filter(c => c.type === 'acquire')).toHaveLength(1);
    expect(
      server.commands
        .filter(command => command.type === 'registerScene')
        .map(command => command.sceneId)
    ).toEqual(['scene-tavern', 'scene-big', 'scene-forest']);
    expect(mocks.publishers).toBe(1);
    expect(mocks.holds).toBe(holdsAfterAcquire);
    expect(mocks.canvasMounts).toBe(31);
    expect(mocks.canvasUnmounts).toBe(30);
    expect(mocks.adapters).toHaveLength(31);
    expect(
      mocks.adapters.slice(0, 30).every(entry => entry.disposed === 1)
    ).toBe(true);
    expect(mocks.adapters.every(entry => entry.flushes >= 0)).toBe(true);
    expect(mocks.adapters.slice(0, 30).every(entry => entry.flushes >= 1)).toBe(
      true
    );
    // Switching creates no poll: no 5 s display-status or 10 s (renew /
    // non-holder control) interval after the steady state, and exactly one
    // of each is alive.
    const pollsAfter = created.mock.calls
      .slice(createdBeforeSwitches)
      .filter(([, delay]) => delay === 5_000 || delay === 10_000);
    expect(pollsAfter).toEqual([]);
    const aliveNow = (delay: number) => {
      const clearedIds = new Set(cleared.mock.calls.map(([id]) => id));
      return created.mock.calls.filter(
        ([, value], index) =>
          value === delay && !clearedIds.has(created.mock.results[index]!.value)
      ).length;
    };
    expect(aliveNow(5_000)).toBe(1);
    expect(aliveNow(10_000)).toBe(1);
    expect(presentationCommands()).toEqual([]);
    view.unmount();
    const createdIds = created.mock.results.map(result => result.value);
    const clearedIds = new Set(cleared.mock.calls.map(([id]) => id));
    expect(createdIds.filter(id => !clearedIds.has(id))).toEqual([]);
    // React DOM's one-time root `selectionchange` listener is not ours.
    const net = (
      add: { mock: { calls: unknown[][] } },
      remove: { mock: { calls: unknown[][] } }
    ) =>
      add.mock.calls.filter(([type]) => type !== 'selectionchange').length -
      remove.mock.calls.length;
    expect(net(windowAdd, windowRemove)).toBeLessThanOrEqual(0);
    expect(net(documentAdd, documentRemove)).toBeLessThanOrEqual(0);
  });

  it('remembers and re-applies each scene camera with the real core camera', async () => {
    nav.reset('scene=scene-tavern');
    render(<TableWorkspace campaignCode="CAMP" />);
    await settled('scene-tavern');
    const tavern = mocks.viewports.get('scene-tavern')!;
    act(() => {
      tavern.camera.setZoom(2);
      tavern.camera.moveTo(-300, -120);
    });
    const remembered = tavern.camera.getVisibleRect(800, 600);
    await navigate('scene=scene-forest');
    await settled('scene-forest');
    const forest = mocks.viewports.get('scene-forest')!;
    expect(forest.camera.zoom).toBe(1);
    await navigate('scene=scene-tavern');
    await settled('scene-tavern');
    const again = mocks.viewports.get('scene-tavern')!;
    expect(again).not.toBe(tavern);
    const restored = again.camera.getVisibleRect(800, 600);
    expect(restored.x).toBeCloseTo(remembered.x);
    expect(restored.y).toBeCloseTo(remembered.y);
    expect(restored.w).toBeCloseTo(remembered.w);
    expect(restored.h).toBeCloseTo(remembered.h);
  });

  it('blocks a switch while the scene has a pending conflict and keeps the URL', async () => {
    nav.reset('scene=scene-tavern');
    render(<TableWorkspace campaignCode="CAMP" />);
    await settled('scene-tavern');
    const entry = mocks.adapters[0]!;
    entry.adapter.getPendingConflict = () => ({
      operationId: 'op-1',
      fields: ['name'],
      createdAt: AT,
    });
    await navigate('scene=scene-forest');
    expect(
      await screen.findByText(
        'Resolve the unsaved change on Tavern before switching'
      )
    ).toBeInTheDocument();
    expect(nav.replace).toHaveBeenLastCalledWith(
      '/dm/campaign/CAMP/table?scene=scene-tavern',
      { scroll: false }
    );
    expect(canvasScene()).toBe('scene-tavern');
    expect(entry.disposed).toBe(0);
    expect(
      screen.getByRole('button', { name: 'Discard pending edit' })
    ).toBeInTheDocument();
  });

  it('keeps the scene, the conflict and the URL on Back (popstate)', async () => {
    nav.reset('scene=scene-tavern');
    render(<TableWorkspace campaignCode="CAMP" />);
    await settled('scene-tavern');
    await navigate('scene=scene-forest');
    await settled('scene-forest');
    const forest = mocks.adapters.at(-1)!;
    forest.adapter.getPendingConflict = () => ({
      operationId: 'op-2',
      fields: ['markers'],
      createdAt: AT,
    });
    await act(async () => nav.back());
    expect(
      await screen.findByText(
        'Resolve the unsaved change on Forest before switching'
      )
    ).toBeInTheDocument();
    expect(nav.replace).toHaveBeenLastCalledWith(
      '/dm/campaign/CAMP/table?scene=scene-forest',
      { scroll: false }
    );
    expect(canvasScene()).toBe('scene-forest');
    expect(forest.disposed).toBe(0);
  });

  it('persists an edit made during the flush before disposing the adapter', async () => {
    nav.reset('scene=scene-tavern');
    render(<TableWorkspace campaignCode="CAMP" />);
    await settled('scene-tavern');
    const entry = mocks.adapters[0]!;
    const flush = entry.adapter.flush;
    let edited = false;
    entry.adapter.flush = async () => {
      if (!edited) {
        edited = true;
        entry.adapter.updateBattleMap({
          cameraViews: [
            { id: 'v1', name: 'Bar', view: { x: 1, y: 2, w: 3, h: 4 } },
          ],
        });
      }
      await flush();
    };
    await navigate('scene=scene-forest');
    await settled('scene-forest');
    expect(entry.disposed).toBe(1);
    const current = repository.getCurrent();
    if (current?.status !== 'ready') throw new Error('not ready');
    expect(
      current.snapshot.scenes.find(scene => scene.sceneId === 'scene-tavern')
        ?.map.cameraViews
    ).toEqual([{ id: 'v1', name: 'Bar', view: { x: 1, y: 2, w: 3, h: 4 } }]);
  });

  it('keeps the scene with "Still saving" when edits never settle', async () => {
    nav.reset('scene=scene-tavern');
    render(<TableWorkspace campaignCode="CAMP" />);
    await settled('scene-tavern');
    const entry = mocks.adapters[0]!;
    let generation = 0;
    entry.adapter.getLocalEditGeneration = () => (generation += 1);
    await navigate('scene=scene-forest');
    expect(
      await screen.findByText('Still saving Tavern — try again')
    ).toBeInTheDocument();
    expect(canvasScene()).toBe('scene-tavern');
    expect(entry.disposed).toBe(0);
    expect(
      screen.queryByRole('button', { name: 'Discard pending edit' })
    ).not.toBeInTheDocument();
  });

  it('keeps canvas and combat mounted when control is lost (R2-3)', async () => {
    nav.reset('scene=scene-tavern');
    render(<TableWorkspace campaignCode="CAMP" />);
    await settled('scene-tavern');
    await waitFor(() =>
      expect(screen.getByText('Live control held.')).toBeInTheDocument()
    );
    const mounts = mocks.canvasMounts;
    const combat = mocks.combatMounts;
    server.other('takeover', 'other-session');
    await navigate('scene=scene-forest');
    await settled('scene-forest');
    expect(
      await screen.findByText(
        /Another session holds live control|Live control lost/u
      )
    ).toBeInTheDocument();
    expect(screen.getByTestId('table-combat')).toBeInTheDocument();
    expect(mocks.canvasMounts).toBe(mounts + 1);
    expect(mocks.combatMounts).toBe(combat + 1);
    expect(server.commands.filter(c => c.type === 'acquire')).toHaveLength(1);
  });

  it('mounts locally while another session holds control and remounts once after an explicit acquire', async () => {
    server.other('acquire', 'other-session');
    // The foreign lease is about to expire (the Acquire countdown).
    server.state.leaseUntil = Date.now() + 1_200;
    nav.reset('scene=scene-forest');
    render(<TableWorkspace campaignCode="CAMP" />);
    await settled('scene-forest');
    expect(
      await screen.findByText(/Another session holds live control/u)
    ).toBeInTheDocument();
    const posts = server.commands.length;
    await navigate('scene=scene-tavern');
    await settled('scene-tavern');
    expect(server.commands).toHaveLength(posts);
    const mounts = mocks.canvasMounts;
    const acquire = screen.getByRole('button', {
      name: /Acquire live control/u,
    });
    await waitFor(() => expect(acquire).toBeEnabled(), { timeout: 3_000 });
    fireEvent.click(acquire);
    await waitFor(() =>
      expect(screen.getByText('Live control held.')).toBeInTheDocument()
    );
    await waitFor(() => expect(mocks.canvasMounts).toBe(mounts + 1));
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });
    // Registered first, then exactly one remount (C6-2).
    expect(mocks.canvasMounts).toBe(mounts + 1);
    expect(
      server.commands.filter(command => command.type === 'registerScene')
    ).toHaveLength(1);
    expect(server.commands.filter(c => c.type === 'takeover')).toHaveLength(0);
  });

  it('disables "Show this scene" until the selected scene is registered', async () => {
    nav.reset('scene=scene-tavern');
    render(<TableWorkspace campaignCode="CAMP" />);
    await settled('scene-tavern');
    const show = await screen.findByRole('button', { name: 'Show this scene' });
    await waitFor(() => expect(show).toBeEnabled());
    expect(presentationCommands()).toEqual([]);
  });
});
