import { describe, expect, it } from 'vitest';
import { createShape } from '@fieldnotes/core';
import {
  assembleFogAuthorityRedisScriptV1,
  encodeFogAuthorityRedisIntentV1,
  parseFogAuthorityRedisPlanResultV1,
} from '@fieldnotes/vtt/redis';
import { prepareFogAuthorityIntent } from '@fieldnotes/vtt/server';

import { RedisAuthorityDriver } from './authority-driver.js';
import { ROLLKEEPER_AUTHORITY_HOST_V1 } from './authority-lua.js';

const ROOM = '123e4567-e89b-42d3-a456-426614174000';
const GENERATION = '223e4567-e89b-42d3-a456-426614174000';

function context() {
  return {
    room: ROOM,
    actorId: 'dm-a',
    connectionId: 'connection-a',
    userId: 'dm-a',
    role: 'dm',
    ownershipId: 'dm-a',
    definitionId: 'rollkeeper-scene-v1',
    roomGeneration: GENERATION,
    clientOperationId: 'abi-operation',
    operationDigest: 'a'.repeat(64),
    deadlineAt: Date.now() + 5_000,
    signal: new AbortController().signal,
    authContext: {
      v: 1,
      campaign: 'AuthorityABI',
      resourceKind: 'scene',
      sceneId: 'scene-a',
      room: ROOM,
      epoch: '323e4567-e89b-42d3-a456-426614174000',
      role: 'dm',
      writerFence: 7,
      roomGeneration: GENERATION,
    },
  } as const;
}

const fogMutation = {
  kind: 'fog-meta' as const,
  record: {
    version: 1,
    editor: 'dm-a',
    definition: {
      version: 1,
      base: 'covered' as const,
      bounds: { x: 0, y: 0, w: 1024, h: 1024 },
      cellSize: 1,
      tileCells: 128 as const,
      generation: 'fog-generation-1',
    },
  },
};

function fogRequest() {
  return {
    proposal: {
      protocol: 'authority:1',
      kind: 'propose',
      generation: GENERATION,
      clientOperationId: 'abi-operation',
      mutation: fogMutation,
    },
    intent: {
      schema: 1,
      kind: 'extension',
      key: 'fog',
      version: 1,
      payload: prepareFogAuthorityIntent(fogMutation),
    },
  } as never;
}

describe('authority fixed fog ABI', () => {
  it('runs the byte-exact assembled source with fog at ARGV[1] and app JSON at ARGV[2]', async () => {
    let captured:
      | {
          script: string;
          keys: readonly string[];
          arguments: readonly string[];
        }
      | undefined;
    const hostResult = [
      1,
      JSON.stringify({
        status: 'committed',
        receipt: {
          generation: GENERATION,
          clientOperationId: 'abi-operation',
          receiptId: '00000000-0000-4000-8000-000000000001',
        },
        position: { generation: GENERATION, revision: '1' },
        replayed: false,
      }),
    ];
    const client = {
      eval: async (
        script: string,
        options: { keys: readonly string[]; arguments: readonly string[] }
      ) => {
        captured = { script, ...options };
        return hostResult;
      },
    };
    const result = await new RedisAuthorityDriver(client as never).commit(
      context() as never,
      fogRequest()
    );
    expect(result).toMatchObject({ status: 'committed', replayed: false });
    expect(captured?.script).toBe(
      assembleFogAuthorityRedisScriptV1(ROLLKEEPER_AUTHORITY_HOST_V1)
    );
    expect(captured?.keys).toHaveLength(16);
    expect(captured?.arguments).toHaveLength(2);
    expect(captured?.arguments[0]).toBe(
      encodeFogAuthorityRedisIntentV1(
        prepareFogAuthorityIntent(fogMutation) as never
      )
    );
    expect(JSON.parse(captured!.arguments[1]!)).toMatchObject({ kind: 'fog' });
    expect(() => parseFogAuthorityRedisPlanResultV1(hostResult)).toThrow();
  });

  it('keeps the ordinary element path on the same assembled script with a null fog argument', async () => {
    let capturedArguments: readonly string[] = [];
    const client = {
      eval: async (
        _script: string,
        options: { arguments: readonly string[] }
      ) => {
        capturedArguments = options.arguments;
        return [0, 'invalid'];
      },
    };
    const element = {
      ...createShape({ position: { x: 1, y: 2 }, size: { w: 10, h: 10 } }),
      id: 'element-a',
    };
    await new RedisAuthorityDriver(client as never).commit(
      context() as never,
      {
        proposal: {
          protocol: 'authority:1',
          kind: 'propose',
          generation: GENERATION,
          clientOperationId: 'abi-operation',
          mutation: { kind: 'upsert', element },
        },
        intent: { schema: 1, kind: 'element-upsert', element },
      } as never
    );
    expect(capturedArguments[0]).toBe('null');
    expect(JSON.parse(capturedArguments[1]!)).toMatchObject({
      kind: 'element-upsert',
    });
  });
});
