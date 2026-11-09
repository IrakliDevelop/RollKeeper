import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EntityActions } from '@/components/ui/encounter/combat-screen/types';
import {
  runCombatCommand,
  type TableCombatCommandV1,
} from '@/lib/table/combat';
import {
  ADOPTED_PC,
  AT,
  SCENE_ID,
  openFixture,
  readySnapshot,
  repositories,
  revisionOf,
} from '@/lib/table/combat.fixture';
import { buildCombatReadModel } from '@/lib/table/combatReadModel';
import type { TableRepository } from '@/lib/table/repository';
import { createMockCharacterState, createMockPlayerData } from '@/test/helpers';

import {
  NOT_AVAILABLE_IN_SCENE_RUNS,
  createTableEntityActions,
  tableDetailCapabilities,
} from './tableEntityActions';

afterEach(() =>
  repositories.splice(0).forEach(repository => repository.dispose())
);

let counter = 0;
async function commit(repository: TableRepository, command: unknown) {
  counter += 1;
  const result = await runCombatCommand(repository, {
    expectedRevision: revisionOf(repository),
    operationId: `adapter-${counter}`,
    command: command as TableCombatCommandV1,
  });
  if (result.status !== 'committed') throw new Error(JSON.stringify(result));
}

async function model() {
  const repository = await openFixture();
  await commit(repository, {
    type: 'combat.createRun',
    sceneId: SCENE_ID,
    runId: 'run-a',
    label: 'Fight',
    at: AT,
  });
  await commit(repository, {
    type: 'combat.setParticipants',
    runId: 'run-a',
    actorIds: ['goblin', 'aria', ADOPTED_PC],
    at: AT,
  });
  for (const actorId of ['goblin', 'aria', ADOPTED_PC])
    await commit(repository, {
      type: 'combat.setInitiative',
      runId: 'run-a',
      actorId,
      value: 10,
      at: AT,
    });
  await commit(repository, { type: 'combat.start', runId: 'run-a', at: AT });
  await commit(repository, {
    type: 'combat.applyStat',
    runId: 'run-a',
    actorId: 'aria',
    change: { kind: 'addCondition', condition: { name: 'Hexed' } },
    at: AT,
  });
  return buildCombatReadModel({
    snapshot: readySnapshot(repository),
    runId: 'run-a',
    players: [
      createMockPlayerData({
        playerId: 'legacy-aria',
        characterId: 'char-aria',
        characterData: createMockCharacterState({
          conditionsAndDiseases: {
            activeConditions: [
              {
                id: 'p',
                name: 'Prone',
                source: 'PHB',
                description: '',
                stackable: false,
                count: 1,
                appliedAt: AT,
              },
            ],
            activeDiseases: [],
            exhaustionVariant: '2024',
          },
        } as never),
      }),
    ],
  })!;
}

/** Compile-time exhaustive: a new EntityActions member fails type-check here. */
const MEMBERS: Record<keyof EntityActions, (actions: EntityActions) => void> = {
  onUpdate: a => a.onUpdate('m-goblin', { armorClass: 17 }),
  onRemove: a => a.onRemove('m-goblin'),
  onDamage: a => a.onDamage('m-goblin', 3),
  onHeal: a => a.onHeal('m-goblin', 3),
  onAddTempHp: a => a.onAddTempHp('m-goblin', 3),
  onSetMaxHp: a => a.onSetMaxHp('m-goblin', 9),
  onAddCondition: a =>
    a.onAddCondition('m-goblin', { name: 'Prone', source: 'dm' }),
  onRemoveCondition: a => a.onRemoveCondition('m-goblin', 'missing'),
  onSetConditionRounds: a => a.onSetConditionRounds('m-goblin', 'c', 2),
  onUseAbility: a => a.onUseAbility('m-goblin', 'x'),
  onUseInventoryEntry: a => a.onUseInventoryEntry?.('m-goblin', 'x'),
  onRestoreAbility: a => a.onRestoreAbility('m-goblin', 'x'),
  onSpendResource: a => a.onSpendResource('m-goblin', 'x', 1),
  onRestoreResource: a => a.onRestoreResource('m-goblin', 'x', 1),
  onUseLegendaryAction: a => a.onUseLegendaryAction('m-goblin', 'x'),
  onResetLegendaryActions: a => a.onResetLegendaryActions('m-goblin'),
  onSetConcentration: a => a.onSetConcentration('m-goblin', 'Bless'),
  onUseLairAction: a => a.onUseLairAction('m-goblin', 'x'),
  onSetInitiative: a => a.onSetInitiative('m-goblin', 14),
  onLongRest: a => a.onLongRest('m-goblin'),
  onShortRest: a => a.onShortRest('m-goblin'),
  onViewPlayer: a => a.onViewPlayer?.('char-aria'),
  onViewNPC: a => a.onViewNPC?.('npc', 'm-goblin'),
  onChangePlayerColor: a => a.onChangePlayerColor?.('char-aria', '#fff'),
  onAdjustCounter: a => a.onAdjustCounter?.('legacy-aria', 1),
};

const SUPPORTED = new Set<keyof EntityActions>([
  'onUpdate',
  'onDamage',
  'onHeal',
  'onAddTempHp',
  'onSetMaxHp',
  'onAddCondition',
  'onRemoveCondition',
  'onSetConditionRounds',
  'onSetInitiative',
]);

