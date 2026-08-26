import { sha256Bytes } from '@/lib/indexeddb/migrationCapture';
import { ENCOUNTER_STORAGE_KEY } from '@/utils/constants';
import type { Encounter } from '@/types/encounter';

export const registeredDurableDmFamilies = [
  'campaign_settings',
  'calendar',
  'magic_item',
  'npc',
  'encounter_definition',
] as const;

export const ENCOUNTER_FAMILY = 'encounter_definition';
export const ENCOUNTER_PERSIST_VERSION = 2;
export const ENCOUNTER_MAX_RECORD_BYTES = 262_144;
export const ENCOUNTER_MAX_ITEMS = 2_000;
export const ENCOUNTER_MAX_TOTAL_BYTES = 5_242_880;

export type EncounterPayload = Omit<Encounter, 'id' | 'campaignCode'>;

/**
 * The 9-key document allowlist. `satisfies` makes a field that is renamed or
 * dropped from the payload type a compile error instead of a silent
 * `unclassified-field` rejection at runtime.
 */
const ENCOUNTER_DOCUMENT_FIELDS = [
  'name',
  'entities',
  'currentTurn',
  'round',
  'isActive',
  'sortOrder',
  'pendingInitiativeRequest',
  'createdAt',
  'updatedAt',
] as const satisfies readonly (keyof EncounterPayload)[];

export const ENCOUNTER_FAMILY_INVENTORY = {
  family: 'encounter_definition',
  localStorageKeys: [ENCOUNTER_STORAGE_KEY],
  persistenceVersions: { [ENCOUNTER_STORAGE_KEY]: ENCOUNTER_PERSIST_VERSION },
  stableIdentity: 'encounters[].id (campaignCode-scoped)',
  stableChildIdentity: [
    'entities[].id',
    'entities[].conditions[].id',
    'entities[].abilities[].id',
    'entities[].resources[].id',
    'entities[].legendaryActions.actions[].id',
    'entities[].lairActions[].id',
  ],
  completeEnvelopeFields: ['encounters', 'encounterTombstones'],
  excludedEnvelopeFields: ['combatConfig', 'activeEncounterId'],
  documentFields: ENCOUNTER_DOCUMENT_FIELDS,
  privateFields: ['*'],
  publicFields: [],
  discoveredFields: [],
  // npcSourceId/monsterSourceId/avatarUrl are value-copy provenance (ruling 5).
  typedCrossFamilyReferences: [],
  redisProjectionKinds: [],
  projection: 'not-applicable',
  retainedValueCopies: [
    'redis shared:initiative (live combat SharedInitiativeState)',
    'redis shared:initiativeRequest / turn-request / initiative-submission (live combat transport)',
    'rollkeeper-npc-data (npc family owns CampaignNPC; encounter entities hold value copies)',
  ],
  excludedFamilies: [
    'campaign_settings',
    'calendar',
    'magic_item',
    'npc',
    'character',
    'membership',
    'location',
    'battle_map',
    'map_asset',
    'combat_log_archive',
    'live_combat',
    'relay',
  ],
} as const;

export interface EncounterManifestRecord {
  legacyId: string;
  schemaVersion: 2;
  byteCount: number;
  payloadFingerprint: string;
  payload: EncounterPayload | null;
  tombstoned: boolean;
}

export interface EncounterManifestBlocker {
  kind:
    | 'malformed-json'
    | 'future-schema'
    | 'legacy-schema'
    | 'incomplete-envelope'
    | 'duplicate-id'
    | 'id-mismatch'
    | 'invalid-encounter-id'
    | 'unclassified-field'
    | 'invalid-encounter'
    | 'duplicate-child-id'
    | 'invalid-child-id'
    | 'active-encounter'
    | 'invalid-tombstone'
    | 'tombstoned-and-live'
    | 'oversized-record'
    | 'oversized-family';
  legacyId: string | null;
  detail: string;
}

export interface EncounterManifest {
  format: 'rollkeeper-encounter-manifest';
  version: 1;
  family: 'encounter_definition';
  campaignCode: string;
  recordCount: number;
  totalBytes: number;
  records: EncounterManifestRecord[];
  blockers: EncounterManifestBlocker[];
  rawCandidates: Array<{
    sourceKey: 'rollkeeper-encounter-data';
    rawValue: string;
    byteCount: number;
    fingerprint: string;
  }>;
  fingerprint: string;
}

