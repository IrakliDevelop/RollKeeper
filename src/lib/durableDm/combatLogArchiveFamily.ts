import { sha256Bytes } from '@/lib/indexeddb/migrationCapture';
import { COMBAT_LOG_STORAGE_KEY } from '@/utils/constants';
import type { CombatLogEvent, CombatLogState } from '@/types/combatLog';

export const registeredDurableDmFamilies = [
  'campaign_settings',
  'calendar',
  'magic_item',
  'npc',
  'encounter_definition',
  'combat_log_archive',
] as const;

export const COMBAT_LOG_ARCHIVE_FAMILY = 'combat_log_archive';
export const COMBAT_LOG_ARCHIVE_PERSIST_VERSION = 2;
export const COMBAT_LOG_ARCHIVE_MAX_RECORD_BYTES = 262_144;
export const COMBAT_LOG_ARCHIVE_MAX_ITEMS = 2_000;
export const COMBAT_LOG_ARCHIVE_MAX_TOTAL_BYTES = 5_242_880;

/**
 * One document per archive. `campaignCode` is stripped exactly as
 * `EncounterPayload` strips it and is re-attached by
 * `combatLogArchiveFromPayload`. Ruling 3: `endedAt` stays optional — an
 * archive that is still open is a fully valid durable document.
 */
export type CombatLogArchivePayload = Omit<CombatLogState, 'campaignCode'>;

/**
 * The 4-key document allowlist. `satisfies` makes a field that is renamed or
 * dropped from the payload type a compile error instead of a silent
 * `unclassified-field` rejection at runtime.
 */
const COMBAT_LOG_ARCHIVE_DOCUMENT_FIELDS = [
  'encounterId',
  'events',
  'startedAt',
  'endedAt',
] as const satisfies readonly (keyof CombatLogArchivePayload)[];

export const COMBAT_LOG_ARCHIVE_FAMILY_INVENTORY = {
  family: 'combat_log_archive',
  localStorageKeys: [COMBAT_LOG_STORAGE_KEY],
  persistenceVersions: {
    [COMBAT_LOG_STORAGE_KEY]: COMBAT_LOG_ARCHIVE_PERSIST_VERSION,
  },
  // Ruling 6: the archive, not the encounter, is the stable identity.
  stableIdentity: 'encounters[<archiveId>] (campaignCode-scoped)',
  stableChildIdentity: ['events[].id'],
  completeEnvelopeFields: ['encounters', 'combatLogTombstones'],
  // Ruling 9: `activeArchiveId` is device-local. `lastAdmissionError` is
  // session state and is never persisted.
  excludedEnvelopeFields: ['activeArchiveId', 'lastAdmissionError'],
  documentFields: COMBAT_LOG_ARCHIVE_DOCUMENT_FIELDS,
  // Ruling 8: DM-private. Logs carry hidden entity names and DM-only conditions.
  privateFields: ['*'],
  publicFields: [],
  discoveredFields: [],
  typedCrossFamilyReferences: ['encounterId → encounter_definition'],
  redisProjectionKinds: [],
  projection: 'not-applicable',
  retainedValueCopies: [
    'rollkeeper-encounter-data (encounter family owns entities; log events hold value-copy entity names)',
  ],
  excludedFamilies: [
    'campaign_settings',
    'calendar',
    'magic_item',
    'npc',
    'encounter_definition',
    'character',
    'membership',
    'location',
    'battle_map',
    'map_asset',
    'live_combat',
    'relay',
  ],
} as const;

export interface CombatLogArchiveManifestRecord {
  legacyId: string;
  schemaVersion: 2;
  byteCount: number;
  payloadFingerprint: string;
  payload: CombatLogArchivePayload | null;
  tombstoned: boolean;
}

/**
 * Two kinds are declared but never emitted by this module:
 *
 * - `duplicate-id` — the archive envelope is a record keyed by `archiveId`, so
 *   `JSON.parse` cannot hand back a repeated identity. A live archive that is
 *   also tombstoned is reported as `tombstoned-and-live`.
 * - `unresolved-encounter-reference` — `encounterId` is a typed cross-family
 *   reference, resolved through the encounter family's authority router. This
 *   module is pure and takes no encounter roster, so the cutover path that owns
 *   the router emits it. Per spec §3 it blocks only its own record.
 */
