import { randomBytes, randomUUID } from 'node:crypto';
import {
  prepareAuthorityCheckpoint,
  type AuthorityCheckpointPayload,
} from '@fieldnotes/sync';
import type {
  AuthorityCaptureLease,
  AuthorityCommitContext,
  AuthorityCommitRequest,
  AuthorityCommitResult,
  AuthorityDriver,
  AuthorityEvidenceResult,
  AuthorityPosition,
  AuthorityPublication,
  AuthorityPublicationClaim,
  AuthorityReadContext,
  AuthorityReadOptions,
  AuthorityReadPage,
  AuthorityState,
} from '@fieldnotes/sync-server';
import {
  createScriptRunner,
  type RedisHashClient,
} from '@fieldnotes/sync-redis';
import {
  assembleFogAuthorityRedisScriptV1,
  encodeFogAuthorityRedisIntentV1,
} from '@fieldnotes/vtt/redis';
import {
  createFogAuthorityServerExtension,
  type FogAuthorityIntent,
} from '@fieldnotes/vtt/server';
import {
  assertAuthorityKeyTag,
  authorityRoomKeys,
  tableControlKey,
  tableRegistryKey,
  type AuthorityRoomKeys,
} from './authority-keys.js';
import {
  ROLLKEEPER_AUTHORITY_HOST_V1,
  ROLLKEEPER_CHECKPOINT_LUA_V1,
  ROLLKEEPER_PROVISION_LUA_V1,
} from './authority-lua.js';
import {
  playerIntentShapeAllowed,
  validateAuthorityRequest,
} from './authority-validation.js';

const AUTHORITY_SCRIPT = assembleFogAuthorityRedisScriptV1(
  ROLLKEEPER_AUTHORITY_HOST_V1
);
const LEASE_MS = 5_000;

interface V1Auth {
  v: 1;
  campaign: string;
  resourceKind: 'scene';
  sceneId: string;
  room: string;
  epoch: string;
  role: 'dm' | 'player' | 'display';
  roomGeneration: string;
  writerFence?: number;
  playerPrincipal?: string;
  displayGeneration?: number;
  principal?: string;
}

interface RoomRef {
  campaign: string;
  room: string;
  definitionId: string;
  keys: AuthorityRoomKeys;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[]
): boolean {
  const actual = Object.keys(value).sort();
  return (
    actual.length === expected.length &&
    [...expected].sort().every((key, index) => actual[index] === key)
  );
}

async function validatesAuthorityState(value: unknown): Promise<boolean> {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['elements', 'layers', 'extensions'])
  )
    return false;
  if (!Array.isArray(value.elements) || !Array.isArray(value.layers))
    return false;
  if (!isRecord(value.extensions) || !hasExactKeys(value.extensions, ['fog']))
    return false;
  const fog = value.extensions.fog;
  if (!isRecord(fog) || !hasExactKeys(fog, ['pluginName', 'version', 'data']))
    return false;
  const fogData = fog.data === null ? null : fog.data;
  if (
    fogData !== null &&
    (!isRecord(fogData) ||
      !hasExactKeys(fogData, ['meta', 'tiles']) ||
      !Array.isArray(fogData.tiles))
  )
    return false;
  try {
    const prepared = await prepareAuthorityCheckpoint(
      {
        ...(value as unknown as AuthorityState),
        cursor: {
          generation: 'rollkeeper-validation',
          streamId: '00000000000000000000000000000000',
          revision: 0,
        },
        casToken: 'rollkeeper-validation',
      } as AuthorityCheckpointPayload,
      {
        requestId: 'rollkeeper-validation',
        checkpointId: 'rollkeeper-validation',
        requiredExtensions: [createFogAuthorityServerExtension().requirement],
      }
    );
    prepared.dispose();
    return true;
  } catch {
    return false;
  }
}

