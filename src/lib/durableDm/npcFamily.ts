import { sha256Bytes } from '@/lib/indexeddb/migrationCapture';
import type { CampaignNPC } from '@/types/encounter';

export const registeredDurableDmFamilies = [
  'campaign_settings',
  'calendar',
  'magic_item',
  'npc',
] as const;

export const NPC_STORAGE_KEY = 'rollkeeper-npc-data';
export const NPC_PERSIST_VERSION = 4;
export const NPC_MAX_RECORD_BYTES = 262_144;
export const NPC_MAX_ITEMS = 2_000;
export const NPC_MAX_TOTAL_BYTES = 5_242_880;

export type NpcPayload = Omit<CampaignNPC, 'id' | 'campaignCode'>;

/**
 * The 34-key document allowlist. `satisfies` makes a field that is renamed
 * or dropped from the payload type a compile error instead of a silent
 * `unclassified-field` rejection at runtime.
 */
const NPC_DOCUMENT_FIELDS = [
  'name',
  'description',
  'armorClass',
  'maxHp',
  'currentHp',
  'tempHp',
  'tempAc',
  'speed',
  'monsterStatBlock',
  'bestiarySourceId',
  'loreHtml',
  'xp',
  'avatarUrl',
  'group',
  'tags',
  'hitDice',
  'deathSaves',
  'initiativeModifier',
  'proficiencyBonus',
  'inventory',
  'currency',
  'spellcasting',
  'resources',
  'abilityUsage',
  'collapsedSpellSections',
  'lastDetailTab',
  'passivePerception',
  'passiveInsight',
  'passiveInvestigation',
  'abilityScores',
  'traits',
  'actions',
  'createdAt',
  'updatedAt',
] as const satisfies readonly (keyof NpcPayload)[];

export const NPC_FAMILY_INVENTORY = {
  family: 'npc',
  localStorageKeys: ['rollkeeper-npc-data'],
  persistenceVersions: { 'rollkeeper-npc-data': 4 },
  stableIdentity: 'npcsByCampaign[campaignCode][].id',
  stableChildIdentity: [
    'inventory[].id',
    'resources[].id',
    'spellcasting.spells[].id',
  ],
  completeEnvelopeFields: ['npcsByCampaign'],
  documentFields: NPC_DOCUMENT_FIELDS,
  privateFields: ['*'],
  publicFields: [],
  discoveredFields: [],
  // inventory[].magicItem is an embedded value copy, avatarUrl is an S3 object
  // reference, and bestiarySourceId is a compendium id — none of them is a
  // reference into another durable DM family.
  typedCrossFamilyReferences: [],
  redisProjectionKinds: [],
  projection: 'not-applicable',
  retainedValueCopies: [
    'rollkeeper-encounter-data (encounter entities, npcSourceId)',
    'redis shared:initiative (live combat SharedTurnEntry)',
    'redis transfers (NPC item sent to player)',
  ],
  excludedFamilies: [
    'campaign_settings',
    'calendar',
    'magic_item',
    'character',
    'membership',
    'location',
    'encounter_definition',
    'combat_log_archive',
    'battle_map',
    'map_asset',
    'live_combat',
    'relay',
  ],
} as const;

export interface NpcManifestRecord {
  legacyId: string;
  schemaVersion: 4;
  byteCount: number;
  payloadFingerprint: string;
  payload: NpcPayload | null;
  tombstoned: boolean;
}

export interface NpcManifestBlocker {
  kind:
    | 'malformed-json'
    | 'future-schema'
    | 'legacy-schema'
    | 'incomplete-envelope'
    | 'duplicate-id'
    | 'id-mismatch'
    | 'invalid-npc-id'
    | 'unclassified-field'
    | 'invalid-npc'
    | 'duplicate-child-id'
    | 'invalid-child-id'
    | 'oversized-record'
    | 'oversized-family';
  legacyId: string | null;
  detail: string;
}

