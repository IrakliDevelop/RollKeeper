import { afterEach, describe, expect, it } from 'vitest';

import {
  createMockCharacterState,
  createMockEncounterEntity,
  createMockPlayerData,
} from '@/test/helpers';
import type { CampaignPlayerData } from '@/types/campaign';
import type { EncounterCondition } from '@/types/encounter';
import { mergePlayerSyncData } from '@/utils/encounterSync';

import { runCombatCommand, type TableCombatCommandV1 } from './combat';
import {
  ADOPTED_PC,
  AT,
  SCENE_ID,
  openFixture,
  readySnapshot,
  repositories,
  revisionOf,
} from './combat.fixture';
import { buildCombatReadModel } from './combatReadModel';
import { runRosterCommand } from './roster';
import type { TableRepository } from './repository';

afterEach(() =>
  repositories.splice(0).forEach(repository => repository.dispose())
);

let counter = 0;
async function commit(repository: TableRepository, command: unknown) {
  counter += 1;
  const result = await runCombatCommand(repository, {
    expectedRevision: revisionOf(repository),
    operationId: `read-model-${counter}`,
    command: command as TableCombatCommandV1,
  });
  if (result.status !== 'committed') throw new Error(JSON.stringify(result));
  return result;
}

function activeCondition(name: string) {
  return {
    id: `cond-${name}`,
    name,
    source: 'PHB',
    description: `${name} description`,
    stackable: false,
    count: 1,
    appliedAt: '2025-01-01T00:00:00.000Z',
  };
}

function ariaPlayer(
  conditions: string[] = [],
  patch: Parameters<typeof createMockCharacterState>[0] = {}
): CampaignPlayerData {
  return createMockPlayerData({
    playerId: 'legacy-aria',
    characterId: 'char-aria',
    characterName: 'Aria',
    characterData: createMockCharacterState({
      hitPoints: {
        current: 17,
        max: 31,
        temporary: 2,
        calculationMode: 'auto',
      },
      conditionsAndDiseases: {
        activeConditions: conditions.map(activeCondition),
        activeDiseases: [],
        exhaustionVariant: '2024',
      },
      reaction: { hasUsedReaction: true },
      ...patch,
    } as never),
  });
}

const branPlayer = (): CampaignPlayerData =>
  createMockPlayerData({
    playerId: 'legacy-bran',
    characterId: 'char-bran',
    characterName: 'Bran',
    characterData: createMockCharacterState({
      hitPoints: { current: 9, max: 30, temporary: 0, calculationMode: 'auto' },
    } as never),
  });

async function fight(repository: TableRepository, actorIds: string[]) {
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
    actorIds,
    hiddenActorIds: ['orc'],
    at: AT,
  });
  for (const [index, actorId] of actorIds.entries()) {
    await commit(repository, {
      type: 'combat.setInitiative',
      runId: 'run-a',
      actorId,
      value: 30 - index * 5,
      at: AT,
    });
  }
  await commit(repository, { type: 'combat.start', runId: 'run-a', at: AT });
}

