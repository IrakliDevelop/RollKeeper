import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BattleMapConnection } from '@/lib/battlemapSync';
import { adoptTableScene, captureAdoptionPreview } from './adoption';
import { prepareTableSceneAuthority } from './authorityLifecycle';
import { saveSceneCheckpoint } from './checkpoint';
import { TableRepository, type TableWorkspaceSelection } from './repository';
import { createTableSceneAdapter } from './sceneAdapter';

const selection: TableWorkspaceSelection = {
  account: { kind: 'authenticated', accountId: 'account-1' },
  workspace: {
    localWorkspaceId: 'workspace-1',
    sourceCampaignCode: 'CAMP',
  },
};
const repositories: TableRepository[] = [];
afterEach(() =>
  repositories.splice(0).forEach(repository => repository.dispose())
);

describe('adopt to live authority checkpoint integration', () => {
  it('registers original map identity, edits, checkpoints and faithfully reloads canvas/layers/fog', async () => {
    const repository = new TableRepository({
      factory: new IDBFactory(),
      selection,
    });
    repositories.push(repository);
    await repository.start();
    const sourceCanvas = {
      version: 4,
      camera: { position: { x: 3, y: 4 }, zoom: 1.5 },
      elements: [{ id: 'source-token', type: 'token', layerId: 'tokens' }],
      layers: [
        {
          id: 'tokens',
          name: 'Tokens',
          visible: true,
          locked: false,
          order: 0,
          opacity: 1,
        },
      ],
      activeLayerId: 'tokens',
      extensions: { fog: { version: 1, data: null } },
    };
    const source = {
      readCampaign: vi.fn(async () => '{"code":"CAMP"}'),
      readMap: vi.fn(async () =>
        JSON.stringify({
          id: 'map-original',
          name: 'Crypt',
          canvasState: JSON.stringify(sourceCanvas),
          mapImageUrl: '/map.webp',
          mapImageSize: { w: 100, h: 100 },
          gridEnabled: false,
          linkedEncounterIds: [],
          markers: [],
          dmOnlyElements: {},
        })
      ),
      readEncounter: vi.fn(),
    };
    const preview = await captureAdoptionPreview({
      source,
      workspaceKey: repository.workspaceIdentity,
      sourceCampaignId: 'CAMP',
      sourceMapId: 'map-original',
      newId: () => 'scene-1',
    });
    await expect(
      adoptTableScene({
        repository,
        source,
        preview,
        expectedRevision: 0,
        operationId: 'adopt-1',
      })
    ).resolves.toMatchObject({ status: 'committed', sceneId: 'scene-1' });

    const commands: Array<Record<string, unknown>> = [];
    let current: Record<string, unknown> | null = null;
    const descriptor = (revision: number, writerFence: number) => ({
      epoch: '10000000-0000-4000-8000-000000000001',
      revision,
      writerFence,
      leaseUntil: Date.now() + 30_000,
      holderSessionId: writerFence ? 'session-1' : null,
      presentation: { sceneId: null, revision: 0, blanked: false },
      publicRunId: null,
    });
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.includes('/control?'))
        return Response.json({ current, registry: [] });
      if (url.endsWith('/control')) {
        const command = (
          JSON.parse(String(init?.body)) as {
            command: Record<string, unknown>;
          }
        ).command;
        commands.push(command);
        const nextRevision = commands.length - 1;
        current = descriptor(
          nextRevision,
          command.type === 'initialize' ? 0 : 1
        );
        return Response.json({ status: 'committed', current });
      }
      if (url.endsWith('/initialize-if-empty'))
        return Response.json({ status: 'provisioned' });
      throw new Error(`Unexpected ${url}`);
    });
    await expect(
      prepareTableSceneAuthority({
        campaignCode: 'CAMP',
        dmId: 'dm-1',
        sceneId: 'scene-1',
        sourceMapId: 'map-original',
        workspaceInstanceId: 'workspace-1',
        contentRevision: 1,
        safeLabel: 'Crypt',
        canvasState: preview.scene.canvasCheckpoint!.state,
        holderSessionId: 'session-1',
        fetcher,
      })
    ).resolves.toMatchObject({ status: 'prepared' });
    expect(
      commands.find(command => command.type === 'registerScene')
    ).toMatchObject({ sceneId: 'scene-1', sourceMapId: 'map-original' });
    expect(commands.map(command => command.type)).not.toContain('show');

    const adapter = createTableSceneAdapter({
      repository,
      sceneId: 'scene-1',
      campaignCode: 'CAMP',
      newOperationId: () => 'local-edit-1',
    });
    adapter.updateBattleMap({
      canvasState: JSON.stringify({
        ...sourceCanvas,
        elements: [{ id: 'edited-token', type: 'token', layerId: 'tokens' }],
      }),
    });
    await adapter.flush();
    const barrier = {
      barrierId: 'barrier-1',
      scopeId: 'CAMP:scene:scene-1',
      generation: 'generation-1',
      throughLocalSequence: 1,
      localEditGeneration: 1,
      operationIds: ['edit-1'],
    };
    const authoritative = {
      elements: [{ id: 'edited-token', type: 'token', layerId: 'tokens' }],
      layers: [
        {
          id: 'tokens',
          definition: sourceCanvas.layers[0],
          version: 2,
          editor: 'dm-1',
        },
      ],
      extensions: {
        fog: {
          pluginName: 'fog',
          version: 1,
          data: {
            meta: { version: 2, editor: 'dm-1' },
            tiles: [],
          },
        },
      },
      cursor: {
        generation: 'generation-1',
        streamId: '0123456789abcdef0123456789abcdef',
        revision: 2,
      },
      casToken: 'cas-2',
    };
    const connection = {
      captureBarrier: () => barrier,
      waitForAcknowledgements: async () => ({
        status: 'acknowledged' as const,
        barrier,
        accepted: [],
        rejectedIds: [],
        uncertainIds: [],
        outstandingIds: [],
      }),
      requestCheckpoint: async () => ({
        status: 'complete' as const,
        barrier,
        checkpoint: authoritative,
      }),
      releaseBarrier: () => true,
    } as unknown as BattleMapConnection;
    const currentWorkspace = await repository.reload();
    if (currentWorkspace.status !== 'ready') throw new Error('expected ready');
    await expect(
      saveSceneCheckpoint({
        repository,
        connection,
        sceneId: 'scene-1',
        expectedRevision: currentWorkspace.snapshot.campaign!.revision,
        operationId: 'checkpoint-1',
      })
    ).resolves.toMatchObject({ status: 'committed', pending: false });

    adapter.dispose();
    const reloaded = createTableSceneAdapter({
      repository,
      sceneId: 'scene-1',
      campaignCode: 'CAMP',
    });
    const canvas = JSON.parse(reloaded.getBattleMap()!.canvasState) as Record<
      string,
      unknown
    >;
    expect(canvas).toMatchObject({
      version: 4,
      elements: [{ id: 'edited-token' }],
      layers: [{ id: 'tokens', name: 'Tokens' }],
      activeLayerId: 'tokens',
      extensions: {
        fog: {
          version: 1,
          data: { meta: { version: 2, editor: 'dm-1' }, tiles: [] },
        },
      },
    });
    reloaded.dispose();
  });
});