export interface NpcManifest {
  format: 'rollkeeper-npc-manifest';
  version: 1;
  family: 'npc';
  campaignCode: string;
  recordCount: number;
  totalBytes: number;
  records: NpcManifestRecord[];
  blockers: NpcManifestBlocker[];
  rawCandidates: Array<{
    sourceKey: 'rollkeeper-npc-data';
    rawValue: string;
    byteCount: number;
    fingerprint: string;
  }>;
  fingerprint: string;
}

export type NpcPayloadValidation =
  | { ok: true; payload: NpcPayload }
  | {
      ok: false;
      kind:
        | 'invalid-npc'
        | 'unclassified-field'
        | 'invalid-child-id'
        | 'duplicate-child-id';
      detail: string;
    };

type NpcPayloadRejection = Extract<NpcPayloadValidation, { ok: false }>;

const encoder = new TextEncoder();
const NPC_FIELDS = new Set<string>(NPC_FAMILY_INVENTORY.documentFields);
const STAT_BLOCK_SECTIONS = [
  'traits',
  'actions',
  'reactions',
  'bonusActions',
  'lairActions',
] as const;
const MAX_ID_LENGTH = 255;
const MAX_NAME_LENGTH = 1_000;
const MAX_LABEL_LENGTH = 100;

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
  kind: NpcPayloadRejection['kind'],
  detail: string
): NpcPayloadRejection {
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

function isStringArray(value: unknown) {
  return (
    Array.isArray(value) && value.every(entry => typeof entry === 'string')
  );
}

/** Optional payload fields may be absent or explicitly null. */
function isAbsent(value: unknown) {
  return value === undefined || value === null;
}

function isNullableString(value: unknown) {
  return isAbsent(value) || typeof value === 'string';
}

function isNullableBoundedString(value: unknown, maxLength: number) {
  return isAbsent(value) || isBoundedString(value, maxLength);
}

function isNullableNumber(value: unknown) {
  return isAbsent(value) || isFiniteNumber(value);
}

function isNullableObject(value: unknown) {
  return isAbsent(value) || record(value);
}

function isNullableStringArray(value: unknown) {
  return isAbsent(value) || isStringArray(value);
}

/** Free-text AC fields accept a legacy number written by older NPC data. */
function isNullableArmorValue(value: unknown) {
  return (
    isAbsent(value) ||
    isBoundedString(value, MAX_LABEL_LENGTH) ||
    isFiniteNumber(value)
  );
}

/**
 * Every child collection carries the same contract: an array of objects, each
 * with a stable string ID of 1-255 characters that is unique within the array.
 */
function validateChildIds(
  path: string,
  value: unknown,
  optional: boolean
): NpcPayloadRejection | null {
  if (optional && isAbsent(value)) return null;
  if (!Array.isArray(value))
    return reject('invalid-npc', `${path} must be an array of objects`);
  const seen = new Set<string>();
  for (const [index, entry] of value.entries()) {
    if (!record(entry))
      return reject('invalid-npc', `${path}[${index}] must be an object`);
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
 * The stat block keeps its nested shape verbatim; only the entry sections are
 * checked so a preview never ships a section the encounter loops would crash on.
 */
function validateStatBlock(value: unknown): NpcPayloadRejection | null {
  if (isAbsent(value)) return null;
  if (!record(value))
    return reject('invalid-npc', 'monsterStatBlock must be an object');
  for (const section of STAT_BLOCK_SECTIONS) {
    const entries = value[section];
    if (isAbsent(entries)) continue;
    if (!Array.isArray(entries) || !entries.every(entry => record(entry)))
      return reject(
        'invalid-npc',
        `monsterStatBlock.${section} must be an array of objects`
      );
  }
  return null;
}

function validateSpellcasting(value: unknown): NpcPayloadRejection | null {
  if (isAbsent(value)) return null;
  if (!record(value))
    return reject('invalid-npc', 'spellcasting must be an object');
  return validateChildIds('spellcasting.spells', value.spells, false);
}

export function validateNpcPayload(value: unknown): NpcPayloadValidation {
  if (!record(value))
    return reject('invalid-npc', 'An NPC must be a JSON object');
  for (const field of Object.keys(value)) {
    if (!NPC_FIELDS.has(field))
      return reject(
        'unclassified-field',
        `NPC field ${field} is not classified in Slice 11D`
      );
  }
  const name = value.name;
  if (!isBoundedString(name, MAX_NAME_LENGTH) || name.length === 0)
    return reject(
      'invalid-npc',
      `An NPC requires a name of 1-${MAX_NAME_LENGTH} characters`
    );
  if (!isFiniteNumber(value.maxHp))
    return reject('invalid-npc', 'NPC maxHp must be a number');
  if (
    !isBoundedString(value.armorClass, MAX_LABEL_LENGTH) &&
    !isFiniteNumber(value.armorClass)
  )
    return reject(
      'invalid-npc',
      `NPC armorClass must be a number or a string of at most ${MAX_LABEL_LENGTH} characters`
    );
  if (!isBoundedString(value.speed, MAX_LABEL_LENGTH))
    return reject(
      'invalid-npc',
      `NPC speed must be a string of at most ${MAX_LABEL_LENGTH} characters`
    );
  if (
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  )
    return reject(
      'invalid-npc',
      'An NPC requires createdAt and updatedAt strings'
    );
  if (
    !isNullableString(value.description) ||
    !isNullableString(value.bestiarySourceId) ||
    !isNullableString(value.loreHtml) ||
    !isNullableString(value.avatarUrl) ||
    !isNullableString(value.group)
  )
    return reject(
      'invalid-npc',
      'NPC description, bestiarySourceId, loreHtml, avatarUrl, and group must be strings when present'
    );
  if (!isNullableBoundedString(value.lastDetailTab, MAX_LABEL_LENGTH))
    return reject(
      'invalid-npc',
      `NPC lastDetailTab must be a string of at most ${MAX_LABEL_LENGTH} characters`
    );
  if (!isNullableArmorValue(value.tempAc))
    return reject(
      'invalid-npc',
      `NPC tempAc must be a number or a string of at most ${MAX_LABEL_LENGTH} characters`
    );
  if (
    !isNullableNumber(value.currentHp) ||
    !isNullableNumber(value.tempHp) ||
    !isNullableNumber(value.xp) ||
    !isNullableNumber(value.initiativeModifier) ||
    !isNullableNumber(value.proficiencyBonus) ||
    !isNullableNumber(value.passivePerception) ||
    !isNullableNumber(value.passiveInsight) ||
    !isNullableNumber(value.passiveInvestigation)
  )
    return reject(
      'invalid-npc',
      'NPC numeric fields must be numbers when present'
    );
  if (
    !isNullableStringArray(value.tags) ||
    !isNullableStringArray(value.collapsedSpellSections) ||
    !isNullableStringArray(value.traits) ||
    !isNullableStringArray(value.actions)
  )
    return reject(
      'invalid-npc',
      'NPC tags, collapsedSpellSections, traits, and actions must be arrays of strings'
    );
  if (
    !isNullableObject(value.hitDice) ||
    !isNullableObject(value.deathSaves) ||
    !isNullableObject(value.currency) ||
    !isNullableObject(value.abilityScores) ||
    !isNullableObject(value.abilityUsage)
  )
    return reject(
      'invalid-npc',
      'NPC hitDice, deathSaves, currency, abilityScores, and abilityUsage must be objects when present'
    );
  const rejection =
    validateStatBlock(value.monsterStatBlock) ??
    validateChildIds('inventory', value.inventory, true) ??
    validateChildIds('resources', value.resources, true) ??
    validateSpellcasting(value.spellcasting);
  if (rejection) return rejection;
  return { ok: true, payload: structuredClone(value) as NpcPayload };
}

export async function buildNpcManifest(input: {
  campaignCode: string;
  rawEnvelope: string;
}): Promise<NpcManifest> {
  const rawCandidate: NpcManifest['rawCandidates'][number] = {
    sourceKey: NPC_STORAGE_KEY,
    rawValue: input.rawEnvelope,
    byteCount: encoder.encode(input.rawEnvelope).byteLength,
    fingerprint: await sha256Bytes(input.rawEnvelope),
  };
  const blockers: NpcManifestBlocker[] = [];
  const records: NpcManifestRecord[] = [];
  if (input.rawEnvelope === '') {
    blockers.push({
      kind: 'incomplete-envelope',
      legacyId: null,
      detail: `${NPC_STORAGE_KEY} has never been persisted on this browser`,
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
      detail: `${NPC_STORAGE_KEY} is not valid JSON`,
    });
    return finalize(input.campaignCode, records, blockers, [rawCandidate]);
  }
  if (
    !record(parsed) ||
    !record(parsed.state) ||
    !record(parsed.state.npcsByCampaign)
  ) {
    blockers.push({
      kind: 'incomplete-envelope',
      legacyId: null,
      detail: 'The complete Zustand npcsByCampaign envelope is missing',
    });
    return finalize(input.campaignCode, records, blockers, [rawCandidate]);
  }
  const persistenceVersion =
    typeof parsed.version === 'number' ? parsed.version : 0;
  if (persistenceVersion > NPC_PERSIST_VERSION) {
    blockers.push({
      kind: 'future-schema',
      legacyId: null,
      detail: `Persistence version ${persistenceVersion} exceeds ${NPC_PERSIST_VERSION}`,
    });
    return finalize(input.campaignCode, records, blockers, [rawCandidate]);
  }
  if (persistenceVersion !== NPC_PERSIST_VERSION) {
    blockers.push({
      kind: 'legacy-schema',
      legacyId: null,
      detail: `${NPC_STORAGE_KEY} is persisted at version ${persistenceVersion}; the NPC store migration must upgrade it to version ${NPC_PERSIST_VERSION} before preview`,
    });
    return finalize(input.campaignCode, records, blockers, [rawCandidate]);
  }
  const scope = parsed.state.npcsByCampaign[input.campaignCode];
  if (scope === undefined)
    return finalize(input.campaignCode, records, blockers, [rawCandidate]);
  if (!Array.isArray(scope)) {
    blockers.push({
      kind: 'incomplete-envelope',
      legacyId: null,
      detail: `npcsByCampaign[${input.campaignCode}] is not an array of NPCs`,
    });
    return finalize(input.campaignCode, records, blockers, [rawCandidate]);
  }
  if (scope.length > NPC_MAX_ITEMS)
    blockers.push({
      kind: 'oversized-family',
      legacyId: null,
      detail: `The NPC roster exceeds ${NPC_MAX_ITEMS} NPCs`,
    });
  const seen = new Set<string>();
  for (const [index, entry] of scope.entries()) {
    if (!record(entry) || !isStableId(entry.id)) {
      blockers.push({
        kind: 'invalid-npc-id',
        legacyId: null,
        detail: `npcsByCampaign[${input.campaignCode}][${index}] requires a stable ID of 1-${MAX_ID_LENGTH} characters`,
      });
      continue;
    }
    const legacyId = entry.id;
    if (seen.has(legacyId)) {
      blockers.push({
        kind: 'duplicate-id',
        legacyId,
        detail: `Duplicate NPC ID ${legacyId}`,
      });
      continue;
    }
    seen.add(legacyId);
    if (entry.campaignCode !== input.campaignCode) {
      blockers.push({
        kind: 'id-mismatch',
        legacyId,
        detail: `NPC ${legacyId} is not scoped to campaign ${input.campaignCode}`,
      });
      continue;
    }
    const { id, campaignCode, ...candidate } = entry;
    void id;
    void campaignCode;
    const validation = validateNpcPayload(candidate);
    if (!validation.ok) {
      blockers.push({
        kind: validation.kind,
        legacyId,
        detail: validation.detail,
      });
      continue;
    }
    const payload = canonicalize(validation.payload) as NpcPayload;
    const encoded = canonicalJson(payload);
    const byteCount = encoder.encode(encoded).byteLength;
    if (byteCount > NPC_MAX_RECORD_BYTES)
      blockers.push({
        kind: 'oversized-record',
        legacyId,
        detail: `NPC ${legacyId} exceeds ${NPC_MAX_RECORD_BYTES} UTF-8 bytes`,
      });
    records.push({
      legacyId,
      schemaVersion: NPC_PERSIST_VERSION,
      byteCount,
      payloadFingerprint: await sha256Bytes(encoded),
      payload,
      tombstoned: false,
    });
  }
  const totalBytes = records.reduce(
    (total, value) => total + value.byteCount,
    0
  );
  if (totalBytes > NPC_MAX_TOTAL_BYTES)
    blockers.push({
      kind: 'oversized-family',
      legacyId: null,
      detail: `The NPC roster exceeds ${NPC_MAX_TOTAL_BYTES} UTF-8 bytes`,
    });
  return finalize(input.campaignCode, records, blockers, [rawCandidate]);
}

export async function buildNpcWorkingCopyManifest(input: {
  source: NpcManifest;
  documents: Array<{
    legacyId: string;
    payload: NpcPayload | null;
    schemaVersion: number;
    tombstoned: boolean;
  }>;
}): Promise<NpcManifest> {
  if (
    input.source.format !== 'rollkeeper-npc-manifest' ||
    input.source.version !== 1 ||
    input.source.family !== 'npc' ||
    input.source.blockers.length > 0
  )
    throw new Error('A validated NPC source manifest is required');
  const records: NpcManifestRecord[] = [];
  for (const entry of input.documents) {
    if (entry.schemaVersion !== NPC_PERSIST_VERSION)
      throw new Error(
        `NPC document ${entry.legacyId} must use schema version ${NPC_PERSIST_VERSION}`
      );
    if (entry.tombstoned) {
      const encoded = canonicalJson({
        legacyId: entry.legacyId,
        tombstoned: true,
      });
      records.push({
        legacyId: entry.legacyId,
        schemaVersion: NPC_PERSIST_VERSION,
        byteCount: encoder.encode(encoded).byteLength,
        payloadFingerprint: await sha256Bytes(encoded),
        payload: null,
        tombstoned: true,
      });
      continue;
    }
    const validation = validateNpcPayload(entry.payload);
    if (!validation.ok)
      throw new Error(
        `NPC document ${entry.legacyId} is invalid: ${validation.detail}`
      );
    const payload = canonicalize(validation.payload) as NpcPayload;
    const encoded = canonicalJson(payload);
    records.push({
      legacyId: entry.legacyId,
      schemaVersion: NPC_PERSIST_VERSION,
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
  records: NpcManifestRecord[],
  blockers: NpcManifestBlocker[],
  rawCandidates: NpcManifest['rawCandidates']
): Promise<NpcManifest> {
  const sortedRecords = [...records].sort((a, b) =>
    a.legacyId.localeCompare(b.legacyId)
  );
  const sortedBlockers = [...blockers].sort((a, b) =>
    canonicalJson(a).localeCompare(canonicalJson(b))
  );
  const summary = {
    format: 'rollkeeper-npc-manifest' as const,
    version: 1 as const,
    family: 'npc' as const,
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

export function npcPayloadFromCampaignNpc(npc: CampaignNPC): NpcPayload {
  const { id, campaignCode, ...payload } = npc;
  void id;
  void campaignCode;
  return structuredClone(payload);
}

export function campaignNpcFromPayload(
  campaignCode: string,
  legacyId: string,
  payload: NpcPayload
): CampaignNPC {
  return { ...structuredClone(payload), id: legacyId, campaignCode };
}

export function sortNpcs<T extends { id: string; createdAt: string }>(
  npcs: T[]
): T[] {
  return [...npcs].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
  );
}

export function fingerprintNpcPayload(payload: NpcPayload) {
  return sha256Bytes(canonicalJson(payload));
}

export function fingerprintNpcTombstone(legacyId: string) {
  return sha256Bytes(canonicalJson({ legacyId, tombstoned: true }));
}
