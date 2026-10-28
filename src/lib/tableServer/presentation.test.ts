import { describe, expect, it } from 'vitest';

import { tableControlKey, tableRegistryKey } from './control';
import { tableAuthorityRoomKeys } from './keys';
import { resolvePresentedTableScene } from './presentation';

const CODE = 'A1B2C3D4E5F6';
const ROOM = '423e4567-e89b-42d3-a456-426614174000';

function redis(values: {
  control?: unknown;
  registry?: Record<string, unknown>;
  meta?: unknown;
  fail?: boolean;
}) {
  return {
    get: async (key: string) => {
      if (values.fail) throw new Error('down');
      if (key === tableControlKey(CODE)) return values.control ?? null;
      if (key === tableAuthorityRoomKeys(CODE, ROOM).meta)
        return values.meta ?? null;
      return null;
    },
    hget: async (key: string, field: string) =>
      key === tableRegistryKey(CODE)
        ? (values.registry?.[field] ?? null)
        : null,
  };
}

const control = (presentation: unknown, extra = {}) => ({
  v: 1,
  epoch: 'epoch-a',
  presentation,
  displayGeneration: 4,
  ...extra,
});
const entry = (sceneId: string, sourceMapId: string, extra = {}) => ({
  v: 1,
  sceneId,
  sourceMapId,
  roomId: ROOM,
  deleted: false,
  ...extra,
});
const meta = { v: 1, generation: 'generation-a' };

describe('resolvePresentedTableScene', () => {
  it('resolves the presented adopted scene for its source map', async () => {
    await expect(
      resolvePresentedTableScene({
        rawRedis: redis({
          control: control({ sceneId: 'scene-x', blanked: false }),
          registry: { 'scene-x': entry('scene-x', 'map-m') },
          meta,
        }),
        campaign: CODE,
        battleMapId: 'map-m',
        requestedSceneId: 'map-m',
        role: 'display',
      })
    ).resolves.toEqual({
      status: 'resolved',
      sceneId: 'scene-x',
      room: ROOM,
      roomGeneration: 'generation-a',
      epoch: 'epoch-a',
      displayGeneration: 4,
    });
  });

  it.each([
    ['no control', {}],
    [
      'blanked',
      {
        control: control({ sceneId: 'scene-x', blanked: true }),
        registry: { 'scene-x': entry('scene-x', 'map-m') },
        meta,
      },
    ],
    [
      'deleted registry entry',
      {
        control: control({ sceneId: 'scene-x', blanked: false }),
        registry: {
          'scene-x': entry('scene-x', 'map-m', { deleted: true }),
        },
        meta,
      },
    ],
    [
      'other source map',
      {
        control: control({ sceneId: 'scene-x', blanked: false }),
        registry: { 'scene-x': entry('scene-x', 'map-other') },
        meta,
      },
    ],
    [
      'uninitialized room',
      {
        control: control({ sceneId: 'scene-x', blanked: false }),
        registry: { 'scene-x': entry('scene-x', 'map-m') },
      },
    ],
  ])('returns unavailable for %s', async (_label, values) => {
    await expect(
      resolvePresentedTableScene({
        rawRedis: redis(values),
        campaign: CODE,
        battleMapId: 'map-m',
        role: 'player',
      })
    ).resolves.toEqual({ status: 'unavailable' });
  });

  it('requires an explicit scene to be the current presentation and a display generation for displays', async () => {
    const values = {
      control: control({ sceneId: 'scene-x', blanked: false }),
      registry: {
        'scene-x': entry('scene-x', 'map-m'),
        'scene-y': entry('scene-y', 'map-m'),
      },
      meta,
    };
    await expect(
      resolvePresentedTableScene({
        rawRedis: redis(values),
        campaign: CODE,
        battleMapId: 'map-m',
        requestedSceneId: 'scene-y',
        role: 'player',
      })
    ).resolves.toEqual({ status: 'unavailable' });
    await expect(
      resolvePresentedTableScene({
        rawRedis: redis({
          ...values,
          control: control(
            { sceneId: 'scene-x', blanked: false },
            { displayGeneration: undefined }
          ),
        }),
        campaign: CODE,
        battleMapId: 'map-m',
        role: 'display',
      })
    ).resolves.toEqual({ status: 'unavailable' });
  });

  it('separates a service read failure and an invalid campaign code', async () => {
    await expect(
      resolvePresentedTableScene({
        rawRedis: redis({ fail: true }),
        campaign: CODE,
        battleMapId: 'map-m',
        role: 'player',
      })
    ).resolves.toEqual({ status: 'error' });
    await expect(
      resolvePresentedTableScene({
        rawRedis: redis({}),
        campaign: 'bad code!',
        battleMapId: 'map-m',
        role: 'player',
      })
    ).resolves.toEqual({ status: 'unavailable' });
  });
});
