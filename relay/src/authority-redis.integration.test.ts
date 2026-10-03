import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { createClient } from 'redis';
import { createShape } from '@fieldnotes/core';
import {
  assembleFogAuthorityRedisScriptV1,
  encodeFogAuthorityRedisIntentV1,
} from '@fieldnotes/vtt/redis';
import { prepareFogAuthorityIntent } from '@fieldnotes/vtt/server';
import type {
  AuthorityCommitContext,
  AuthorityCommitRequest,
  AuthorityReadContext,
} from '@fieldnotes/sync-server';

import { RedisAuthorityDriver } from './authority-driver.js';
import { ROLLKEEPER_PROVISION_LUA_V1 } from './authority-lua.js';
import {
  authorityRoomKeys,
  tableControlKey,
  tableRegistryKey,
} from './authority-keys.js';

const redisUrl = process.env.REDIS_TEST_URL;
const run = redisUrl ? describe : describe.skip;
const CAMPAIGN = 'AuthorityIT';
const ROOM = '123e4567-e89b-42d3-a456-426614174000';
const GENERATION = '223e4567-e89b-42d3-a456-426614174000';
const EPOCH = '323e4567-e89b-42d3-a456-426614174000';
const keys = authorityRoomKeys(CAMPAIGN, ROOM);
const declaredKeys = [
  ...Object.values(keys),
  tableControlKey(CAMPAIGN),
  tableRegistryKey(CAMPAIGN),
];

function operationDigest(operationId: string): string {
  return createHash('sha256').update(operationId).digest('hex');
}

function validWindowEntry(input: {
  operationId: string;
  generation?: string;
  createdAt: number;
  revision: string;
  digest?: string;
}) {
  const generation = input.generation ?? GENERATION;
  const receipt = {
    generation,
    clientOperationId: input.operationId,
    receiptId: `00000000-0000-4000-8000-${input.revision.padStart(12, '0')}`,
  };
  const result = JSON.stringify({
    status: 'committed',
    receipt,
    position: { generation, revision: input.revision },
    replayed: false,
  });
  return {
    receipt: JSON.stringify(receipt),
    dedupe: JSON.stringify({
      generation,
      digest: input.digest ?? operationDigest(input.operationId),
      result,
      createdAt: input.createdAt,
      expiresAt: input.createdAt + 86_400_000,
    }),
  };
}

function tunedWindow(input: {
  count: number;
  targetBytes: number;
  createdAt: number;
  generation?: string;
}) {
  const ids = Array.from(
    { length: input.count },
    (_, index) => `w${index.toString(36).padStart(3, '0')}`
  );
  const render = (operationId: string, index: number) =>
    validWindowEntry({
      operationId,
      generation: input.generation,
      createdAt: input.createdAt,
      revision: String(index + 1),
    });
  let entries = ids.map(render);
  let bytes = entries.reduce((sum, entry) => sum + entry.dedupe.length, 0);
  let remaining = input.targetBytes - bytes;
  if (remaining < 0) throw new Error('window byte target is below minimum');
  for (let index = 0; index < ids.length && remaining > 0; index += 1) {
    const capacity = 128 - ids[index]!.length;
    const added = Math.min(capacity, remaining);
    ids[index] = `${ids[index]}${'x'.repeat(added)}`;
    remaining -= added;
  }
  if (remaining !== 0) throw new Error('window byte target is unreachable');
  entries = ids.map(render);
  bytes = entries.reduce((sum, entry) => sum + entry.dedupe.length, 0);
  if (bytes !== input.targetBytes) throw new Error('window byte tuning failed');
  const dedupe: Record<string, string> = {};
  const receipts: Record<string, string> = {};
  ids.forEach((id, index) => {
    dedupe[id] = entries[index]!.dedupe;
    receipts[id] = entries[index]!.receipt;
  });
  return { order: ids, dedupe, receipts, bytes };
}