export type EncounterPayloadValidation =
  | { ok: true; payload: EncounterPayload }
  | {
      ok: false;
      kind:
        | 'invalid-encounter'
        | 'unclassified-field'
        | 'invalid-child-id'
        | 'duplicate-child-id';
      detail: string;
    };

type EncounterPayloadRejection = Extract<
  EncounterPayloadValidation,
  { ok: false }
>;

const encoder = new TextEncoder();
const ENCOUNTER_FIELDS = new Set<string>(
  ENCOUNTER_FAMILY_INVENTORY.documentFields
);
const STAT_BLOCK_SECTIONS = [
  'traits',
  'actions',
  'reactions',
  'bonusActions',
  'lairActions',
] as const;
const MAX_ID_LENGTH = 255;
const MAX_NAME_LENGTH = 1_000;

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

function canonicalJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

function reject(
  kind: EncounterPayloadRejection['kind'],
  detail: string
): EncounterPayloadRejection {
  return { ok: false, kind, detail };
}

function isStableId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_ID_LENGTH
  );
}

function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length <= maxLength;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Optional payload fields may be absent or explicitly null. */
function isAbsent(value: unknown) {
  return value === undefined || value === null;
}

/**
 * Every child collection carries the same contract: an array of objects, each
 * with a stable string ID of 1-255 characters that is unique within the array.
 */
function validateChildIds(
  path: string,
  value: unknown,
  optional: boolean
): EncounterPayloadRejection | null {
  if (optional && isAbsent(value)) return null;
  if (!Array.isArray(value))
    return reject('invalid-encounter', `${path} must be an array of objects`);
  const seen = new Set<string>();
  for (const [index, entry] of value.entries()) {
    if (!record(entry))
      return reject('invalid-encounter', `${path}[${index}] must be an object`);
    if (!isStableId(entry.id))
      return reject(
        'invalid-child-id',
        `${path}[${index}] requires a stable ID of 1-${MAX_ID_LENGTH} characters`
      );
    if (seen.has(entry.id))
      return reject('duplicate-child-id', `Duplicate ${path} ID ${entry.id}`);
    seen.add(entry.id);
  }
  return null;
}

/**
 * The stat block keeps its nested shape verbatim; entry IDs are optional
 * (`StatBlockEntry.id`), so only entries that carry one are checked for
 * shape and uniqueness.
 */
function validateEntityStatBlock(
  path: string,
  value: unknown
): EncounterPayloadRejection | null {
  if (isAbsent(value)) return null;
  if (!record(value))
    return reject(
      'invalid-encounter',
      `${path}.monsterStatBlock must be an object`
    );
  for (const section of STAT_BLOCK_SECTIONS) {
    const entries = value[section];
    if (isAbsent(entries)) continue;
    if (!Array.isArray(entries) || !entries.every(entry => record(entry)))
      return reject(
        'invalid-encounter',
        `${path}.monsterStatBlock.${section} must be an array of objects`
      );
    const seen = new Set<string>();
    for (const entry of entries as Record<string, unknown>[]) {
      const id = entry.id;
      if (id === undefined) continue;
      if (!isStableId(id))
        return reject(
          'invalid-child-id',
          `${path}.monsterStatBlock.${section} entry requires a stable ID of 1-${MAX_ID_LENGTH} characters when present`
        );
      if (seen.has(id))
        return reject(
          'duplicate-child-id',
          `Duplicate ${path}.monsterStatBlock.${section} ID ${id}`
        );
      seen.add(id);
    }
  }
  return null;
}

function validateLegendaryActions(
  path: string,
  value: unknown
): EncounterPayloadRejection | null {
  if (isAbsent(value)) return null;
  if (!record(value))
    return reject(
      'invalid-encounter',
      `${path}.legendaryActions must be an object`
    );
  return validateChildIds(
    `${path}.legendaryActions.actions`,
    value.actions,
    false
  );
}

function validateEntity(
  index: number,
  entity: Record<string, unknown>
): EncounterPayloadRejection | null {
  const path = `entities[${index}]`;
  return (
    validateChildIds(`${path}.conditions`, entity.conditions, true) ??
    validateChildIds(`${path}.abilities`, entity.abilities, true) ??
    validateChildIds(`${path}.resources`, entity.resources, true) ??
    validateChildIds(`${path}.lairActions`, entity.lairActions, true) ??
    validateLegendaryActions(path, entity.legendaryActions) ??
    validateEntityStatBlock(path, entity.monsterStatBlock)
  );
}

