import type { Redis } from '@upstash/redis';

import { sha256Bytes } from '@/lib/indexeddb/migrationCapture';
import { SLIDING_TTL_SECONDS } from '@/lib/redis';

import {
  projectCalendarForLegacyPlayers,
  type CalendarPayload,
} from './calendarFamily';

export interface CalendarProjectionCursor {
  epoch: number;
  version: number;
  fingerprint: string;
}

export type CalendarProjectionCasDecision =
  | 'write'
  | 'identical'
  | 'stale-version'
  | 'stale-epoch'
  | 'divergent';

export function decideCalendarProjectionCas(
  current: CalendarProjectionCursor | null,
  incoming: CalendarProjectionCursor
): CalendarProjectionCasDecision {
  if (!current || incoming.epoch > current.epoch) return 'write';
  if (incoming.epoch < current.epoch) return 'stale-epoch';
  if (incoming.version > current.version) return 'write';
  if (incoming.version < current.version) return 'stale-version';
  return incoming.fingerprint === current.fingerprint
    ? 'identical'
    : 'divergent';
}

export const CALENDAR_PROJECTION_CAS_SCRIPT = `
-- rollkeeper-calendar-projection-v1
local existing_raw = redis.call('GET', KEYS[1])
local existing = nil
if existing_raw then
  local ok, parsed = pcall(cjson.decode, existing_raw)
  if not ok or type(parsed) ~= 'table' then return {'poison', ''} end
  existing = parsed
end
local incoming_epoch = tonumber(ARGV[1])
local incoming_version = tonumber(ARGV[2])
local incoming_fingerprint = ARGV[3]
if existing then
  local stored_epoch = tonumber(existing.epoch) or -1
  local stored_version = tonumber(existing.version) or -1
  local stored_fingerprint = tostring(existing.fingerprint or '')
  if incoming_epoch < stored_epoch then return {'stale-epoch', stored_fingerprint} end
  if incoming_epoch == stored_epoch and incoming_version < stored_version then return {'stale-version', stored_fingerprint} end
  if incoming_epoch == stored_epoch and incoming_version == stored_version then
    if incoming_fingerprint == stored_fingerprint then return {'identical', stored_fingerprint} end
    return {'divergent', stored_fingerprint}
  end
end
local ttl = tonumber(ARGV[6])
redis.call('SET', KEYS[1], cjson.encode({epoch=incoming_epoch,version=incoming_version,fingerprint=incoming_fingerprint}), 'EX', ttl)
if ARGV[5] == '1' then redis.call('DEL', KEYS[2])
else redis.call('SET', KEYS[2], ARGV[4], 'EX', ttl) end
return {'written', incoming_fingerprint}
`;

interface ProjectionRedis {
  eval(script: string, keys: string[], args: string[]): Promise<unknown>;
}

export interface CalendarProjectionInput {
  campaignCode: string;
  epoch: number;
  version: number;
  sourceFingerprint: string;
  payload: CalendarPayload | null;
  tombstoned: boolean;
}

export async function publishCalendarProjection(
  redis: ProjectionRedis,
  input: CalendarProjectionInput
): Promise<{
  status:
    | 'written'
    | 'identical'
    | 'stale-version'
    | 'stale-epoch'
    | 'divergent'
    | 'poison';
  projectionFingerprint: string;
}> {
  if (!/^[A-Z0-9]{6}$/u.test(input.campaignCode)) {
    throw new Error('Invalid calendar projection code');
  }
  if (
    !input.tombstoned &&
    (!input.payload ||
      typeof input.payload !== 'object' ||
      Array.isArray(input.payload))
  ) {
    throw new Error('Invalid calendar projection payload');
  }
  const projection = input.tombstoned
    ? { codecVersion: 1 as const, tombstoned: true as const }
    : projectCalendarForLegacyPlayers(input.payload!);
  const projectionFingerprint = await sha256Bytes(JSON.stringify(projection));
  const base = `campaign:${input.campaignCode}`;
  const reply = await redis.eval(
    CALENDAR_PROJECTION_CAS_SCRIPT,
    [`${base}:projection:calendar:meta`, `${base}:shared:calendar`],
    [
      String(input.epoch),
      String(input.version),
      projectionFingerprint,
      input.tombstoned ? '{}' : JSON.stringify(projection),
      input.tombstoned ? '1' : '0',
      String(SLIDING_TTL_SECONDS),
    ]
  );
  if (!Array.isArray(reply) || typeof reply[0] !== 'string')
    throw new Error('Malformed calendar projection reply');
  const allowed = [
    'written',
    'identical',
    'stale-version',
    'stale-epoch',
    'divergent',
    'poison',
  ];
  if (!allowed.includes(reply[0]))
    throw new Error('Unknown calendar projection reply');
  return {
    status: reply[0] as
      | 'written'
      | 'identical'
      | 'stale-version'
      | 'stale-epoch'
      | 'divergent'
      | 'poison',
    projectionFingerprint:
      reply[0] === 'written'
        ? projectionFingerprint
        : typeof reply[1] === 'string' && /^[a-f0-9]{64}$/u.test(reply[1])
          ? reply[1]
          : projectionFingerprint,
  };
}

export function asCalendarProjectionRedis(redis: Redis): ProjectionRedis {
  return redis;
}
