import type {
  AuthContext,
  AuthorizeFrame,
  FrameAuthorizationContext,
} from '@fieldnotes/sync-server';

import {
  authorityRoomKeys,
  assertAuthorityKeyTag,
  tableControlKey,
  tableRegistryKey,
} from './authority-keys.js';

export interface AccessRedis {
  eval(
    script: string,
    options: { keys: string[]; arguments: string[] }
  ): Promise<unknown>;
}

interface AccessClaim {
  v: 1;
  campaign: string;
  sceneId: string;
  room: string;
  epoch: string;
  roomGeneration: string;
  role: 'dm' | 'player' | 'display';
  writerFence?: number;
  playerPrincipal?: string;
  displayGeneration?: number;
}

interface Pending {
  claim: AccessClaim;
  expiresAt?: number;
  deadlineAt: number;
  signal?: AbortSignal;
  settled: boolean;
  timeout: ReturnType<typeof setTimeout>;
  abort?: () => void;
  resolve(value: boolean): void;
}

const ACCESS_LUA = String.raw`
local controlRaw = redis.call('GET', KEYS[1])
if not controlRaw then return {} end
local controlOk, control = pcall(cjson.decode, controlRaw)
if not controlOk or type(control) ~= 'table' or control.v ~= 1 then return {} end
local checksOk, checks = pcall(cjson.decode, ARGV[1])
if not checksOk or type(checks) ~= 'table' then return {} end
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
local result = {}
for index, check in ipairs(checks) do
  local allowed = control.epoch == check.epoch
  local registryRaw = redis.call('HGET', KEYS[2], check.sceneId)
  local registryOk, registry = pcall(cjson.decode, registryRaw)
  local metaRaw = redis.call('GET', KEYS[index + 2])
  local metaOk, meta = pcall(cjson.decode, metaRaw)
  allowed = allowed and registryOk and type(registry) == 'table' and registry.v == 1
    and registry.deleted ~= true and registry.sceneId == check.sceneId
    and registry.roomId == check.room and metaOk and type(meta) == 'table'
    and meta.v == 1 and meta.generation == check.roomGeneration
  if check.role == 'dm' then
    allowed = allowed and control.writerFence == check.writerFence
      and type(control.leaseUntil) == 'number' and control.leaseUntil > now
  elseif check.role == 'player' then
    allowed = allowed and type(check.playerPrincipal) == 'string'
      and type(control.presentation) == 'table'
      and control.presentation.sceneId == check.sceneId
      and control.presentation.blanked ~= true
  elseif check.role == 'display' then
    allowed = allowed and type(control.presentation) == 'table'
      and control.presentation.sceneId == check.sceneId
      and control.presentation.blanked ~= true
      and control.displayGeneration == check.displayGeneration
  else allowed = false end
  result[index] = allowed and 1 or 0
end
return result
`;

function claimFrom(authContext: AuthContext | undefined): AccessClaim | null {
  const value = authContext as Record<string, unknown> | undefined;
  if (
    !value ||
    value.v !== 1 ||
    typeof value.campaign !== 'string' ||
    typeof value.sceneId !== 'string' ||
    typeof value.room !== 'string' ||
    typeof value.epoch !== 'string' ||
    typeof value.roomGeneration !== 'string' ||
    !['dm', 'player', 'display'].includes(String(value.role))
  )
    return null;
  return value as unknown as AccessClaim;
}

/**
 * Freezes each admission window for at most 20 ms and performs one Redis
 * evaluation per campaign. No permission result survives its own batch.
 */
export class TableAccessBatcher {
  private queue: Pending[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly redis: AccessRedis,
    private readonly windowMs = 20
  ) {}