export function validateEncounterPayload(
  value: unknown
): EncounterPayloadValidation {
  if (!record(value))
    return reject('invalid-encounter', 'An encounter must be a JSON object');
  for (const field of Object.keys(value)) {
    if (!ENCOUNTER_FIELDS.has(field))
      return reject(
        'unclassified-field',
        `Encounter field ${field} is not classified in Slice 11E`
      );
  }
  const name = value.name;
  if (!isBoundedString(name, MAX_NAME_LENGTH) || name.length === 0)
    return reject(
      'invalid-encounter',
      `An encounter requires a name of 1-${MAX_NAME_LENGTH} characters`
    );
  if (!isFiniteNumber(value.currentTurn))
    return reject(
      'invalid-encounter',
      'Encounter currentTurn must be a number'
    );
  if (!isFiniteNumber(value.round))
    return reject('invalid-encounter', 'Encounter round must be a number');
  if (typeof value.isActive !== 'boolean')
    return reject('invalid-encounter', 'Encounter isActive must be a boolean');
  if (value.sortOrder !== 'initiative' && value.sortOrder !== 'manual')
    return reject(
      'invalid-encounter',
      'Encounter sortOrder must be "initiative" or "manual"'
    );
  if (
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  )
    return reject(
      'invalid-encounter',
      'An encounter requires createdAt and updatedAt strings'
    );
  const pending = value.pendingInitiativeRequest;
  if (!isAbsent(pending)) {
    if (
      !record(pending) ||
      !isStableId(pending.requestId) ||
      !isFiniteNumber(pending.requestedAt)
    )
      return reject(
        'invalid-encounter',
        'Encounter pendingInitiativeRequest must have a requestId string and a requestedAt number'
      );
  }
  const entitiesRejection = validateChildIds('entities', value.entities, false);
  if (entitiesRejection) return entitiesRejection;
  const entities = value.entities as Record<string, unknown>[];
  for (const [index, entity] of entities.entries()) {
    const rejection = validateEntity(index, entity);
    if (rejection) return rejection;
  }
  return { ok: true, payload: structuredClone(value) as EncounterPayload };
}

