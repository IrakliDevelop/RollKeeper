import { describe, expect, it } from 'vitest';
import { createShape } from '@fieldnotes/core';

import { RedisAuthorityDriver } from './authority-driver.js';
import {
  isCanonicalPlayerLayerRecord,
  playerIntentShapeAllowed,
} from './authority-validation.js';

const ROOM = '123e4567-e89b-42d3-a456-426614174000';
const GENERATION = '223e4567-e89b-42d3-a456-426614174000';

function context(role: 'dm' | 'player' | 'display', ownershipId: string) {
  return {
    room: ROOM,
    actorId: ownershipId,
    connectionId: `connection-${ownershipId}`,
    userId: ownershipId,
    role,
    ownershipId,
    definitionId: 'rollkeeper-scene-v1',
    roomGeneration: GENERATION,
    clientOperationId: 'policy-operation',
    operationDigest: 'a'.repeat(64),
    deadlineAt: Date.now() + 5_000,
    signal: new AbortController().signal,
    authContext: {
      v: 1,
      campaign: 'PolicyUnit',
      resourceKind: 'scene',
      sceneId: 'scene-a',
      room: ROOM,
      epoch: '323e4567-e89b-42d3-a456-426614174000',
      role,
      roomGeneration: GENERATION,
      ...(role === 'dm' ? { writerFence: 7 } : {}),
      ...(role === 'player' ? { playerPrincipal: ownershipId } : {}),
      ...(role === 'display' ? { displayGeneration: 2 } : {}),
    },
  } as never;
}

function request(
  mutation: Record<string, unknown>,
  intent: Record<string, unknown>
) {
  return {
    proposal: {
      protocol: 'authority:1',
      kind: 'propose',
      generation: GENERATION,
      clientOperationId: 'policy-operation',
      mutation,
    },
    intent,
  } as never;
}

function upsert(element: Record<string, unknown>) {
  return request(
    { kind: 'upsert', element },
    { schema: 1, kind: 'element-upsert', element }
  );
}

function element(fields: Record<string, unknown> = {}) {
  return {
    ...createShape({
      position: { x: 1, y: 2 },
      size: { w: 10, h: 10 },
      layerId: 'player-player-a',
    }),
    id: 'element-a',
    ...fields,
  };
}

const canonical = {
  id: 'player-player-a',
  name: 'My elements',
  visible: true,
  locked: false,
  order: 500,
  opacity: 1,
};

function layer(definition: Record<string, unknown>) {
  return request(
    { kind: 'layer-upsert', layer: definition, version: 2, editor: 'player-a' },
    {
      schema: 1,
      kind: 'layer-write',
      record: {
        id: definition.id,
        version: 2,
        editor: 'player-a',
        definition,
      },
    }
  );
}

function recordingClient() {
  const calls: unknown[] = [];
  return {
    calls,
    client: {
      eval: async (...args: unknown[]) => {
        calls.push(args);
        return [0, 'conflict'];
      },
    } as never,
  };
}

describe('stateless v1 player intent guard', () => {
  it('rejects display mutations before any Redis script runs', async () => {
    const { calls, client } = recordingClient();
    const result = await new RedisAuthorityDriver(client).commit(
      context('display', 'display-a'),
      upsert(element())
    );
    expect(result).toEqual({ status: 'rejected', reason: 'forbidden' });
    expect(calls).toHaveLength(0);
  });

  it.each([
    ['dm audience', { audience: 'dm' }],
    ['public audience', { audience: 'public' }],
    ['combatant kind', { tokenKind: 'combatant', entityId: 'npc' }],
    ['unknown kind', { tokenKind: 'vehicle' }],
  ])(
    'rejects a player upsert carrying %s before Redis',
    async (_label, fields) => {
      const { calls, client } = recordingClient();
      const result = await new RedisAuthorityDriver(client).commit(
        context('player', 'player-a'),
        upsert(element(fields))
      );
      expect(result).toEqual({ status: 'rejected', reason: 'forbidden' });
      expect(calls).toHaveLength(0);
    }
  );

  it('forwards ordinary and player-kind upserts to the atomic script', async () => {
    for (const fields of [
      {},
      { tokenKind: 'player', characterId: 'player-a' },
    ]) {
      const { calls, client } = recordingClient();
      await new RedisAuthorityDriver(client).commit(
        context('player', 'player-a'),
        upsert(element(fields))
      );
      expect(calls).toHaveLength(1);
    }
  });

  it('never applies the player guard to DM writes', async () => {
    const { calls, client } = recordingClient();
    await new RedisAuthorityDriver(client).commit(
      context('dm', 'dm-a'),
      upsert(element({ audience: 'dm', tokenKind: 'combatant' }))
    );
    expect(calls).toHaveLength(1);
  });

  it.each([
    ['hidden', { visible: false }],
    ['locked', { locked: true }],
    ['reordered', { order: 900 }],
    ['transparent', { opacity: 0.5 }],
    ['foreign id', { id: 'player-player-b' }],
  ])('rejects a %s player layer definition', async (_label, fields) => {
    const { calls, client } = recordingClient();
    const result = await new RedisAuthorityDriver(client).commit(
      context('player', 'player-a'),
      layer({ ...canonical, ...fields })
    );
    expect(result).toEqual({ status: 'rejected', reason: 'forbidden' });
    expect(calls).toHaveLength(0);
  });

  it('rejects a player layer tombstone and forwards the canonical band', async () => {
    const tombstone = recordingClient();
    expect(
      await new RedisAuthorityDriver(tombstone.client).commit(
        context('player', 'player-a'),
        request(
          {
            kind: 'layer-remove',
            id: 'player-player-a',
            version: 3,
            editor: 'player-a',
          },
          {
            schema: 1,
            kind: 'layer-write',
            record: { id: 'player-player-a', version: 3, editor: 'player-a' },
          }
        )
      )
    ).toEqual({ status: 'rejected', reason: 'forbidden' });
    expect(tombstone.calls).toHaveLength(0);
    const accepted = recordingClient();
    await new RedisAuthorityDriver(accepted.client).commit(
      context('player', 'player-a'),
      layer(canonical)
    );
    expect(accepted.calls).toHaveLength(1);
  });

  it('exposes the predicates used by the guard', () => {
    expect(
      isCanonicalPlayerLayerRecord(
        { id: canonical.id, version: 1, editor: 'p', definition: canonical },
        'player-a'
      )
    ).toBe(true);
    expect(
      playerIntentShapeAllowed(
        { schema: 1, kind: 'element-upsert', element: element() } as never,
        'player-a'
      )
    ).toBe(true);
    expect(
      playerIntentShapeAllowed(
        { schema: 1, kind: 'extension', key: 'fog' } as never,
        'player-a'
      )
    ).toBe(true);
  });
});
