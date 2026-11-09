import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
const hashes = new Map<string, Record<string, string>>();
vi.mock('@/lib/redis', () => ({
  getRawRedis: () => ({
    get: async (key: string) => store.get(key) ?? null,
    hget: async (key: string, field: string) =>
      hashes.get(key)?.[field] ?? null,
  }),
}));

import { authorityAdminContext } from './authorityAdmin';
import {
  tableAuthorityRoomKeys,
  tableControlKey,
  tableRegistryKey,
} from './keys';

const ROOM = '623e4567-e89b-42d3-a456-426614174000';

/** Tab B holds the lease; tab A is the same DM principal (PR08 desktop B1). */
beforeEach(() => {
  store.clear();
  hashes.clear();
  store.set(
    tableControlKey('MANUAL'),
    JSON.stringify({
      v: 1,
      epoch: 'e1',
      revision: 9,
      writerFence: 7,
      holderSessionId: 'session-tab-B',
      holderPrincipal: 'legacy:dm-1',
      leaseUntil: Date.now() + 60_000,
    })
  );
  hashes.set(tableRegistryKey('MANUAL'), {
    'scene-1': JSON.stringify({ v: 1, sceneId: 'scene-1', roomId: ROOM }),
  });
  store.set(
    tableAuthorityRoomKeys('MANUAL', ROOM).meta,
    JSON.stringify({ v: 1, generation: 'g1', casToken: 'c1' })
  );
});

describe('authorityAdminContext is bound to the live tab (B1)', () => {
  it('returns the context for the lease-holding session and its fence', async () => {
    const context = await authorityAdminContext(
      'MANUAL',
      'scene-1',
      'legacy:dm-1',
      {
        holderSessionId: 'session-tab-B',
        expectedFence: 7,
      }
    );
    expect(context).toMatchObject({
      room: ROOM,
      writerFence: 7,
      roomGeneration: 'g1',
      casToken: 'c1',
    });
  });

  it.each([
    [
      'another tab of the same DM',
      { holderSessionId: 'session-tab-A', expectedFence: 7 },
    ],
    ['a stale fence', { holderSessionId: 'session-tab-B', expectedFence: 6 }],
    ['no session', { holderSessionId: undefined, expectedFence: 7 }],
    [
      'no fence',
      { holderSessionId: 'session-tab-B', expectedFence: undefined },
    ],
  ])('returns null for %s', async (_label, lease) => {
    expect(
      await authorityAdminContext('MANUAL', 'scene-1', 'legacy:dm-1', lease)
    ).toBeNull();
  });
});