export async function buildEncounterManifest(input: {
  campaignCode: string;
  rawEnvelope: string;
}): Promise<EncounterManifest> {
  const rawCandidate: EncounterManifest['rawCandidates'][number] = {
    sourceKey: ENCOUNTER_STORAGE_KEY,
    rawValue: input.rawEnvelope,
    byteCount: encoder.encode(input.rawEnvelope).byteLength,
    fingerprint: await sha256Bytes(input.rawEnvelope),
  };
  const blockers: EncounterManifestBlocker[] = [];
  const records: EncounterManifestRecord[] = [];
  if (input.rawEnvelope === '') {
    blockers.push({
      kind: 'incomplete-envelope',
      legacyId: null,
      detail: `${ENCOUNTER_STORAGE_KEY} has never been persisted on this browser`,
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
      detail: `${ENCOUNTER_STORAGE_KEY} is not valid JSON`,
    });
    return finalize(input.campaignCode, records, blockers, [rawCandidate]);
  }
  if (
    !record(parsed) ||
    !record(parsed.state) ||
    !Array.isArray(parsed.state.encounters)
  ) {
    blockers.push({
      kind: 'incomplete-envelope',
      legacyId: null,
      detail: 'The complete Zustand encounters envelope is missing',
    });
    return finalize(input.campaignCode, records, blockers, [rawCandidate]);
  }
  const persistenceVersion =
    typeof parsed.version === 'number' ? parsed.version : 0;
  if (persistenceVersion > ENCOUNTER_PERSIST_VERSION) {
    blockers.push({
      kind: 'future-schema',
      legacyId: null,
      detail: `Persistence version ${persistenceVersion} exceeds ${ENCOUNTER_PERSIST_VERSION}`,
    });
    return finalize(input.campaignCode, records, blockers, [rawCandidate]);
  }
  if (persistenceVersion !== ENCOUNTER_PERSIST_VERSION) {
    blockers.push({
      kind: 'legacy-schema',
      legacyId: null,
      detail: `${ENCOUNTER_STORAGE_KEY} is persisted at version ${persistenceVersion}; the encounter store migration must upgrade it to version ${ENCOUNTER_PERSIST_VERSION} before preview`,
    });
    return finalize(input.campaignCode, records, blockers, [rawCandidate]);
  }
  const rawTombstones = parsed.state.encounterTombstones;
  if (!isAbsent(rawTombstones) && !record(rawTombstones)) {
    blockers.push({
      kind: 'incomplete-envelope',
      legacyId: null,
      detail: `${ENCOUNTER_STORAGE_KEY} encounterTombstones is not an object`,
    });
    return finalize(input.campaignCode, records, blockers, [rawCandidate]);
  }
  const encounters = parsed.state.encounters;
  const tombstones = record(rawTombstones) ? rawTombstones : {};

  // Pre-scan the whole array (regardless of campaign) so a legacy id shared
  // across two different campaigns' encounters can be flagged as id-mismatch
  // rather than silently routed into this campaign's slice.
  const idCampaigns = new Map<string, Set<string>>();
  for (const entry of encounters) {
    if (!record(entry) || !isStableId(entry.id)) continue;
    if (typeof entry.campaignCode !== 'string') continue;
    const set = idCampaigns.get(entry.id) ?? new Set<string>();
    set.add(entry.campaignCode);
    idCampaigns.set(entry.id, set);
  }

  const seenInCampaign = new Set<string>();
  const emittedLiveIds = new Set<string>();
  for (const entry of encounters) {
    const entryCampaignCode = record(entry) ? entry.campaignCode : undefined;
    if (entryCampaignCode !== input.campaignCode) continue; // ruling 3: ignored, no blocker
    if (!record(entry) || !isStableId(entry.id)) {
      blockers.push({
        kind: 'invalid-encounter-id',
        legacyId: null,
        detail: `An encounter of campaign ${input.campaignCode} requires a stable ID of 1-${MAX_ID_LENGTH} characters`,
      });
      continue;
    }
    const legacyId = entry.id;
    if (seenInCampaign.has(legacyId)) {
      blockers.push({
        kind: 'duplicate-id',
        legacyId,
        detail: `Duplicate encounter ID ${legacyId}`,
      });
      continue;
    }
    seenInCampaign.add(legacyId);
    const campaignsForId = idCampaigns.get(legacyId);
    if (campaignsForId && campaignsForId.size > 1) {
      blockers.push({
        kind: 'id-mismatch',
        legacyId,
        detail: `Encounter ${legacyId} is not scoped to campaign ${input.campaignCode}`,
      });
      continue;
    }
    const { id, campaignCode, ...candidate } = entry;
    void id;
    void campaignCode;
    const validation = validateEncounterPayload(candidate);
    if (!validation.ok) {
      blockers.push({
        kind: validation.kind,
        legacyId,
        detail: validation.detail,
      });
      continue;
    }
    const payload = canonicalize(validation.payload) as EncounterPayload;
    if (payload.isActive === true)
      blockers.push({
        kind: 'active-encounter',
        legacyId,
        detail: `Encounter "${payload.name}" is in active combat; end combat before cutover`,
      });
    const encoded = canonicalJson(payload);
    const byteCount = encoder.encode(encoded).byteLength;
    if (byteCount > ENCOUNTER_MAX_RECORD_BYTES)
      blockers.push({
        kind: 'oversized-record',
        legacyId,
        detail: `Encounter ${legacyId} exceeds ${ENCOUNTER_MAX_RECORD_BYTES} UTF-8 bytes`,
      });
    records.push({
      legacyId,
      schemaVersion: ENCOUNTER_PERSIST_VERSION,
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
        detail: `Encounter tombstone ${id} requires a beforeImage object and a deletedAt string`,
      });
      continue;
    }
    const beforeImage = tombstone.beforeImage;
    if (beforeImage.campaignCode !== input.campaignCode) continue; // ruling 3: not this campaign's slice
    if (emittedLiveIds.has(id)) {
      blockers.push({
        kind: 'tombstoned-and-live',
        legacyId: id,
        detail: `Encounter ${id} is both tombstoned and present as a live encounter`,
      });
      continue;
    }
    const encoded = canonicalJson({ legacyId: id, tombstoned: true });
    records.push({
      legacyId: id,
      schemaVersion: ENCOUNTER_PERSIST_VERSION,
      byteCount: encoder.encode(encoded).byteLength,
      payloadFingerprint: await fingerprintEncounterTombstone(id),
      payload: null,
      tombstoned: true,
    });
  }

  if (records.length > ENCOUNTER_MAX_ITEMS)
    blockers.push({
      kind: 'oversized-family',
      legacyId: null,
      detail: `The encounter roster exceeds ${ENCOUNTER_MAX_ITEMS} encounters`,
    });
  const totalBytes = records.reduce(
    (total, value) => total + value.byteCount,
    0
  );
  if (totalBytes > ENCOUNTER_MAX_TOTAL_BYTES)
    blockers.push({
      kind: 'oversized-family',
      legacyId: null,
      detail: `The encounter roster exceeds ${ENCOUNTER_MAX_TOTAL_BYTES} UTF-8 bytes`,
    });
  return finalize(input.campaignCode, records, blockers, [rawCandidate]);
}

