import type { Json } from '@/types/database.generated';

export const CHARACTER_CLOUD_SCHEMA_VERSION = 1;
export const MAX_CHARACTER_CLOUD_PAYLOAD_BYTES = 1024 * 1024;

type JsonObject = { [key: string]: Json | undefined };

export interface CharacterCloudRow {
  id: string;
  legacy_client_id: string;
  name: string;
  payload: unknown;
  schema_version: number;
  client_revision: number;
  server_version: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RestorableCharacter extends Record<string, unknown> {
  id: string;
  name: string;
  characterData: Record<string, unknown>;
}

export interface DecodedCloudCharacter {
  status: 'supported' | 'quarantined';
  row: CharacterCloudRow;
  rawPayload: Json;
  localCharacter: RestorableCharacter | null;
  contentFingerprint: string;
  quarantineReason: string | null;
}

export type RestoreMode = 'original' | 'copy';
export type RestorePlanKind =
  | 'restore-original'
  | 'attach-link'
  | 'restore-copy'
  | 'quarantined';

export interface CharacterRestorePlan {
  kind: RestorePlanKind;
  character: RestorableCharacter | null;
  attachCloudLink: boolean;
  reason: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeJson(value: unknown): Json {
  if (!isRecord(value)) {
    throw new Error('Character payload must be an object');
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new Error('Character payload must be valid JSON');
  }
  if (serialized === undefined) {
    throw new Error('Character payload must be valid JSON');
  }
  if (
    new TextEncoder().encode(serialized).byteLength >
    MAX_CHARACTER_CLOUD_PAYLOAD_BYTES
  ) {
    throw new Error('Character payload is too large for cloud backup');
  }
  if (/data:[^;,\s]+(?:;[^,\s]*)?;base64,/i.test(serialized)) {
    throw new Error('Base64 media is not allowed in cloud character payloads');
  }
  return JSON.parse(serialized) as Json;
}

export function copyJsonForRecovery(value: unknown): Json {
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) throw new Error();
    return JSON.parse(serialized) as Json;
  } catch {
    throw new Error('Cloud recovery payload is not valid JSON');
  }
}

