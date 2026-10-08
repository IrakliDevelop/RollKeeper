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
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TableControlSession } from '@/lib/table/authorityLifecycle';
import { runCombatCommand } from '@/lib/table/combat';
import {
  AT,
  IMPORTED_RUN,
  openFixture,
  readySnapshot,
  repositories,
  revisionOf,
} from '@/lib/table/combat.fixture';
import type { TableRepository } from '@/lib/table/repository';
import { useBattleMapStore } from '@/store/battleMapStore';
import { useCombatLogStore } from '@/store/combatLogStore';
import { useEncounterStore } from '@/store/encounterStore';
import { useNPCStore } from '@/store/npcStore';

const download = vi.hoisted(() => ({ calls: [] as unknown[][] }));
// F2: inject a planner-only start rejection at the combined action's plan
// gate (runCombatCommand keeps using the real internal planner).
const planner = vi.hoisted(() => ({ reject: null as string | null }));
vi.mock('@/lib/table/combat', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/table/combat')>();
  return {
    ...actual,
    planCombatCommand: (
      ...args: Parameters<typeof actual.planCombatCommand>
    ) =>
      planner.reject
        ? { status: 'rejected', reason: planner.reject }
        : actual.planCombatCommand(...args),
  };
});
vi.mock('./combatHistoryDownload', () => ({
  downloadCombatHistory: (...args: unknown[]) => download.calls.push(args),
}));
vi.mock('@/hooks/useOfficialConditions', () => ({
  useOfficialConditions: () => ({ loading: false, conditions: [] }),
}));
vi.mock('@/hooks/usePaletteSpellEffects', () => ({
  usePaletteSpellEffects: () => ({ loading: false, effects: [] }),
}));

import { TableCombatPanel } from './TableCombatPanel';

const PLAYERS = {
  players: [
    {
      playerId: 'legacy-aria',
      playerName: 'Sam',
      characterId: 'char-aria',
      characterName: 'Aria',
      characterData: {
        hitPoints: { current: 17, max: 31, temporary: 0 },
        conditionsAndDiseases: { activeConditions: [] },
        reaction: { hasUsedReaction: false },
      },
      lastSynced: AT,
    },
  ],
};

function fakeSession(): TableControlSession {
  return {
    holderSessionId: 'table-session-1',
    current: () => ({
      epoch: '10000000-0000-4000-8000-000000000001',
      revision: 1,
      writerFence: 1,
      leaseUntil: Date.now() + 30_000,
      holderSessionId: 'table-session-1',
      presentation: { sceneId: null, revision: 0, blanked: false },
      publicRunId: null,
    }),
    isLost: () => false,
    lostReason: () => null,
    renew: vi.fn(async () => ({ status: 'committed' as const })),
    publishInitiative: vi.fn(async () => ({ status: 'committed' as const })),
    endInitiative: vi.fn(async () => ({ status: 'committed' as const })),
    registerScene: vi.fn(async () => ({ status: 'committed' as const })),
    show: vi.fn(async () => ({ status: 'committed' as const })),
    blank: vi.fn(async () => ({ status: 'committed' as const })),
    unpresent: vi.fn(async () => ({ status: 'committed' as const })),
    deletePresented: vi.fn(async () => ({ status: 'committed' as const })),
    resend: vi.fn(async () => ({ status: 'committed' as const })),
    subscribe: () => () => {},
  };
}

beforeEach(() => {
  download.calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json(PLAYERS))
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  repositories.splice(0).forEach(repository => repository.dispose());
});

function renderPanel(
  repository: TableRepository,
  overrides: Partial<Parameters<typeof TableCombatPanel>[0]> = {}
) {
  return render(
    <TableCombatPanel
      repository={repository}
      sceneId="scene-1"
      campaignCode="CAMP"
      dmId="dm-1"
      controlSession={null}
      controlEpoch={0}
      liveUnavailable={false}
      requestedRunId={null}
      {...overrides}
    />
  );
}

