import { describe, expect, it } from 'vitest';

import { campaignLocationKey } from '@/lib/redis';
import { tableControlKey, tableRegistryKey } from './control';
import { readPresentedTableScene, resolveTableResource } from './presentation';

const CODE = 'A1B2C3D4E5F6';
const ROOM = '423e4567-e89b-42d3-a456-426614174000';

const entry = (sceneId: string, sourceMapId: string | null, extra = {}) =>
  JSON.stringify({
    v: 1,
    sceneId,
    workspaceInstanceId: 'workspace-a',
    sourceMapId,
    contentRevision: 1,
    safeLabel: sceneId === 'scene-forest' ? 'Private Forest' : 'Tavern',
    registeredAt: 1,
    registryRevision: 1,
    deleted: false,
    roomId: ROOM,
    ...extra,
  });

function fakeRedis(options: {
  control?: unknown;
  registry?: Record<string, string>;
  flat?: boolean;
  location?: unknown;
  fail?: 'get' | 'hget' | 'hgetall';
}) {
  return {
    get: async (key: string) => {
      if (options.fail === 'get') throw new Error('down');
      if (key === tableControlKey(CODE))
        return options.control === undefined
          ? null
          : JSON.stringify(options.control);
      if (key === campaignLocationKey(CODE, 'loc-1'))
        return options.location ?? null;
      return null;
    },
    hget: async (key: string, field: string) => {
      if (options.fail === 'hget') throw new Error('down');
      return key === tableRegistryKey(CODE)
        ? (options.registry?.[field] ?? null)
        : null;
    },
    hgetall: async (key: string) => {
      if (options.fail === 'hgetall') throw new Error('down');
      if (key !== tableRegistryKey(CODE) || !options.registry) return null;
      return options.flat
        ? Object.entries(options.registry).flat()
        : options.registry;
    },
  };
}

const registry = {
  'scene-tavern': entry('scene-tavern', 'map-tavern'),
  'scene-forest': entry('scene-forest', 'map-forest'),
};
const presenting = (sceneId: string | null, blanked = false) => ({
  v: 1,
  epoch: 'epoch-a',
  presentation: { sceneId, revision: 3, blanked },
});

describe('resolveTableResource (PR04 P5.2)', () => {
  it('resolves a registered scene id first and reports audience visibility', async () => {
    const rawRedis = fakeRedis({
      control: presenting('scene-tavern'),
      registry,
    });
    await expect(
      resolveTableResource({ rawRedis, campaign: CODE, id: 'scene-tavern' })
    ).resolves.toMatchObject({
      kind: 'scene',
      sceneId: 'scene-tavern',
      sourceMapId: 'map-tavern',
      safeLabel: 'Tavern',
      audienceVisible: true,
    });
    await expect(
      resolveTableResource({ rawRedis, campaign: CODE, id: 'scene-forest' })
    ).resolves.toMatchObject({ kind: 'scene', audienceVisible: false });
  });

  it('is never audience-visible when blanked, unpresented, deleted or without control', async () => {
    for (const [control, reg] of [
      [presenting('scene-tavern', true), registry],
      [presenting(null), registry],
      [
        presenting('scene-tavern'),
        {
          'scene-tavern': entry('scene-tavern', 'map-tavern', {
            deleted: true,
          }),
        },
      ],
      [undefined, registry],
    ] as const) {
      await expect(
        resolveTableResource({
          rawRedis: fakeRedis({ control, registry: { ...reg } }),
          campaign: CODE,
          id: 'scene-tavern',
        })
      ).resolves.toMatchObject({ kind: 'scene', audienceVisible: false });
    }
  });

  it('classifies a registered source map through the REST flat-array HGETALL', async () => {
    await expect(
      resolveTableResource({
        rawRedis: fakeRedis({
          control: presenting('scene-tavern'),
          registry,
          flat: true,
        }),
        campaign: CODE,
        id: 'map-tavern',
      })
    ).resolves.toEqual({ kind: 'source-map' });
  });

  it('classifies a verified location and otherwise an unregistered map', async () => {
    const location = JSON.stringify({
      id: 'loc-1',
      name: 'Location',
      mapImageUrl: 'https://example.test/l.png',
      updatedAt: '2026-10-07T00:00:00.000Z',
    });
    await expect(
      resolveTableResource({
        rawRedis: fakeRedis({ registry, location }),
        campaign: CODE,
        id: 'loc-1',
      })
    ).resolves.toEqual({ kind: 'location' });
    await expect(
      resolveTableResource({
        rawRedis: fakeRedis({ registry }),
        campaign: CODE,
        id: 'map-unknown',
      })
    ).resolves.toEqual({ kind: 'unregistered' });
  });

  it('reports read failures as error, never as a kind', async () => {
    for (const fail of ['get', 'hget', 'hgetall'] as const) {
      await expect(
        resolveTableResource({
          rawRedis: fakeRedis({
            control: presenting('scene-tavern'),
            registry,
            fail,
          }),
          campaign: CODE,
          id: fail === 'hgetall' ? 'map-x' : 'scene-tavern',
        })
      ).resolves.toEqual({ kind: 'error' });
    }
  });
});

describe('readPresentedTableScene (list projection)', () => {
  it('returns only the presented unblanked registered scene', async () => {
    await expect(
      readPresentedTableScene({
        rawRedis: fakeRedis({ control: presenting('scene-tavern'), registry }),
        campaign: CODE,
      })
    ).resolves.toEqual({
      status: 'presented',
      sceneId: 'scene-tavern',
      sourceMapId: 'map-tavern',
      safeLabel: 'Tavern',
    });
    await expect(
      readPresentedTableScene({
        rawRedis: fakeRedis({
          control: presenting('scene-tavern', true),
          registry,
        }),
        campaign: CODE,
      })
    ).resolves.toEqual({ status: 'none' });
  });
});