describe('Table EntityActions adapter (R2-4, R2-5, C3-1, C3-2, C3-3)', () => {
  it.each(Object.keys(MEMBERS) as Array<keyof EntityActions>)(
    '%s maps to exactly one command or the visible notice with no write',
    async member => {
      const view = await model();
      const dispatch = vi.fn();
      const notify = vi.fn();
      const actions = createTableEntityActions({
        model: view,
        dispatch,
        notify,
      });
      MEMBERS[member](actions);
      if (SUPPORTED.has(member) && member !== 'onRemoveCondition') {
        expect(dispatch).toHaveBeenCalledTimes(1);
        expect(notify).not.toHaveBeenCalled();
      } else if (member === 'onRemoveCondition') {
        // Unknown condition id: refused visibly, nothing written.
        expect(dispatch).not.toHaveBeenCalled();
        expect(notify).toHaveBeenCalledTimes(1);
      } else {
        expect(dispatch).not.toHaveBeenCalled();
        expect(notify).toHaveBeenCalledWith(NOT_AVAILABLE_IN_SCENE_RUNS);
      }
    }
  );

  it('maps every allowlisted onUpdate field to one command and refuses others', async () => {
    const view = await model();
    const dispatch = vi.fn();
    const notify = vi.fn();
    const actions = createTableEntityActions({ model: view, dispatch, notify });
    actions.onUpdate('m-goblin', { armorClass: 17 });
    actions.onUpdate('m-goblin', { currentHp: 4 });
    actions.onUpdate('m-goblin', { maxHp: 9 });
    actions.onUpdate('m-goblin', { tempHp: 0 });
    actions.onUpdate('m-goblin', { hasUsedReaction: true });
    actions.onUpdate('m-goblin', { isHidden: true });
    expect(dispatch.mock.calls.map(call => call[0])).toEqual([
      {
        type: 'combat.applyStat',
        actorId: 'goblin',
        change: { kind: 'setArmorClass', value: 17 },
      },
      {
        type: 'combat.applyStat',
        actorId: 'goblin',
        change: { kind: 'setHp', value: 4 },
      },
      {
        type: 'combat.applyStat',
        actorId: 'goblin',
        change: { kind: 'setMaxHp', value: 9 },
      },
      {
        type: 'combat.applyStat',
        actorId: 'goblin',
        change: { kind: 'setTempHp', value: 0 },
      },
      {
        type: 'combat.applyStat',
        actorId: 'goblin',
        change: { kind: 'setReaction', available: false },
      },
      { type: 'combat.setHidden', actorId: 'goblin', hidden: true },
    ]);
    for (const updates of [
      { name: 'Renamed' },
      { tempAc: 2 },
      { playerDisposition: 'ally' as const },
      { deathSaves: { successes: 1, failures: 0, isStabilized: false } },
      { armorClass: 12, maxHp: 3 },
    ]) {
      dispatch.mockClear();
      notify.mockClear();
      actions.onUpdate('m-goblin', updates);
      expect(dispatch).not.toHaveBeenCalled();
      expect(notify).toHaveBeenCalledWith(NOT_AVAILABLE_IN_SCENE_RUNS);
    }
  });

  it('collapses player-sync removal into one command and drops the suppression update silently', async () => {
    const view = await model();
    const dispatch = vi.fn();
    const notify = vi.fn();
    const actions = createTableEntityActions({ model: view, dispatch, notify });
    actions.onUpdate('m-aria', { suppressedConditions: ['Prone'] });
    actions.onRemoveCondition('m-aria', 'psync-prone');
    expect(notify).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'combat.applyStat',
      actorId: 'aria',
      change: {
        kind: 'removeCondition',
        conditionId: 'psync-prone',
        conditionName: 'Prone',
        playerConditionNames: ['Prone'],
      },
    });
  });

  it('derives detail capabilities per participant kind', async () => {
    const view = await model();
    const byActor = new Map(
      view.participants.map(participant => [participant.actorId, participant])
    );
    expect(tableDetailCapabilities(byActor.get('goblin')!)).toMatchObject({
      hp: true,
      tempHp: true,
      maxHp: true,
      armorClass: true,
      conditions: true,
      reaction: true,
      hidden: true,
    });
    expect(tableDetailCapabilities(byActor.get('aria')!)).toMatchObject({
      hp: false,
      armorClass: false,
      conditions: true,
      reaction: false,
    });
    expect(tableDetailCapabilities(byActor.get(ADOPTED_PC)!)).toMatchObject({
      hp: false,
      conditions: false,
      reaction: true,
      readOnlyNote: expect.stringMatching(/Copied PC \(view only\)/),
    });
  });

  it('strips undefined optional fields so the command validates (F9)', async () => {
    const view = await model();
    const dispatch = vi.fn();
    const actions = createTableEntityActions({
      model: view,
      dispatch,
      notify: vi.fn(),
    });
    actions.onAddCondition('m-goblin', {
      name: 'Prone',
      source: 'dm',
      description: undefined,
      rounds: undefined,
    });
    const draft = dispatch.mock.calls[0]![0] as {
      change: { condition: Record<string, unknown> };
    };
    expect(Object.keys(draft.change.condition).sort()).toEqual([
      'name',
      'source',
    ]);
    const repository = repositories.at(-1)!;
    const result = await runCombatCommand(repository, {
      expectedRevision: revisionOf(repository),
      operationId: 'f9-condition',
      command: {
        ...(draft as unknown as Record<string, unknown>),
        runId: 'run-a',
        at: AT,
      } as TableCombatCommandV1,
    });
    expect(result.status).toBe('committed');
  });
});
