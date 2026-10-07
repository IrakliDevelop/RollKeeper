import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';

import {
  AT,
  SCENE_ID,
  fixtureSelection,
  openFixture,
  repositories,
  revisionOf,
} from './combat.fixture';
import { findSceneRunsForEncounter } from './combatLibrary';
import { TableRepository } from './repository';

afterEach(() =>
  repositories.splice(0).forEach(repository => repository.dispose())
);

async function names(factory: IDBFactory) {
  return (await factory.databases()).map(database => database.name);
}

describe('library "Open scene run" lookup (D10, R2-9)', () => {
  it('returns nothing and creates no database when Table storage was never used', async () => {
    const factory = new IDBFactory();
    await expect(
      findSceneRunsForEncounter({
        factory,
        account: fixtureSelection.account,
        campaignCode: 'CAMP',
        encounterId: 'enc-1',
      })
    ).resolves.toEqual([]);
    expect(await names(factory)).toEqual([]);
  });

  it('returns nothing when the databases() API is unavailable', async () => {
    const factory = new IDBFactory();
    const limited = Object.assign(Object.create(factory), {
      databases: undefined,
    }) as IDBFactory;
    await expect(
      findSceneRunsForEncounter({
        factory: limited,
        account: fixtureSelection.account,
        campaignCode: 'CAMP',
        encounterId: 'enc-1',
      })
    ).resolves.toEqual([]);
    expect(await names(factory)).toEqual([]);
  });

  it('finds runs adopted from the encounter in the current account workspace only', async () => {
    const factory = new IDBFactory();
    // The fixture workspace is bound to campaign code CAMP-COMBAT.
    const repository = new TableRepository({
      factory,
      selection: {
        account: fixtureSelection.account,
        workspace: {
          localWorkspaceId: 'workspace-library',
          sourceCampaignCode: 'CAMP-COMBAT',
        },
      },
      broadcastChannel: null,
      events: null,
    });
    repositories.push(repository);
    await repository.start();
    const seeded = await openFixture({ factory });
    void seeded;
    const key = repository.workspaceIdentity;
    const committed = await repository.mutateWorkspace(
      revisionOf(repository),
      'library-seed',
      {
        scenes: {
          put: [
            {
              schemaVersion: 1,
              workspaceKey: key,
              sceneId: SCENE_ID,
              originalMapId: null,
              map: {
                name: 'Map',
                mapImageUrl: '/m.webp',
                mapImageSize: { w: 1, h: 1 },
                gridEnabled: false,
                gridSettings: null,
                markers: [],
                dmOnlyElements: {},
              },
              canvasCheckpoint: null,
              members: [],
              arrivalPoint: null,
              createdAt: AT,
              updatedAt: AT,
            },
          ],
        },
        encounters: {
          put: ['enc-1', 'enc-2'].map((sourceEncounterId, index) => ({
            schemaVersion: 1 as const,
            workspaceKey: key,
            runId: `run-${index}`,
            sceneId: SCENE_ID,
            sourceEncounterId,
            runGeneration: `run-${index}`,
            participants: [],
            round: 0,
            currentActorId: null,
            isActive: false,
            createdAt: AT,
            updatedAt: AT,
            label: `Adopted ${index}`,
          })),
        },
      }
    );
    expect(committed.status).toBe('committed');
    await expect(
      findSceneRunsForEncounter({
        factory,
        account: fixtureSelection.account,
        campaignCode: 'CAMP-COMBAT',
        encounterId: 'enc-1',
      })
    ).resolves.toEqual([
      {
        runId: 'run-0',
        sceneId: SCENE_ID,
        label: 'Adopted 0',
        localWorkspaceId: 'workspace-library',
        defaultWorkspace: true,
      },
    ]);
    await expect(
      findSceneRunsForEncounter({
        factory,
        account: { kind: 'guest' },
        campaignCode: 'CAMP-COMBAT',
        encounterId: 'enc-1',
      })
    ).resolves.toEqual([]);
    await expect(
      findSceneRunsForEncounter({
        factory,
        account: fixtureSelection.account,
        campaignCode: 'OTHER',
        encounterId: 'enc-1',
      })
    ).resolves.toEqual([]);
  });
});