function authFrom(
  context: AuthorityReadContext | AuthorityCommitContext
): V1Auth | null {
  const value = context.authContext;
  if (!isRecord(value) || value.v !== 1 || value.resourceKind !== 'scene')
    return null;
  if (
    typeof value.campaign !== 'string' ||
    typeof value.sceneId !== 'string' ||
    typeof value.room !== 'string' ||
    value.room !== context.room ||
    typeof value.epoch !== 'string' ||
    typeof value.roomGeneration !== 'string' ||
    !['dm', 'player', 'display'].includes(String(value.role))
  )
    return null;
  return value as unknown as V1Auth;
}

function arrayResult(raw: unknown): readonly unknown[] {
  if (!Array.isArray(raw) || raw.length < 2)
    throw new Error('Invalid authority Redis result');
  return raw;
}

function textValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  throw new Error('Invalid authority Redis string');
}

function rejection(value: unknown): AuthorityCommitResult {
  const reason = textValue(value);
  if (
    ![
      'forbidden',
      'invalid',
      'generation-mismatch',
      'conflict',
      'expired',
      'overloaded',
      'unsupported-extension',
      'operation-id-reused',
      'retry-window-expired',
    ].includes(reason)
  ) {
    throw new Error(`Invalid authority rejection: ${reason}`);
  }
  return {
    status: 'rejected',
    reason: reason as Extract<
      AuthorityCommitResult,
      { status: 'rejected' }
    >['reason'],
  };
}

function decodeJson<T>(value: unknown): T {
  return JSON.parse(textValue(value)) as T;
}

function readArgs(
  context: AuthorityReadContext | AuthorityCommitContext,
  auth: V1Auth
) {
  return {
    campaign: auth.campaign,
    sceneId: auth.sceneId,
    room: auth.room,
    epoch: auth.epoch,
    role: auth.role,
    roomGeneration: auth.roomGeneration,
    ownershipId: context.ownershipId,
    ...(auth.writerFence === undefined
      ? {}
      : { writerFence: auth.writerFence }),
    ...(auth.playerPrincipal === undefined
      ? {}
      : { playerPrincipal: auth.playerPrincipal }),
    ...(auth.displayGeneration === undefined
      ? {}
      : { displayGeneration: auth.displayGeneration }),
    ...(auth.principal === undefined ? {} : { principal: auth.principal }),
  };
}

function roomRef(
  context: AuthorityReadContext | AuthorityCommitContext,
  auth: V1Auth
): RoomRef {
  const keys = authorityRoomKeys(auth.campaign, context.room);
  assertAuthorityKeyTag(auth.campaign, [
    ...Object.values(keys),
    tableControlKey(auth.campaign),
    tableRegistryKey(auth.campaign),
  ]);
  return {
    campaign: auth.campaign,
    room: context.room,
    definitionId: context.definitionId,
    keys,
  };
}

export class RedisAuthorityDriver implements AuthorityDriver {
  private readonly run: ReturnType<typeof createScriptRunner>;
  private readonly rooms = new Map<string, RoomRef>();

  constructor(private readonly redis: RedisHashClient) {
    this.run = createScriptRunner(redis);
  }

  private remember(ref: RoomRef): void {
    this.rooms.set(`${ref.campaign}\0${ref.room}`, ref);
  }

