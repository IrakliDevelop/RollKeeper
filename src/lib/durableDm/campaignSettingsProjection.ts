import type { Redis } from '@upstash/redis';

import { sha256Bytes } from '@/lib/indexeddb/migrationCapture';
import { SLIDING_TTL_SECONDS } from '@/lib/redis';

import {
  projectCampaignSettingsForLegacyPlayers,
  type CampaignSettingsPayload,
} from './campaignSettingsFamily';

export interface ProjectionCursor {
  epoch: number;
  version: number;
  fingerprint: string;
}

export type ProjectionCasDecision =
  | 'write'
  | 'identical'
  | 'stale-version'
  | 'stale-epoch'
  | 'divergent';

export function decideCampaignSettingsProjectionCas(
  current: ProjectionCursor | null,
  incoming: ProjectionCursor
): ProjectionCasDecision {
  if (!current || incoming.epoch > current.epoch) return 'write';
  if (incoming.epoch < current.epoch) return 'stale-epoch';
  if (incoming.version > current.version) return 'write';
  if (incoming.version < current.version) return 'stale-version';
  return incoming.fingerprint === current.fingerprint
    ? 'identical'
    : 'divergent';
}

export const CAMPAIGN_SETTINGS_PROJECTION_CAS_SCRIPT = `
-- rollkeeper-campaign-settings-projection-v1
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
local ttl = tonumber(ARGV[7])
redis.call('SET', KEYS[1], cjson.encode({epoch=incoming_epoch,version=incoming_version,fingerprint=incoming_fingerprint}), 'EX', ttl)
if ARGV[6] == '1' then
  redis.call('DEL', KEYS[2], KEYS[3])
else
  redis.call('SET', KEYS[2], ARGV[4], 'EX', ttl)
  redis.call('SET', KEYS[3], ARGV[5], 'EX', ttl)
end
return {'written', incoming_fingerprint}
`;

interface ProjectionRedis {
  eval(script: string, keys: string[], args: string[]): Promise<unknown>;
}

export interface CampaignSettingsProjectionInput {
  campaignCode: string;
  epoch: number;
  version: number;
  sourceFingerprint: string;
  payload: CampaignSettingsPayload | null;
  tombstoned: boolean;
}

export async function publishCampaignSettingsProjection(
  redis: ProjectionRedis,
  input: CampaignSettingsProjectionInput
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
    throw new Error('Invalid campaign projection code');
  }
  if (
    !input.tombstoned &&
    (!input.payload ||
      typeof input.payload !== 'object' ||
      Array.isArray(input.payload))
  ) {
    throw new Error('Invalid campaign settings projection payload');
  }
  const projection = input.tombstoned
    ? { codecVersion: 1 as const, tombstoned: true as const }
    : projectCampaignSettingsForLegacyPlayers(input.payload!);
  const projectionFingerprint = await sha256Bytes(JSON.stringify(projection));
  const base = `campaign:${input.campaignCode}`;
  const reply = await redis.eval(
    CAMPAIGN_SETTINGS_PROJECTION_CAS_SCRIPT,
    [
      `${base}:projection:campaign_settings:meta`,
      `${base}:shared:settings`,
      `${base}:shared:counters`,
    ],
    [
      String(input.epoch),
      String(input.version),
      projectionFingerprint,
      input.tombstoned
        ? '{}'
        : JSON.stringify(
            (
              projection as ReturnType<
                typeof projectCampaignSettingsForLegacyPlayers
              >
            ).settings
          ),
      input.tombstoned
        ? '{}'
        : JSON.stringify(
            (
              projection as ReturnType<
                typeof projectCampaignSettingsForLegacyPlayers
              >
            ).counters
          ),
      input.tombstoned ? '1' : '0',
      String(SLIDING_TTL_SECONDS),
    ]
  );
  if (!Array.isArray(reply) || typeof reply[0] !== 'string') {
    throw new Error('Malformed campaign settings projection reply');
  }
  const status = reply[0];
  if (
    ![
      'written',
      'identical',
      'stale-version',
      'stale-epoch',
      'divergent',
      'poison',
    ].includes(status)
  ) {
    throw new Error('Unknown campaign settings projection reply');
  }
  return {
    status: status as
      | 'written'
      | 'identical'
      | 'stale-version'
      | 'stale-epoch'
      | 'divergent'
      | 'poison',
    projectionFingerprint:
      status === 'written'
        ? projectionFingerprint
        : typeof reply[1] === 'string' && /^[a-f0-9]{64}$/u.test(reply[1])
          ? reply[1]
          : projectionFingerprint,
  };
}

export interface ClaimedCampaignSettingsProjection {
  eventId: string;
  campaignCode: string;
  epoch: number;
  version: number;
  sourceFingerprint: string;
  payload: unknown;
  tombstoned: boolean;
}

interface ProjectionQueue {
  claim(
    workerId: string,
    limit: number
  ): Promise<ClaimedCampaignSettingsProjection[]>;
  acknowledge(
    eventId: string,
    workerId: string,
    projectionFingerprint: string
  ): Promise<void>;
  fail(
    eventId: string,
    workerId: string,
    errorCode: string,
    incidentKind:
      | 'equal_version_divergence'
      | 'poison_event'
      | 'stale_epoch'
      | null
  ): Promise<void>;
}

interface WorkerOptions {
  queue: ProjectionQueue;
  publish: (
    input: CampaignSettingsProjectionInput
  ) => Promise<Awaited<ReturnType<typeof publishCampaignSettingsProjection>>>;
  workerId: string;
}

export class CampaignSettingsProjectionWorker {
  constructor(private readonly options: WorkerOptions) {}

  async drain(limit: number) {
    const events = await this.options.queue.claim(this.options.workerId, limit);
    let acknowledged = 0;
    let failed = 0;
    for (const event of events) {
      if (
        !event.tombstoned &&
        (typeof event.payload !== 'object' ||
          event.payload === null ||
          Array.isArray(event.payload))
      ) {
        await this.options.queue.fail(
          event.eventId,
          this.options.workerId,
          'invalid-payload',
          'poison_event'
        );
        failed += 1;
        continue;
      }
      try {
        const result = await this.options.publish({
          campaignCode: event.campaignCode,
          epoch: event.epoch,
          version: event.version,
          sourceFingerprint: event.sourceFingerprint,
          payload: event.payload as CampaignSettingsPayload | null,
          tombstoned: event.tombstoned,
        });
        if (result.status === 'divergent') {
          await this.options.queue.fail(
            event.eventId,
            this.options.workerId,
            'equal-version-divergence',
            'equal_version_divergence'
          );
          failed += 1;
        } else if (result.status === 'stale-epoch') {
          await this.options.queue.fail(
            event.eventId,
            this.options.workerId,
            'stale-epoch',
            'stale_epoch'
          );
          failed += 1;
        } else if (result.status === 'poison') {
          await this.options.queue.fail(
            event.eventId,
            this.options.workerId,
            'poison-redis-state',
            'poison_event'
          );
          failed += 1;
        } else {
          await this.options.queue.acknowledge(
            event.eventId,
            this.options.workerId,
            result.projectionFingerprint
          );
          acknowledged += 1;
        }
      } catch {
        await this.options.queue.fail(
          event.eventId,
          this.options.workerId,
          'publication-failed',
          null
        );
        failed += 1;
      }
    }
    return { claimed: events.length, acknowledged, failed };
  }
}

export function asProjectionRedis(redis: Redis): ProjectionRedis {
  return redis;
}
