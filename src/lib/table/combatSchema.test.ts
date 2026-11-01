import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';

import { exportTableBundle, importTableBundle } from './bundle';
import { TableRepository, type TableWorkspaceSelection } from './repository';
import {
  canonicalJson,
  validateEncounterRecord,
  validateLogRecord,
  type TableActorRecordV1,
  type TableEncounterRecordV1,
  type TableLogRecordV1,
  type TableSceneRecordV1,
} from './schema';

const AT = '2026-10-07T00:00:00.000Z';
const selection: TableWorkspaceSelection = {
  account: { kind: 'authenticated', accountId: 'account-schema' },
  workspace: { localWorkspaceId: 'workspace-schema' },
};
const repositories: TableRepository[] = [];
afterEach(() =>
  repositories.splice(0).forEach(repository => repository.dispose())
);

function scene(workspaceKey: string): TableSceneRecordV1 {
  return {
    schemaVersion: 1,
    workspaceKey,
    sceneId: 'scene-1',
    originalMapId: null,
    map: {
      name: 'Map',
      mapImageUrl: '/map.webp',
      mapImageSize: { w: 10, h: 10 },
      gridEnabled: false,
      gridSettings: null,
      markers: [],
      dmOnlyElements: {},
    },
    canvasCheckpoint: null,
    members: [{ actorId: 'actor-1', tokenIds: [], sceneMemberId: 'member-1' }],
    arrivalPoint: null,
    createdAt: AT,
    updatedAt: AT,
  };
}

function actor(workspaceKey: string): TableActorRecordV1 {
  return {
    schemaVersion: 1,
    workspaceKey,
    actorId: 'actor-1',
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
    createdAt: AT,
    updatedAt: AT,
  };
}

/** A PR01/PR02-shaped run: none of the PR03 optional fields. */
function pr02Run(workspaceKey: string): TableEncounterRecordV1 {
  return {
    schemaVersion: 1,
    workspaceKey,
    runId: 'run-1',
    sceneId: 'scene-1',
    sourceEncounterId: null,
    runGeneration: 'run-1',
    participants: [
      {
        actorId: 'actor-1',
        initiative: 12,
        turnResources: { reactionAvailable: true, legendaryActionsUsed: 0 },
      },
    ],
    round: 0,
    currentActorId: null,
    isActive: false,
    createdAt: AT,
    updatedAt: AT,
  };
}

function pr02Log(workspaceKey: string): TableLogRecordV1 {
  return {
    schemaVersion: 1,
    workspaceKey,
    archiveId: 'run-1:legacy',
    runId: 'run-1',
    events: [{ id: 'e-1', type: 'combat_start' }],
    startedAt: AT,
    endedAt: null,
  };
}

function pr03Run(workspaceKey: string): TableEncounterRecordV1 {
  return {
    ...pr02Run(workspaceKey),
    runId: 'run-2',
    runGeneration: 'run-2',
    label: 'Ambush at the ford',
    combatGeneration: 2,
    participants: [
      {
        actorId: 'actor-1',
        initiative: 0,
        turnResources: { reactionAvailable: true, legendaryActionsUsed: 0 },
        hidden: true,
      },
    ],
    publication: { intent: 'end', combatGeneration: 2, acknowledged: false },
  };
}

function pr03Log(workspaceKey: string): TableLogRecordV1 {
  return {
    ...pr02Log(workspaceKey),
    archiveId: 'run-2:2',
    runId: 'run-2',
    sceneId: 'scene-1',
    combatGeneration: 2,
    loggingPaused: true,
    endedAt: AT,
  };
}

