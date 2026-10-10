import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Camera, ElementStore } from '@fieldnotes/core';
import { IDBFactory } from 'fake-indexeddb';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { registryServer } from '@/lib/table/controlServer.fixture';
import { useBattleMapStore } from '@/store/battleMapStore';
import { useCharacterStore } from '@/store/characterStore';
import { useEncounterStore } from '@/store/encounterStore';
import type { BattleMap } from '@/types/battlemap';
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
  openedWorkspaces: [] as Array<string | null>,
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
      useAuthenticatedTableWorkspace: (options: {
        localWorkspaceId?: string | null;
      }) => {
        const repository = mocks.repository as TableRepository;
        const [unknown] = useState(
          Boolean(options.localWorkspaceId) &&
            options.localWorkspaceId !==
              repository.workspaceSelection.workspace.localWorkspaceId
        );
        const [revision, setRevision] = useState(0);
        useEffect(
          () => repository.subscribe(() => setRevision(value => value + 1)),
          [repository]
        );
        mocks.openedWorkspaces.push(options.localWorkspaceId ?? null);
        return unknown
          ? {
              repository: null,
              revision,
              loading: false,
              error: 'Table workspace is unavailable',
            }
          : { repository, revision, loading: false, error: null };
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
      editMapControl?: ReactNode;
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
          store: new ElementStore(),
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
          {props.editMapControl}
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
const failControlReads = { next: 0 };

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
    if (
      url.includes('/table/control') &&
      (!init?.method || init.method === 'GET') &&
      failControlReads.next > 0
    ) {
      failControlReads.next -= 1;
      return new Response('unavailable', { status: 503 });
    }
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
  mocks.openedWorkspaces = [];
  requests.length = 0;
  failControlReads.next = 0;
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

/** Radix Popover measures with ResizeObserver/DOMRect (FC-4 precedent). */
function stubPopoverLayout() {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
}

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
    // O7-2 HR-6: the compact S1 label is always visible; the full sentence
    // is in Details.
    expect(screen.getByText('Saved on this device')).toBeVisible();
    expect(
      screen.queryByText('Scenes and fights are saved on this device only.')
    ).toBeNull();
    stubPopoverLayout();
    fireEvent.click(screen.getByRole('button', { name: /^Details/u }));
    expect(
      await screen.findByText(
        'Scenes and fights are saved on this device only.'
      )
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

describe('F2 invalid canonical parameters never open the default workspace', () => {
  it.each([
    ['over-length', 'w'.repeat(600)],
    ['control character', 'a%0Ab'],
  ])(
    'refuses a %s tableWorkspace with the not-bound notice',
    async (_l, value) => {
      nav.reset(`scene=scene-tavern&tableWorkspace=${value}`);
      render(<TableWorkspace campaignCode="CAMP" />);
      expect(
        await screen.findByText(/not bound to this campaign route/u)
      ).toBeInTheDocument();
      expect(mocks.openedWorkspaces).not.toContain(null);
      expect(canvasScene()).toBeUndefined();
      expect(server.commands).toEqual([]);
    }
  );

  it('shows the W1 notice for a present but invalid scene', async () => {
    nav.reset(`scene=${'z'.repeat(600)}`);
    render(<TableWorkspace campaignCode="CAMP" />);
    expect(
      await screen.findByText('That scene is not available in this workspace')
    ).toBeInTheDocument();
    expect(canvasScene()).toBeUndefined();
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
      expect(screen.getByText("You're live")).toBeInTheDocument()
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
      screen.getByRole('button', { name: 'Discard my edit' })
    ).toBeInTheDocument();
  });

  it('compact header: the Details popover holds secondary lines, never the conflict alert or notices (FU-5, O7-2)', async () => {
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
    const notice = await screen.findByText(
      'Resolve the unsaved change on Tavern before switching'
    );
    const details = screen.getByRole('button', { name: /^Details/u });
    expect(details).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByRole('button', { name: 'Save checkpoint' })
    ).toBeNull();
    stubPopoverLayout();
    fireEvent.click(details);
    expect(details).toHaveAttribute('aria-expanded', 'true');
    const content = await screen.findByTestId('table-header-details');
    expect(details.getAttribute('aria-controls')).toBe(content.id);
    const collapsed = (node: Element) => content.contains(node);
    const alerts = screen.getAllByRole('alert');
    expect(
      alerts.some(alert =>
        /changed in another tab or device, so your edit wasn't applied/u.test(
          alert.textContent ?? ''
        )
      )
    ).toBe(true);
    for (const alert of alerts) expect(collapsed(alert)).toBe(false);
    for (const name of [
      'Show newer version',
      'Try my edit again',
      'Discard my edit',
    ])
      expect(collapsed(screen.getByRole('button', { name }))).toBe(false);
    expect(collapsed(notice)).toBe(false);
    expect(
      collapsed(screen.getByRole('button', { name: 'Save checkpoint' }))
    ).toBe(true);
    expect(collapsed(screen.getByText('Connection', { selector: 'dt' }))).toBe(
      true
    );
    expect(collapsed(screen.getByText('Saved on this device'))).toBe(false);
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

  it('serializes requests arriving mid-switch: the latest wins after the gate (C6-4)', async () => {
    nav.reset('scene=scene-tavern');
    render(<TableWorkspace campaignCode="CAMP" />);
    await settled('scene-tavern');
    const tavern = mocks.adapters[0]!;
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const flush = tavern.adapter.flush;
    tavern.adapter.flush = async () => {
      await gate;
      await flush();
    };
    await navigate('scene=scene-big');
    await navigate('scene=scene-forest');
    expect(canvasScene()).toBe('scene-tavern');
    expect(tavern.disposed).toBe(0);
    release();
    await settled('scene-forest');
    expect(mocks.adapters.map(entry => entry.adapter.sceneId)).toEqual([
      'scene-tavern',
      'scene-forest',
    ]);
    expect(tavern.disposed).toBe(1);
  });

  it('keeps the mounted scene when the request returns to it within one flush (F4)', async () => {
    nav.reset('scene=scene-tavern');
    render(<TableWorkspace campaignCode="CAMP" />);
    await settled('scene-tavern');
    const tavern = mocks.adapters[0]!;
    const mounts = mocks.canvasMounts;
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const flush = tavern.adapter.flush;
    tavern.adapter.flush = async () => {
      await gate;
      await flush();
    };
    await navigate('scene=scene-forest');
    await navigate('scene=scene-tavern');
    release();
    await settled('scene-tavern');
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 30));
    });
    expect(mocks.adapters).toHaveLength(1);
    expect(tavern.disposed).toBe(0);
    expect(mocks.canvasMounts).toBe(mounts);
  });

  it('clears the conflict switch notice once the conflict is resolved (F5)', async () => {
    nav.reset('scene=scene-tavern');
    render(<TableWorkspace campaignCode="CAMP" />);
    await settled('scene-tavern');
    const entry = mocks.adapters[0]!;
    let pending = true;
    entry.adapter.getPendingConflict = () =>
      pending ? { operationId: 'op-1', fields: ['name'], createdAt: AT } : null;
    entry.adapter.discardPendingConflict = () => {
      pending = false;
    };
    await navigate('scene=scene-forest');
    const notice = 'Resolve the unsaved change on Tavern before switching';
    expect(await screen.findByText(notice)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Discard my edit' }));
    await waitFor(() => expect(screen.queryByText(notice)).toBeNull());
    expect(canvasScene()).toBe('scene-tavern');
  });

  it('blocks a switch while an Edit-map image replace is in flight (F9)', async () => {
    nav.reset('scene=scene-tavern');
    render(<TableWorkspace campaignCode="CAMP" />);
    await settled('scene-tavern');
    fireEvent.click(screen.getByRole('button', { name: 'Edit map' }));
    // jsdom never decodes the file: the replace stays in flight.
    fireEvent.change(screen.getByLabelText('Map image file'), {
      target: {
        files: [new File([new Uint8Array(4)], 'm.png', { type: 'image/png' })],
      },
    });
    await navigate('scene=scene-forest');
    expect(
      await screen.findByText('Still saving Tavern — try again')
    ).toBeInTheDocument();
    expect(canvasScene()).toBe('scene-tavern');
    expect(mocks.adapters[0]!.disposed).toBe(0);
  });

  it('shows "Couldn\'t load the map image." when the ensure probe fails (N4)', async () => {
    const current = repository.getCurrent();
    if (current?.status !== 'ready') throw new Error('not ready');
    await repository.mutateWorkspace(
      current.snapshot.campaign?.revision ?? 0,
      'broken-image-scene',
      {
        scenes: {
          put: [
            {
              ...sceneRecord(
                repository.workspaceIdentity,
                'scene-broken',
                'Ruins'
              ),
              map: {
                ...sceneRecord(
                  repository.workspaceIdentity,
                  'scene-broken',
                  'Ruins'
                ).map,
                mapImageUrl: 'https://expired.example.test/ruins.webp',
                mapImageSize: { w: 100, h: 100 },
              },
            },
          ],
        },
      }
    );
    class BrokenImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      crossOrigin = '';
      set src(_value: string) {
        setTimeout(() => this.onerror?.(), 0);
      }
    }
    vi.stubGlobal('Image', BrokenImage);
    nav.reset('scene=scene-broken');
    render(<TableWorkspace campaignCode="CAMP" />);
    await settled('scene-broken');
    expect(
      await screen.findByText("Couldn't load the map image.")
    ).toBeInTheDocument();
    const viewport = mocks.viewports.get('scene-broken') as unknown as {
      store: ElementStore;
    };
    expect(viewport.store.getAll()).toEqual([]);
  });

  it('offers "Try again" after a transient failure (A3)', async () => {
    nav.reset('scene=scene-tavern');
    render(<TableWorkspace campaignCode="CAMP" />);
    await settled('scene-tavern');
    await waitFor(() =>
      expect(screen.getByText("You're live")).toBeInTheDocument()
    );
    failControlReads.next = 1;
    await navigate('scene=scene-forest');
    await settled('scene-forest');
    expect(
      await screen.findByText(
        'Live registration is unavailable; this scene stays local.'
      )
    ).toBeInTheDocument();
    const registers = () =>
      server.commands.filter(
        command =>
          command.type === 'registerScene' && command.sceneId === 'scene-forest'
      ).length;
    expect(registers()).toBe(0);
    const mounts = mocks.canvasMounts;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(registers()).toBe(1));
    // The local canvas re-mints its relay token once registered.
    await waitFor(() => expect(mocks.canvasMounts).toBe(mounts + 1));
    await waitFor(() =>
      expect(
        screen.queryByText(
          'Live registration is unavailable; this scene stays local.'
        )
      ).toBeNull()
    );
    expect(server.commands.filter(c => c.type === 'acquire')).toHaveLength(1);
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
      screen.queryByRole('button', { name: 'Discard my edit' })
    ).not.toBeInTheDocument();
  });

  it('keeps canvas and combat mounted when control is lost (R2-3)', async () => {
    nav.reset('scene=scene-tavern');
    render(<TableWorkspace campaignCode="CAMP" />);
    await settled('scene-tavern');
    await waitFor(() =>
      expect(screen.getByText("You're live")).toBeInTheDocument()
    );
    const mounts = mocks.canvasMounts;
    const combat = mocks.combatMounts;
    server.other('takeover', 'other-session');
    await navigate('scene=scene-forest');
    await settled('scene-forest');
    expect(
      await screen.findByText(
        /Another tab or device is live right now|You're no longer live/u
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
      await screen.findByText(/Another tab or device is live right now/u)
    ).toBeInTheDocument();
    const posts = server.commands.length;
    await navigate('scene=scene-tavern');
    await settled('scene-tavern');
    expect(server.commands).toHaveLength(posts);
    const mounts = mocks.canvasMounts;
    const acquire = screen.getByRole('button', {
      name: /Go live/u,
    });
    await waitFor(() => expect(acquire).toBeEnabled(), { timeout: 3_000 });
    fireEvent.click(acquire);
    await waitFor(() =>
      expect(screen.getByText("You're live")).toBeInTheDocument()
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

describe('W5/W6 browser, creation and local adoption in the workspace', () => {
  const crypt = {
    id: 'map-crypt',
    campaignCode: 'CAMP',
    name: 'Crypt',
    mapImageUrl: '/maps/crypt.webp',
    mapImageSize: { w: 640, h: 480 },
    canvasState: '',
    dmOnlyElements: {},
    gridEnabled: false,
    linkedEncounterIds: [],
    markers: [],
    createdAt: AT,
    updatedAt: AT,
  } as unknown as BattleMap;

  function seedLegacyMap() {
    useBattleMapStore.setState({
      battleMaps: { CAMP: { 'map-crypt': crypt } },
    });
    window.localStorage.setItem(
      'rollkeeper-battlemap-data',
      JSON.stringify({
        state: { battleMaps: { CAMP: { 'map-crypt': crypt } } },
        version: 0,
      })
    );
    window.localStorage.setItem(
      'rollkeeper-dm-data',
      JSON.stringify({
        state: { campaigns: [{ code: 'CAMP', name: 'Camp' }] },
        version: 1,
      })
    );
  }
  afterEach(() => {
    useBattleMapStore.setState({ battleMaps: {} });
    window.localStorage.clear();
  });

  it('opens the Scenes panel from ?panel=scenes and selects privately with a push', async () => {
    nav.reset('scene=scene-tavern&panel=scenes');
    render(<TableWorkspace campaignCode="CAMP" />);
    await settled('scene-tavern');
    const panel = await screen.findByRole('region', { name: 'Scenes' });
    expect(screen.getByRole('button', { name: 'Scenes' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    fireEvent.click(within(panel).getByRole('button', { name: /Forest/u }));
    expect(nav.push).toHaveBeenCalledWith(
      '/dm/campaign/CAMP/table?scene=scene-forest',
      { scroll: false }
    );
    await settled('scene-forest');
    expect(presentationCommands()).toEqual([]);
  });

  it.each([
    [
      'Escape',
      (panel: HTMLElement) => fireEvent.keyDown(panel, { key: 'Escape' }),
    ],
    [
      'the close button',
      (panel: HTMLElement) =>
        fireEvent.click(
          within(panel).getByRole('button', { name: 'Close scenes' })
        ),
    ],
  ])(
    'returns focus to the current Scenes toggle on %s after a scene switch (FU-6)',
    async (_how, close) => {
      nav.reset('scene=scene-tavern&panel=scenes');
      render(<TableWorkspace campaignCode="CAMP" />);
      await settled('scene-tavern');
      const panel = await screen.findByRole('region', { name: 'Scenes' });
      const first = screen.getByRole('button', { name: 'Scenes' });
      fireEvent.click(within(panel).getByRole('button', { name: /Forest/u }));
      await settled('scene-forest');
      const current = screen.getByRole('button', { name: 'Scenes' });
      expect(current).not.toBe(first);
      const button = within(
        screen.getByRole('region', { name: 'Scenes' })
      ).getByRole('button', { name: /Forest/u });
      button.focus();
      close(screen.getByRole('region', { name: 'Scenes' }));
      await waitFor(() =>
        expect(
          screen.queryByRole('region', { name: 'Scenes' })
        ).not.toBeInTheDocument()
      );
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Scenes' })
      );
      expect(current.isConnected).toBe(true);
    }
  );

  it('collapses and expands panels without new subscriptions or camera/selection changes', async () => {
    nav.reset('scene=scene-tavern');
    render(<TableWorkspace campaignCode="CAMP" />);
    await settled('scene-tavern');
    const camera = mocks.viewports.get('scene-tavern')!.camera;
    act(() => camera.moveTo(-40, -30));
    const created = vi.spyOn(globalThis, 'setInterval');
    const windowAdd = vi.spyOn(window, 'addEventListener');
    const documentAdd = vi.spyOn(document, 'addEventListener');
    const mounts = mocks.canvasMounts;
    const toggle = screen.getByRole('button', { name: 'Scenes' });
    for (let index = 0; index < 10; index += 1) {
      fireEvent.click(toggle);
      fireEvent.click(toggle);
    }
    expect(created).not.toHaveBeenCalled();
    expect(windowAdd).not.toHaveBeenCalled();
    expect(documentAdd).not.toHaveBeenCalled();
    expect(mocks.canvasMounts).toBe(mounts);
    expect(camera.position).toEqual({ x: -40, y: -30 });
    expect(canvasScene()).toBe('scene-tavern');
  });

  it('creates a blank scene, selects it and registers it on the one session', async () => {
    nav.reset('scene=scene-tavern&panel=scenes');
    render(<TableWorkspace campaignCode="CAMP" />);
    await settled('scene-tavern');
    fireEvent.click(screen.getByRole('button', { name: 'New scene' }));
    fireEvent.change(await screen.findByLabelText('Scene name'), {
      target: { value: 'Swamp' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create scene' }));
    await waitFor(() =>
      expect(nav.push).toHaveBeenCalledWith(
        expect.stringMatching(/^\/dm\/campaign\/CAMP\/table\?scene=/u),
        { scroll: false }
      )
    );
    const href = nav.push.mock.calls.at(-1)![0];
    const sceneId = new URLSearchParams(href.split('?')[1]).get('scene')!;
    await settled(sceneId);
    await waitFor(() =>
      expect(
        server.commands.filter(
          command =>
            command.type === 'registerScene' && command.sceneId === sceneId
        )
      ).toHaveLength(1)
    );
    const register = server.commands.find(
      command => command.sceneId === sceneId
    )!;
    expect(register.sourceMapId).toBe(sceneId);
    expect(server.commands.filter(c => c.type === 'acquire')).toHaveLength(1);
    expect(presentationCommands()).toEqual([]);
  });

  it('adopts a never-opened battle map locally and selects it (one acquire, one register)', async () => {
    seedLegacyMap();
    nav.reset('scene=scene-tavern&panel=scenes');
    render(<TableWorkspace campaignCode="CAMP" />);
    await settled('scene-tavern');
    await waitFor(() =>
      expect(
        server.commands.filter(c => c.type === 'registerScene')
      ).toHaveLength(1)
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add Crypt' }));
    await waitFor(() => expect(nav.push).toHaveBeenCalled());
    const href = nav.push.mock.calls.at(-1)![0];
    const sceneId = new URLSearchParams(href.split('?')[1]).get('scene')!;
    await settled(sceneId);
    await waitFor(() =>
      expect(
        server.commands.filter(c => c.type === 'registerScene')
      ).toHaveLength(2)
    );
    expect(server.commands.filter(c => c.type === 'acquire')).toHaveLength(1);
    expect(server.commands.filter(c => c.type === 'renew')).toHaveLength(0);
    expect(
      server.commands.find(
        c => c.type === 'registerScene' && c.sceneId === sceneId
      )?.sourceMapId
    ).toBe('map-crypt');
  });

  it('adopts while another session holds control with zero control requests', async () => {
    seedLegacyMap();
    server.other('acquire', 'other-session');
    nav.reset('scene=scene-tavern&panel=scenes');
    render(<TableWorkspace campaignCode="CAMP" />);
    await settled('scene-tavern');
    await screen.findByText(/Another tab or device is live right now/u);
    const posts = server.commands.length;
    fireEvent.click(screen.getByRole('button', { name: 'Add Crypt' }));
    await waitFor(() => expect(nav.push).toHaveBeenCalled());
    const href = nav.push.mock.calls.at(-1)![0];
    await settled(new URLSearchParams(href.split('?')[1]).get('scene')!);
    expect(server.commands).toHaveLength(posts);
  });
});

describe('W7 encounter "Prepare on map"', () => {
  const ENCOUNTER = {
    id: 'enc-lib',
    name: 'Bandit ambush',
    campaignCode: 'CAMP',
    entities: [
      {
        id: 'e-bandit',
        type: 'monster',
        name: 'Bandit',
        initiative: null,
        initiativeModifier: 1,
        currentHp: 11,
        maxHp: 11,
        tempHp: 0,
        armorClass: 12,
        conditions: [],
      },
      {
        id: 'e-aria',
        type: 'player',
        name: 'Aria',
        initiative: null,
        initiativeModifier: 2,
        currentHp: 20,
        maxHp: 20,
        tempHp: 0,
        armorClass: 15,
        conditions: [],
      },
    ],
    currentTurn: 0,
    round: 0,
    isActive: false,
    sortOrder: 'initiative',
    createdAt: AT,
    updatedAt: AT,
  };
  beforeEach(() => {
    useCharacterStore.setState({ hasHydrated: true } as never);
    useEncounterStore.setState({ encounters: [ENCOUNTER] } as never);
  });
  afterEach(() => {
    useEncounterStore.setState({ encounters: [] } as never);
  });

  const runs = (sceneId: string) => {
    const current = repository.getCurrent();
    if (current?.status !== 'ready') throw new Error('not ready');
    return current.snapshot.encounters.filter(
      run => run.sceneId === sceneId && run.sourceEncounterId === 'enc-lib'
    );
  };

  it('copies the encounter into the chosen scene after explicit confirmation', async () => {
    const libraryWrites = vi.spyOn(useEncounterStore, 'setState');
    nav.reset('prepareEncounter=enc-lib&panel=scenes');
    render(<TableWorkspace campaignCode="CAMP" />);
    expect(
      await screen.findByText(
        'Prepare Bandit ambush: choose a scene or create one'
      )
    ).toBeInTheDocument();
    const panel = screen.getByRole('region', { name: 'Scenes' });
    fireEvent.click(within(panel).getByRole('button', { name: /Forest/u }));
    expect(nav.push).toHaveBeenLastCalledWith(
      '/dm/campaign/CAMP/table?scene=scene-forest&prepareEncounter=enc-lib',
      { scroll: false }
    );
    await settled('scene-forest');
    expect(runs('scene-forest')).toEqual([]);
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Copy Bandit ambush into Forest',
      })
    );
    await waitFor(() => expect(runs('scene-forest')).toHaveLength(1));
    const [run] = runs('scene-forest');
    expect(run!.participants.map(p => p.actorId)).toEqual([
      `${run!.runId}:e-bandit`,
    ]);
    await waitFor(() =>
      expect(nav.replace).toHaveBeenLastCalledWith(
        `/dm/campaign/CAMP/table?scene=scene-forest&run=${run!.runId}`,
        { scroll: false }
      )
    );
    expect(
      screen.queryByText(/Prepare Bandit ambush/u)
    ).not.toBeInTheDocument();
    expect(libraryWrites).not.toHaveBeenCalled();
    expect(presentationCommands()).toEqual([]);
  });

  it('cancels without creating anything', async () => {
    nav.reset('scene=scene-forest&prepareEncounter=enc-lib');
    render(<TableWorkspace campaignCode="CAMP" />);
    await settled('scene-forest');
    fireEvent.click(
      await screen.findByRole('button', { name: 'Cancel prepare' })
    );
    expect(nav.replace).toHaveBeenLastCalledWith(
      '/dm/campaign/CAMP/table?scene=scene-forest',
      { scroll: false }
    );
    expect(runs('scene-forest')).toEqual([]);
  });

  it('says "Encounter not found" for an unknown or foreign encounter and offers nothing else', async () => {
    useEncounterStore.setState({
      encounters: [{ ...ENCOUNTER, campaignCode: 'OTHER' }],
    } as never);
    nav.reset('scene=scene-forest&prepareEncounter=enc-lib');
    render(<TableWorkspace campaignCode="CAMP" />);
    await settled('scene-forest');
    expect(await screen.findByText('Encounter not found')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Copy /u })).toBeNull();
    expect(runs('scene-forest')).toEqual([]);
  });

  it('offers the existing copy (with a selector for several) or an explicit new copy', async () => {
    const key = repository.workspaceIdentity;
    const current = repository.getCurrent();
    if (current?.status !== 'ready') throw new Error('not ready');
    await repository.mutateWorkspace(
      current.snapshot.campaign?.revision ?? 0,
      'existing-copies',
      {
        encounters: {
          put: ['copy-1', 'copy-2'].map(runId => ({
            schemaVersion: 1 as const,
            workspaceKey: key,
            runId,
            sceneId: 'scene-tavern',
            sourceEncounterId: 'enc-lib',
            runGeneration: runId,
            participants: [],
            round: 0,
            currentActorId: null,
            isActive: false,
            createdAt: AT,
            updatedAt: AT,
            label: `Ambush ${runId}`,
          })),
        },
      }
    );
    nav.reset('scene=scene-tavern&prepareEncounter=enc-lib');
    render(<TableWorkspace campaignCode="CAMP" />);
    await settled('scene-tavern');
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('combobox', { name: 'Existing copies' })
    );
    fireEvent.click(await screen.findByRole('option', { name: /copy-2/u }));
    fireEvent.click(screen.getByRole('button', { name: 'Open existing run' }));
    expect(nav.replace).toHaveBeenLastCalledWith(
      '/dm/campaign/CAMP/table?scene=scene-tavern&run=copy-2',
      { scroll: false }
    );
    expect(runs('scene-tavern')).toHaveLength(2);
    expect(
      screen.queryByRole('button', { name: 'Create another copy' })
    ).not.toBeInTheDocument();
  });

  it('labels existing copies with date, short time and a copy ordinal on collision (FU-7)', async () => {
    const key = repository.workspaceIdentity;
    const current = repository.getCurrent();
    if (current?.status !== 'ready') throw new Error('not ready');
    const times = {
      'copy-b': '2026-10-07T18:40:00.000Z',
      'copy-a': '2026-10-07T09:15:00.000Z',
    };
    await repository.mutateWorkspace(
      current.snapshot.campaign?.revision ?? 0,
      'colliding-copies',
      {
        encounters: {
          put: Object.entries(times).map(([runId, createdAt]) => ({
            schemaVersion: 1 as const,
            workspaceKey: key,
            runId,
            sceneId: 'scene-tavern',
            sourceEncounterId: 'enc-lib',
            runGeneration: runId,
            participants: [],
            round: 0,
            currentActorId: null,
            isActive: false,
            createdAt,
            updatedAt: createdAt,
            label: 'Bandit ambush',
          })),
        },
      }
    );
    nav.reset('scene=scene-tavern&prepareEncounter=enc-lib');
    render(<TableWorkspace campaignCode="CAMP" />);
    await settled('scene-tavern');
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('combobox', { name: 'Existing copies' })
    );
    const when = (iso: string) =>
      `${new Date(iso).toLocaleDateString()} ${new Date(iso).toLocaleTimeString(undefined, { timeStyle: 'short' })}`;
    expect(
      (await screen.findAllByRole('option')).map(option => option.textContent)
    ).toEqual([
      `Tavern · Bandit ambush · ${when(times['copy-a'])} · copy 1`,
      `Tavern · Bandit ambush · ${when(times['copy-b'])} · copy 2`,
    ]);
  });

  it('creates another copy only on explicit request', async () => {
    const key = repository.workspaceIdentity;
    const current = repository.getCurrent();
    if (current?.status !== 'ready') throw new Error('not ready');
    await repository.mutateWorkspace(
      current.snapshot.campaign?.revision ?? 0,
      'existing-copy',
      {
        encounters: {
          put: [
            {
              schemaVersion: 1,
              workspaceKey: key,
              runId: 'copy-1',
              sceneId: 'scene-tavern',
              sourceEncounterId: 'enc-lib',
              runGeneration: 'copy-1',
              participants: [],
              round: 0,
              currentActorId: null,
              isActive: false,
              createdAt: AT,
              updatedAt: AT,
              label: 'Ambush',
            },
          ],
        },
      }
    );
    nav.reset('scene=scene-tavern&prepareEncounter=enc-lib');
    render(<TableWorkspace campaignCode="CAMP" />);
    await settled('scene-tavern');
    expect(
      await screen.findByRole('button', { name: 'Open existing run' })
    ).toBeInTheDocument();
    expect(runs('scene-tavern')).toHaveLength(1);
    fireEvent.click(
      screen.getByRole('button', { name: 'Create another copy' })
    );
    await waitFor(() => expect(runs('scene-tavern')).toHaveLength(2));
  });

  it('never prompts for an encounter in a peaceful scene', async () => {
    nav.reset('scene=scene-forest');
    render(<TableWorkspace campaignCode="CAMP" />);
    await settled('scene-forest');
    expect(screen.queryByText(/Prepare /u)).toBeNull();
    expect(screen.queryByRole('button', { name: /^Copy /u })).toBeNull();
    expect(screen.queryByText('Encounter not found')).toBeNull();
    expect(runs('scene-forest')).toEqual([]);
  });

  it('creates a new scene during preparation and copies into it', async () => {
    nav.reset('prepareEncounter=enc-lib&panel=scenes');
    render(<TableWorkspace campaignCode="CAMP" />);
    fireEvent.click(await screen.findByRole('button', { name: 'New scene' }));
    fireEvent.change(await screen.findByLabelText('Scene name'), {
      target: { value: 'Swamp' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create scene' }));
    await waitFor(() => expect(nav.push).toHaveBeenCalled());
    const href = nav.push.mock.calls.at(-1)![0];
    const params = new URLSearchParams(href.split('?')[1]);
    expect(params.get('prepareEncounter')).toBe('enc-lib');
    const sceneId = params.get('scene')!;
    await settled(sceneId);
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Copy Bandit ambush into Swamp',
      })
    );
    await waitFor(() => expect(runs(sceneId)).toHaveLength(1));
  });
});