function canonicalize(value: Json): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(item => canonicalize(item)).join(',')}]`;
  }
  const object = value as JsonObject;
  return `{${Object.keys(object)
    .filter(key => object[key] !== undefined)
    .sort()
    .map(key => `${JSON.stringify(key)}:${canonicalize(object[key] as Json)}`)
    .join(',')}}`;
}

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map(value => value.toString(16).padStart(2, '0'))
    .join('');
}

export function encodeCharacterCloudPayload(character: unknown): Json {
  return normalizeJson(character);
}

export async function fingerprintCharacterPayload(
  payload: unknown
): Promise<string> {
  const normalized = normalizeJson(payload);
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonicalize(normalized))
  );
  return hex(digest);
}

function historicalCharacterState(payload: Record<string, unknown>) {
  if (isRecord(payload.characterData)) return payload.characterData;
  if (isRecord(payload.state) && isRecord(payload.state.character)) {
    return payload.state.character;
  }
  if (isRecord(payload.state)) return payload.state;
  if (isRecord(payload.character)) return payload.character;
  return payload;
}

function toLocalCharacter(
  rawPayload: Json,
  row: CharacterCloudRow
): RestorableCharacter {
  const payload = rawPayload as Record<string, unknown>;
  if (isRecord(payload.characterData)) {
    const id =
      typeof payload.id === 'string' ? payload.id : row.legacy_client_id;
    return {
      ...payload,
      id,
      name: typeof payload.name === 'string' ? payload.name : row.name,
      characterData: { ...payload.characterData, id },
    } as RestorableCharacter;
  }

  const state = historicalCharacterState(payload);
  const id = typeof state.id === 'string' ? state.id : row.legacy_client_id;
  const name = typeof state.name === 'string' ? state.name : row.name;
  const classValue = state.class;
  const className =
    typeof classValue === 'string'
      ? classValue
      : isRecord(classValue) && typeof classValue.name === 'string'
        ? classValue.name
        : 'Unknown';
  const now = row.updated_at;
  return {
    id,
    name,
    race: typeof state.race === 'string' ? state.race : 'Unknown',
    class: className,
    level: typeof state.level === 'number' ? state.level : 1,
    createdAt: row.created_at,
    updatedAt: now,
    lastPlayed: now,
    characterData: { ...state, id },
    tags: ['cloud-recovery'],
    isArchived: false,
  };
}

export async function decodeCharacterCloudRow(
  row: CharacterCloudRow
): Promise<DecodedCloudCharacter> {
  const recoveryPayload = copyJsonForRecovery(row.payload);
  let rawPayload: Json;
  try {
    rawPayload = normalizeJson(recoveryPayload);
  } catch (cause) {
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(canonicalize(recoveryPayload))
    );
    return {
      status: 'quarantined',
      row,
      rawPayload: recoveryPayload,
      localCharacter: null,
      contentFingerprint: hex(digest),
      quarantineReason:
        cause instanceof Error
          ? cause.message
          : 'Invalid cloud character payload',
    };
  }
  const contentFingerprint = await fingerprintCharacterPayload(rawPayload);
  if (row.schema_version > CHARACTER_CLOUD_SCHEMA_VERSION) {
    return {
      status: 'quarantined',
      row,
      rawPayload,
      localCharacter: null,
      contentFingerprint,
      quarantineReason: `Cloud character uses future schema version ${row.schema_version}`,
    };
  }
  if (row.schema_version < 1) {
    return {
      status: 'quarantined',
      row,
      rawPayload,
      localCharacter: null,
      contentFingerprint,
      quarantineReason: `Cloud character uses unsupported schema version ${row.schema_version}`,
    };
  }
  return {
    status: 'supported',
    row,
    rawPayload,
    localCharacter: toLocalCharacter(rawPayload, row),
    contentFingerprint,
    quarantineReason: null,
  };
}

function cloneAsCopy(
  character: RestorableCharacter,
  generateId: () => string
): RestorableCharacter {
  const copy = structuredClone(character);
  const id = generateId();
  return {
    ...copy,
    id,
    name: `${copy.name} (Cloud Copy)`,
    characterData: { ...copy.characterData, id },
    tags: Array.isArray(copy.tags)
      ? [...copy.tags, 'cloud-recovery']
      : ['cloud-recovery'],
    isArchived: false,
  };
}

export async function planCharacterRestore(
  decoded: DecodedCloudCharacter,
  localCharacters: readonly unknown[],
  mode: RestoreMode,
  generateId: () => string = () => crypto.randomUUID()
): Promise<CharacterRestorePlan> {
  if (decoded.status === 'quarantined' || !decoded.localCharacter) {
    return {
      kind: 'quarantined',
      character: null,
      attachCloudLink: false,
      reason: decoded.quarantineReason,
    };
  }
  if (mode === 'copy') {
    return {
      kind: 'restore-copy',
      character: cloneAsCopy(decoded.localCharacter, generateId),
      attachCloudLink: false,
      reason: null,
    };
  }

  const collision = localCharacters.find(
    candidate =>
      isRecord(candidate) && candidate.id === decoded.row.legacy_client_id
  );
  if (!collision) {
    return {
      kind: 'restore-original',
      character: decoded.localCharacter,
      attachCloudLink: true,
      reason: null,
    };
  }
  const localFingerprint = await fingerprintCharacterPayload(collision);
  if (localFingerprint === decoded.contentFingerprint) {
    return {
      kind: 'attach-link',
      character: null,
      attachCloudLink: true,
      reason: null,
    };
  }
  return {
    kind: 'restore-copy',
    character: cloneAsCopy(decoded.localCharacter, generateId),
    attachCloudLink: false,
    reason: 'A different local character already uses this ID',
  };
}