run('authority driver against real Redis', () => {
  const client = createClient({ url: redisUrl });

  beforeAll(async () => {
    await client.connect();
    await client.ping();
  });

  beforeEach(async () => {
    await client.del(declaredKeys);
    await client.set(
      tableControlKey(CAMPAIGN),
      JSON.stringify({
        v: 1,
        epoch: EPOCH,
        writerFence: 7,
        leaseUntil: Date.now() + 60_000,
        presentation: { sceneId: 'scene-a', revision: 1, blanked: false },
        displayGeneration: 2,
      })
    );
    await client.hSet(
      tableRegistryKey(CAMPAIGN),
      'scene-a',
      JSON.stringify({
        v: 1,
        sceneId: 'scene-a',
        roomId: ROOM,
        deleted: false,
      })
    );
    await client.set(
      keys.meta,
      JSON.stringify({
        v: 1,
        generation: GENERATION,
        revision: 0,
        casToken: 'cas-initial',
      })
    );
  });

  afterAll(async () => {
    if (client.isOpen) {
      await client.del(declaredKeys);
      await client.quit();
    }
  });

  function context(
    overrides: Partial<AuthorityCommitContext> = {}
  ): AuthorityCommitContext {
    return {
      room: ROOM,
      actorId: 'dm-a',
      connectionId: 'connection-a',
      userId: 'dm-a',
      role: 'dm',
      ownershipId: 'dm-a',
      definitionId: 'rollkeeper-scene-v1',
      roomGeneration: GENERATION,
      clientOperationId: 'operation-a',
      operationDigest: operationDigest('operation-a'),
      deadlineAt: Date.now() + 5_000,
      signal: new AbortController().signal,
      authContext: {
        v: 1,
        campaign: CAMPAIGN,
        resourceKind: 'scene',
        sceneId: 'scene-a',
        room: ROOM,
        epoch: EPOCH,
        role: 'dm',
        writerFence: 7,
        roomGeneration: GENERATION,
      },
      ...overrides,
    };
  }

  function upsert(
    id = 'element-a',
    clientOperationId = 'operation-a',
    generation = GENERATION
  ): AuthorityCommitRequest {
    const element = {
      ...createShape({ position: { x: 1, y: 2 }, size: { w: 10, h: 10 } }),
      id,
    };
    return {
      proposal: {
        protocol: 'authority:1',
        kind: 'propose',
        generation,
        clientOperationId,
        mutation: { kind: 'upsert', element },
      },
      intent: { schema: 1, kind: 'element-upsert', element },
    } as AuthorityCommitRequest;
  }

  function remove(
    id = 'element-a',
    clientOperationId = 'operation-a'
  ): AuthorityCommitRequest {
    return {
      proposal: {
        protocol: 'authority:1',
        kind: 'propose',
        generation: GENERATION,
        clientOperationId,
        mutation: { kind: 'remove', id },
      },
      intent: { schema: 1, kind: 'element-remove', id },
    } as AuthorityCommitRequest;
  }

  function playerContext(
    clientOperationId: string,
    ownershipId = 'player-a'
  ): AuthorityCommitContext {
    return context({
      actorId: ownershipId,
      userId: ownershipId,
      role: 'player',
      ownershipId,
      clientOperationId,
      operationDigest: operationDigest(clientOperationId),
      authContext: {
        ...(context().authContext ?? {}),
        role: 'player',
        playerPrincipal: ownershipId,
      },
    });
  }

  function operationContext(
    operationId: string,
    overrides: Partial<AuthorityCommitContext> = {}
  ): AuthorityCommitContext {
    return context({
      clientOperationId: operationId,
      operationDigest: operationDigest(operationId),
      ...overrides,
    });
  }

  function requestFor(
    operationId: string,
    mutation: Record<string, unknown>,
    intent: Record<string, unknown>,
    proposalExtra: Record<string, unknown> = {}
  ): AuthorityCommitRequest {
    return {
      proposal: {
        protocol: 'authority:1',
        kind: 'propose',
        generation: GENERATION,
        clientOperationId: operationId,
        mutation,
        ...proposalExtra,
      },
      intent,
    } as AuthorityCommitRequest;
  }

  async function snapshot(): Promise<readonly string[]> {
    return Promise.all(
      declaredKeys.map(async key => {
        const [type, ttl, dump] = await Promise.all([
          client.type(key),
          client.pTTL(key),
          client.sendCommand<Buffer | null>(['DUMP', key]),
        ]);
        return `${key}\0${type}\0${ttl}\0${dump?.toString('base64') ?? ''}`;
      })
    );
  }

  async function seedWindow(window: ReturnType<typeof tunedWindow>) {
    await client.hSet(keys.dedupe, window.dedupe);
    await client.hSet(keys.receipts, window.receipts);
    await client.rPush(keys.dedupeOrder, window.order);
  }

  async function dedupeBytes(): Promise<number> {
    const fields = await client.hKeys(keys.dedupe);
    return (
      await Promise.all(fields.map(id => client.hStrLen(keys.dedupe, id)))
    ).reduce((sum, value) => sum + value, 0);
  }

  it('commits once, replays the same digest, and is shared by two drivers', async () => {
    const first = new RedisAuthorityDriver(client);
    const second = new RedisAuthorityDriver(client);
    const accepted = await first.commit(context(), upsert());
    expect(accepted).toMatchObject({ status: 'committed', replayed: false });
    const replayed = await second.commit(context(), upsert());
    expect(replayed).toMatchObject({
      status: 'committed',
      replayed: true,
      position: accepted.status === 'committed' ? accepted.position : undefined,
    });
    const page = await second.readAfter(
      context() as AuthorityReadContext,
      { generation: GENERATION, revision: '0' },
      { entries: 8, bytes: 64 * 1024 },
      {
        deadlineAt: Date.now() + 5_000,
        signal: new AbortController().signal,
      }
    );
    expect(page.status).toBe('ok');
    if (page.status !== 'ok' || !page.records[0])
      throw new Error('expected committed publication');
    const evidence = await second.readEvidence(
      context() as AuthorityReadContext,
      page.records[0],
      {
        deadlineAt: Date.now() + 5_000,
        signal: new AbortController().signal,
      }
    );
    expect(evidence.status).toBe('available');
    if (evidence.status !== 'available')
      throw new Error('expected committed evidence');
    expect(evidence.lease.before.elements).toEqual([]);
    expect(evidence.lease.after.elements).toEqual([
      expect.objectContaining({ id: 'element-a', ownerId: 'dm-a' }),
    ]);
    await evidence.lease.release();
    const capture = await second.checkpoint(context() as AuthorityReadContext, {
      deadlineAt: Date.now() + 5_000,
      signal: new AbortController().signal,
    });
    expect(capture.position).toEqual({ generation: GENERATION, revision: '1' });
    expect(capture.state.elements).toEqual([
      expect.objectContaining({ id: 'element-a', ownerId: 'dm-a' }),
    ]);
    await capture.release();
    await expect(
      second.readAfter(
        context() as AuthorityReadContext,
        accepted.status === 'committed'
          ? accepted.position
          : { generation: GENERATION, revision: '1' },
        { entries: 8, bytes: 64 * 1024 },
        {
          deadlineAt: Date.now() + 5_000,
          signal: new AbortController().signal,
        }
      )
    ).resolves.toEqual({
      status: 'ok',
      head:
        accepted.status === 'committed'
          ? accepted.position
          : { generation: GENERATION, revision: '1' },
      records: [],
    });
    expect(await client.hLen(keys.receipts)).toBe(1);
    expect(await client.hLen(keys.dedupe)).toBe(1);
    expect(await client.lLen(keys.history)).toBe(1);
    expect(await client.lLen(keys.outbox)).toBe(1);
    expect(await client.hLen(keys.evidence)).toBe(2);
  });

  it('commits every core, layer, and fog mutation with exactly one publication envelope', async () => {
    const driver = new RedisAuthorityDriver(client);
    const shape = (id: string, x: number) => ({
      ...createShape({ position: { x, y: 2 }, size: { w: 10, h: 10 } }),
      id,
    });
    const layer = {
      id: 'layer-a',
      name: 'Layer A',
      visible: true,
      locked: false,
      order: 1,
      opacity: 1,
    };
    const fogDefinition = {
      version: 1,
      base: 'covered' as const,
      bounds: { x: 0, y: 0, w: 1024, h: 1024 },
      cellSize: 1,
      tileCells: 128 as const,
      generation: 'fog-generation-a',
    };
    const fogMeta = {
      kind: 'fog-meta' as const,
      record: { version: 1, editor: 'dm-a', definition: fogDefinition },
    };
    const fogPatch = {
      kind: 'fog-patch' as const,
      generation: fogDefinition.generation,
      tiles: [
        {
          generation: fogDefinition.generation,
          x: 0,
          y: 0,
          version: 1,
          editor: 'dm-a',
        },
      ],
    };
    const commits: Array<{
      label: string;
      operationId: string;
      build: () => Promise<AuthorityCommitRequest> | AuthorityCommitRequest;
    }> = [
      {
        label: 'element create',
        operationId: 'matrix-element-create',
        build: () => upsert('matrix-element', 'matrix-element-create'),
      },
      {
        label: 'element edit',
        operationId: 'matrix-element-edit',
        build: () => {
          const element = shape('matrix-element', 3);
          return requestFor(
            'matrix-element-edit',
            { kind: 'upsert', element },
            { schema: 1, kind: 'element-upsert', element }
          );
        },
      },
      {
        label: 'element remove',
        operationId: 'matrix-element-remove',
        build: () =>
          requestFor(
            'matrix-element-remove',
            { kind: 'remove', id: 'matrix-element' },
            { schema: 1, kind: 'element-remove', id: 'matrix-element' }
          ),
      },
      {
        label: 'retained-owner recreation',
        operationId: 'matrix-element-recreate',
        build: () => upsert('matrix-element', 'matrix-element-recreate'),
      },
      {
        label: 'valid CAS clear',
        operationId: 'matrix-clear',
        build: async () => {
          const meta = JSON.parse((await client.get(keys.meta))!) as {
            casToken: string;
          };
          return requestFor(
            'matrix-clear',
            { kind: 'clear' },
            { schema: 1, kind: 'elements-clear' },
            { expectedState: meta.casToken }
          );
        },
      },
      {
        label: 'layer upsert',
        operationId: 'matrix-layer-upsert',
        build: () =>
          requestFor(
            'matrix-layer-upsert',
            { kind: 'layer-upsert', layer, version: 1, editor: 'dm-a' },
            {
              schema: 1,
              kind: 'layer-write',
              record: {
                id: layer.id,
                version: 1,
                editor: 'dm-a',
                definition: layer,
              },
            }
          ),
      },
      {
        label: 'layer tombstone',
        operationId: 'matrix-layer-remove',
        build: () =>
          requestFor(
            'matrix-layer-remove',
            { kind: 'layer-remove', id: layer.id, version: 2, editor: 'dm-a' },
            {
              schema: 1,
              kind: 'layer-write',
              record: { id: layer.id, version: 2, editor: 'dm-a' },
            }
          ),
      },
      {
        label: 'fog meta',
        operationId: 'matrix-fog-meta',
        build: () =>
          requestFor('matrix-fog-meta', fogMeta, {
            schema: 1,
            kind: 'extension',
            key: 'fog',
            version: 1,
            payload: prepareFogAuthorityIntent(fogMeta),
          }),
      },
      {
        label: 'fog patch',
        operationId: 'matrix-fog-patch',
        build: () =>
          requestFor('matrix-fog-patch', fogPatch, {
            schema: 1,
            kind: 'extension',
            key: 'fog',
            version: 1,
            payload: prepareFogAuthorityIntent(fogPatch),
          }),
      },
    ];

    for (const entry of commits) {
      const before = {
        receipts: await client.hLen(keys.receipts),
        dedupe: await client.hLen(keys.dedupe),
        order: await client.lLen(keys.dedupeOrder),
        history: await client.lLen(keys.history),
        evidence: await client.hLen(keys.evidence),
        outbox: await client.lLen(keys.outbox),
        revision: Number(
          (JSON.parse((await client.get(keys.meta))!) as { revision: number })
            .revision
        ),
      };
      const result = await driver.commit(
        operationContext(entry.operationId),
        await entry.build()
      );
      expect(result, entry.label).toMatchObject({
        status: 'committed',
        replayed: false,
      });
      expect(
        {
          receipts: await client.hLen(keys.receipts),
          dedupe: await client.hLen(keys.dedupe),
          order: await client.lLen(keys.dedupeOrder),
          history: await client.lLen(keys.history),
          evidence: await client.hLen(keys.evidence),
          outbox: await client.lLen(keys.outbox),
          revision: Number(
            (
              JSON.parse((await client.get(keys.meta))!) as {
                revision: number;
              }
            ).revision
          ),
        },
        entry.label
      ).toEqual({
        receipts: before.receipts + 1,
        dedupe: before.dedupe + 1,
        order: before.order + 1,
        history: before.history + 1,
        evidence: before.evidence + 2,
        outbox: before.outbox + 1,
        revision: before.revision + 1,
      });
    }
  });

  it('enforces retained player ownership across edit, remove, recreate, DM changes, and clear', async () => {
    const driver = new RedisAuthorityDriver(client);
    const playerRequest = (operationId: string, id = 'owned-element') =>
      upsert(id, operationId);
    await expect(
      driver.commit(
        playerContext('owner-create', 'player-a'),
        playerRequest('owner-create')
      )
    ).resolves.toMatchObject({ status: 'committed' });
    expect(await client.hGet(keys.ownership, 'owned-element')).toBe('player-a');
    await expect(
      driver.commit(
        playerContext('owner-self-edit', 'player-a'),
        playerRequest('owner-self-edit')
      )
    ).resolves.toMatchObject({ status: 'committed' });
    await expect(
      driver.commit(
        operationContext('owner-dm-edit'),
        playerRequest('owner-dm-edit')
      )
    ).resolves.toMatchObject({ status: 'committed' });
    expect(await client.hGet(keys.ownership, 'owned-element')).toBe('player-a');
    for (const [label, request] of [
      ['cross-owner-edit', playerRequest('cross-owner-edit')],
      ['cross-owner-recreate', playerRequest('cross-owner-recreate')],
    ] as const) {
      if (label === 'cross-owner-recreate')
        await client.hDel(keys.elements, 'owned-element');
      const before = await snapshot();
      await expect(
        driver.commit(playerContext(label, 'player-b'), request)
      ).resolves.toEqual({ status: 'rejected', reason: 'forbidden' });
      expect(await snapshot()).toEqual(before);
      if (label === 'cross-owner-edit') {
        await expect(
          driver.commit(
            playerContext('owner-remove', 'player-a'),
            remove('owned-element', 'owner-remove')
          )
        ).resolves.toMatchObject({ status: 'committed' });
      }
    }
    expect(await client.hGet(keys.ownership, 'owned-element')).toBe('player-a');
    await expect(
      driver.commit(
        playerContext('owner-recreate', 'player-a'),
        playerRequest('owner-recreate')
      )
    ).resolves.toMatchObject({ status: 'committed' });
    await expect(
      driver.commit(
        operationContext('owner-dm-remove'),
        requestFor(
          'owner-dm-remove',
          { kind: 'remove', id: 'owned-element' },
          { schema: 1, kind: 'element-remove', id: 'owned-element' }
        )
      )
    ).resolves.toMatchObject({ status: 'committed' });
    await expect(
      driver.commit(
        operationContext('owner-dm-recreate'),
        playerRequest('owner-dm-recreate')
      )
    ).resolves.toMatchObject({ status: 'committed' });
    expect(await client.hGet(keys.ownership, 'owned-element')).toBe('player-a');
    const meta = JSON.parse((await client.get(keys.meta))!) as {
      casToken: string;
    };
    await expect(
      driver.commit(
        operationContext('owner-clear'),
        requestFor(
          'owner-clear',
          { kind: 'clear' },
          { schema: 1, kind: 'elements-clear' },
          { expectedState: meta.casToken }
        )
      )
    ).resolves.toMatchObject({ status: 'committed' });
    expect(await client.hExists(keys.elements, 'owned-element')).toBe(false);
    expect(await client.hGet(keys.ownership, 'owned-element')).toBe('player-a');
  });

  it('rejects a copied fog plan and reloads the exact assembled script after NOSCRIPT', async () => {
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
          generation: 'fog-generation-copy',
        },
      },
    };
    const copiedPlanHost = `
local approved = fn_fog_plan_v1(KEYS[1], KEYS[2], ARGV[1])
if approved[1] ~= 1 then return approved end
local copied = {}
for key, value in pairs(approved) do copied[key] = value end
return fn_fog_apply_v1(KEYS[1], KEYS[2], copied)
`;
    const before = await snapshot();
    await expect(
      client.eval(assembleFogAuthorityRedisScriptV1(copiedPlanHost), {
        keys: [keys.fogMeta, keys.fogTiles],
        arguments: [
          encodeFogAuthorityRedisIntentV1(
            prepareFogAuthorityIntent(fogMutation) as never
          ),
        ],
      })
    ).rejects.toThrow(/invalid fog authority plan/);
    expect(await snapshot()).toEqual(before);

    const driver = new RedisAuthorityDriver(client);
    await expect(
      driver.commit(
        operationContext('noscript-a'),
        upsert('noscript-a', 'noscript-a')
      )
    ).resolves.toMatchObject({ status: 'committed' });
    await client.sendCommand(['SCRIPT', 'FLUSH']);
    await expect(
      driver.commit(
        operationContext('noscript-b'),
        upsert('noscript-b', 'noscript-b')
      )
    ).resolves.toMatchObject({ status: 'committed' });
  });

  it.each([
    [
      'proposal mismatch',
      context(),
      {
        ...upsert(),
        intent: { schema: 1, kind: 'element-remove', id: 'element-a' },
      },
    ],
    [
      'stale fence',
      context({
        authContext: { ...(context().authContext ?? {}), writerFence: 6 },
      }),
      upsert(),
    ],
    ['expired deadline', context({ deadlineAt: Date.now() - 1 }), upsert()],
    [
      'wrong generation',
      context({ roomGeneration: '423e4567-e89b-42d3-a456-426614174000' }),
      upsert(),
    ],
  ])(
    'leaves every declared key byte-identical on %s',
    async (_label, ctx, request) => {
      const driver = new RedisAuthorityDriver(client);
      const before = await snapshot();
      await driver.commit(
        ctx as AuthorityCommitContext,
        request as AuthorityCommitRequest
      );
      expect(await snapshot()).toEqual(before);
    }
  );

  it('rejects operation-id digest reuse without changing any key', async () => {
    const driver = new RedisAuthorityDriver(client);
    await driver.commit(context(), upsert());
    const before = await snapshot();
    const result = await driver.commit(
      context({ operationDigest: 'f'.repeat(64) }),
      upsert()
    );
    expect(result).toEqual({
      status: 'rejected',
      reason: 'operation-id-reused',
    });
    expect(await snapshot()).toEqual(before);
  });

  it('validates the whole three-store window before replaying a target', async () => {
    const driver = new RedisAuthorityDriver(client);
    await expect(driver.commit(context(), upsert())).resolves.toMatchObject({
      status: 'committed',
    });
    await client.hSet(
      keys.receipts,
      'orphan-operation',
      JSON.stringify({
        generation: GENERATION,
        clientOperationId: 'orphan-operation',
        receiptId: '00000000-0000-4000-8000-000000000999',
      })
    );
    const before = await snapshot();
    await expect(driver.commit(context(), upsert())).resolves.toEqual({
      status: 'rejected',
      reason: 'invalid',
    });
    expect(await snapshot()).toEqual(before);
  });

  it('never replays a dedupe receipt from a different generation', async () => {
    const driver = new RedisAuthorityDriver(client);
    await driver.commit(context(), upsert());
    const replacement = '423e4567-e89b-42d3-a456-426614174000';
    await client.set(
      keys.meta,
      JSON.stringify({
        v: 1,
        generation: replacement,
        revision: 0,
        casToken: 'cas-replaced',
      })
    );
    const result = await driver.commit(
      context({
        roomGeneration: replacement,
        authContext: {
          ...(context().authContext ?? {}),
          roomGeneration: replacement,
        },
      }),
      {
        ...upsert(),
        proposal: { ...upsert().proposal, generation: replacement },
      } as AuthorityCommitRequest
    );
    expect(result).toEqual({
      status: 'rejected',
      reason: 'invalid',
    });
  });

  it.each([
    ['never-owned', false],
    ['already-absent', true],
  ])(
    'rejects a player remove when the element is %s without changing any key',
    async (_label, retainOwnership) => {
      if (retainOwnership) {
        await client.hSet(keys.ownership, 'element-a', 'player-a');
      }
      const before = await snapshot();
      const result = await new RedisAuthorityDriver(client).commit(
        playerContext('remove-a'),
        remove('element-a', 'remove-a')
      );
      expect(result).toEqual({ status: 'rejected', reason: 'forbidden' });
      expect(await snapshot()).toEqual(before);
    }
  );

  it('limits player element upserts to ten committed operations per rolling second', async () => {
    const driver = new RedisAuthorityDriver(client);
    for (let index = 0; index < 10; index += 1) {
      const operation = `player-upsert-${index}`;
      await expect(
        driver.commit(
          playerContext(operation),
          upsert(`element-${index}`, operation)
        )
      ).resolves.toMatchObject({ status: 'committed' });
    }
    const before = await snapshot();
    await expect(
      driver.commit(
        playerContext('player-upsert-10'),
        upsert('element-10', 'player-upsert-10')
      )
    ).resolves.toEqual({ status: 'rejected', reason: 'overloaded' });
    expect(await snapshot()).toEqual(before);

    await new Promise(resolve => setTimeout(resolve, 1_010));
    await expect(
      driver.commit(
        playerContext('player-upsert-11'),
        upsert('element-11', 'player-upsert-11')
      )
    ).resolves.toMatchObject({ status: 'committed' });
  });

  it('gives two players independent ten-operation rolling windows', async () => {
    const driver = new RedisAuthorityDriver(client);
    for (let index = 0; index < 10; index += 1) {
      const operation = `player-a-${index}`;
      await expect(
        driver.commit(
          playerContext(operation, 'player-a'),
          upsert(`player-a-element-${index}`, operation)
        )
      ).resolves.toMatchObject({ status: 'committed' });
    }
    for (let index = 0; index < 10; index += 1) {
      const operation = `player-b-${index}`;
      await expect(
        driver.commit(
          playerContext(operation, 'player-b'),
          upsert(`player-b-element-${index}`, operation)
        )
      ).resolves.toMatchObject({ status: 'committed' });
    }
  });

  it('rejects an exact-valid dedupe window above 512 KiB without changing any key', async () => {
    const createdAt = Date.now() - 1_000;
    const dedupe: Record<string, string> = {};
    const receipts: Record<string, string> = {};
    const order: string[] = [];
    for (let index = 1; index <= 1_023; index += 1) {
      const prefix = `op-${String(index).padStart(4, '0')}-`;
      const operationId = prefix + 'x'.repeat(128 - prefix.length);
      const entry = validWindowEntry({
        operationId,
        createdAt,
        revision: String(index),
      });
      order.push(operationId);
      dedupe[operationId] = entry.dedupe;
      receipts[operationId] = entry.receipt;
    }
    await client.hSet(keys.dedupe, dedupe);
    await client.hSet(keys.receipts, receipts);
    await client.rPush(keys.dedupeOrder, order);
    const byteTotal = (
      await Promise.all(order.map(id => client.hStrLen(keys.dedupe, id)))
    ).reduce((sum, value) => sum + value, 0);
    expect(byteTotal).toBeGreaterThan(524_288);
    const before = await snapshot();
    await expect(
      new RedisAuthorityDriver(client).commit(context(), upsert())
    ).resolves.toEqual({ status: 'rejected', reason: 'overloaded' });
    expect(await snapshot()).toEqual(before);
  });

  it.each([
    ['one byte below', -1, 'committed'],
    ['exactly equal', 0, 'committed'],
    ['one byte above', 1, 'overloaded'],
  ] as const)(
    'enforces the pending-inclusive 512 KiB dedupe boundary (%s)',
    async (_label, delta, expected) => {
      const createdAt = Date.now() - 1_000;
      const pendingBytes = validWindowEntry({
        operationId: 'operation-a',
        createdAt,
        revision: '1',
      }).dedupe.length;
      const window = tunedWindow({
        count: 1_023,
        targetBytes: 524_288 - pendingBytes + delta,
        createdAt,
      });
      await seedWindow(window);
      expect(await dedupeBytes()).toBe(window.bytes);
      const before = await snapshot();
      const result = await new RedisAuthorityDriver(client).commit(
        context(),
        upsert()
      );
      if (expected === 'overloaded') {
        expect(result).toEqual({ status: 'rejected', reason: 'overloaded' });
        expect(await snapshot()).toEqual(before);
      } else {
        expect(result).toMatchObject({ status: 'committed' });
        expect(await client.hLen(keys.dedupe)).toBe(1_024);
        expect(await dedupeBytes()).toBe(524_288 + delta);
      }
    }
  );

  it('enforces the 1024-record dedupe boundary invariantly', async () => {
    const createdAt = Date.now() - 1_000;
    const window = tunedWindow({
      count: 1_024,
      targetBytes: 500_000,
      createdAt,
    });
    await seedWindow(window);
    const before = await snapshot();
    await expect(
      new RedisAuthorityDriver(client).commit(context(), upsert())
    ).resolves.toEqual({ status: 'rejected', reason: 'overloaded' });
    expect(await snapshot()).toEqual(before);
  });

  it('validates and commits five independent exact-cap windows under four seconds each', async () => {
    const durations: number[] = [];
    for (let index = 0; index < 5; index += 1) {
      const generation = `423e4567-e89b-42d3-a456-42661417400${index}`;
      const operationId = `benchmark-operation-${index}`;
      const createdAt = Date.now() - 1_000;
      await client.del(Object.values(keys));
      await client.set(
        keys.meta,
        JSON.stringify({
          v: 1,
          generation,
          revision: 1_023,
          casToken: `benchmark-cas-${index}`,
        })
      );
      const pendingBytes = validWindowEntry({
        operationId,
        generation,
        createdAt,
        revision: '1024',
      }).dedupe.length;
      const window = tunedWindow({
        count: 1_023,
        targetBytes: 524_288 - pendingBytes,
        createdAt,
        generation,
      });
      await seedWindow(window);
      const benchmarkContext = context({
        roomGeneration: generation,
        clientOperationId: operationId,
        operationDigest: operationDigest(operationId),
        deadlineAt: Date.now() + 5_000,
        authContext: {
          ...(context().authContext ?? {}),
          roomGeneration: generation,
        },
      });
      const startedAt = performance.now();
      await expect(
        new RedisAuthorityDriver(client).commit(
          benchmarkContext,
          upsert(`benchmark-element-${index}`, operationId, generation)
        )
      ).resolves.toMatchObject({ status: 'committed', replayed: false });
      const elapsed = performance.now() - startedAt;
      durations.push(elapsed);
      expect(elapsed).toBeLessThan(4_000);
      expect(await client.hLen(keys.dedupe)).toBe(1_024);
      expect(await dedupeBytes()).toBe(524_288);
    }
    const sorted = [...durations].sort((left, right) => left - right);
    console.info(
      `[authority-window-benchmark] runs=5 records=1024 bytes=524288 p50Ms=${sorted[2]!.toFixed(2)} maxMs=${Math.max(...durations).toFixed(2)}`
    );
  });

  it('rejects every three-store schema and correspondence corruption invariantly', async () => {
    const operationId = 'window-entry';
    const createdAt = Date.now() - 1_000;
    const base = validWindowEntry({
      operationId,
      createdAt,
      revision: '1',
    });
    const corruptions: Array<
      [
        string,
        (
          dedupe: Record<string, unknown>,
          result: Record<string, unknown>
        ) => Promise<void>,
      ]
    > = [
      [
        'orphan dedupe',
        async () => {
          await client.hSet(keys.dedupe, operationId, base.dedupe);
        },
      ],
      [
        'orphan receipt',
        async () => {
          await client.hSet(keys.receipts, operationId, base.receipt);
        },
      ],
      [
        'missing dedupe',
        async () => {
          await client.rPush(keys.dedupeOrder, operationId);
          await client.hSet(keys.receipts, operationId, base.receipt);
        },
      ],
      [
        'missing receipt',
        async () => {
          await client.rPush(keys.dedupeOrder, operationId);
          await client.hSet(keys.dedupe, operationId, base.dedupe);
        },
      ],
      [
        'duplicate order id',
        async () => {
          await client.hSet(keys.dedupe, operationId, base.dedupe);
          await client.hSet(keys.receipts, operationId, base.receipt);
          await client.rPush(keys.dedupeOrder, [operationId, operationId]);
        },
      ],
      [
        'wrong dedupe generation',
        async dedupe => {
          dedupe.generation = '423e4567-e89b-42d3-a456-426614174000';
        },
      ],
      [
        'wrong embedded receipt generation',
        async (_dedupe, result) => {
          (result.receipt as Record<string, unknown>).generation =
            '423e4567-e89b-42d3-a456-426614174000';
        },
      ],
      [
        'wrong result position generation',
        async (_dedupe, result) => {
          (result.position as Record<string, unknown>).generation =
            '423e4567-e89b-42d3-a456-426614174000';
        },
      ],
      [
        'wrong paired receipt generation',
        async () => {
          const paired = JSON.parse(base.receipt) as Record<string, unknown>;
          paired.generation = '423e4567-e89b-42d3-a456-426614174000';
          await client.hSet(keys.receipts, operationId, JSON.stringify(paired));
        },
      ],
      ['invalid digest', async dedupe => void (dedupe.digest = 'not-a-digest')],
      [
        'future createdAt',
        async dedupe => {
          dedupe.createdAt = Date.now() + 60_000;
          dedupe.expiresAt = Number(dedupe.createdAt) + 86_400_000;
        },
      ],
      [
        'invalid expiry relation',
        async dedupe => void (dedupe.expiresAt = Number(dedupe.createdAt) + 1),
      ],
      [
        'wrong embedded operation id',
        async (_dedupe, result) => {
          (result.receipt as Record<string, unknown>).clientOperationId =
            'other';
        },
      ],
      [
        'wrong paired operation id',
        async () => {
          const paired = JSON.parse(base.receipt) as Record<string, unknown>;
          paired.clientOperationId = 'other';
          await client.hSet(keys.receipts, operationId, JSON.stringify(paired));
        },
      ],
      [
        'mismatched paired receipt',
        async () => {
          const paired = JSON.parse(base.receipt) as Record<string, unknown>;
          paired.receiptId = '00000000-0000-4000-8000-000000000999';
          await client.hSet(keys.receipts, operationId, JSON.stringify(paired));
        },
      ],
      [
        'extra result key',
        async (_dedupe, result) => void (result.extra = true),
      ],
      [
        'extra embedded receipt key',
        async (_dedupe, result) => {
          (result.receipt as Record<string, unknown>).extra = true;
        },
      ],
      [
        'extra paired receipt key',
        async () => {
          const paired = JSON.parse(base.receipt) as Record<string, unknown>;
          paired.extra = true;
          await client.hSet(keys.receipts, operationId, JSON.stringify(paired));
        },
      ],
    ];

    for (const [label, corrupt] of corruptions) {
      await client.del([keys.dedupe, keys.dedupeOrder, keys.receipts]);
      const dedupe = JSON.parse(base.dedupe) as Record<string, unknown>;
      const result = JSON.parse(String(dedupe.result)) as Record<
        string,
        unknown
      >;
      if (
        !label.startsWith('orphan') &&
        !label.startsWith('missing') &&
        label !== 'duplicate order id'
      ) {
        await client.hSet(keys.dedupe, operationId, base.dedupe);
        await client.hSet(keys.receipts, operationId, base.receipt);
        await client.rPush(keys.dedupeOrder, operationId);
      }
      await corrupt(dedupe, result);
      if (
        !label.startsWith('orphan') &&
        !label.startsWith('missing') &&
        label !== 'duplicate order id' &&
        label !== 'mismatched paired receipt' &&
        label !== 'wrong paired receipt generation' &&
        label !== 'wrong paired operation id' &&
        label !== 'extra paired receipt key'
      ) {
        dedupe.result = JSON.stringify(result);
        await client.hSet(keys.dedupe, operationId, JSON.stringify(dedupe));
      }
      const before = await snapshot();
      await expect(
        new RedisAuthorityDriver(client).commit(context(), upsert()),
        label
      ).resolves.toEqual({ status: 'rejected', reason: 'invalid' });
      expect(await snapshot(), label).toEqual(before);
    }
  });

  it('accepts equal-createdAt ordering and a target one millisecond before expiry', async () => {
    const seedTime = (await client.time()).getTime();
    const first = validWindowEntry({
      operationId: 'equal-created-a',
      createdAt: seedTime - 1_000,
      revision: '1',
    });
    const second = validWindowEntry({
      operationId: 'equal-created-b',
      createdAt: seedTime - 1_000,
      revision: '2',
    });
    await client.hSet(keys.dedupe, {
      'equal-created-a': first.dedupe,
      'equal-created-b': second.dedupe,
    });
    await client.hSet(keys.receipts, {
      'equal-created-a': first.receipt,
      'equal-created-b': second.receipt,
    });
    await client.rPush(keys.dedupeOrder, [
      'equal-created-a',
      'equal-created-b',
    ]);
    await expect(
      new RedisAuthorityDriver(client).commit(context(), upsert())
    ).resolves.toMatchObject({ status: 'committed' });

    let replayed = false;
    for (let attempt = 0; attempt < 50 && !replayed; attempt += 1) {
      await client.del([keys.dedupe, keys.dedupeOrder, keys.receipts]);
      const now = (await client.time()).getTime();
      const target = validWindowEntry({
        operationId: 'operation-a',
        createdAt: now - 86_399_999,
        revision: '1',
        digest: operationDigest('operation-a'),
      });
      await client.hSet(keys.dedupe, 'operation-a', target.dedupe);
      await client.hSet(keys.receipts, 'operation-a', target.receipt);
      await client.rPush(keys.dedupeOrder, 'operation-a');
      const result = await new RedisAuthorityDriver(client).commit(
        context(),
        upsert()
      );
      replayed = result.status === 'committed' && result.replayed;
    }
    expect(replayed).toBe(true);
  });

  it('retires expiresAt equal to Redis time with its paired receipt and order entry', async () => {
    const now = (await client.time()).getTime();
    const expired = validWindowEntry({
      operationId: 'expires-at-now',
      createdAt: now - 86_400_000,
      revision: '1',
    });
    await client.hSet(keys.dedupe, 'expires-at-now', expired.dedupe);
    await client.hSet(keys.receipts, 'expires-at-now', expired.receipt);
    await client.rPush(keys.dedupeOrder, 'expires-at-now');
    await expect(
      new RedisAuthorityDriver(client).commit(context(), upsert())
    ).resolves.toMatchObject({ status: 'committed' });
    expect(await client.hExists(keys.dedupe, 'expires-at-now')).toBe(false);
    expect(await client.hExists(keys.receipts, 'expires-at-now')).toBe(false);
    expect(await client.lRange(keys.dedupeOrder, 0, -1)).toEqual([
      'operation-a',
    ]);
  });

  it('subtracts expired dedupe bytes before pending capacity admission', async () => {
    const createdAt = Date.now() - 86_400_001;
    const dedupe: Record<string, string> = {};
    const receipts: Record<string, string> = {};
    const order: string[] = [];
    for (let index = 1; index <= 1_023; index += 1) {
      const prefix = `expired-byte-${String(index).padStart(4, '0')}-`;
      const operationId = prefix + 'x'.repeat(128 - prefix.length);
      const entry = validWindowEntry({
        operationId,
        createdAt,
        revision: String(index),
      });
      order.push(operationId);
      dedupe[operationId] = entry.dedupe;
      receipts[operationId] = entry.receipt;
    }
    await client.hSet(keys.dedupe, dedupe);
    await client.hSet(keys.receipts, receipts);
    await client.rPush(keys.dedupeOrder, order);
    expect(await dedupeBytes()).toBeGreaterThan(524_288);
    await expect(
      new RedisAuthorityDriver(client).commit(context(), upsert())
    ).resolves.toMatchObject({ status: 'committed' });
    expect(await client.hLen(keys.dedupe)).toBe(1);
    expect(await client.hLen(keys.receipts)).toBe(1);
    expect(await client.lRange(keys.dedupeOrder, 0, -1)).toEqual([
      'operation-a',
    ]);
  });

  it('does not replay through an otherwise valid live window above the byte cap', async () => {
    const createdAt = Date.now() - 1_000;
    const target = validWindowEntry({
      operationId: 'operation-a',
      createdAt,
      revision: '1',
      digest: operationDigest('operation-a'),
    });
    const dedupe: Record<string, string> = { 'operation-a': target.dedupe };
    const receipts: Record<string, string> = {
      'operation-a': target.receipt,
    };
    const order = ['operation-a'];
    for (let index = 1; index <= 1_022; index += 1) {
      const prefix = `overcap-${String(index).padStart(4, '0')}-`;
      const operationId = prefix + 'x'.repeat(128 - prefix.length);
      const entry = validWindowEntry({
        operationId,
        createdAt,
        revision: String(index + 1),
      });
      order.push(operationId);
      dedupe[operationId] = entry.dedupe;
      receipts[operationId] = entry.receipt;
    }
    await client.hSet(keys.dedupe, dedupe);
    await client.hSet(keys.receipts, receipts);
    await client.rPush(keys.dedupeOrder, order);
    expect(await dedupeBytes()).toBeGreaterThan(524_288);
    const before = await snapshot();
    await expect(
      new RedisAuthorityDriver(client).commit(context(), upsert())
    ).resolves.toEqual({ status: 'rejected', reason: 'overloaded' });
    expect(await snapshot()).toEqual(before);
  });

  it.each([
    ['wrong type', async () => client.set(keys.playerRate, 'corrupt')],
    [
      'over-cap cardinality',
      async () => {
        const entries: Record<string, string> = {};
        for (let index = 0; index < 1_025; index += 1)
          entries[`player-${index}`] = '{}';
        await client.hSet(keys.playerRate, entries);
      },
    ],
  ])(
    'rejects a %s player-rate key without changing any key',
    async (_label, seed) => {
      await seed();
      const before = await snapshot();
      await expect(
        new RedisAuthorityDriver(client).commit(
          playerContext('rate-corrupt'),
          upsert('rate-corrupt', 'rate-corrupt')
        )
      ).resolves.toMatchObject({ status: 'rejected' });
      expect(await snapshot()).toEqual(before);
    }
  );

  it('accepts equal-millisecond player timestamps and rejects the eleventh slot', async () => {
    const timestamp = Date.now() - 10;
    await client.hSet(
      keys.playerRate,
      'player-a',
      `{"generation":"${GENERATION}","timestamps":[${Array(9).fill(timestamp).join(',')}]}`
    );
    const driver = new RedisAuthorityDriver(client);
    await expect(
      driver.commit(
        playerContext('equal-ms-10'),
        upsert('equal-ms-10', 'equal-ms-10')
      )
    ).resolves.toMatchObject({ status: 'committed' });
    const parsed = JSON.parse(
      (await client.hGet(keys.playerRate, 'player-a'))!
    ) as { timestamps: number[] };
    expect(parsed.timestamps).toHaveLength(10);
    expect(new Set(parsed.timestamps.slice(0, 9))).toEqual(
      new Set([timestamp])
    );
    const before = await snapshot();
    await expect(
      driver.commit(
        playerContext('equal-ms-11'),
        upsert('equal-ms-11', 'equal-ms-11')
      )
    ).resolves.toEqual({ status: 'rejected', reason: 'overloaded' });
    expect(await snapshot()).toEqual(before);
  });

  it('does not count a timestamp at the 1000 ms boundary', async () => {
    const redisTime = await client.time();
    const now = redisTime.getTime();
    await client.hSet(
      keys.playerRate,
      'player-a',
      `{"generation":"${GENERATION}","timestamps":[${Array(10)
        .fill(now - 1_000)
        .join(',')}]}`
    );
    await expect(
      new RedisAuthorityDriver(client).commit(
        playerContext('boundary-success'),
        upsert('boundary-success', 'boundary-success')
      )
    ).resolves.toMatchObject({ status: 'committed' });
  });

  it('replays before player rate accounting without consuming a slot', async () => {
    const driver = new RedisAuthorityDriver(client);
    await expect(
      driver.commit(
        playerContext('replay-rate'),
        upsert('replay-rate', 'replay-rate')
      )
    ).resolves.toMatchObject({ status: 'committed', replayed: false });
    const now = Date.now();
    await client.hSet(
      keys.playerRate,
      'player-a',
      `{"generation":"${GENERATION}","timestamps":[${Array(10).fill(now).join(',')}]}`
    );
    const before = await snapshot();
    await expect(
      driver.commit(
        playerContext('replay-rate'),
        upsert('replay-rate', 'replay-rate')
      )
    ).resolves.toMatchObject({ status: 'committed', replayed: true });
    expect(await snapshot()).toEqual(before);
  });

  it.each([
    ['malformed', '{}'],
    [
      'wrong generation',
      `{"generation":"423e4567-e89b-42d3-a456-426614174000","timestamps":[1]}`,
    ],
    ['oversized', 'x'.repeat(513)],
    [
      'future timestamp',
      `{"generation":"${GENERATION}","timestamps":[9007199254740991]}`,
    ],
    [
      'decreasing timestamps',
      `{"generation":"${GENERATION}","timestamps":[2,1]}`,
    ],
  ])(
    'rejects a %s trusted player rate field invariantly',
    async (_label, raw) => {
      await client.hSet(keys.playerRate, 'player-a', raw);
      const before = await snapshot();
      await expect(
        new RedisAuthorityDriver(client).commit(
          playerContext('bad-rate'),
          upsert('bad-rate', 'bad-rate')
        )
      ).resolves.toEqual({ status: 'rejected', reason: 'invalid' });
      expect(await snapshot()).toEqual(before);
    }
  );

  it('rejects a new player at 1024 fields but lets an existing player prune at cap', async () => {
    const fields: Record<string, string> = {};
    const old = Date.now() - 2_000;
    fields['player-a'] = `{"generation":"${GENERATION}","timestamps":[${old}]}`;
    for (let index = 1; index < 1_024; index += 1)
      fields[`occupant-${index}`] = '{}';
    await client.hSet(keys.playerRate, fields);
    const driver = new RedisAuthorityDriver(client);
    const before = await snapshot();
    await expect(
      driver.commit(
        playerContext('new-at-cap', 'new-player'),
        upsert('new-at-cap', 'new-at-cap')
      )
    ).resolves.toEqual({ status: 'rejected', reason: 'overloaded' });
    expect(await snapshot()).toEqual(before);
    await expect(
      driver.commit(
        playerContext('existing-at-cap', 'player-a'),
        upsert('existing-at-cap', 'existing-at-cap')
      )
    ).resolves.toMatchObject({ status: 'committed' });
    expect(await client.hLen(keys.playerRate)).toBe(1_024);
  });

  it('retires the oldest history and its evidence atomically at steady-state bounds', async () => {
    const evidence: Record<string, string> = {};
    const history: string[] = [];
    const empty = JSON.stringify({
      elements: [],
      layers: [],
      extensions: { fog: { pluginName: 'fog', version: 1, data: null } },
    });
    for (let index = 1; index <= 1_024; index += 1) {
      const beforeId = `history-${index}:before`;
      const afterId = `history-${index}:after`;
      evidence[beforeId] = empty;
      evidence[afterId] = empty;
      history.push(
        JSON.stringify({
          position: { generation: GENERATION, revision: String(index) },
          before: { id: beforeId, byteLength: empty.length, nodes: 1 },
          after: { id: afterId, byteLength: empty.length, nodes: 1 },
          bytes: 1,
        })
      );
    }
    await client.hSet(keys.evidence, evidence);
    await client.rPush(keys.history, history);
    await client.set(
      keys.meta,
      JSON.stringify({
        v: 1,
        generation: GENERATION,
        revision: 1_024,
        casToken: 'cas-initial',
      })
    );
    const result = await new RedisAuthorityDriver(client).commit(
      context(),
      upsert()
    );
    expect(result).toMatchObject({ status: 'committed' });
    expect(await client.lLen(keys.history)).toBe(1_024);
    expect(await client.hLen(keys.evidence)).toBe(2_048);
    expect(await client.hExists(keys.evidence, 'history-1:before')).toBe(false);
    expect(await client.hExists(keys.evidence, 'history-1:after')).toBe(false);
  });

  it('retires receipts with expired dedupe entries', async () => {
    const dedupe: Record<string, string> = {};
    const receipts: Record<string, string> = {};
    const order: string[] = [];
    for (let index = 0; index < 1_024; index += 1) {
      const id = `expired-${index}`;
      const entry = validWindowEntry({
        operationId: id,
        createdAt: Date.now() - 86_400_001,
        revision: String(index + 1),
      });
      order.push(id);
      receipts[id] = entry.receipt;
      dedupe[id] = entry.dedupe;
    }
    await client.hSet(keys.dedupe, dedupe);
    await client.hSet(keys.receipts, receipts);
    await client.rPush(keys.dedupeOrder, order);
    await expect(
      new RedisAuthorityDriver(client).commit(context(), upsert())
    ).resolves.toMatchObject({ status: 'committed' });
    expect(await client.hLen(keys.dedupe)).toBe(1);
    expect(await client.hLen(keys.receipts)).toBe(1);
    expect(await client.lLen(keys.dedupeOrder)).toBe(1);
  });

  it('rejects an orphan oversized receipt without changing any key', async () => {
    await client.hSet(keys.receipts, 'orphan', 'x'.repeat(1_048_576));
    const before = await snapshot();
    await expect(
      new RedisAuthorityDriver(client).commit(context(), upsert())
    ).resolves.toEqual({ status: 'rejected', reason: 'invalid' });
    expect(await snapshot()).toEqual(before);
  });

  it('rejects orphan evidence cardinality without changing any key', async () => {
    await client.hSet(keys.evidence, 'orphan', '{}');
    const before = await snapshot();
    await expect(
      new RedisAuthorityDriver(client).commit(context(), upsert())
    ).resolves.toEqual({ status: 'rejected', reason: 'invalid' });
    expect(await snapshot()).toEqual(before);
  });

  it('retires the oldest history/evidence pair before crossing the evidence byte cap', async () => {
    const halfCap = 'x'.repeat(20 * 1024 * 1024);
    await client.hSet(keys.evidence, {
      'large:before': halfCap,
      'large:after': halfCap,
    });
    await client.rPush(
      keys.history,
      JSON.stringify({
        position: { generation: GENERATION, revision: '1' },
        before: { id: 'large:before', byteLength: halfCap.length, nodes: 1 },
        after: { id: 'large:after', byteLength: halfCap.length, nodes: 1 },
        bytes: 1,
      })
    );
    await expect(
      new RedisAuthorityDriver(client).commit(context(), upsert())
    ).resolves.toMatchObject({ status: 'committed' });
    expect(await client.hExists(keys.evidence, 'large:before')).toBe(false);
    expect(await client.hExists(keys.evidence, 'large:after')).toBe(false);
    expect(await client.hLen(keys.evidence)).toBe(2);
    expect(await client.lLen(keys.history)).toBe(1);
  }, 20_000);

  it.each([
    [
      'initialize object-shaped elements',
      true,
      {
        elements: {},
        layers: [],
        extensions: { fog: { pluginName: 'fog', version: 1, data: null } },
      },
    ],
    [
      'restore unknown extension',
      false,
      {
        elements: [],
        layers: [],
        extensions: {
          fog: { pluginName: 'fog', version: 1, data: null },
          other: {},
        },
      },
    ],
    [
      'restore object-shaped fog tiles',
      false,
      {
        elements: [],
        layers: [],
        extensions: {
          fog: {
            pluginName: 'fog',
            version: 1,
            data: { meta: { version: 1 }, tiles: {} },
          },
        },
      },
    ],
    [
      'restore missing fog extension',
      false,
      { elements: [], layers: [], extensions: {} },
    ],
    [
      'restore unknown fog member',
      false,
      {
        elements: [],
        layers: [],
        extensions: {
          fog: {
            pluginName: 'fog',
            version: 1,
            data: null,
            unknown: true,
          },
        },
      },
    ],
    [
      'restore unknown top-level member',
      false,
      {
        elements: [],
        layers: [],
        extensions: { fog: { pluginName: 'fog', version: 1, data: null } },
        cursor: {},
      },
    ],
  ])(
    'rejects malformed %s without changing any declared key',
    async (_label, initialize, state) => {
      const control = JSON.parse(
        (await client.get(tableControlKey(CAMPAIGN)))!
      ) as Record<string, unknown>;
      control.holderPrincipal = 'principal-a';
      await client.set(tableControlKey(CAMPAIGN), JSON.stringify(control));
      if (initialize) await client.del(keys.meta);
      const before = await snapshot();
      const result = await new RedisAuthorityDriver(client).provision({
        campaign: CAMPAIGN,
        sceneId: 'scene-a',
        room: ROOM,
        epoch: EPOCH,
        writerFence: 7,
        principal: 'principal-a',
        deadlineAt: Date.now() + 5_000,
        state: state as never,
        generation: initialize
          ? GENERATION
          : '423e4567-e89b-42d3-a456-426614174000',
        casToken: 'replacement-cas',
        expectedGeneration: initialize ? null : GENERATION,
        expectedCasToken: initialize ? null : 'cas-initial',
      });
      expect(result).toEqual({ status: 'rejected', reason: 'invalid' });
      expect(await snapshot()).toEqual(before);
    }
  );

  it.each([
    [
      'object-shaped elements',
      {
        elements: {},
        layers: [],
        extensions: { fog: { pluginName: 'fog', version: 1, data: null } },
      },
      { elementsArray: false, layersArray: true, fogTilesArray: true },
    ],
    [
      'unknown top-level state member',
      {
        elements: [],
        layers: [],
        extensions: { fog: { pluginName: 'fog', version: 1, data: null } },
        unexpected: true,
      },
      { elementsArray: true, layersArray: true, fogTilesArray: true },
    ],
  ])(
    'duplicates structural fail-closed validation inside Lua (%s)',
    async (_label, state, stateShape) => {
      const control = JSON.parse(
        (await client.get(tableControlKey(CAMPAIGN)))!
      ) as Record<string, unknown>;
      control.holderPrincipal = 'principal-a';
      await client.set(tableControlKey(CAMPAIGN), JSON.stringify(control));
      await client.del(keys.meta);
      const before = await snapshot();
      const raw = (await client.eval(ROLLKEEPER_PROVISION_LUA_V1, {
        keys: [
          tableControlKey(CAMPAIGN),
          tableRegistryKey(CAMPAIGN),
          keys.meta,
          keys.elements,
          keys.ownership,
          keys.layers,
          keys.fogMeta,
          keys.fogTiles,
          keys.dedupe,
          keys.dedupeOrder,
          keys.receipts,
          keys.history,
          keys.evidence,
          keys.outbox,
          keys.outboxClaims,
          keys.playerRate,
        ],
        arguments: [
          JSON.stringify({
            campaign: CAMPAIGN,
            sceneId: 'scene-a',
            room: ROOM,
            epoch: EPOCH,
            writerFence: 7,
            principal: 'principal-a',
            deadlineAt: Date.now() + 5_000,
            state,
            stateShape,
            generation: GENERATION,
            casToken: 'replacement-cas',
            expectedGeneration: null,
            expectedCasToken: null,
          }),
        ],
      })) as unknown[];
      expect(raw.map(String)).toEqual(['0', 'invalid']);
      expect(await snapshot()).toEqual(before);
    }
  );

  it('guards initialize-if-empty and whole-generation restore with generation and CAS', async () => {
    await client.del(keys.meta);
    const first = new RedisAuthorityDriver(client);
    const state = {
      elements: [
        {
          ...createShape({
            position: { x: 1, y: 2 },
            size: { w: 10, h: 10 },
          }),
          id: 'seed-a',
          ownerId: 'dm-a',
        },
      ],
      layers: [],
      extensions: { fog: { pluginName: 'fog', version: 1, data: null } },
    } as never;
    const common = {
      campaign: CAMPAIGN,
      sceneId: 'scene-a',
      room: ROOM,
      epoch: EPOCH,
      writerFence: 7,
      principal: 'principal-a',
      deadlineAt: Date.now() + 5_000,
      state,
    };
    const control = JSON.parse(
      (await client.get(tableControlKey(CAMPAIGN)))!
    ) as Record<string, unknown>;
    control.holderPrincipal = 'principal-a';
    await client.set(tableControlKey(CAMPAIGN), JSON.stringify(control));
    expect(
      await first.provision({
        ...common,
        generation: GENERATION,
        casToken: 'cas-provisioned',
        expectedGeneration: null,
        expectedCasToken: null,
      })
    ).toEqual({ status: 'provisioned', generation: GENERATION });
    const afterInitial = await snapshot();
    expect(
      await first.provision({
        ...common,
        generation: '423e4567-e89b-42d3-a456-426614174000',
        casToken: 'cas-racer',
        expectedGeneration: null,
        expectedCasToken: null,
      })
    ).toEqual({ status: 'rejected', reason: 'conflict' });
    expect(await snapshot()).toEqual(afterInitial);

    const replacement = '523e4567-e89b-42d3-a456-426614174000';
    await client.hSet(
      keys.dedupe,
      'old-operation',
      JSON.stringify({ generation: GENERATION })
    );
    await client.rPush(keys.dedupeOrder, 'old-operation');
    await client.hSet(
      keys.receipts,
      'old-operation',
      JSON.stringify({ generation: GENERATION })
    );
    await client.rPush(
      keys.history,
      JSON.stringify({ position: { generation: GENERATION } })
    );
    await client.hSet(keys.evidence, 'old-evidence', '{}');
    await client.rPush(
      keys.outbox,
      JSON.stringify({ position: { generation: GENERATION } })
    );
    await client.hSet(keys.outboxClaims, 'old-claim', 'worker-a');
    await client.hSet(keys.playerRate, 'old-rate', '{}');
    expect(
      await first.provision({
        ...common,
        state: {
          ...state,
          elements: [
            {
              ...createShape({
                position: { x: 3, y: 4 },
                size: { w: 10, h: 10 },
              }),
              id: 'seed-b',
              ownerId: 'restored-owner',
            },
          ],
        } as never,
        generation: replacement,
        casToken: 'cas-replaced',
        expectedGeneration: GENERATION,
        expectedCasToken: 'cas-provisioned',
      })
    ).toEqual({ status: 'provisioned', generation: replacement });
    expect(await client.hGet(keys.ownership, 'seed-a')).toBeNull();
    expect(await client.hGet(keys.ownership, 'seed-b')).toBe('restored-owner');
    expect(await client.hLen(keys.dedupe)).toBe(0);
    expect(await client.lLen(keys.dedupeOrder)).toBe(0);
    expect(await client.hLen(keys.receipts)).toBe(0);
    expect(await client.lLen(keys.history)).toBe(0);
    expect(await client.hLen(keys.evidence)).toBe(0);
    expect(await client.lLen(keys.outbox)).toBe(0);
    expect(await client.hLen(keys.outboxClaims)).toBe(0);
    expect(await client.hLen(keys.playerRate)).toBe(0);
  });
});