async function createRun(label: string) {
  fireEvent.click(screen.getByRole('button', { name: 'New run' }));
  const dialog = await screen.findByRole('dialog', { name: 'New scene run' });
  const input = within(dialog).getByLabelText('Run label');
  fireEvent.change(input, { target: { value: label } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Create run' }));
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'New scene run' })).toBeNull()
  );
}

async function chooseParticipants(names: string[]) {
  fireEvent.click(
    await screen.findByRole('button', { name: 'Choose participants' })
  );
  const dialog = await screen.findByRole('dialog', {
    name: 'Choose participants',
  });
  for (const name of names)
    fireEvent.click(within(dialog).getByRole('checkbox', { name }));
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Save participants' })
  );
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Choose participants' })
    ).toBeNull()
  );
}

async function setInitiative(name: string, value: string) {
  const input = await screen.findByLabelText(`Initiative for ${name}`);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
  await waitFor(() => expect(screen.queryByText('Saving…')).toBeNull());
}

async function preparedAndStarted(repository: TableRepository) {
  renderPanel(repository, { controlSession: fakeSession(), controlEpoch: 1 });
  await createRun('Bridge ambush');
  await chooseParticipants(['Goblin', 'Knight', 'Aria']);
  await setInitiative('Goblin', '12');
  await setInitiative('Knight', '0');
  await setInitiative('Aria', '15');
  fireEvent.click(screen.getByRole('button', { name: 'Start combat' }));
  await screen.findByText(/ROUND 1 · NOW/);
  // The start intent is published and acknowledged once (background).
  await waitFor(() =>
    expect(
      readySnapshot(repository).encounters.find(
        value => value.label === 'Bridge ambush'
      )?.publication?.acknowledged
    ).toBe(true)
  );
}

