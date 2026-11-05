import { campaignLocationKey, campaignLocationsKey } from '@/lib/redis';

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/u;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DETAIL_BYTES = 20 * 1024 * 1024;
const LIST_BYTES = 1024 * 1024;
const LIST_ENTRIES = 1_000;
const REGISTRY_FIELDS = 100;
const REGISTRY_ENTRY_BYTES = 2 * 1024;
const encoder = new TextEncoder();

type RedisGet = { get(key: string): Promise<unknown> };
type RedisHashRead = {
  hgetall(key: string): Promise<unknown>;
};

export type LocationResolution =
  | { status: 'verified' }
  | { status: 'corrupt' | 'collision' | 'unavailable' };

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const byteLength = (value: string): number => encoder.encode(value).byteLength;

/**
 * HGETALL arrives as an object from the deserializing client but as the raw
 * REST flat array `[field, value, ...]` from `getRawRedis()`. Null means a
 * malformed shape (odd length, non-string or duplicate field).
 */
export function normalizeHashEntries(
  value: unknown
): Array<[string, unknown]> | null {
  if (value === null || value === undefined) return [];
  if (record(value)) return Object.entries(value);
  if (!Array.isArray(value) || value.length % 2 !== 0) return null;

  const entries: Array<[string, unknown]> = [];
  const fields = new Set<string>();
  for (let index = 0; index < value.length; index += 2) {
    const field = value[index];
    if (typeof field !== 'string' || fields.has(field)) return null;
    fields.add(field);
    entries.push([field, value[index + 1]]);
  }
  return entries;
}

export const isSafeResourceId = (value: unknown): value is string =>
  typeof value === 'string' && SAFE_ID.test(value);

function decodeOnce(
  value: unknown,
  maxBytes: number
): { ok: true; value: unknown } | { ok: false } {
  try {
    if (typeof value === 'string') {
      if (byteLength(value) > maxBytes) return { ok: false };
      return { ok: true, value: JSON.parse(value) as unknown };
    }
    const encoded = JSON.stringify(value);
    if (encoded === undefined || byteLength(encoded) > maxBytes)
      return { ok: false };
    return { ok: true, value };
  } catch {
    return { ok: false };
  }
}

function validLocationIdentity(
  value: unknown
): value is Record<string, unknown> {
  if (!record(value) || !isSafeResourceId(value.id)) return false;
  return (
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    [...value.name].length <= 200 &&
    typeof value.mapImageUrl === 'string' &&
    value.mapImageUrl.length > 0 &&
    byteLength(value.mapImageUrl) <= 8192 &&
    typeof value.updatedAt === 'string' &&
    byteLength(value.updatedAt) <= 64
  );
}

const REGISTRY_KEYS = [
  'v',
  'sceneId',
  'workspaceInstanceId',
  'sourceMapId',
  'contentRevision',
  'safeLabel',
  'registeredAt',
  'registryRevision',
  'deleted',
  'roomId',
] as const;

const revision = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

function validRegistryEntry(
  field: string,
  value: unknown
): value is Record<string, unknown> {
  if (!record(value)) return false;
  const keys = Object.keys(value).sort();
  const expected = [...REGISTRY_KEYS].sort();
  return (
    keys.length === expected.length &&
    keys.every((key, index) => key === expected[index]) &&
    value.v === 1 &&
    isSafeResourceId(value.sceneId) &&
    value.sceneId === field &&
    isSafeResourceId(value.workspaceInstanceId) &&
    (value.sourceMapId === null || isSafeResourceId(value.sourceMapId)) &&
    revision(value.contentRevision) &&
    typeof value.safeLabel === 'string' &&
    value.safeLabel.trim().length > 0 &&
    [...value.safeLabel].length <= 200 &&
    revision(value.registeredAt) &&
    revision(value.registryRevision) &&
    typeof value.deleted === 'boolean' &&
    typeof value.roomId === 'string' &&
    UUID.test(value.roomId)
  );
}

/**
 * Proves a no-scene location claim from bounded campaign-owned data, then
 * rejects any collision with an active Table scene source. Every stored value
 * is decoded at most once and every failure is fail-closed.
 */
export async function resolveVerifiedLocation(input: {
  redis: RedisGet;
  registryRedis: RedisHashRead;
  campaign: string;
  battleMapId: string;
  registryKey: string;
}): Promise<LocationResolution> {
  let detail: unknown;
  try {
    detail = await input.redis.get(
      campaignLocationKey(input.campaign, input.battleMapId)
    );
  } catch {
    return { status: 'unavailable' };
  }

  if (detail === null || detail === undefined) {
    let list: unknown;
    try {
      list = await input.redis.get(campaignLocationsKey(input.campaign));
    } catch {
      return { status: 'unavailable' };
    }
    const decoded = decodeOnce(list, LIST_BYTES);
    if (
      !decoded.ok ||
      !Array.isArray(decoded.value) ||
      decoded.value.length > LIST_ENTRIES ||
      !decoded.value.every(validLocationIdentity) ||
      decoded.value.filter(entry => entry.id === input.battleMapId).length !== 1
    )
      return { status: 'corrupt' };
  } else {
    const decoded = decodeOnce(detail, DETAIL_BYTES);
    if (
      !decoded.ok ||
      !validLocationIdentity(decoded.value) ||
      decoded.value.id !== input.battleMapId
    )
      return { status: 'corrupt' };
  }

  let rawRegistry: unknown;
  try {
    rawRegistry = await input.registryRedis.hgetall(input.registryKey);
  } catch {
    return { status: 'unavailable' };
  }
  const entries = normalizeHashEntries(rawRegistry);
  if (entries === null) return { status: 'corrupt' };
  if (entries.length > REGISTRY_FIELDS) return { status: 'corrupt' };
  for (const [field, raw] of entries) {
    const decoded = decodeOnce(raw, REGISTRY_ENTRY_BYTES);
    if (!decoded.ok || !validRegistryEntry(field, decoded.value))
      return { status: 'corrupt' };
    if (
      decoded.value.deleted === false &&
      decoded.value.sourceMapId === input.battleMapId
    )
      return { status: 'collision' };
  }
  return { status: 'verified' };
}