describe('PR03 additive schema (D1, R3)', () => {
  it('accepts the new optional run and log fields', () => {
    expect(validateEncounterRecord(pr03Run('w')).ok).toBe(true);
    expect(validateLogRecord(pr03Log('w')).ok).toBe(true);
  });

  it('keeps PR01/PR02 run and log records valid without the new fields', () => {
    expect(validateEncounterRecord(pr02Run('w')).ok).toBe(true);
    expect(validateLogRecord(pr02Log('w')).ok).toBe(true);
  });

  it.each([
    ['empty label', { label: '' }],
    ['label over 200 characters', { label: 'é'.repeat(201) }],
    ['non-string label', { label: 7 }],
    ['negative generation', { combatGeneration: -1 }],
    ['fractional generation', { combatGeneration: 1.5 }],
    ['unsafe generation', { combatGeneration: Number.MAX_SAFE_INTEGER + 1 }],
    [
      'publication with unknown intent',
      {
        publication: {
          intent: 'show',
          combatGeneration: 1,
          acknowledged: false,
        },
      },
    ],
    [
      'publication missing acknowledged',
      {
        publication: { intent: 'publish', combatGeneration: 1 },
      },
    ],
    [
      'publication with extra key',
      {
        publication: {
          intent: 'publish',
          combatGeneration: 1,
          acknowledged: false,
          token: 'x',
        },
      },
    ],
    [
      'publication with negative generation',
      {
        publication: {
          intent: 'end',
          combatGeneration: -2,
          acknowledged: true,
        },
      },
    ],
  ])('rejects a run with %s', (_name, patch) => {
    expect(
      validateEncounterRecord({ ...pr03Run('w'), ...(patch as object) }).ok
    ).toBe(false);
  });

  it('accepts a 200-character Unicode label', () => {
    expect(
      validateEncounterRecord({ ...pr03Run('w'), label: '🐉'.repeat(200) }).ok
    ).toBe(true);
  });

  it.each([
    ['hidden false', { hidden: false }],
    ['hidden string', { hidden: 'yes' }],
  ])(
    'rejects a participant with %s (only `true` or absent)',
    (_name, patch) => {
      const run = pr03Run('w');
      run.participants = [{ ...run.participants[0]!, ...(patch as object) }];
      expect(validateEncounterRecord(run).ok).toBe(false);
    }
  );

  it.each([
    ['empty sceneId', { sceneId: '' }],
    ['negative generation', { combatGeneration: -1 }],
    ['loggingPaused false', { loggingPaused: false }],
  ])('rejects a log with %s', (_name, patch) => {
    expect(
      validateLogRecord({ ...pr03Log('w'), ...(patch as object) }).ok
    ).toBe(false);
  });

  it('round-trips PR02 and PR03 run/log records byte-stably through a bundle', async () => {
    const factory = new IDBFactory();
    const source = new TableRepository({
      factory,
      selection,
      broadcastChannel: null,
      events: null,
    });
    repositories.push(source);
    await source.start();
    const key = source.workspaceIdentity;
    const committed = await source.mutateWorkspace(0, 'seed', {
      scenes: { put: [scene(key)] },
      actors: { put: [actor(key)] },
      encounters: { put: [pr02Run(key), pr03Run(key)] },
      logs: { put: [pr02Log(key), pr03Log(key)] },
    });
    expect(committed.status).toBe('committed');

    const raw = await exportTableBundle(source);
    const bundle = JSON.parse(raw) as {
      records: { encounters: unknown[]; logs: unknown[] };
    };
    const byId = (values: unknown[], key: string, id: string) =>
      values.find(value => (value as Record<string, unknown>)[key] === id);
    expect(
      canonicalJson(byId(bundle.records.encounters, 'runId', 'run-1'))
    ).toBe(canonicalJson(pr02Run(key)));
    expect(
      canonicalJson(byId(bundle.records.encounters, 'runId', 'run-2'))
    ).toBe(canonicalJson(pr03Run(key)));
    expect(
      canonicalJson(byId(bundle.records.logs, 'archiveId', 'run-1:legacy'))
    ).toBe(canonicalJson(pr02Log(key)));
    expect(
      canonicalJson(byId(bundle.records.logs, 'archiveId', 'run-2:2'))
    ).toBe(canonicalJson(pr03Log(key)));

    const imported = await importTableBundle({
      factory,
      account: selection.account,
      activeWorkspaceKey: key,
      targetCampaignCode: 'CAMP-SCHEMA',
      raw,
      newWorkspaceId: () => 'schema-fork',
    });
    expect(imported.status).toBe('imported');
    const target = new TableRepository({
      factory,
      broadcastChannel: null,
      events: null,
      selection: {
        account: selection.account,
        workspace: {
          localWorkspaceId: 'schema-fork',
          sourceCampaignCode: null,
          routeCampaignCode: 'CAMP-SCHEMA',
        },
      },
    });
    repositories.push(target);
    const loaded = await target.start();
    if (loaded.status !== 'ready') throw new Error('expected ready import');
    const targetKey = target.workspaceIdentity;
    const run1 = loaded.snapshot.encounters.find(run => run.runId === 'run-1');
    const run2 = loaded.snapshot.encounters.find(run => run.runId === 'run-2');
    expect(canonicalJson(run1)).toBe(canonicalJson(pr02Run(targetKey)));
    expect(canonicalJson(run2)).toBe(canonicalJson(pr03Run(targetKey)));
    expect(
      canonicalJson(
        loaded.snapshot.logs.find(log => log.archiveId === 'run-2:2')
      )
    ).toBe(canonicalJson(pr03Log(targetKey)));
  });
});