export interface CombatLogArchiveManifestBlocker {
  kind:
    | 'malformed-json'
    | 'future-schema'
    | 'legacy-schema'
    | 'incomplete-envelope'
    | 'invalid-archive-id'
    | 'duplicate-id'
    | 'unclassified-field'
    | 'invalid-archive'
    | 'duplicate-child-id'
    | 'invalid-child-id'
    | 'active-combat-log'
    | 'unresolved-encounter-reference'
    | 'invalid-tombstone'
    | 'tombstoned-and-live'
    | 'oversized-record'
    | 'too-many-records'
    | 'oversized-family';
  legacyId: string | null;
  detail: string;
}

export interface CombatLogArchiveManifest {
  format: 'rollkeeper-combat-log-archive-manifest';
  version: 1;
  family: 'combat_log_archive';
  campaignCode: string;
  recordCount: number;
  totalBytes: number;
  records: CombatLogArchiveManifestRecord[];
  blockers: CombatLogArchiveManifestBlocker[];
  rawCandidates: Array<{
    sourceKey: 'rollkeeper-combat-log';
    rawValue: string;
    byteCount: number;
    fingerprint: string;
  }>;
  fingerprint: string;
}

export type CombatLogArchivePayloadValidation =
  | { ok: true; payload: CombatLogArchivePayload }
  | {
      ok: false;
      kind:
        | 'invalid-archive'
        | 'unclassified-field'
        | 'invalid-child-id'
        | 'duplicate-child-id';
      detail: string;
    };

type CombatLogArchivePayloadRejection = Extract<
  CombatLogArchivePayloadValidation,
  { ok: false }
>;

const encoder = new TextEncoder();
const COMBAT_LOG_ARCHIVE_FIELDS = new Set<string>(
  COMBAT_LOG_ARCHIVE_FAMILY_INVENTORY.documentFields
);
/** Byte bounds, not code-unit bounds — SQL measures `octet_length` (spec §3). */
const MAX_ID_BYTES = 255;
const MAX_TEXT_BYTES = 1_000;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!record(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map(key => [key, canonicalize(value[key])])
  );
}

/**
 * Recursive key sort (JavaScript code-unit order, matching SQL's `collate "C"`)
 * then `JSON.stringify`; array order is preserved. Exported because
 * `combatLogStore`'s prospective admission gates must measure exactly the bytes
 * this manifest measures.
 */
export function canonicalJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

function reject(
  kind: CombatLogArchivePayloadRejection['kind'],
  detail: string
): CombatLogArchivePayloadRejection {
  return { ok: false, kind, detail };
}

function byteLength(value: string) {
  return encoder.encode(value).byteLength;
}

function isStableId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    byteLength(value) <= MAX_ID_BYTES
  );
}