  async provision(input: {
    campaign: string;
    sceneId: string;
    room: string;
    epoch: string;
    writerFence: number;
    principal: string;
    deadlineAt: number;
    generation: string;
    casToken: string;
    expectedGeneration: string | null;
    expectedCasToken: string | null;
    state: AuthorityState;
  }): Promise<
    | { status: 'provisioned'; generation: string }
    | { status: 'rejected'; reason: string }
  > {
    if (!(await validatesAuthorityState(input.state)))
      return { status: 'rejected', reason: 'invalid' };
    const keys = authorityRoomKeys(input.campaign, input.room);
    assertAuthorityKeyTag(input.campaign, [
      tableControlKey(input.campaign),
      tableRegistryKey(input.campaign),
      ...Object.values(keys),
    ]);
    const raw = arrayResult(
      await this.run(ROLLKEEPER_PROVISION_LUA_V1, {
        keys: [
          tableControlKey(input.campaign),
          tableRegistryKey(input.campaign),
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
            ...input,
            stateShape: {
              elementsArray: true,
              layersArray: true,
              fogTilesArray: true,
            },
          }),
        ],
      })
    );
    return Number(raw[0]) === 1
      ? { status: 'provisioned', generation: textValue(raw[1]) }
      : { status: 'rejected', reason: textValue(raw[1]) };
  }

  async head(
    context: AuthorityReadContext,
    options: AuthorityReadOptions
  ): Promise<AuthorityPosition> {
    const capture = await this.checkpoint(context, options);
    try {
      return capture.position;
    } finally {
      await capture.release();
    }
  }

  async commit(
    context: AuthorityCommitContext,
    request: AuthorityCommitRequest
  ): Promise<AuthorityCommitResult> {
    if (context.signal.aborted || context.deadlineAt <= Date.now())
      return { status: 'rejected', reason: 'expired' };
    const auth = authFrom(context);
    if (!auth || auth.roomGeneration !== context.roomGeneration)
      return { status: 'rejected', reason: 'forbidden' };
    const intent = validateAuthorityRequest(context, request);
    if (!intent) return { status: 'rejected', reason: 'invalid' };
    // Displays are read-only; the Lua role gate repeats this atomically.
    if (auth.role === 'display')
      return { status: 'rejected', reason: 'forbidden' };
    if (
      auth.role === 'player' &&
      !playerIntentShapeAllowed(intent, context.ownershipId)
    )
      return { status: 'rejected', reason: 'forbidden' };
    const ref = roomRef(context, auth);
    this.remember(ref);
    const app: Record<string, unknown> = {
      ...readArgs(context, auth),
      generation: context.roomGeneration,
      clientOperationId: context.clientOperationId,
      operationDigest: context.operationDigest,
      deadlineAt: context.deadlineAt,
      receiptId: randomUUID(),
      evidenceId: randomUUID(),
      nextCasToken: randomBytes(32).toString('hex'),
    };
    let fogArgument = 'null';
    if (intent.kind === 'element-upsert') {
      Object.assign(app, {
        kind: intent.kind,
        elementId: intent.element.id,
        element: intent.element,
      });
    } else if (intent.kind === 'element-remove') {
      Object.assign(app, { kind: intent.kind, elementId: intent.id });
    } else if (intent.kind === 'elements-clear') {
      Object.assign(app, {
        kind: intent.kind,
        expectedState: intent.expectedState,
      });
    } else if (intent.kind === 'layer-write') {
      Object.assign(app, { kind: intent.kind, record: intent.record });
    } else if (
      intent.kind === 'extension' &&
      intent.key === 'fog' &&
      intent.version === 1
    ) {
      app.kind = 'fog';
      fogArgument = encodeFogAuthorityRedisIntentV1(
        intent.payload as unknown as FogAuthorityIntent
      );
    } else {
      return { status: 'rejected', reason: 'unsupported-extension' };
    }
    const keys = ref.keys;
    const raw = arrayResult(
      await this.run(AUTHORITY_SCRIPT, {
        keys: [
          keys.fogMeta,
          keys.fogTiles,
          keys.meta,
          keys.elements,
          keys.ownership,
          keys.layers,
          keys.dedupe,
          keys.dedupeOrder,
          keys.receipts,
          keys.history,
          keys.evidence,
          keys.outbox,
          keys.outboxClaims,
          tableControlKey(auth.campaign),
          tableRegistryKey(auth.campaign),
          keys.playerRate,
        ],
        arguments: [fogArgument, JSON.stringify(app)],
      })
    );
    return Number(raw[0]) === 1
      ? decodeJson<AuthorityCommitResult>(raw[1])
      : rejection(raw[1]);
  }

  async checkpoint(
    context: AuthorityReadContext,
    options: AuthorityReadOptions
  ): Promise<AuthorityCaptureLease> {
    if (options.signal.aborted || options.deadlineAt <= Date.now())
      throw new Error('Authority checkpoint expired');
    const auth = authFrom(context);
    if (!auth) throw new Error('Authority checkpoint forbidden');
    const ref = roomRef(context, auth);
    this.remember(ref);
    const keys = ref.keys;
    const raw = arrayResult(
      await this.run(ROLLKEEPER_CHECKPOINT_LUA_V1, {
        keys: [
          keys.meta,
          keys.elements,
          keys.layers,
          keys.fogMeta,
          keys.fogTiles,
          tableControlKey(auth.campaign),
          tableRegistryKey(auth.campaign),
        ],
        arguments: [
          JSON.stringify({
            ...readArgs(context, auth),
            deadlineAt: options.deadlineAt,
          }),
        ],
      })
    );
    if (Number(raw[0]) !== 1)
      throw new Error(`Authority checkpoint ${textValue(raw[1])}`);
    const captured = decodeJson<{
      generation: string;
      revision: string;
      casToken: string;
      state: AuthorityState;
    }>(raw[1]);
    const token = randomBytes(16).toString('hex');
    return {
      position: {
        generation: captured.generation,
        revision: captured.revision,
      },
      state: captured.state,
      casToken: captured.casToken,
      expiresAt: Date.now() + LEASE_MS,
      token,
      async release() {},
    };
  }

  async readAfter(
    context: AuthorityReadContext,
    after: AuthorityPosition,
    limits: { entries: number; bytes: number },
    options: AuthorityReadOptions
  ): Promise<AuthorityReadPage> {
    const capture = await this.checkpoint(context, options);
    await capture.release();
    if (capture.position.generation !== after.generation)
      return { status: 'gap', head: capture.position };
    const auth = authFrom(context)!;
    const ref = roomRef(context, auth);
    const raw = await this.redis.eval(
      "return redis.call('LRANGE', KEYS[1], 0, -1)",
      { keys: [ref.keys.history], arguments: [] }
    );
    if (!Array.isArray(raw)) throw new Error('Invalid authority history');
    const publications = raw.map(item =>
      decodeJson<AuthorityPublication>(item)
    );
    const start = publications.findIndex(
      item =>
        item.previous.generation === after.generation &&
        item.previous.revision === after.revision
    );
    if (start < 0) {
      if (after.revision !== capture.position.revision)
        return { status: 'gap', head: capture.position };
      return { status: 'ok', head: capture.position, records: [] };
    }
    const records: AuthorityPublication[] = [];
    let bytes = 0;
    for (const item of publications.slice(start)) {
      const size = Buffer.byteLength(JSON.stringify(item));
      if (
        records.length >= Math.min(8, limits.entries) ||
        bytes + size > Math.min(64 * 1024, limits.bytes)
      )
        break;
      records.push(item);
      bytes += size;
      if (item.position.revision === capture.position.revision) break;
    }
    return { status: 'ok', head: capture.position, records };
  }

  async readEvidence(
    context: AuthorityReadContext,
    publication: AuthorityPublication,
    options: AuthorityReadOptions
  ): Promise<AuthorityEvidenceResult> {
    const capture = await this.checkpoint(context, options);
    await capture.release();
    if (capture.position.generation !== publication.position.generation)
      return { status: 'generation-changed', head: capture.position };
    const auth = authFrom(context)!;
    const keys = roomRef(context, auth).keys;
    const raw = await this.redis.eval(
      "return {redis.call('HGET',KEYS[1],ARGV[1]),redis.call('HGET',KEYS[1],ARGV[2])}",
      {
        keys: [keys.evidence],
        arguments: [publication.before.id, publication.after.id],
      }
    );
    if (!Array.isArray(raw) || !raw[0] || !raw[1])
      return { status: 'history-unavailable' };
    return {
      status: 'available',
      lease: {
        before: decodeJson<AuthorityState>(raw[0]),
        after: decodeJson<AuthorityState>(raw[1]),
        expiresAt: Date.now() + LEASE_MS,
        token: randomBytes(16).toString('hex'),
        async release() {},
      },
    };
  }

  async claimPublications(
    ownerId: string,
    limits: { entries: number; bytes: number; leaseMs: number },
    options: AuthorityReadOptions
  ): Promise<readonly AuthorityPublicationClaim[]> {
    if (options.signal.aborted || options.deadlineAt <= Date.now()) return [];
    const claims: AuthorityPublicationClaim[] = [];
    let bytes = 0;
    for (const ref of this.rooms.values()) {
      if (claims.length >= limits.entries) break;
      const token = randomBytes(16).toString('hex');
      const raw = arrayResult(
        await this.redis.eval(
          "local e=redis.call('LINDEX',KEYS[1],0); if not e then return {0,''} end; local p=cjson.decode(e); local f=p.position.generation..':'..p.position.revision; local c=redis.call('HGET',KEYS[2],f); local n=tonumber(ARGV[3]); if c then local d=cjson.decode(c); if d.expiresAt>n then return {0,''} end end; redis.call('HSET',KEYS[2],f,cjson.encode({ownerId=ARGV[1],token=ARGV[2],expiresAt=n+tonumber(ARGV[4])})); return {1,e}",
          {
            keys: [ref.keys.outbox, ref.keys.outboxClaims],
            arguments: [
              ownerId,
              token,
              String(Date.now()),
              String(limits.leaseMs),
            ],
          }
        )
      );
      if (Number(raw[0]) !== 1) continue;
      const publication = decodeJson<AuthorityPublication>(raw[1]);
      const size = Buffer.byteLength(JSON.stringify(publication));
      if (bytes + size > limits.bytes) break;
      bytes += size;
      claims.push({
        room: ref.room,
        definitionId: ref.definitionId,
        position: publication.position,
        ownerId,
        token,
        expiresAt: Date.now() + limits.leaseMs,
      });
    }
    return claims;
  }

  async markPublished(
    claim: AuthorityPublicationClaim,
    options: AuthorityReadOptions
  ): Promise<void> {
    if (options.signal.aborted || options.deadlineAt <= Date.now())
      throw new Error('Publication claim expired');
    const ref = [...this.rooms.values()].find(
      item =>
        item.room === claim.room && item.definitionId === claim.definitionId
    );
    if (!ref) throw new Error('Unknown publication room');
    const raw = arrayResult(
      await this.redis.eval(
        "local f=ARGV[1]..':'..ARGV[2]; local c=redis.call('HGET',KEYS[2],f); if not c then return {0,'claim'} end; local d=cjson.decode(c); if d.ownerId~=ARGV[3] or d.token~=ARGV[4] then return {0,'claim'} end; local e=redis.call('LINDEX',KEYS[1],0); if not e then return {0,'outbox'} end; local p=cjson.decode(e); if p.position.generation~=ARGV[1] or p.position.revision~=ARGV[2] then return {0,'position'} end; redis.call('LPOP',KEYS[1]); redis.call('HDEL',KEYS[2],f); return {1,'ok'}",
        {
          keys: [ref.keys.outbox, ref.keys.outboxClaims],
          arguments: [
            claim.position.generation,
            claim.position.revision,
            claim.ownerId,
            claim.token,
          ],
        }
      )
    );
    if (Number(raw[0]) !== 1)
      throw new Error(`Unable to mark publication: ${textValue(raw[1])}`);
  }
}

export { AUTHORITY_SCRIPT };
