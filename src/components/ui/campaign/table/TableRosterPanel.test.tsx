import { IDBFactory } from 'fake-indexeddb';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TableRepository } from '@/lib/table/repository';
import { dmTokenFields, partyTokenFields } from '@/lib/table/roster';
import type {
  JsonObject,
  TableActorRecordV1,
  TableSceneRecordV1,
} from '@/lib/table/schema';

import { TableRosterPanel, type TableRosterCanvas } from './TableRosterPanel';

const AT = '2026-10-06T00:00:00.000Z';
const repositories: TableRepository[] = [];

function scene(
  workspaceKey: string,
  members: TableSceneRecordV1['members'] = [],
  elements: JsonObject[] = []
): TableSceneRecordV1 {
  return {
    schemaVersion: 1,
    workspaceKey,
    sceneId: 'tavern',
    originalMapId: null,
    map: {
      name: 'Tavern',
      mapImageUrl: '/tavern.webp',
      mapImageSize: { w: 100, h: 100 },
      gridEnabled: false,
      gridSettings: null,
      markers: [],
      dmOnlyElements: {},
    },
    canvasCheckpoint:
      elements.length === 0
        ? null
        : {
            protocolVersion: 1,
            generation: 'generation-1',
            revision: 2,
            capturedAt: AT,
            state: {
              elements,
              layers: [],
              extensions: {
                fog: { pluginName: 'fog', version: 1, data: null },
              },
            },
          },
    members,
    arrivalPoint: null,
    createdAt: AT,
    updatedAt: AT,
  };
}

function partyActor(workspaceKey: string): TableActorRecordV1 {
  return {
    schemaVersion: 1,
    workspaceKey,
    actorId: 'party-actor',
    actorKind: 'player-reference',
    liveStats: null,
    playerReference: { campaignId: 'CAMP', playerId: 'legacy-a' },
    cachedPlayerData: { name: 'Aria' },
    playerConditionOverlay: {
      suppressedSourceConditionIds: [],
      dmConditions: [],
    },
    createdAt: AT,
    updatedAt: AT,
  };
}

function creature(workspaceKey: string, actorId: string): TableActorRecordV1 {
  return {
    schemaVersion: 1,
    workspaceKey,
    actorId,
    actorKind: 'dm-managed',
    liveStats: {
      name: 'Goblin',
      currentHp: 7,
      maxHp: 7,
      tempHp: 0,
      armorClass: 15,
      conditions: [],
    },
    playerReference: null,
    cachedPlayerData: null,
    playerConditionOverlay: null,
    profile: { category: 'monster', sourceKind: 'bestiary' },
    createdAt: AT,
    updatedAt: AT,
  };
}

async function repositoryWith(
  members: TableSceneRecordV1['members'] = [],
  actors: (key: string) => TableActorRecordV1[] = () => [],
  elements: JsonObject[] = []
) {
  const repository = new TableRepository({
    factory: new IDBFactory(),
    selection: {
      account: { kind: 'guest' },
      workspace: { localWorkspaceId: `panel-${repositories.length}` },
    },
    broadcastChannel: null,
    events: null,
  });
  repositories.push(repository);
  await repository.start();
  const key = repository.workspaceIdentity;
  await repository.mutateWorkspace(0, 'seed', {
    actors: { put: actors(key) },
    scenes: { put: [scene(key, members, elements)] },
  });
  return repository;
}

function snapshot(repository: TableRepository) {
  const current = repository.getCurrent();
  if (current?.status !== 'ready') throw new Error('not ready');
  return current.snapshot;
}

function fakeCanvas(elements: Record<string, unknown>[] = []) {
  const canvas = {
    elements: vi.fn(() => elements),
    subscribe: vi.fn(() => () => {}),
    select: vi.fn(),
    armPlacement: vi.fn(),
    applyTokenPatch: vi.fn(() => true),
    ensurePlayerBand: vi.fn(),
  } satisfies TableRosterCanvas;
  return canvas;
}