  authorizeClaim(
    authContext: AuthContext | undefined,
    expiresAt?: number,
    options: { deadlineAt?: number; signal?: AbortSignal } = {}
  ): Promise<boolean> {
    const claim = claimFrom(authContext);
    if (!claim) return Promise.resolve(true);
    if (expiresAt === undefined || expiresAt <= Date.now())
      return Promise.resolve(false);
    if (options.signal?.aborted) return Promise.resolve(false);
    const deadlineAt = Math.min(
      Date.now() + 1_000,
      expiresAt,
      options.deadlineAt ?? Number.POSITIVE_INFINITY
    );
    if (deadlineAt <= Date.now()) return Promise.resolve(false);
    return new Promise(resolve => {
      const pending: Pending = {
        claim: Object.freeze({ ...claim }),
        expiresAt,
        deadlineAt,
        signal: options.signal,
        settled: false,
        timeout: undefined as unknown as ReturnType<typeof setTimeout>,
        resolve,
      };
      const finish = (value: boolean) => this.finish(pending, value);
      pending.timeout = setTimeout(
        () => finish(false),
        Math.max(0, deadlineAt - Date.now())
      );
      if (options.signal) {
        pending.abort = () => finish(false);
        options.signal.addEventListener('abort', pending.abort, { once: true });
      }
      this.queue.push(pending);
      if (!this.timer)
        this.timer = setTimeout(() => void this.flush(), this.windowMs);
    });
  }

  readonly authorizeFrame: AuthorizeFrame = (
    context: FrameAuthorizationContext
  ) =>
    this.authorizeClaim(context.authContext, context.expiresAt, {
      deadlineAt: context.deadlineAt,
      signal: context.signal,
    });

  private finish(pending: Pending, value: boolean): void {
    if (pending.settled) return;
    pending.settled = true;
    clearTimeout(pending.timeout);
    if (pending.signal && pending.abort)
      pending.signal.removeEventListener('abort', pending.abort);
    pending.resolve(value);
  }

  private async flush(): Promise<void> {
    const batch = this.queue;
    this.queue = [];
    this.timer = null;
    const groups = new Map<string, Pending[]>();
    for (const pending of batch) {
      if (pending.settled) continue;
      const group = groups.get(pending.claim.campaign) ?? [];
      group.push(pending);
      groups.set(pending.claim.campaign, group);
    }
    await Promise.all(
      [...groups.entries()].map(async ([campaign, entries]) => {
        try {
          const keys = [
            tableControlKey(campaign),
            tableRegistryKey(campaign),
            ...entries.map(
              entry => authorityRoomKeys(campaign, entry.claim.room).meta
            ),
          ];
          assertAuthorityKeyTag(campaign, keys);
          const frozen = entries.map(entry => ({ ...entry.claim }));
          const read = this.redis.eval(ACCESS_LUA, {
            keys,
            arguments: [JSON.stringify(frozen)],
          });
          // Bound the native Redis operation as well as each caller. A late
          // Redis rejection is observed, while its result is never reused.
          const timeout = Symbol('timeout');
          const groupDeadline = Math.min(
            ...entries.map(entry => entry.deadlineAt)
          );
          let timer: ReturnType<typeof setTimeout> | undefined;
          const raw = await Promise.race([
            read,
            new Promise<typeof timeout>(resolve => {
              timer = setTimeout(
                () => resolve(timeout),
                Math.max(0, groupDeadline - Date.now())
              );
            }),
          ]);
          if (timer) clearTimeout(timer);
          if (raw === timeout) {
            void read.catch(() => undefined);
            entries.forEach(entry => this.finish(entry, false));
            return;
          }
          const results = Array.isArray(raw) ? raw : [];
          entries.forEach((entry, index) => {
            this.finish(
              entry,
              entry.expiresAt !== undefined &&
                entry.expiresAt > Date.now() &&
                entry.deadlineAt > Date.now() &&
                !entry.signal?.aborted &&
                Number(results[index]) === 1
            );
          });
        } catch {
          entries.forEach(entry => this.finish(entry, false));
        }
      })
    );
  }
}

export { ACCESS_LUA };