describe('Table combat panel (D10)', () => {
  it('selects participants, lists bystanders, blocks a missing initiative and accepts 0', async () => {
    const repository = await openFixture();
    renderPanel(repository);
    expect(
      await screen.findByText(/Create or choose a scene run/i)
    ).toBeVisible();
    await createRun('Bridge ambush');
    expect(
      screen.getByText(
        'DM condition changes are not sent to player sheets in scene runs'
      )
    ).toBeVisible();
    await chooseParticipants(['Goblin', 'Knight', 'Aria']);
    for (const name of ['Orc', 'Bran', 'Bard'])
      expect(
        screen.getByText(`${name} · Bystander — not in initiative`)
      ).toBeVisible();
    expect(screen.queryByText(/Ghost/)).toBeNull();
    await setInitiative('Goblin', '12');
    await setInitiative('Knight', '0');
    fireEvent.click(screen.getByRole('button', { name: 'Start combat' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Missing initiative: Aria/
    );
    const run = readySnapshot(repository).encounters.find(
      value => value.label === 'Bridge ambush'
    )!;
    expect(run.isActive).toBe(false);
    expect(screen.getByLabelText('Initiative for Aria')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    await setInitiative('Aria', '15');
    fireEvent.click(screen.getByRole('button', { name: 'Start combat' }));
    expect(await screen.findByText(/ROUND 1 · NOW/)).toBeVisible();
    const started = readySnapshot(repository).encounters.find(
      value => value.runId === run.runId
    )!;
    expect(started.participants.map(value => value.initiative)).toEqual([
      12, 0, 15,
    ]);
    expect(started.currentActorId).toBe('aria');
  });

  it('runs turns and ends combat without legacy writes', async () => {
    const stores = [
      useEncounterStore,
      useCombatLogStore,
      useNPCStore,
      useBattleMapStore,
    ];
    // Zustand's internal `set` bypasses a setState spy: assert state identity
    // (any legacy write replaces it) and persisted storage instead.
    const states = stores.map(store => store.getState());
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    try {
      const repository = await openFixture();
      await preparedAndStarted(repository);
      fireEvent.click(screen.getByRole('button', { name: /Next/ }));
      await waitFor(() =>
        expect(
          readySnapshot(repository).encounters.find(
            value => value.label === 'Bridge ambush'
          )?.currentActorId
        ).toBe('goblin')
      );
      fireEvent.click(screen.getByRole('button', { name: 'End combat' }));
      await waitFor(() =>
        expect(readySnapshot(repository).campaign?.activeRunId).toBeNull()
      );
      stores.forEach((store, index) =>
        expect(store.getState()).toBe(states[index])
      );
      expect(storage).not.toHaveBeenCalled();
    } finally {
      storage.mockRestore();
    }
  });

  it('refuses a second action while one is saving (one commit, visible refusal)', async () => {
    const repository = await openFixture();
    await preparedAndStarted(repository);
    const before = revisionOf(repository);
    const next = screen.getByRole('button', { name: /Next/ });
    fireEvent.click(next);
    fireEvent.click(next);
    expect(screen.getByText('Saving…')).toBeVisible();
    await waitFor(() => expect(revisionOf(repository)).toBe(before + 1));
    await act(async () => new Promise(resolve => setTimeout(resolve, 50)));
    expect(revisionOf(repository)).toBe(before + 1);
  });

  it('surfaces a conflict as "Changed elsewhere" and never auto-replans', async () => {
    const factory = new IDBFactory();
    const repository = await openFixture({ factory });
    await preparedAndStarted(repository);
    const other = await openFixture({ factory, seed: false });
    const run = readySnapshot(other).encounters.find(
      value => value.label === 'Bridge ambush'
    )!;
    const elsewhere = await runCombatCommand(other, {
      expectedRevision: revisionOf(other),
      operationId: 'other-tab',
      command: {
        type: 'combat.setHidden',
        runId: run.runId,
        actorId: 'goblin',
        hidden: true,
        at: AT,
      },
    });
    expect(elsewhere.status).toBe('committed');
    const revision = revisionOf(other);
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(
      await screen.findByText(/Changed elsewhere — review and retry/)
    ).toBeVisible();
    expect(revisionOf(other)).toBe(revision);
    await other.reload();
    expect(revisionOf(other)).toBe(revision);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() =>
      expect(
        readySnapshot(repository).encounters.find(
          value => value.runId === run.runId
        )?.currentActorId
      ).toBe('goblin')
    );
  });

  it('blocks a competing run while another is active and links to it', async () => {
    const repository = await openFixture();
    await preparedAndStarted(repository);
    await createRun('Second wave');
    expect(await screen.findByText(/Another run is active/)).toBeVisible();
    await chooseParticipants(['Orc']);
    await setInitiative('Orc', '3');
    expect(screen.getByRole('button', { name: 'Start combat' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Go to active run' }));
    expect(await screen.findByText(/ROUND 1 · NOW/)).toBeVisible();
  });

  it('labels an imported legacy-active run and resets it explicitly', async () => {
    const repository = await openFixture();
    renderPanel(repository, { requestedRunId: IMPORTED_RUN });
    expect(
      await screen.findByText(/Imported as active — not running here/)
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Start combat' })).toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: 'Reset imported state' })
    );
    await waitFor(() =>
      expect(
        readySnapshot(repository).encounters.find(
          value => value.runId === IMPORTED_RUN
        )?.isActive
      ).toBe(false)
    );
    expect(readySnapshot(repository).campaign?.selectedRunId).toBe(
      IMPORTED_RUN
    );
  });

  it('publishes the start, shows broadcasting, and turn publishes add no local revision', async () => {
    const repository = await openFixture();
    const session = fakeSession();
    renderPanel(repository, { controlSession: session, controlEpoch: 1 });
    await createRun('Bridge ambush');
    await chooseParticipants(['Goblin', 'Aria']);
    await setInitiative('Goblin', '12');
    await setInitiative('Aria', '15');
    fireEvent.click(screen.getByRole('button', { name: 'Start combat' }));
    expect(await screen.findByText(/Broadcasting initiative/)).toBeVisible();
    await waitFor(() =>
      expect(
        readySnapshot(repository).encounters.find(
          value => value.label === 'Bridge ambush'
        )?.publication?.acknowledged
      ).toBe(true)
    );
    const [runId, initiative] = vi.mocked(session.publishInitiative).mock
      .calls[0]!;
    expect(initiative.encounterId).toBe(runId);
    expect(JSON.stringify(initiative)).not.toContain('Bridge ambush');
    const revision = revisionOf(repository);
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    await waitFor(
      () => expect(session.publishInitiative).toHaveBeenCalledTimes(2),
      { timeout: 3_000 }
    );
    expect(revisionOf(repository)).toBe(revision + 1);
  });

  it('shows "Started locally · not broadcasting" without live control', async () => {
    const repository = await openFixture();
    renderPanel(repository);
    await createRun('Bridge ambush');
    await chooseParticipants(['Goblin']);
    await setInitiative('Goblin', '12');
    fireEvent.click(screen.getByRole('button', { name: 'Start combat' }));
    expect(
      await screen.findByText(/Started locally · not broadcasting/)
    ).toBeVisible();
  });

  it('views and exports history and deletes a closed archive after confirmation', async () => {
    const repository = await openFixture();
    await preparedAndStarted(repository);
    fireEvent.click(screen.getByRole('button', { name: 'End combat' }));
    await waitFor(() =>
      expect(readySnapshot(repository).campaign?.activeRunId).toBeNull()
    );
    fireEvent.click(screen.getByRole('button', { name: 'History' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Combat history',
    });
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: /Bridge ambush · generation 1/,
      })
    );
    expect(within(dialog).getByText(/COMBAT STARTED/)).toBeVisible();
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Export JSON' })
    );
    expect(download.calls).toHaveLength(1);
    const [filename, content] = download.calls[0] as [string, string];
    expect(filename).toMatch(/\.json$/);
    expect(JSON.parse(content)).toMatchObject({
      format: 'rollkeeper-table-combat-history',
      version: 1,
      label: 'Bridge ambush',
      combatGeneration: 1,
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Delete archive' })
    );
    expect(
      within(dialog).getByText(/Export it first if you need a copy/)
    ).toBeVisible();
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Confirm delete' })
    );
    await waitFor(() => expect(readySnapshot(repository).logs).toHaveLength(0));
  });

  it('keeps new controls keyboard reachable with accessible names', async () => {
    const user = userEvent.setup();
    const repository = await openFixture();
    renderPanel(repository);
    await screen.findByRole('button', { name: 'New run' });
    await user.tab();
    expect(document.activeElement).not.toBe(document.body);
    expect(screen.getByRole('combobox', { name: 'Scene run' })).toBeVisible();
    await createRun('Keyboard run');
    await chooseParticipants(['Goblin']);
    const input = screen.getByLabelText('Initiative for Goblin');
    input.focus();
    expect(document.activeElement).toBe(input);
    expect(
      screen.getByRole('switch', { name: 'Hide Goblin from players' })
    ).toBeVisible();
  });

  it('surfaces an active run in another scene with a link and names the published run (F2)', async () => {
    const repository = await openFixture();
    const key = repository.workspaceIdentity;
    const base = readySnapshot(repository).scenes[0]!;
    const seeded = await repository.mutateWorkspace(
      revisionOf(repository),
      'second-scene',
      {
        scenes: {
          put: [
            {
              ...structuredClone(base),
              workspaceKey: key,
              sceneId: 'scene-2',
              originalMapId: 'map-2',
              map: { ...structuredClone(base.map), name: 'Far Ridge' },
              canvasCheckpoint: null,
              members: [
                { actorId: 'orc', tokenIds: [], sceneMemberId: 'm2-orc' },
              ],
            },
          ],
        },
      }
    );
    expect(seeded.status).toBe('committed');
    const commands = [
      {
        type: 'combat.createRun',
        sceneId: 'scene-2',
        runId: 'far-run',
        label: 'Far fight',
      },
      { type: 'combat.setParticipants', runId: 'far-run', actorIds: ['orc'] },
      {
        type: 'combat.setInitiative',
        runId: 'far-run',
        actorId: 'orc',
        value: 9,
      },
      { type: 'combat.start', runId: 'far-run' },
    ];
    for (const [index, command] of commands.entries()) {
      const result = await runCombatCommand(repository, {
        expectedRevision: revisionOf(repository),
        operationId: `far-${index}`,
        command: { ...command, at: AT } as never,
      });
      expect(result.status).toBe('committed');
    }
    renderPanel(repository, { tableWorkspaceId: 'fork-1' });
    await createRun('Near fight');
    expect(
      await screen.findByText(
        /Another run is active: Far fight \(scene Far Ridge\)/
      )
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Go to active run' })
    ).toHaveAttribute(
      'href',
      '/dm/campaign/CAMP/table/scene-2?tableWorkspace=fork-1&run=far-run'
    );
    await chooseParticipants(['Goblin']);
    await setInitiative('Goblin', '3');
    expect(screen.getByRole('button', { name: 'Start combat' })).toBeDisabled();
    expect(
      screen.getByText(/Far fight \(scene Far Ridge\)/, {
        selector: '[data-testid="table-publication-status"]',
      })
    ).toBeVisible();
  });

  it('waits for player data instead of publishing 0 HP and shows HP as unknown (F1)', async () => {
    vi.mocked(fetch).mockImplementation(async () =>
      Response.json({ error: 'down' }, { status: 503 })
    );
    const repository = await openFixture();
    const session = fakeSession();
    renderPanel(repository, { controlSession: session, controlEpoch: 1 });
    await createRun('Bridge ambush');
    await chooseParticipants(['Goblin', 'Aria']);
    await setInitiative('Goblin', '12');
    await setInitiative('Aria', '15');
    fireEvent.click(screen.getByRole('button', { name: 'Start combat' }));
    expect(
      await screen.findByText(/^Waiting for player data · Bridge ambush$/)
    ).toBeVisible();
    expect(session.publishInitiative).not.toHaveBeenCalled();
    expect(screen.getAllByText(/HP —/).length).toBeGreaterThan(0);
    expect(screen.queryByText('0/0')).toBeNull();
  });

  it('broadcasts without HP for a loaded-but-unavailable player and names them to the DM (N1)', async () => {
    vi.mocked(fetch).mockImplementation(async () =>
      Response.json({
        players: [
          {
            playerId: 'legacy-bran',
            playerName: 'Ann',
            characterId: 'char-bran',
            characterName: 'Bran',
            characterData: { hitPoints: { current: 5, max: 9 } },
            lastSynced: AT,
          },
        ],
      })
    );
    const repository = await openFixture();
    const session = fakeSession();
    renderPanel(repository, { controlSession: session, controlEpoch: 1 });
    await createRun('Bridge ambush');
    await chooseParticipants(['Goblin', 'Aria']);
    await setInitiative('Goblin', '12');
    await setInitiative('Aria', '15');
    fireEvent.click(screen.getByRole('button', { name: 'Start combat' }));
    await waitFor(() => expect(session.publishInitiative).toHaveBeenCalled());
    const [, initiative] = vi.mocked(session.publishInitiative).mock.calls[0]!;
    const aria = initiative.turnOrder.find(
      entry => entry.displayName === 'Aria'
    )!;
    expect(aria).not.toHaveProperty('currentHp');
    expect(aria).not.toHaveProperty('isDead');
    expect(
      screen.getByText('Aria: player data unavailable — HP not broadcast')
    ).toBeVisible();
  });
});

describe('Combined Show + Start (PR04 P8, S2)', () => {
  const shown = (sceneId: string | null, blanked = false) => ({
    epoch: '10000000-0000-4000-8000-000000000001',
    revision: 3,
    writerFence: 1,
    leaseUntil: Date.now() + 30_000,
    holderSessionId: 'table-session-1',
    presentation: { sceneId, revision: 2, blanked },
    publicRunId: null,
  });
  const NOT_SHOWN = { sceneId: 'scene-other', blanked: false };

  async function prepare(
    repository: TableRepository,
    session: TableControlSession | null,
    presentation: {
      sceneId: string | null;
      blanked: boolean;
    } | null = NOT_SHOWN
  ) {
    renderPanel(repository, {
      controlSession: session,
      controlEpoch: 1,
      presentation,
    });
    await createRun('Bridge ambush');
    await chooseParticipants(['Goblin', 'Aria']);
    await setInitiative('Goblin', '12');
  }
  const runOf = (repository: TableRepository) =>
    readySnapshot(repository).encounters.find(
      value => value.label === 'Bridge ambush'
    )!;

  it('is offered next to Start only to the holder while this scene is not shown', async () => {
    const repository = await openFixture();
    await prepare(repository, fakeSession());
    expect(
      screen.getByRole('button', { name: 'Show scene and start combat' })
    ).toBeVisible();
    cleanup();
    await prepare(await openFixture(), fakeSession(), {
      sceneId: 'scene-1',
      blanked: false,
    });
    expect(
      screen.queryByRole('button', { name: 'Show scene and start combat' })
    ).toBeNull();
    cleanup();
    await prepare(await openFixture(), null);
    expect(
      screen.queryByRole('button', { name: 'Show scene and start combat' })
    ).toBeNull();
  });

  it('plan rejection: nothing is sent and nothing starts', async () => {
    const repository = await openFixture();
    const session = fakeSession();
    await prepare(repository, session);
    fireEvent.click(
      screen.getByRole('button', { name: 'Show scene and start combat' })
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Missing initiative: Aria/
    );
    expect(session.show).not.toHaveBeenCalled();
    expect(runOf(repository).isActive).toBe(false);
  });

  it('planner-only rejection (not caught by the panel pre-check): Show is never sent', async () => {
    const repository = await openFixture();
    const session = fakeSession();
    await prepare(repository, session);
    await setInitiative('Aria', '15');
    const before = revisionOf(repository);
    planner.reject = 'archive-capacity';
    try {
      fireEvent.click(
        screen.getByRole('button', { name: 'Show scene and start combat' })
      );
      expect(await screen.findByText(/Combat history is full/)).toBeVisible();
    } finally {
      planner.reject = null;
    }
    expect(session.show).not.toHaveBeenCalled();
    expect(session.blank).not.toHaveBeenCalled();
    expect(revisionOf(repository)).toBe(before);
    expect(runOf(repository).isActive).toBe(false);
  });

  it('local revision recheck: a change before Show aborts with nothing sent', async () => {
    const factory = new IDBFactory();
    const repository = await openFixture({ factory });
    const session = fakeSession();
    await prepare(repository, session);
    await setInitiative('Aria', '15');
    const other = await openFixture({ factory, seed: false });
    const reload = repository.reload.bind(repository);
    vi.spyOn(repository, 'reload').mockImplementationOnce(async () => {
      await runCombatCommand(other, {
        expectedRevision: revisionOf(other),
        operationId: 'other-tab-edit',
        command: {
          type: 'combat.setHidden',
          runId: runOf(other).runId,
          actorId: 'goblin',
          hidden: true,
          at: AT,
        },
      });
      return reload();
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Show scene and start combat' })
    );
    expect(
      await screen.findByText('Scene changed locally — review and retry')
    ).toBeVisible();
    expect(session.show).not.toHaveBeenCalled();
    expect(runOf(repository).isActive).toBe(false);
  });

  it('Show not committed: combat does not start and the reason is explained', async () => {
    const repository = await openFixture();
    const session = fakeSession();
    vi.mocked(session.show).mockResolvedValue({
      status: 'rejected',
      reason: 'scene-deleted',
      current: shown('scene-other'),
    });
    await prepare(repository, session);
    await setInitiative('Aria', '15');
    fireEvent.click(
      screen.getByRole('button', { name: 'Show scene and start combat' })
    );
    expect(
      await screen.findByText(
        /Scene not shown — combat did not start: this scene was deleted/
      )
    ).toBeVisible();
    expect(runOf(repository).isActive).toBe(false);
  });

  it.each([
    ['network', undefined],
    ['redis-unavailable', 503],
  ] as const)(
    'Show sent but not confirmed (%s): combat does not start and it never claims "not shown"',
    async (reason, httpStatus) => {
      const repository = await openFixture();
      const session = fakeSession();
      vi.mocked(session.show).mockResolvedValue({
        status: 'failed',
        reason,
        ...(httpStatus ? { httpStatus } : {}),
        command: {
          type: 'show',
          operationId: 'show-x',
          expectedEpoch: '10000000-0000-4000-8000-000000000001',
          expectedRevision: 3,
          expectedFence: 1,
          holderSessionId: 'table-session-1',
          sceneId: 'scene-1',
        },
      });
      await prepare(repository, session);
      await setInitiative('Aria', '15');
      fireEvent.click(
        screen.getByRole('button', { name: 'Show scene and start combat' })
      );
      expect(
        await screen.findByText(
          'Show not confirmed — combat did not start; check the audience status'
        )
      ).toBeVisible();
      expect(screen.queryByText(/Scene not shown/)).toBeNull();
      expect(runOf(repository).isActive).toBe(false);
    }
  );

  it('a definite 400 Show refusal still says "Scene not shown"', async () => {
    const repository = await openFixture();
    const session = fakeSession();
    vi.mocked(session.show).mockResolvedValue({
      status: 'failed',
      reason: 'unavailable',
      httpStatus: 400,
    });
    await prepare(repository, session);
    await setInitiative('Aria', '15');
    fireEvent.click(
      screen.getByRole('button', { name: 'Show scene and start combat' })
    );
    expect(
      await screen.findByText(/Scene not shown — combat did not start: /)
    ).toBeVisible();
    expect(runOf(repository).isActive).toBe(false);
  });

  it('Start conflicts after Show: the scene stays shown and the message says so', async () => {
    const factory = new IDBFactory();
    const repository = await openFixture({ factory });
    const session = fakeSession();
    const other = await openFixture({ factory, seed: false });
    await prepare(repository, session);
    await setInitiative('Aria', '15');
    vi.mocked(session.show).mockImplementation(async () => {
      await other.reload();
      await runCombatCommand(other, {
        expectedRevision: revisionOf(other),
        operationId: 'other-tab-during-show',
        command: {
          type: 'combat.setHidden',
          runId: runOf(other).runId,
          actorId: 'goblin',
          hidden: true,
          at: AT,
        },
      });
      return {
        status: 'committed',
        duplicate: false,
        current: shown('scene-1'),
      };
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Show scene and start combat' })
    );
    expect(
      await screen.findByText(/Scene is now shown; combat did not start: /)
    ).toBeVisible();
    expect(session.show).toHaveBeenCalledWith('scene-1', expect.any(String));
    expect(session.unpresent).not.toHaveBeenCalled();
    expect(session.blank).not.toHaveBeenCalled();
    await repository.reload();
    expect(runOf(repository).isActive).toBe(false);
  });

  it('both halves commit; a failed remote publish stays explicitly local-only', async () => {
    const repository = await openFixture();
    const session = fakeSession();
    vi.mocked(session.show).mockResolvedValue({
      status: 'committed',
      duplicate: false,
      current: shown('scene-1'),
    });
    vi.mocked(session.publishInitiative).mockResolvedValue({
      status: 'failed',
      reason: 'network',
    });
    await prepare(repository, session);
    await setInitiative('Aria', '15');
    fireEvent.click(
      screen.getByRole('button', { name: 'Show scene and start combat' })
    );
    expect(
      await screen.findByText('Scene shown and combat started')
    ).toBeVisible();
    expect(await screen.findByText(/ROUND 1 · NOW/)).toBeVisible();
    expect(
      await screen.findByText(/Started locally · not broadcasting/)
    ).toBeVisible();
    expect(runOf(repository).isActive).toBe(true);
  });

  it('"Start combat" alone never shows the scene (D9)', async () => {
    const repository = await openFixture();
    const session = fakeSession();
    await prepare(repository, session);
    await setInitiative('Aria', '15');
    fireEvent.click(screen.getByRole('button', { name: 'Start combat' }));
    expect(await screen.findByText(/ROUND 1 · NOW/)).toBeVisible();
    expect(session.show).not.toHaveBeenCalled();
  });
});