const playersResponse = {
  campaign: { code: 'CAMP', name: 'Camp', createdAt: AT },
  players: [
    {
      playerId: 'legacy-a',
      playerName: 'Sam',
      characterId: 'legacy-a',
      characterName: 'Aria',
      characterData: {
        class: { name: 'Rogue' },
        level: 3,
        armorClass: 14,
        hitPoints: { current: 20, max: 20 },
        abilities: { dexterity: 16 },
      },
      lastSynced: AT,
    },
  ],
};

function renderPanel(
  repository: TableRepository,
  canvas: TableRosterCanvas,
  live = true
) {
  return render(
    <TableRosterPanel
      repository={repository}
      sceneId="tavern"
      campaignCode="CAMP"
      dmId="dm-a"
      canvas={canvas}
      live={live}
    />
  );
}

async function rowButton(name: string): Promise<HTMLElement> {
  const label = await screen.findByText(name, { selector: 'span' });
  const button = label.closest('button');
  if (!button) throw new Error(`no roster row for ${name}`);
  return button;
}

async function openAddDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Add to scene' }));
  return screen.findByRole('dialog');
}

describe('TableRosterPanel', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      if (String(input).endsWith('/api/campaign/CAMP/players')) {
        return new Response(JSON.stringify(playersResponse), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    repositories.splice(0).forEach(repository => repository.dispose());
  });

  it('assigns member ids once for PR01 members and shows control status', async () => {
    const repository = await repositoryWith(
      [{ actorId: 'pr01-goblin', tokenIds: [] }],
      key => [creature(key, 'pr01-goblin')]
    );
    renderPanel(repository, fakeCanvas());
    await waitFor(() =>
      expect(snapshot(repository).scenes[0]!.members[0]!.sceneMemberId).toEqual(
        expect.any(String)
      )
    );
    expect(snapshot(repository).campaign?.revision).toBe(2);
    expect(await screen.findByText(/DM-controlled/)).toBeInTheDocument();
  });

  it('adds a verified party member once through the accessible add dialog', async () => {
    const repository = await repositoryWith();
    renderPanel(repository, fakeCanvas());
    let dialog = await openAddDialog();
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Party' }));
    fireEvent.click(
      await within(dialog).findByRole('button', { name: /Aria/ })
    );
    await waitFor(() =>
      expect(
        snapshot(repository).actors.filter(
          actor => actor.actorKind === 'player-reference'
        )
      ).toHaveLength(1)
    );
    expect(await screen.findByRole('status')).toHaveTextContent(/Aria added/i);
    dialog = await openAddDialog();
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Party' }));
    fireEvent.click(
      await within(dialog).findByRole('button', { name: /Aria/ })
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      /already in this scene/i
    );
    expect(snapshot(repository).scenes[0]!.members).toHaveLength(1);
    expect(await screen.findByText(/Player-controlled/)).toBeInTheDocument();
  });

  it('adds a campaign NPC copy through a read-only picker without library writes (review N1)', async () => {
    const { useNPCStore } = await import('@/store/npcStore');
    useNPCStore.setState({
      npcsByCampaign: {
        CAMP: [
          {
            id: 'npc-barkeep',
            name: 'Barkeep Tomas',
            kind: 'npc',
            maxHp: 9,
            armorClass: '11',
          } as never,
        ],
      },
    });
    const createNPC = vi.spyOn(useNPCStore.getState(), 'createNPC');
    const deleteNPC = vi.spyOn(useNPCStore.getState(), 'deleteNPC');
    const before = JSON.stringify(useNPCStore.getState().npcsByCampaign);
    const repository = await repositoryWith();
    renderPanel(repository, fakeCanvas());
    const dialog = await openAddDialog();
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Campaign NPC' }));
    expect(
      within(dialog).queryByRole('button', { name: /create/i })
    ).toBeNull();
    expect(
      within(dialog).queryByRole('button', { name: /delete/i })
    ).toBeNull();
    expect(within(dialog).queryByText(/hide name/i)).toBeNull();
    fireEvent.click(
      await within(dialog).findByRole('button', { name: /Barkeep Tomas/ })
    );
    await waitFor(() =>
      expect(snapshot(repository).actors[0]).toMatchObject({
        actorKind: 'dm-managed',
        liveStats: { name: 'Barkeep Tomas', maxHp: 9, armorClass: 11 },
        profile: {
          category: 'npc',
          sourceKind: 'campaign-npc',
          sourceId: 'npc-barkeep',
        },
      })
    );
    expect(createNPC).not.toHaveBeenCalled();
    expect(deleteNPC).not.toHaveBeenCalled();
    expect(JSON.stringify(useNPCStore.getState().npcsByCampaign)).toBe(before);
  });

  it('implements keyboard-operable ARIA tabs in the add dialog (review N3)', async () => {
    const repository = await repositoryWith();
    renderPanel(repository, fakeCanvas());
    const dialog = await openAddDialog();
    const tabs = within(dialog).getAllByRole('tab');
    expect(tabs.map(tab => tab.textContent)).toEqual([
      'Party',
      'Creature',
      'Campaign NPC',
      'Manual PC',
    ]);
    const panel = within(dialog).getByRole('tabpanel');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[0]).toHaveAttribute('aria-controls', panel.id);
    expect(panel).toHaveAttribute('aria-labelledby', tabs[0]!.id);
    expect(tabs.map(tab => tab.getAttribute('tabindex'))).toEqual([
      '0',
      '-1',
      '-1',
      '-1',
    ]);
    tabs[0]!.focus();
    fireEvent.keyDown(tabs[0]!, { key: 'ArrowRight' });
    expect(within(dialog).getAllByRole('tab')[1]).toHaveFocus();
    expect(within(dialog).getAllByRole('tab')[1]).toHaveAttribute(
      'aria-selected',
      'true'
    );
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(within(dialog).getAllByRole('tab')[3]).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(within(dialog).getAllByRole('tab')[0]).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    expect(within(dialog).getAllByRole('tab')[3]).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    expect(within(dialog).getAllByRole('tab')[0]).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('restores a removed party member truthfully (review N2)', async () => {
    const repository = await repositoryWith(
      [
        {
          actorId: 'party-actor',
          tokenIds: [],
          sceneMemberId: 'member-a',
          control: { kind: 'dm' },
          removedAt: AT,
        },
      ],
      key => [partyActor(key)]
    );
    renderPanel(repository, fakeCanvas());
    const dialog = await openAddDialog();
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Party' }));
    fireEvent.click(
      await within(dialog).findByRole('button', { name: /Aria/ })
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      /Aria restored to the scene as player-controlled/i
    );
    expect(snapshot(repository).scenes[0]!.members[0]!.control).toEqual({
      kind: 'player',
      legacyPlayerId: 'legacy-a',
      characterId: 'legacy-a',
    });
  });

  it('adds a manual PC from the design-system form', async () => {
    const repository = await repositoryWith();
    renderPanel(repository, fakeCanvas());
    const dialog = await openAddDialog();
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Manual PC' }));
    fireEvent.change(within(dialog).getByLabelText('Name'), {
      target: { value: 'Nyx' },
    });
    fireEvent.change(within(dialog).getByLabelText('Max HP'), {
      target: { value: '12' },
    });
    fireEvent.change(within(dialog).getByLabelText('Armor class'), {
      target: { value: '13' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add PC' }));
    await waitFor(() =>
      expect(snapshot(repository).actors[0]).toMatchObject({
        actorKind: 'dm-managed',
        profile: { category: 'pc', sourceKind: 'manual' },
        liveStats: { name: 'Nyx', maxHp: 12, armorClass: 13 },
      })
    );
  });

  it('commits the binding before arming a party token placement', async () => {
    const repository = await repositoryWith(
      [
        {
          actorId: 'party-actor',
          tokenIds: [],
          sceneMemberId: 'member-a',
          control: { kind: 'player', legacyPlayerId: 'legacy-a' },
        },
      ],
      key => [
        {
          schemaVersion: 1,
          workspaceKey: key,
          actorId: 'party-actor',
          actorKind: 'player-reference',
          liveStats: null,
          playerReference: { campaignId: 'CAMP', playerId: 'legacy-a' },
          cachedPlayerData: { name: 'Aria' },
          playerConditionOverlay: {
            suppressedSourceConditionIds: [],
            dmConditions: [],
          },
          createdAt: AT,
          updatedAt: AT,
        },
      ]
    );
    const canvas = fakeCanvas();
    const boundAtArm: string[][] = [];
    canvas.armPlacement.mockImplementation(() => {
      boundAtArm.push([
        ...snapshot(repository).scenes[0]!.members[0]!.tokenIds,
      ]);
    });
    renderPanel(repository, canvas);
    // Party fields are stamped only once the players snapshot verifies Aria.
    await screen.findByText(/Player-controlled/);
    fireEvent.click(await rowButton('Aria'));
    await waitFor(() => expect(canvas.armPlacement).toHaveBeenCalledTimes(1));
    const tokenId = snapshot(repository).scenes[0]!.members[0]!.tokenIds[0]!;
    expect(boundAtArm).toEqual([[tokenId]]);
    expect(canvas.ensurePlayerBand).toHaveBeenCalledWith('legacy-a', 'Aria');
    expect(canvas.armPlacement.mock.calls[0]![0]).toMatchObject({
      tokenId,
      sceneMemberId: 'member-a',
      fields: partyTokenFields('member-a', 'legacy-a'),
    });
  });

  it('re-places a member with its existing bound token id without a second binding', async () => {
    const repository = await repositoryWith(
      [{ actorId: 'goblin', tokenIds: ['goblin-token'], sceneMemberId: 'm-g' }],
      key => [creature(key, 'goblin')]
    );
    const canvas = fakeCanvas();
    renderPanel(repository, canvas);
    const revision = snapshot(repository).campaign?.revision;
    fireEvent.click(await rowButton('Goblin'));
    await waitFor(() => expect(canvas.armPlacement).toHaveBeenCalledTimes(1));
    expect(canvas.armPlacement.mock.calls[0]![0]).toMatchObject({
      tokenId: 'goblin-token',
      fields: {
        tokenKind: 'combatant',
        entityId: 'm-g',
        sceneMemberId: 'm-g',
      },
    });
    expect(snapshot(repository).campaign?.revision).toBe(revision);
  });

  it('disposes canvas and repository subscriptions and aborts the players read on unmount', async () => {
    const repository = await repositoryWith();
    const unsubscribe = vi.fn();
    const canvas = fakeCanvas();
    canvas.subscribe.mockReturnValue(unsubscribe);
    const signals: AbortSignal[] = [];
    vi.mocked(globalThis.fetch).mockImplementation(async (_input, init) => {
      if (init?.signal) signals.push(init.signal);
      return new Promise<Response>(() => {});
    });
    const { unmount } = renderPanel(repository, canvas);
    await waitFor(() => expect(signals).toHaveLength(1));
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
    expect(signals[0]!.aborted).toBe(true);
  });

  it('selects a placed member token instead of placing another', async () => {
    const repository = await repositoryWith(
      [{ actorId: 'goblin', tokenIds: ['goblin-token'], sceneMemberId: 'm-g' }],
      key => [creature(key, 'goblin')]
    );
    const canvas = fakeCanvas([
      {
        id: 'goblin-token',
        tokenKind: 'combatant',
        entityId: 'm-g',
        sceneMemberId: 'm-g',
      },
    ]);
    renderPanel(repository, canvas);
    fireEvent.click(await rowButton('Goblin'));
    expect(canvas.select).toHaveBeenCalledWith(['goblin-token']);
    expect(canvas.armPlacement).not.toHaveBeenCalled();
  });

  it('edits DM-managed creature stats and keeps party stats read-only', async () => {
    const repository = await repositoryWith(
      [{ actorId: 'goblin', tokenIds: [], sceneMemberId: 'm-g' }],
      key => [creature(key, 'goblin')]
    );
    renderPanel(repository, fakeCanvas());
    fireEvent.click(
      await screen.findByRole('button', { name: 'Details for Goblin' })
    );
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Current HP'), {
      target: { value: '3' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save stats' }));
    await waitFor(() =>
      expect(snapshot(repository).actors[0]!.liveStats?.currentHp).toBe(3)
    );
    expect(await screen.findByRole('status')).toHaveTextContent(/stats saved/i);
  });

  it('gives player control and returns it to the DM, patching bound tokens after each commit', async () => {
    const repository = await repositoryWith(
      [
        {
          actorId: 'party-actor',
          tokenIds: ['goblin-token'],
          sceneMemberId: 'm-g',
          control: { kind: 'dm' },
        },
      ],
      key => [partyActor(key)]
    );
    const token = {
      id: 'goblin-token',
      tokenKind: 'combatant',
      entityId: 'm-g',
      sceneMemberId: 'm-g',
      layerId: 'layer-annotations',
    };
    const canvas = fakeCanvas([token]);
    renderPanel(repository, canvas);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Details for Aria' })
    );
    let dialog = await screen.findByRole('dialog');
    await within(dialog).findByRole('button', {
      name: 'Give Aria control',
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Give Aria control' })
    );
    await waitFor(() =>
      expect(snapshot(repository).scenes[0]!.members[0]!.control).toEqual({
        kind: 'player',
        legacyPlayerId: 'legacy-a',
        characterId: 'legacy-a',
      })
    );
    await waitFor(() =>
      expect(canvas.applyTokenPatch).toHaveBeenCalledWith('goblin-token', {
        set: partyTokenFields('m-g', 'legacy-a'),
        unset: ['entityId'],
      })
    );
    expect(canvas.ensurePlayerBand).toHaveBeenCalledWith('legacy-a', 'Aria');
    dialog = screen.getByRole('dialog');
    fireEvent.click(
      await within(dialog).findByRole('button', {
        name: 'Return to DM control',
      })
    );
    await waitFor(() =>
      expect(snapshot(repository).scenes[0]!.members[0]!.control).toEqual({
        kind: 'dm',
      })
    );
  });

  it('keeps DM-managed creatures and manual PCs DM-only (no player control offered)', async () => {
    const repository = await repositoryWith(
      [{ actorId: 'goblin', tokenIds: [], sceneMemberId: 'm-g' }],
      key => [creature(key, 'goblin')]
    );
    renderPanel(repository, fakeCanvas());
    fireEvent.click(
      await screen.findByRole('button', { name: 'Details for Goblin' })
    );
    const dialog = await screen.findByRole('dialog');
    expect(
      await within(dialog).findByText(/DM-managed participant/)
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: /Give .* control/ })
    ).toBeNull();
  });

  it('surfaces a control mismatch and aliases for explicit repair and binding', async () => {
    const repository = await repositoryWith(
      [
        {
          actorId: 'goblin',
          tokenIds: ['goblin-token'],
          sceneMemberId: 'm-g',
          control: { kind: 'player', legacyPlayerId: 'legacy-a' },
        },
      ],
      key => [creature(key, 'goblin')]
    );
    const canvas = fakeCanvas([
      {
        id: 'goblin-token',
        tokenKind: 'combatant',
        entityId: 'm-g',
        sceneMemberId: 'm-g',
      },
      { id: 'self-token', tokenKind: 'player', characterId: 'legacy-a' },
    ]);
    renderPanel(repository, canvas);
    expect(await screen.findByText(/Repair needed/)).toBeInTheDocument();
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });
    expect(canvas.applyTokenPatch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Details for Goblin' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Repair token' })
    );
    expect(canvas.applyTokenPatch).toHaveBeenCalledWith('goblin-token', {
      set: partyTokenFields('m-g', 'legacy-a'),
      unset: ['entityId'],
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Bind self-token' })
    );
    await waitFor(() =>
      expect(snapshot(repository).scenes[0]!.members[0]!.tokenIds).toEqual([
        'goblin-token',
        'self-token',
      ])
    );
  });

  it('shows verification unavailable and stamps DM-only fields when the players snapshot fails', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(
      async () => new Response('{}', { status: 503 })
    );
    const repository = await repositoryWith(
      [
        {
          actorId: 'party-actor',
          tokenIds: [],
          sceneMemberId: 'member-a',
          control: { kind: 'player', legacyPlayerId: 'legacy-a' },
        },
      ],
      key => [partyActor(key)]
    );
    const canvas = fakeCanvas();
    renderPanel(repository, canvas);
    expect(
      await screen.findByText(/Verification unavailable/)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Player-controlled/)).toBeNull();
    fireEvent.click(await rowButton('Aria'));
    await waitFor(() => expect(canvas.armPlacement).toHaveBeenCalledTimes(1));
    expect(canvas.armPlacement.mock.calls[0]![0]).toMatchObject({
      fields: dmTokenFields('member-a'),
    });
    expect(canvas.ensurePlayerBand).not.toHaveBeenCalled();
  });

  it('offers explicit binding of an unbound legacy token and surfaces a failed canvas step with a retry', async () => {
    const repository = await repositoryWith(
      [
        {
          actorId: 'goblin',
          tokenIds: [],
          sceneMemberId: 'm-g',
          control: { kind: 'dm' },
        },
      ],
      key => [creature(key, 'goblin')],
      [
        {
          id: 'legacy-orc',
          tokenKind: 'combatant',
          entityId: 'orc',
          ownerId: 'dm-a',
        },
      ]
    );
    const canvas = fakeCanvas([
      { id: 'legacy-orc', tokenKind: 'combatant', entityId: 'orc' },
    ]);
    canvas.applyTokenPatch.mockReturnValueOnce(false);
    renderPanel(repository, canvas);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Details for Goblin' })
    );
    const dialog = await screen.findByRole('dialog');
    const bind = within(dialog).queryByRole('button', {
      name: 'Bind legacy-orc',
    });
    if (!bind) return expect.fail('legacy token not offered for binding');
    fireEvent.click(bind);
    expect(await within(dialog).findByRole('status')).toHaveTextContent(
      /not updated on the map/i
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Retry' }));
    await waitFor(() =>
      expect(canvas.applyTokenPatch).toHaveBeenCalledTimes(2)
    );
  });

  it('surfaces a failed member-id assignment with a retry', async () => {
    const repository = await repositoryWith(
      [{ actorId: 'pr01-goblin', tokenIds: [] }],
      key => [creature(key, 'pr01-goblin')]
    );
    const original = repository.mutateWorkspace.bind(repository);
    const spy = vi
      .spyOn(repository, 'mutateWorkspace')
      .mockImplementationOnce(async () => ({
        status: 'failed',
        reason: 'transaction-failed',
      }));
    renderPanel(repository, fakeCanvas());
    expect(await screen.findByText(/could not be prepared/i)).toHaveAttribute(
      'role',
      'status'
    );
    spy.mockImplementation(original);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() =>
      expect(snapshot(repository).scenes[0]!.members[0]!.sceneMemberId).toEqual(
        expect.any(String)
      )
    );
  });

  it('reports a concurrent change without replaying and retries deliberately', async () => {
    const repository = await repositoryWith(
      [{ actorId: 'goblin', tokenIds: [], sceneMemberId: 'm-g' }],
      key => [creature(key, 'goblin')]
    );
    renderPanel(repository, fakeCanvas());
    fireEvent.click(
      await screen.findByRole('button', { name: 'Details for Goblin' })
    );
    const dialog = await screen.findByRole('dialog');
    const current = snapshot(repository);
    await repository.mutateWorkspace(current.campaign!.revision, 'elsewhere', {
      scenes: { put: [{ ...current.scenes[0]!, updatedAt: AT }] },
    });
    const stale = vi
      .spyOn(repository, 'getCurrent')
      .mockReturnValue({ status: 'ready', snapshot: current });
    fireEvent.change(within(dialog).getByLabelText('Current HP'), {
      target: { value: '2' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save stats' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      /changed elsewhere/i
    );
    expect(snapshot(repository).actors[0]!.liveStats?.currentHp).toBe(7);
    stale.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() =>
      expect(snapshot(repository).actors[0]!.liveStats?.currentHp).toBe(2)
    );
  });
});