describe('Table combat read model (D5, R2-1, R2-2)', () => {
  it('presents participants sorted under their sceneMemberId with type mapping', async () => {
    const repository = await openFixture();
    await fight(repository, ['goblin', 'orc', 'knight', 'aria', ADOPTED_PC]);
    const model = buildCombatReadModel({
      snapshot: readySnapshot(repository),
      runId: 'run-a',
      players: [ariaPlayer()],
    })!;
    expect(model.encounter.entities.map(entity => entity.id)).toEqual([
      'm-goblin',
      'm-orc',
      'm-knight',
      'm-aria',
      'm-pc1',
    ]);
    expect(model.encounter).toMatchObject({
      id: 'run-a',
      name: 'Fight',
      round: 1,
      currentTurn: 0,
      isActive: true,
    });
    const byId = new Map(model.encounter.entities.map(e => [e.id, e]));
    expect(byId.get('m-goblin')).toMatchObject({ type: 'monster' });
    expect(byId.get('m-orc')).toMatchObject({ type: 'npc', isHidden: true });
    expect(byId.get('m-knight')?.type).toBe('player');
    expect(byId.get('m-knight')?.playerCharacterId).toBeUndefined();
    expect(byId.get('m-aria')).toMatchObject({
      type: 'player',
      playerCharacterId: 'char-aria',
    });
    // Unverified adopted PC: adoption stats, read-only, identity unresolved.
    expect(byId.get('m-pc1')).toMatchObject({ type: 'player', currentHp: 22 });
    expect(byId.get('m-pc1')?.playerCharacterId).toBeUndefined();
    const pc = model.participants.find(value => value.actorId === ADOPTED_PC)!;
    expect(pc).toMatchObject({
      kind: 'adopted-pc',
      identityUnresolved: true,
      playerControlled: false,
    });
    expect(JSON.stringify(model.encounter)).not.toContain(ADOPTED_PC);
  });

  it('merges the verified adopted PC live data read-only (published HP is live)', async () => {
    const repository = await openFixture();
    await fight(repository, ['goblin', ADOPTED_PC]);
    const model = buildCombatReadModel({
      snapshot: readySnapshot(repository),
      runId: 'run-a',
      players: [branPlayer()],
    })!;
    const pc = model.encounter.entities.find(e => e.id === 'm-pc1')!;
    expect(pc).toMatchObject({
      type: 'player',
      playerCharacterId: 'char-bran',
      currentHp: 9,
      maxHp: 30,
    });
    expect(
      model.participants.find(value => value.actorId === ADOPTED_PC)
    ).toMatchObject({ playerControlled: true, identityUnresolved: false });
  });

  it('keeps player identity after Return to DM control (C3-4)', async () => {
    const repository = await openFixture();
    await fight(repository, ['goblin', 'aria']);
    const result = await runRosterCommand(repository, {
      expectedRevision: revisionOf(repository),
      operationId: 'return-to-dm',
      command: {
        type: 'roster.reassignControl',
        sceneId: SCENE_ID,
        sceneMemberId: 'm-aria',
        control: { kind: 'dm' },
        at: AT,
      },
      players: [
        { playerId: 'legacy-aria', characterId: 'char-aria', name: 'Aria' },
      ],
    });
    expect(result.status).toBe('committed');
    const model = buildCombatReadModel({
      snapshot: readySnapshot(repository),
      runId: 'run-a',
      players: [ariaPlayer()],
    })!;
    expect(model.encounter.entities.find(e => e.id === 'm-aria')).toMatchObject(
      {
        type: 'player',
        playerCharacterId: 'char-aria',
        currentHp: 17,
      }
    );
  });

  it('reuses the encounterSync precedence fixtures for player conditions', async () => {
    const repository = await openFixture();
    await fight(repository, ['goblin', 'aria']);
    await commit(repository, {
      type: 'combat.applyStat',
      runId: 'run-a',
      actorId: 'aria',
      change: {
        kind: 'addCondition',
        condition: { name: 'Stunned', source: 'dm' },
      },
      at: AT,
    });
    await commit(repository, {
      type: 'combat.applyStat',
      runId: 'run-a',
      actorId: 'aria',
      change: {
        kind: 'addCondition',
        condition: { name: 'Poisoned', source: 'dm' },
      },
      at: AT,
    });
    const player = ariaPlayer(['Blinded', 'Poisoned']);
    const model = buildCombatReadModel({
      snapshot: readySnapshot(repository),
      runId: 'run-a',
      players: [player],
    })!;
    const aria = model.encounter.entities.find(e => e.id === 'm-aria')!;
    // Same result as the legacy merge over an equivalent encounter entity.
    const overlay = readySnapshot(repository).actors.find(
      actor => actor.actorId === 'aria'
    )!.playerConditionOverlay!;
    const legacy = mergePlayerSyncData(
      createMockEncounterEntity({
        type: 'player',
        conditions: overlay.dmConditions as unknown as EncounterCondition[],
      }),
      player
    )!;
    expect(aria.conditions).toEqual(legacy.conditions);
    // DM condition preserved; player-sync wins a same-name duplicate.
    expect(aria.conditions.map(c => [c.name, c.source])).toEqual([
      ['Stunned', 'dm'],
      ['Blinded', 'player-sync'],
      ['Poisoned', 'player-sync'],
    ]);
    expect(aria).toMatchObject({ currentHp: 17, maxHp: 31, tempHp: 2 });
  });

  it('filters stale suppressions against current player conditions (C3-5)', async () => {
    const repository = await openFixture();
    await fight(repository, ['goblin', 'aria']);
    await commit(repository, {
      type: 'combat.applyStat',
      runId: 'run-a',
      actorId: 'aria',
      change: {
        kind: 'removeCondition',
        conditionId: 'psync-prone',
        conditionName: 'Prone',
        playerConditionNames: ['Prone'],
      },
      at: AT,
    });
    const view = (conditions: string[]) =>
      buildCombatReadModel({
        snapshot: readySnapshot(repository),
        runId: 'run-a',
        players: [ariaPlayer(conditions)],
      })!;
    expect(
      view(['Prone']).encounter.entities.find(e => e.id === 'm-aria')!
        .conditions
    ).toEqual([]);
    // Player cleared Prone: the suppression is stale and reported for pruning.
    const cleared = view([]);
    expect(
      cleared.participants.find(value => value.actorId === 'aria')
    ).toMatchObject({ staleSuppressions: ['Prone'], playerConditionNames: [] });
    await commit(repository, {
      type: 'combat.pruneSuppressions',
      actorId: 'aria',
      playerConditionNames: [],
      at: AT,
    });
    // Player is Prone again: visible to the DM and in the published payload.
    const again = view(['Prone']);
    expect(
      again.encounter.entities
        .find(e => e.id === 'm-aria')!
        .conditions.map(c => c.name)
    ).toEqual(['Prone']);
  });

  it('takes reaction from the player sheet for player-controlled participants only (R2-10)', async () => {
    const repository = await openFixture();
    await fight(repository, ['goblin', 'aria']);
    await commit(repository, {
      type: 'combat.applyStat',
      runId: 'run-a',
      actorId: 'goblin',
      change: { kind: 'setReaction', available: false },
      at: AT,
    });
    const model = buildCombatReadModel({
      snapshot: readySnapshot(repository),
      runId: 'run-a',
      players: [
        ariaPlayer([], { reaction: { hasUsedReaction: false } } as never),
      ],
    })!;
    const byId = new Map(model.encounter.entities.map(e => [e.id, e]));
    expect(byId.get('m-goblin')?.hasUsedReaction).toBe(true);
    expect(byId.get('m-aria')?.hasUsedReaction).toBe(false);
  });

  it('labels a removed member that remains a participant', async () => {
    const repository = await openFixture();
    await fight(repository, ['goblin', 'orc']);
    await runRosterCommand(repository, {
      expectedRevision: revisionOf(repository),
      operationId: 'remove-orc',
      command: {
        type: 'roster.removeMember',
        sceneId: SCENE_ID,
        sceneMemberId: 'm-orc',
        at: AT,
      },
    });
    const model = buildCombatReadModel({
      snapshot: readySnapshot(repository),
      runId: 'run-a',
    })!;
    expect(
      model.participants.find(value => value.actorId === 'orc')
    ).toMatchObject({ removedFromScene: true, entityId: 'm-orc' });
  });
});