export async function buildEncounterWorkingCopyManifest(input: {
  source: EncounterManifest;
  documents: Array<{
    legacyId: string;
    payload: EncounterPayload | null;
    schemaVersion: number;
    tombstoned: boolean;
  }>;
}): Promise<EncounterManifest> {
  if (
    input.source.format !== 'rollkeeper-encounter-manifest' ||
    input.source.version !== 1 ||
    input.source.family !== 'encounter_definition' ||
    input.source.blockers.length > 0
  )
    throw new Error('A validated encounter source manifest is required');
  const records: EncounterManifestRecord[] = [];
  for (const entry of input.documents) {
    if (entry.schemaVersion !== ENCOUNTER_PERSIST_VERSION)
      throw new Error(
        `Encounter document ${entry.legacyId} must use schema version ${ENCOUNTER_PERSIST_VERSION}`
      );
    if (entry.tombstoned) {
      const encoded = canonicalJson({
        legacyId: entry.legacyId,
        tombstoned: true,
      });
      records.push({
        legacyId: entry.legacyId,
        schemaVersion: ENCOUNTER_PERSIST_VERSION,
        byteCount: encoder.encode(encoded).byteLength,
        payloadFingerprint: await sha256Bytes(encoded),
        payload: null,
        tombstoned: true,
      });
      continue;
    }
    const validation = validateEncounterPayload(entry.payload);
    if (!validation.ok)
      throw new Error(
        `Encounter document ${entry.legacyId} is invalid: ${validation.detail}`
      );
    const payload = canonicalize(validation.payload) as EncounterPayload;
    const encoded = canonicalJson(payload);
    records.push({
      legacyId: entry.legacyId,
      schemaVersion: ENCOUNTER_PERSIST_VERSION,
      byteCount: encoder.encode(encoded).byteLength,
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
  records: EncounterManifestRecord[],
  blockers: EncounterManifestBlocker[],
  rawCandidates: EncounterManifest['rawCandidates']
): Promise<EncounterManifest> {
  const sortedRecords = [...records].sort((a, b) =>
    a.legacyId.localeCompare(b.legacyId)
  );
  const sortedBlockers = [...blockers].sort((a, b) =>
    canonicalJson(a).localeCompare(canonicalJson(b))
  );
  const summary = {
    format: 'rollkeeper-encounter-manifest' as const,
    version: 1 as const,
    family: 'encounter_definition' as const,
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

export function encounterPayloadFromEncounter(
  encounter: Encounter
): EncounterPayload {
  const { id, campaignCode, ...payload } = encounter;
  void id;
  void campaignCode;
  return structuredClone(payload);
}

export function encounterFromPayload(
  campaignCode: string,
  legacyId: string,
  payload: EncounterPayload
): Encounter {
  return { ...structuredClone(payload), id: legacyId, campaignCode };
}

export function sortEncounters<T extends { id: string; createdAt: string }>(
  items: T[]
): T[] {
  return [...items].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
  );
}

export function fingerprintEncounterPayload(payload: EncounterPayload) {
  return sha256Bytes(canonicalJson(payload));
}

export function fingerprintEncounterTombstone(legacyId: string) {
  return sha256Bytes(canonicalJson({ legacyId, tombstoned: true }));
}