function isBoundedString(value: unknown, maxBytes: number): value is string {
  return typeof value === 'string' && byteLength(value) <= maxBytes;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Optional payload fields may be absent or explicitly null. */
function isAbsent(value: unknown) {
  return value === undefined || value === null;
}

type EventFieldKind = 'id' | 'text' | 'number' | 'boolean' | 'textArray';

interface EventFieldSpec {
  kind: EventFieldKind;
  optional?: boolean;
  values?: readonly string[];
}

const NAMED_ENTITY_FIELDS = {
  entityId: { kind: 'id' },
  entityName: { kind: 'text' },
} as const satisfies Record<string, EventFieldSpec>;

const CONDITION_FIELDS = {
  sourceId: { kind: 'id', optional: true },
  sourceName: { kind: 'text', optional: true },
  targetId: { kind: 'id' },
  targetName: { kind: 'text' },
  conditionName: { kind: 'text' },
  duration: { kind: 'text', optional: true },
  sourceSpell: { kind: 'text', optional: true },
} as const satisfies Record<string, EventFieldSpec>;

const ROUND_FIELDS = {
  roundNumber: { kind: 'number' },
} as const satisfies Record<string, EventFieldSpec>;

const COMBAT_STATUS_FIELDS = {
  participantNames: { kind: 'textArray' },
  endReason: {
    kind: 'text',
    optional: true,
    values: ['victory', 'defeat', 'flee', 'truce', 'dm_ended'],
  },
} as const satisfies Record<string, EventFieldSpec>;

/**
 * Discriminator-specific field allowlists (spec §3). A `damage` event may not
 * carry `spellName`. `satisfies Record<CombatLogEvent['type'], …>` makes a new
 * member of the event union a compile error until it is classified here.
 */
const EVENT_FIELD_SPECS = {
  damage: {
    sourceId: { kind: 'id' },
    sourceName: { kind: 'text' },
    targetId: { kind: 'id' },
    targetName: { kind: 'text' },
    amount: { kind: 'number' },
    damageType: { kind: 'text' },
    isCritical: { kind: 'boolean', optional: true },
    weaponOrSpellName: { kind: 'text', optional: true },
  },
  healing: {
    sourceId: { kind: 'id' },
    sourceName: { kind: 'text' },
    targetId: { kind: 'id' },
    targetName: { kind: 'text' },
    amount: { kind: 'number' },
    actualHealing: { kind: 'number' },
    spellOrAbilityName: { kind: 'text', optional: true },
  },
  condition_applied: CONDITION_FIELDS,
  condition_removed: CONDITION_FIELDS,
  turn_start: NAMED_ENTITY_FIELDS,
  turn_end: NAMED_ENTITY_FIELDS,
  spell_cast: {
    casterId: { kind: 'id' },
    casterName: { kind: 'text' },
    spellName: { kind: 'text' },
    spellLevel: { kind: 'number' },
    slotUsed: { kind: 'number', optional: true },
    isConcentration: { kind: 'boolean', optional: true },
  },
  ability_use: {
    userId: { kind: 'id' },
    userName: { kind: 'text' },
    abilityName: { kind: 'text' },
    abilityType: {
      kind: 'text',
      values: ['legendary_action', 'lair_action', 'recharge', 'reaction'],
    },
    legendaryActionCost: { kind: 'number', optional: true },
  },
  round_start: ROUND_FIELDS,
  round_end: ROUND_FIELDS,
  combat_start: COMBAT_STATUS_FIELDS,
  combat_end: COMBAT_STATUS_FIELDS,
  unconscious: NAMED_ENTITY_FIELDS,
  death: NAMED_ENTITY_FIELDS,
  revived: NAMED_ENTITY_FIELDS,
  stabilized: NAMED_ENTITY_FIELDS,
} as const satisfies Record<
  CombatLogEvent['type'],
  Record<string, EventFieldSpec>
>;

/** Fields every event carries regardless of its discriminator. */
const BASE_EVENT_FIELDS = new Set([
  'id',
  'timestamp',
  'round',
  'turn',
  'encounterId',
  'type',
]);

function isEventFieldValid(value: unknown, spec: EventFieldSpec): boolean {
  switch (spec.kind) {
    case 'id':
      return isStableId(value);
    case 'number':
      return isFiniteNumber(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'textArray':
      return (
        Array.isArray(value) &&
        value.every(entry => isBoundedString(entry, MAX_TEXT_BYTES))
      );
    case 'text':
      if (!isBoundedString(value, MAX_TEXT_BYTES)) return false;
      return spec.values ? spec.values.includes(value) : true;
  }
}

/**
 * `events[].id` is stable child identity: missing or duplicate ids are
 * rejected. Mirrors `validateChildIds` in `encounterFamily.ts`.
 */
function validateChildIds(
  path: string,
  value: unknown
): CombatLogArchivePayloadRejection | null {
  if (!Array.isArray(value))
    return reject('invalid-archive', `${path} must be an array of objects`);
  const seen = new Set<string>();
  for (const [index, entry] of value.entries()) {
    if (!record(entry))
      return reject('invalid-archive', `${path}[${index}] must be an object`);
    if (!isStableId(entry.id))
      return reject(
        'invalid-child-id',
        `${path}[${index}] requires a stable ID of 1-${MAX_ID_BYTES} UTF-8 bytes`
      );
    if (seen.has(entry.id))
      return reject('duplicate-child-id', `Duplicate ${path} ID ${entry.id}`);
    seen.add(entry.id);
  }
  return null;
}

function validateEvent(
  index: number,
  event: Record<string, unknown>,
  documentEncounterId: string
): CombatLogArchivePayloadRejection | null {
  const path = `events[${index}]`;
  const type = event.type;
  if (typeof type !== 'string' || !(type in EVENT_FIELD_SPECS))
    return reject(
      'invalid-archive',
      `${path}.type ${JSON.stringify(type)} is not a combat log event type`
    );
  const specs = EVENT_FIELD_SPECS[type as CombatLogEvent['type']] as Record<
    string,
    EventFieldSpec
  >;

  for (const field of Object.keys(event))
    if (!BASE_EVENT_FIELDS.has(field) && !(field in specs))
      return reject(
        'unclassified-field',
        `${path} field ${field} does not belong to a ${type} event`
      );

  if (!isBoundedString(event.timestamp, MAX_TEXT_BYTES))
    return reject('invalid-archive', `${path}.timestamp must be a string`);
  if (!isFiniteNumber(event.round))
    return reject('invalid-archive', `${path}.round must be a finite number`);
  if (!isFiniteNumber(event.turn))
    return reject('invalid-archive', `${path}.turn must be a finite number`);
  // Spec §3: every event's encounterId must equal the document's encounterId.
  if (event.encounterId !== documentEncounterId)
    return reject(
      'invalid-archive',
      `${path}.encounterId must equal the archive encounterId ${documentEncounterId}`
    );

  for (const [field, spec] of Object.entries(specs)) {
    const value = event[field];
    if (spec.optional && isAbsent(value)) continue;
    if (!isEventFieldValid(value, spec))
      return reject(
        'invalid-archive',
        `${path}.${field} is not a valid ${type} ${spec.kind}`
      );
  }
  return null;
}

export function validateCombatLogArchivePayload(
  value: unknown
): CombatLogArchivePayloadValidation {
  if (!record(value))
    return reject(
      'invalid-archive',
      'A combat log archive must be a JSON object'
    );
  for (const field of Object.keys(value)) {
    if (!COMBAT_LOG_ARCHIVE_FIELDS.has(field))
      return reject(
        'unclassified-field',
        `Combat log archive field ${field} is not classified in Slice 11F`
      );
  }
  if (!isStableId(value.encounterId))
    return reject(
      'invalid-archive',
      `A combat log archive requires an encounterId of 1-${MAX_ID_BYTES} UTF-8 bytes`
    );
  const startedAt = value.startedAt;
  if (!isBoundedString(startedAt, MAX_TEXT_BYTES) || startedAt.length === 0)
    return reject(
      'invalid-archive',
      'A combat log archive requires a startedAt string'
    );
  // Ruling 3: `endedAt` is optional. An archive that is still open is a fully
  // valid durable document; only cutover is blocked.
  const endedAt = value.endedAt;
  if (
    !isAbsent(endedAt) &&
    (!isBoundedString(endedAt, MAX_TEXT_BYTES) || endedAt.length === 0)
  )
    return reject(
      'invalid-archive',
      'A combat log archive endedAt must be a non-empty string when present'
    );
  const eventsRejection = validateChildIds('events', value.events);
  if (eventsRejection) return eventsRejection;
  const events = value.events as Record<string, unknown>[];
  for (const [index, event] of events.entries()) {
    const rejection = validateEvent(index, event, value.encounterId);
    if (rejection) return rejection;
  }
  return {
    ok: true,
    payload: structuredClone(value) as CombatLogArchivePayload,
  };
}

export async function buildCombatLogArchiveManifest(input: {
  campaignCode: string;
  rawEnvelope: string;
}): Promise<CombatLogArchiveManifest> {
  const rawCandidate: CombatLogArchiveManifest['rawCandidates'][number] = {
    sourceKey: COMBAT_LOG_STORAGE_KEY,
    rawValue: input.rawEnvelope,
    byteCount: byteLength(input.rawEnvelope),
    fingerprint: await sha256Bytes(input.rawEnvelope),
  };
  const blockers: CombatLogArchiveManifestBlocker[] = [];
  const records: CombatLogArchiveManifestRecord[] = [];
  if (input.rawEnvelope === '') {
    blockers.push({
      kind: 'incomplete-envelope',
      legacyId: null,
      detail: `${COMBAT_LOG_STORAGE_KEY} has never been persisted on this device`,
    });
    return finalize(input.campaignCode, records, blockers, [rawCandidate]);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.rawEnvelope);
  } catch {
    blockers.push({
      kind: 'malformed-json',
      legacyId: null,
      detail: `${COMBAT_LOG_STORAGE_KEY} is not valid JSON`,
    });
    return finalize(input.campaignCode, records, blockers, [rawCandidate]);
  }
  // Ruling 6: `encounters` is a record keyed by `archiveId`, not an array.
  if (
    !record(parsed) ||
    !record(parsed.state) ||
    !record(parsed.state.encounters)
  ) {
    blockers.push({
      kind: 'incomplete-envelope',
      legacyId: null,
      detail: 'The complete Zustand combat log archive envelope is missing',
    });
    return finalize(input.campaignCode, records, blockers, [rawCandidate]);
  }
  const persistenceVersion =
    typeof parsed.version === 'number' ? parsed.version : 0;
  if (persistenceVersion > COMBAT_LOG_ARCHIVE_PERSIST_VERSION) {
    blockers.push({
      kind: 'future-schema',
      legacyId: null,
      detail: `Persistence version ${persistenceVersion} exceeds ${COMBAT_LOG_ARCHIVE_PERSIST_VERSION}`,
    });
    return finalize(input.campaignCode, records, blockers, [rawCandidate]);
  }
  if (persistenceVersion !== COMBAT_LOG_ARCHIVE_PERSIST_VERSION) {
    blockers.push({
      kind: 'legacy-schema',
      legacyId: null,
      detail: `${COMBAT_LOG_STORAGE_KEY} is persisted at version ${persistenceVersion}; the combat log store migration must upgrade it to version ${COMBAT_LOG_ARCHIVE_PERSIST_VERSION} before preview`,
    });
    return finalize(input.campaignCode, records, blockers, [rawCandidate]);
  }
  const rawTombstones = parsed.state.combatLogTombstones;
  if (!isAbsent(rawTombstones) && !record(rawTombstones)) {
    blockers.push({
      kind: 'incomplete-envelope',
      legacyId: null,
      detail: `${COMBAT_LOG_STORAGE_KEY} combatLogTombstones is not an object`,
    });
    return finalize(input.campaignCode, records, blockers, [rawCandidate]);
  }
  const archives = parsed.state.encounters;
  const tombstones = record(rawTombstones) ? rawTombstones : {};

  const emittedLiveIds = new Set<string>();
  for (const [legacyId, entry] of Object.entries(archives)) {
    // Ruling 1: another campaign's slice (and an unrouted orphan) is ignored
    // without a blocker.
    if (!record(entry) || entry.campaignCode !== input.campaignCode) continue;
    if (!isStableId(legacyId)) {
      blockers.push({
        kind: 'invalid-archive-id',
        legacyId: null,
        detail: `A combat log archive of campaign ${input.campaignCode} requires a stable ID of 1-${MAX_ID_BYTES} UTF-8 bytes`,
      });
      continue;
    }
    const { campaignCode, ...candidate } = entry;
    void campaignCode;
    const validation = validateCombatLogArchivePayload(candidate);
    if (!validation.ok) {
      blockers.push({
        kind: validation.kind,
        legacyId,
        detail: validation.detail,
      });
      continue;
    }
    const payload = canonicalize(validation.payload) as CombatLogArchivePayload;
    // Ruling 3: emitted only here, on the legacy cutover path. The record is
    // still captured, and `buildCombatLogArchiveWorkingCopyManifest` accepts
    // the same document without a blocker.
    if (isAbsent(payload.endedAt))
      blockers.push({
        kind: 'active-combat-log',
        legacyId,
        detail: `Combat log archive ${legacyId} is still open; end the combat log before turning on backup`,
      });
    const encoded = canonicalJson(payload);
    const byteCount = byteLength(encoded);
    if (byteCount > COMBAT_LOG_ARCHIVE_MAX_RECORD_BYTES)
      blockers.push({
        kind: 'oversized-record',
        legacyId,
        detail: `Combat log archive ${legacyId} exceeds ${COMBAT_LOG_ARCHIVE_MAX_RECORD_BYTES} UTF-8 bytes`,
      });
    records.push({
      legacyId,
      schemaVersion: COMBAT_LOG_ARCHIVE_PERSIST_VERSION,
      byteCount,
      payloadFingerprint: await sha256Bytes(encoded),
      payload,
      tombstoned: false,
    });
    emittedLiveIds.add(legacyId);
  }

  for (const [id, tombstone] of Object.entries(tombstones)) {
    if (
      !record(tombstone) ||
      !record(tombstone.beforeImage) ||
      typeof tombstone.deletedAt !== 'string'
    ) {
      blockers.push({
        kind: 'invalid-tombstone',
        legacyId: id,
        detail: `Combat log archive tombstone ${id} requires a beforeImage object and a deletedAt string`,
      });
      continue;
    }
    const beforeImage = tombstone.beforeImage;
    if (beforeImage.campaignCode !== input.campaignCode) continue; // not this campaign's slice
    if (emittedLiveIds.has(id)) {
      blockers.push({
        kind: 'tombstoned-and-live',
        legacyId: id,
        detail: `Combat log archive ${id} is both tombstoned and present as a live archive`,
      });
      continue;
    }
    const encoded = canonicalJson({ legacyId: id, tombstoned: true });
    records.push({
      legacyId: id,
      schemaVersion: COMBAT_LOG_ARCHIVE_PERSIST_VERSION,
      byteCount: byteLength(encoded),
      payloadFingerprint: await fingerprintCombatLogArchiveTombstone(id),
      payload: null,
      tombstoned: true,
    });
  }

  if (records.length > COMBAT_LOG_ARCHIVE_MAX_ITEMS)
    blockers.push({
      kind: 'too-many-records',
      legacyId: null,
      detail: `The combat log archive family exceeds ${COMBAT_LOG_ARCHIVE_MAX_ITEMS} archives`,
    });
  const totalBytes = records.reduce(
    (total, value) => total + value.byteCount,
    0
  );
  if (totalBytes > COMBAT_LOG_ARCHIVE_MAX_TOTAL_BYTES)
    blockers.push({
      kind: 'oversized-family',
      legacyId: null,
      detail: `The combat log archive family exceeds ${COMBAT_LOG_ARCHIVE_MAX_TOTAL_BYTES} UTF-8 bytes`,
    });
  return finalize(input.campaignCode, records, blockers, [rawCandidate]);
}

export async function buildCombatLogArchiveWorkingCopyManifest(input: {
  source: CombatLogArchiveManifest;
  documents: Array<{
    legacyId: string;
    payload: CombatLogArchivePayload | null;
    schemaVersion: number;
    tombstoned: boolean;
  }>;
}): Promise<CombatLogArchiveManifest> {
  if (
    input.source.format !== 'rollkeeper-combat-log-archive-manifest' ||
    input.source.version !== 1 ||
    input.source.family !== 'combat_log_archive' ||
    input.source.blockers.length > 0
  )
    throw new Error(
      'A validated combat log archive source manifest is required'
    );
  const records: CombatLogArchiveManifestRecord[] = [];
  for (const entry of input.documents) {
    if (entry.schemaVersion !== COMBAT_LOG_ARCHIVE_PERSIST_VERSION)
      throw new Error(
        `Combat log archive document ${entry.legacyId} must use schema version ${COMBAT_LOG_ARCHIVE_PERSIST_VERSION}`
      );
    if (entry.tombstoned) {
      const encoded = canonicalJson({
        legacyId: entry.legacyId,
        tombstoned: true,
      });
      records.push({
        legacyId: entry.legacyId,
        schemaVersion: COMBAT_LOG_ARCHIVE_PERSIST_VERSION,
        byteCount: byteLength(encoded),
        payloadFingerprint: await sha256Bytes(encoded),
        payload: null,
        tombstoned: true,
      });
      continue;
    }
    const validation = validateCombatLogArchivePayload(entry.payload);
    if (!validation.ok)
      throw new Error(
        `Combat log archive document ${entry.legacyId} is invalid: ${validation.detail}`
      );
    // Ruling 3: no `active-combat-log` blocker here. An archive with no
    // `endedAt` commits like any other edit; only cutover is blocked.
    const payload = canonicalize(validation.payload) as CombatLogArchivePayload;
    const encoded = canonicalJson(payload);
    records.push({
      legacyId: entry.legacyId,
      schemaVersion: COMBAT_LOG_ARCHIVE_PERSIST_VERSION,
      byteCount: byteLength(encoded),
      payloadFingerprint: await sha256Bytes(encoded),
      payload,
      tombstoned: false,
    });
  }
  return finalize(
    input.source.campaignCode,
    records,
    [],
    structuredClone(input.source.rawCandidates)
  );
}

async function finalize(
  campaignCode: string,
  records: CombatLogArchiveManifestRecord[],
  blockers: CombatLogArchiveManifestBlocker[],
  rawCandidates: CombatLogArchiveManifest['rawCandidates']
): Promise<CombatLogArchiveManifest> {
  const sortedRecords = [...records].sort((a, b) =>
    a.legacyId.localeCompare(b.legacyId)
  );
  const sortedBlockers = [...blockers].sort((a, b) =>
    canonicalJson(a).localeCompare(canonicalJson(b))
  );
  const summary = {
    format: 'rollkeeper-combat-log-archive-manifest' as const,
    version: 1 as const,
    family: 'combat_log_archive' as const,
    campaignCode,
    records: sortedRecords.map(
      ({
        legacyId,
        schemaVersion,
        byteCount,
        payloadFingerprint,
        tombstoned,
      }) => ({
        legacyId,
        schemaVersion,
        byteCount,
        payloadFingerprint,
        tombstoned,
      })
    ),
    blockers: sortedBlockers,
    rawCandidates: rawCandidates.map(
      ({ sourceKey, byteCount, fingerprint }) => ({
        sourceKey,
        byteCount,
        fingerprint,
      })
    ),
  };
  return {
    ...summary,
    recordCount: sortedRecords.length,
    totalBytes: sortedRecords.reduce(
      (total, value) => total + value.byteCount,
      0
    ),
    records: sortedRecords,
    blockers: sortedBlockers,
    rawCandidates,
    fingerprint: await sha256Bytes(canonicalJson(summary)),
  };
}

export function combatLogArchivePayloadFrom(
  archive: CombatLogState
): CombatLogArchivePayload {
  const { campaignCode, ...payload } = archive;
  void campaignCode;
  return structuredClone(payload);
}

/**
 * `legacyId` is the archive's stable identity, but Ruling 6 keeps it on the
 * store's record key rather than inside `CombatLogState`, so it is accepted for
 * signature parity with the sibling families and deliberately not written.
 */
export function combatLogArchiveFromPayload(
  campaignCode: string,
  legacyId: string,
  payload: CombatLogArchivePayload
): CombatLogState {
  void legacyId;
  return { ...structuredClone(payload), campaignCode };
}

export function fingerprintCombatLogArchivePayload(
  payload: CombatLogArchivePayload
) {
  return sha256Bytes(canonicalJson(payload));
}

export function fingerprintCombatLogArchiveTombstone(legacyId: string) {
  return sha256Bytes(canonicalJson({ legacyId, tombstoned: true }));
}
