import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';

import { exportTableBundle, importTableBundle } from './bundle';
import { TableRepository, type TableWorkspaceSelection } from './repository';
import type { TableSceneRecordV1 } from './schema';

async function sha256(raw: string): Promise<string> {
  const bytes = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

const sourceSelection: TableWorkspaceSelection = {
  account: { kind: 'authenticated', accountId: 'a' },
  workspace: { localWorkspaceId: 'source' },
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
    originalMapId: 'map-1',
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
    members: [],
    arrivalPoint: null,
    createdAt: '2026-10-05T00:00:00.000Z',
    updatedAt: '2026-10-05T00:00:00.000Z',
  };
}

describe('Table bundles', () => {
  it('keeps checkpoint canvas/layers/fog while excluding the transient authority CAS token', async () => {
    const factory = new IDBFactory();
    const source = new TableRepository({ factory, selection: sourceSelection });
    repositories.push(source);
    await source.start();
    const checkpointed = scene(source.workspaceIdentity);
    checkpointed.canvasCheckpoint = {
      protocolVersion: 1,
      generation: 'generation-1',
      revision: 4,
      capturedAt: '2026-10-05T00:00:00.000Z',
      state: {
        elements: [{ id: 'token-1' }],
        layers: [],
        extensions: {
          fog: { pluginName: 'fog', version: 1, data: null },
        },
        cursor: {
          generation: 'generation-1',
          streamId: '0123456789abcdef0123456789abcdef',
          revision: 4,
        },
        casToken: 'must-not-export',
      },
    };
    await source.putSceneForTest(checkpointed, 0);
    const raw = await exportTableBundle(source);
    expect(raw).not.toContain('must-not-export');
    expect(raw).not.toContain('casToken');
    expect(JSON.parse(raw)).toMatchObject({
      records: {
        scenes: [
          {
            canvasCheckpoint: {
              state: {
                elements: [{ id: 'token-1' }],
                extensions: { fog: { pluginName: 'fog', version: 1 } },
              },
            },
          },
        ],
      },
    });
  });

  it('round-trips every family into a new namespace with counts/digests and no credentials', async () => {
    const factory = new IDBFactory();
    const source = new TableRepository({ factory, selection: sourceSelection });
    repositories.push(source);
    await source.start();
    await source.putSceneForTest(scene(source.workspaceIdentity), 0);
    const raw = await exportTableBundle(source);
    const manifest = JSON.parse(raw) as {
      digests: { campaign: string; scenes: string[]; sources: string[] };
    };
    expect(manifest.digests.campaign).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.digests.scenes).toEqual([
      expect.stringMatching(/^[a-f0-9]{64}$/),
    ]);
    expect(raw).not.toMatch(
      /bearer|cookie|writerFence|authContext|capability/i
    );

    const imported = await importTableBundle({
      factory,
      account: sourceSelection.account,
      activeWorkspaceKey: source.workspaceIdentity,
      targetCampaignCode: 'CAMP-A',
      raw,
      newWorkspaceId: () => 'imported-workspace',
      now: () => '2026-10-05T03:00:00.000Z',
    });
    expect(imported).toMatchObject({
      status: 'imported',
      localWorkspaceId: 'imported-workspace',
    });
    const target = new TableRepository({
      factory,
      selection: {
        account: sourceSelection.account,
        workspace: {
          localWorkspaceId: 'imported-workspace',
          sourceCampaignCode: null,
          routeCampaignCode: 'CAMP-A',
        },
      },
    });
    repositories.push(target);
    const loaded = await target.start();
    if (loaded.status !== 'ready') throw new Error('expected ready');
    expect(loaded.snapshot.scenes).toHaveLength(1);
    expect(loaded.snapshot.scenes[0]?.workspaceKey).toBe(
      target.workspaceIdentity
    );
  });

  it('binds an imported fork to its explicit campaign route and rejects a forged cross-campaign selection', async () => {
    const factory = new IDBFactory();
    const source = new TableRepository({ factory, selection: sourceSelection });
    repositories.push(source);
    await source.start();
    await source.putSceneForTest(scene(source.workspaceIdentity), 0);
    const imported = await importTableBundle({
      factory,
      account: sourceSelection.account,
      activeWorkspaceKey: source.workspaceIdentity,
      targetCampaignCode: 'CAMP-A',
      raw: await exportTableBundle(source),
      newWorkspaceId: () => 'bound-fork',
    });
    expect(imported.status).toBe('imported');

    await expect(
      import('./sceneAdapter').then(({ openTableWorkspace }) =>
        openTableWorkspace({
          factory,
          account: sourceSelection.account,
          sourceCampaignCode: 'CAMP-B',
          localWorkspaceId: 'bound-fork',
        })
      )
    ).rejects.toThrow(/not bound/i);
  });

  it('rejects per-record and source raw-byte tampering even when family shape remains valid', async () => {
    const factory = new IDBFactory();
    const source = new TableRepository({ factory, selection: sourceSelection });
    repositories.push(source);
    await source.start();
    await source.putSceneForTest(scene(source.workspaceIdentity), 0);
    const raw = await exportTableBundle(source);
    const changedRecord = JSON.parse(raw) as {
      records: { scenes: Array<{ map: { name: string } }> };
    };
    changedRecord.records.scenes[0]!.map.name = 'Tampered';
    await expect(
      importTableBundle({
        factory,
        account: sourceSelection.account,
        activeWorkspaceKey: source.workspaceIdentity,
        targetCampaignCode: 'CAMP-A',
        raw: JSON.stringify(changedRecord),
        newWorkspaceId: () => 'tampered-record',
      })
    ).resolves.toMatchObject({ status: 'rejected' });

    const sourceRaw = '{"id":"map-1","label":"original"}';
    await source.mutateWorkspace(1, 'add-source', {
      sources: {
        put: [
          {
            schemaVersion: 1,
            workspaceKey: source.workspaceIdentity,
            sourceKey: 'map:map-1',
            sourceKind: 'map',
            sourceId: 'map-1',
            rawJson: sourceRaw,
            sha256: await sha256(sourceRaw),
            byteCount: new TextEncoder().encode(sourceRaw).byteLength,
            capturedAt: '2026-10-05T00:00:00.000Z',
          },
        ],
      },
    });
    const withSource = JSON.parse(await exportTableBundle(source)) as {
      records: { sources: Array<{ rawJson: string }> };
      digests: { sources: string[] };
    };
    withSource.records.sources[0]!.rawJson =
      '{"id":"map-1","label":"tampered"}';
    await expect(
      importTableBundle({
        factory,
        account: sourceSelection.account,
        activeWorkspaceKey: source.workspaceIdentity,
        targetCampaignCode: 'CAMP-A',
        raw: JSON.stringify(withSource),
        newWorkspaceId: () => 'tampered-source',
      })
    ).resolves.toMatchObject({ status: 'rejected' });
  });

  it.each([
    ['token', 'abc'],
    ['api_key', 'abc'],
    ['clientSecret', 'abc'],
    ['database-password', 'abc'],
  ])('refuses recursive credential key variant %s', async (key, value) => {
    const factory = new IDBFactory();
    const source = new TableRepository({ factory, selection: sourceSelection });
    repositories.push(source);
    await source.start();
    await source.putSceneForTest(scene(source.workspaceIdentity), 0);
    const rawJson = JSON.stringify({ id: 'map-1', nested: { [key]: value } });
    await source.mutateWorkspace(1, `sensitive-${key}`, {
      sources: {
        put: [
          {
            schemaVersion: 1,
            workspaceKey: source.workspaceIdentity,
            sourceKey: 'map:map-1',
            sourceKind: 'map',
            sourceId: 'map-1',
            rawJson,
            sha256: await sha256(rawJson),
            byteCount: new TextEncoder().encode(rawJson).byteLength,
            capturedAt: '2026-10-05T00:00:00.000Z',
          },
        ],
      },
    });
    await expect(exportTableBundle(source)).rejects.toThrow(
      'credential material'
    );
  });

  it('rejects malformed, future and oversized bundles before publish', async () => {
    const factory = new IDBFactory();
    const base = {
      bundleVersion: 1,
      exportedAt: '2026-10-05T00:00:00.000Z',
      sourceWorkspaceKey: 'x',
      counts: {},
      digests: {},
      records: {},
    };
    for (const raw of [
      'not json',
      JSON.stringify({ ...base, bundleVersion: 2 }),
      'x'.repeat(105_000_000),
    ]) {
      const result = await importTableBundle({
        factory,
        account: { kind: 'guest' },
        activeWorkspaceKey: 'guest/workspace:active',
        targetCampaignCode: 'CAMP-A',
        raw,
        newWorkspaceId: () => 'target',
      });
      expect(result.status).toBe('rejected');
    }
  });

  it('never overwrites the active workspace and an interrupted staging transaction exposes no target campaign', async () => {
    const factory = new IDBFactory();
    const source = new TableRepository({ factory, selection: sourceSelection });
    repositories.push(source);
    await source.start();
    await source.putSceneForTest(scene(source.workspaceIdentity), 0);
    const raw = await exportTableBundle(source);

    const noOverwrite = await importTableBundle({
      factory,
      account: sourceSelection.account,
      activeWorkspaceKey: source.workspaceIdentity,
      targetCampaignCode: 'CAMP-A',
      raw,
      newWorkspaceId: () => 'source',
    });
    expect(noOverwrite.status).toBe('rejected');
    const interrupted = await importTableBundle({
      factory,
      account: sourceSelection.account,
      activeWorkspaceKey: source.workspaceIdentity,
      targetCampaignCode: 'CAMP-A',
      raw,
      newWorkspaceId: () => 'interrupted',
      beforePublish: () => {
        throw new Error('stop');
      },
    });
    expect(interrupted.status).toBe('failed');
    const target = new TableRepository({
      factory,
      selection: {
        account: sourceSelection.account,
        workspace: { localWorkspaceId: 'interrupted' },
      },
    });
    repositories.push(target);
    const loaded = await target.start();
    expect(loaded.status === 'ready' && loaded.snapshot.campaign).toBeNull();
  });
});
