import { sha256Bytes } from '@/lib/indexeddb/migrationCapture';
import type { CustomMagicItem } from '@/types/magicItemLibrary';

export const registeredDurableDmFamilies = [
  'campaign_settings',
  'calendar',
  'magic_item',
] as const;

export const MAGIC_ITEM_STORAGE_KEY = 'rollkeeper-dm-magic-item-library';
export const MAGIC_ITEM_MAX_RECORD_BYTES = 262_144;
export const MAGIC_ITEM_MAX_ITEMS = 2_000;
export const MAGIC_ITEM_MAX_TOTAL_BYTES = 5_242_880;

export const MAGIC_ITEM_FAMILY_INVENTORY = {
  family: 'magic_item',
  localStorageKeys: ['rollkeeper-dm-magic-item-library'],
  persistenceVersions: { 'rollkeeper-dm-magic-item-library': 1 },
  stableIdentity: 'itemsByCampaign[campaignCode][].id',
  stableChildIdentity: ['charges[].id', 'chargePool.abilities[].id'],
  completeEnvelopeFields: ['itemsByCampaign'],
  documentFields: [
    'name',
    'category',
    'rarity',
    'description',
    'properties',
    'requiresAttunement',
    'isAttuned',
    'isEquipped',
    'charges',
    'chargePool',
    'bonusSpellAttack',
    'bonusSpellSaveDc',
    'legacyCharges',
    'createdAt',
    'updatedAt',
    'tags',
    'group',
    'sourceItemId',
  ],
  privateFields: ['*'],
  publicFields: [],
  discoveredFields: [],
  // sourceItemId points at an SRD compendium entry, not another durable family.
  typedCrossFamilyReferences: [],
  redisProjectionKinds: [],
  projection: 'not-applicable',
  excludedFamilies: [
    'campaign_settings',
    'calendar',
    'character',
    'membership',
    'location',
    'encounter_definition',
    'combat_log_archive',
    'npc',
    'battle_map',
    'map_asset',
    'live_combat',
    'relay',
  ],
} as const;

export type MagicItemPayload = Omit<CustomMagicItem, 'id' | 'campaignCode'>;

export interface MagicItemManifestRecord {
  legacyId: string;
  schemaVersion: 1;
  byteCount: number;
  payloadFingerprint: string;
  payload: MagicItemPayload | null;
  tombstoned: boolean;
}

export interface MagicItemManifestBlocker {
  kind:
    | 'malformed-json'
    | 'future-schema'
    | 'incomplete-envelope'
    | 'duplicate-id'
    | 'id-mismatch'
    | 'invalid-item-id'
    | 'unclassified-field'
    | 'invalid-item'
    | 'duplicate-child-id'
    | 'invalid-child-id'
    | 'oversized-record'
    | 'oversized-family';
  legacyId: string | null;
  detail: string;
}

export interface MagicItemManifest {
  format: 'rollkeeper-magic-item-manifest';
  version: 1;
  family: 'magic_item';
  campaignCode: string;
  recordCount: number;
  totalBytes: number;
  records: MagicItemManifestRecord[];
  blockers: MagicItemManifestBlocker[];
  rawCandidates: Array<{
    sourceKey: 'rollkeeper-dm-magic-item-library';
    rawValue: string;
    byteCount: number;
    fingerprint: string;
  }>;
  fingerprint: string;
}

export type MagicItemPayloadValidation =
  | { ok: true; payload: MagicItemPayload }
  | {
      ok: false;
      kind:
        | 'invalid-item'
        | 'unclassified-field'
        | 'invalid-child-id'
        | 'duplicate-child-id';
      detail: string;
    };

type MagicItemPayloadRejection = Extract<
  MagicItemPayloadValidation,
  { ok: false }
>;

const encoder = new TextEncoder();
const MAGIC_ITEM_FIELDS = new Set<string>(
  MAGIC_ITEM_FAMILY_INVENTORY.documentFields
);
const MAGIC_ITEM_CATEGORIES = new Set<string>([
  'wondrous',
  'armor',
  'shield',
  'ring',
  'staff',
  'wand',
  'rod',
  'scroll',
  'potion',
  'artifact',
  'other',
]);
const MAGIC_ITEM_RARITIES = new Set<string>([
  'common',
  'uncommon',
  'rare',
  'very rare',
  'legendary',
  'artifact',
]);
const CHARGE_REST_TYPES = new Set<string>(['short', 'long', 'dawn']);
const CHARGE_POOL_RECHARGE_TYPES = new Set<string>([
  'short',
  'long',
  'dawn',
  'dusk',
  'midnight',
  'special',
]);
const MAX_ID_LENGTH = 255;

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
  kind: MagicItemPayloadRejection['kind'],
  detail: string
): MagicItemPayloadRejection {
  return { ok: false, kind, detail };
}

function isStableId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_ID_LENGTH
  );
}

function isFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isOptionalFiniteNumber(value: unknown) {
  return value === undefined || isFiniteNumber(value);
}

function isOptionalString(value: unknown) {
  return value === undefined || typeof value === 'string';
}

function isOptionalBoolean(value: unknown) {
  return value === undefined || typeof value === 'boolean';
}

function isNullableString(value: unknown) {
  return value === undefined || value === null || typeof value === 'string';
}

function isStringArray(value: unknown) {
  return (
    Array.isArray(value) && value.every(entry => typeof entry === 'string')
  );
}

function validateCharges(value: unknown): MagicItemPayloadRejection | null {
  if (!Array.isArray(value))
    return reject('invalid-item', 'Magic item charges must be an array');
  const seen = new Set<string>();
  for (const [index, charge] of value.entries()) {
    if (!record(charge) || !isStableId(charge.id))
      return reject(
        'invalid-child-id',
        `charges[${index}] requires a stable ID of 1-${MAX_ID_LENGTH} characters`
      );
    if (seen.has(charge.id))
      return reject('duplicate-child-id', `Duplicate charge ID ${charge.id}`);
    seen.add(charge.id);
    if (typeof charge.name !== 'string' || charge.name.length === 0)
      return reject('invalid-item', `charges[${index}] requires a name`);
    if (
      !isFiniteNumber(charge.maxCharges) ||
      !isFiniteNumber(charge.usedCharges)
    )
      return reject(
        'invalid-item',
        `charges[${index}] requires numeric charge counts`
      );
    if (
      typeof charge.restType !== 'string' ||
      !CHARGE_REST_TYPES.has(charge.restType)
    )
      return reject(
        'invalid-item',
        `charges[${index}] has an unsupported rest type`
      );
    if (
      !isOptionalString(charge.description) ||
      !isOptionalBoolean(charge.scaleWithProficiency) ||
      !isOptionalFiniteNumber(charge.proficiencyMultiplier)
    )
      return reject(
        'invalid-item',
        `charges[${index}] has an invalid optional field`
      );
  }
  return null;
}

function validateChargePool(value: unknown): MagicItemPayloadRejection | null {
  if (!record(value))
    return reject('invalid-item', 'Magic item chargePool must be an object');
  if (!isFiniteNumber(value.maxCharges) || !isFiniteNumber(value.usedCharges))
    return reject('invalid-item', 'chargePool requires numeric charge counts');
  if (
    typeof value.rechargeType !== 'string' ||
    !CHARGE_POOL_RECHARGE_TYPES.has(value.rechargeType)
  )
    return reject(
      'invalid-item',
      'chargePool has an unsupported recharge type'
    );
  if (!isOptionalString(value.rechargeAmount))
    return reject('invalid-item', 'chargePool rechargeAmount must be a string');
  if (!Array.isArray(value.abilities))
    return reject('invalid-item', 'chargePool abilities must be an array');
  const seen = new Set<string>();
  for (const [index, ability] of value.abilities.entries()) {
    if (!record(ability) || !isStableId(ability.id))
      return reject(
        'invalid-child-id',
        `chargePool.abilities[${index}] requires a stable ID of 1-${MAX_ID_LENGTH} characters`
      );
    if (seen.has(ability.id))
      return reject(
        'duplicate-child-id',
        `Duplicate charge pool ability ID ${ability.id}`
      );
    seen.add(ability.id);
    if (typeof ability.name !== 'string' || ability.name.length === 0)
      return reject(
        'invalid-item',
        `chargePool.abilities[${index}] requires a name`
      );
    if (!isFiniteNumber(ability.cost))
      return reject(
        'invalid-item',
        `chargePool.abilities[${index}] requires a numeric cost`
      );
    if (
      !isOptionalString(ability.description) ||
      !isOptionalBoolean(ability.isSpell) ||
      !isOptionalFiniteNumber(ability.spellLevel)
    )
      return reject(
        'invalid-item',
        `chargePool.abilities[${index}] has an invalid optional field`
      );
  }
  return null;
}

function validateLegacyCharges(
  value: unknown
): MagicItemPayloadRejection | null {
  if (!record(value))
    return reject('invalid-item', 'Magic item legacyCharges must be an object');
  if (!isFiniteNumber(value.current) || !isFiniteNumber(value.max))
    return reject('invalid-item', 'legacyCharges requires numeric counts');
  if (!isOptionalString(value.rechargeRule))
    return reject(
      'invalid-item',
      'legacyCharges rechargeRule must be a string'
    );
  return null;
}

export function validateMagicItemPayload(
  value: unknown
): MagicItemPayloadValidation {
  if (!record(value))
    return reject('invalid-item', 'A magic item must be a JSON object');
  for (const field of Object.keys(value)) {
    if (!MAGIC_ITEM_FIELDS.has(field))
      return reject(
        'unclassified-field',
        `Magic item field ${field} is not classified in Slice 11C`
      );
  }
  if (typeof value.name !== 'string' || value.name.trim().length === 0)
    return reject('invalid-item', 'A magic item requires a non-empty name');
  if (
    typeof value.category !== 'string' ||
    !MAGIC_ITEM_CATEGORIES.has(value.category)
  )
    return reject('invalid-item', 'Magic item category is not supported');
  if (
    typeof value.rarity !== 'string' ||
    !MAGIC_ITEM_RARITIES.has(value.rarity)
  )
    return reject('invalid-item', 'Magic item rarity is not supported');
  if (typeof value.description !== 'string')
    return reject('invalid-item', 'Magic item description must be a string');
  if (!isStringArray(value.properties))
    return reject(
      'invalid-item',
      'Magic item properties must be an array of strings'
    );
  if (
    typeof value.requiresAttunement !== 'boolean' ||
    typeof value.isAttuned !== 'boolean'
  )
    return reject(
      'invalid-item',
      'Magic item attunement flags must be booleans'
    );
  if (!isOptionalBoolean(value.isEquipped))
    return reject('invalid-item', 'Magic item isEquipped must be a boolean');
  if (
    !isOptionalFiniteNumber(value.bonusSpellAttack) ||
    !isOptionalFiniteNumber(value.bonusSpellSaveDc)
  )
    return reject('invalid-item', 'Magic item spell bonuses must be numbers');
  if (typeof value.createdAt !== 'string' || value.createdAt.length === 0)
    return reject('invalid-item', 'Magic item requires a createdAt timestamp');
  if (typeof value.updatedAt !== 'string' || value.updatedAt.length === 0)
    return reject('invalid-item', 'Magic item requires an updatedAt timestamp');
  if (!isStringArray(value.tags))
    return reject(
      'invalid-item',
      'Magic item tags must be an array of strings'
    );
  if (!isNullableString(value.group))
    return reject('invalid-item', 'Magic item group must be a string or null');
  if (!isNullableString(value.sourceItemId))
    return reject(
      'invalid-item',
      'Magic item sourceItemId must be a string or null'
    );
  const childRejection =
    (value.charges === undefined ? null : validateCharges(value.charges)) ??
    (value.chargePool === undefined
      ? null
      : validateChargePool(value.chargePool)) ??
    (value.legacyCharges === undefined
      ? null
      : validateLegacyCharges(value.legacyCharges));
  if (childRejection) return childRejection;
  return { ok: true, payload: structuredClone(value) as MagicItemPayload };
}

export async function buildMagicItemManifest(input: {
  campaignCode: string;
  rawEnvelope: string;
}): Promise<MagicItemManifest> {
  const rawCandidate: MagicItemManifest['rawCandidates'][number] = {
    sourceKey: MAGIC_ITEM_STORAGE_KEY,
    rawValue: input.rawEnvelope,
    byteCount: encoder.encode(input.rawEnvelope).byteLength,
    fingerprint: await sha256Bytes(input.rawEnvelope),
  };
  const blockers: MagicItemManifestBlocker[] = [];
  const records: MagicItemManifestRecord[] = [];
  if (input.rawEnvelope === '') {
    blockers.push({
      kind: 'incomplete-envelope',
      legacyId: null,
      detail: `${MAGIC_ITEM_STORAGE_KEY} has never been persisted on this device`,
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
      detail: `${MAGIC_ITEM_STORAGE_KEY} is not valid JSON`,
    });
    return finalize(input.campaignCode, records, blockers, [rawCandidate]);
  }
  if (
    !record(parsed) ||
    !record(parsed.state) ||
    !record(parsed.state.itemsByCampaign)
  ) {
    blockers.push({
      kind: 'incomplete-envelope',
      legacyId: null,
      detail: 'The complete Zustand itemsByCampaign envelope is missing',
    });
    return finalize(input.campaignCode, records, blockers, [rawCandidate]);
  }
  const persistenceVersion =
    typeof parsed.version === 'number' ? parsed.version : 0;
  if (persistenceVersion > 1) {
    blockers.push({
      kind: 'future-schema',
      legacyId: null,
      detail: `Persistence version ${persistenceVersion} exceeds 1`,
    });
    return finalize(input.campaignCode, records, blockers, [rawCandidate]);
  }
  const scope = parsed.state.itemsByCampaign[input.campaignCode];
  if (scope === undefined)
    return finalize(input.campaignCode, records, blockers, [rawCandidate]);
  if (!Array.isArray(scope)) {
    blockers.push({
      kind: 'incomplete-envelope',
      legacyId: null,
      detail: `itemsByCampaign[${input.campaignCode}] is not an array of magic items`,
    });
    return finalize(input.campaignCode, records, blockers, [rawCandidate]);
  }
  if (scope.length > MAGIC_ITEM_MAX_ITEMS)
    blockers.push({
      kind: 'oversized-family',
      legacyId: null,
      detail: `The magic item library exceeds ${MAGIC_ITEM_MAX_ITEMS} items`,
    });
  const seen = new Set<string>();
  for (const [index, entry] of scope.entries()) {
    if (!record(entry) || !isStableId(entry.id)) {
      blockers.push({
        kind: 'invalid-item-id',
        legacyId: null,
        detail: `itemsByCampaign[${input.campaignCode}][${index}] requires a stable ID of 1-${MAX_ID_LENGTH} characters`,
      });
      continue;
    }
    const legacyId = entry.id;
    if (seen.has(legacyId)) {
      blockers.push({
        kind: 'duplicate-id',
        legacyId,
        detail: `Duplicate magic item ID ${legacyId}`,
      });
      continue;
    }
    seen.add(legacyId);
    if (entry.campaignCode !== input.campaignCode) {
      blockers.push({
        kind: 'id-mismatch',
        legacyId,
        detail: `Magic item ${legacyId} is not scoped to campaign ${input.campaignCode}`,
      });
      continue;
    }
    const { id, campaignCode, ...candidate } = entry;
    void id;
    void campaignCode;
    const validation = validateMagicItemPayload(candidate);
    if (!validation.ok) {
      blockers.push({
        kind: validation.kind,
        legacyId,
        detail: validation.detail,
      });
      continue;
    }
    const payload = canonicalize(validation.payload) as MagicItemPayload;
    const encoded = canonicalJson(payload);
    const byteCount = encoder.encode(encoded).byteLength;
    if (byteCount > MAGIC_ITEM_MAX_RECORD_BYTES)
      blockers.push({
        kind: 'oversized-record',
        legacyId,
        detail: `Magic item ${legacyId} exceeds ${MAGIC_ITEM_MAX_RECORD_BYTES} UTF-8 bytes`,
      });
    records.push({
      legacyId,
      schemaVersion: 1,
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
  if (totalBytes > MAGIC_ITEM_MAX_TOTAL_BYTES)
    blockers.push({
      kind: 'oversized-family',
      legacyId: null,
      detail: `The magic item library exceeds ${MAGIC_ITEM_MAX_TOTAL_BYTES} UTF-8 bytes`,
    });
  return finalize(input.campaignCode, records, blockers, [rawCandidate]);
}

export async function buildMagicItemWorkingCopyManifest(input: {
  source: MagicItemManifest;
  documents: Array<{
    legacyId: string;
    payload: MagicItemPayload | null;
    schemaVersion: number;
    tombstoned: boolean;
  }>;
}): Promise<MagicItemManifest> {
  if (
    input.source.format !== 'rollkeeper-magic-item-manifest' ||
    input.source.version !== 1 ||
    input.source.family !== 'magic_item' ||
    input.source.blockers.length > 0
  )
    throw new Error('A validated magic item source manifest is required');
  const records: MagicItemManifestRecord[] = [];
  for (const entry of input.documents) {
    if (entry.schemaVersion !== 1)
      throw new Error(
        `Magic item document ${entry.legacyId} must use schema version 1`
      );
    if (entry.tombstoned) {
      const encoded = canonicalJson({
        legacyId: entry.legacyId,
        tombstoned: true,
      });
      records.push({
        legacyId: entry.legacyId,
        schemaVersion: 1,
        byteCount: encoder.encode(encoded).byteLength,
        payloadFingerprint: await sha256Bytes(encoded),
        payload: null,
        tombstoned: true,
      });
      continue;
    }
    const validation = validateMagicItemPayload(entry.payload);
    if (!validation.ok)
      throw new Error(
        `Magic item document ${entry.legacyId} is invalid: ${validation.detail}`
      );
    const payload = canonicalize(validation.payload) as MagicItemPayload;
    const encoded = canonicalJson(payload);
    records.push({
      legacyId: entry.legacyId,
      schemaVersion: 1,
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
  records: MagicItemManifestRecord[],
  blockers: MagicItemManifestBlocker[],
  rawCandidates: MagicItemManifest['rawCandidates']
): Promise<MagicItemManifest> {
  const sortedRecords = [...records].sort((a, b) =>
    a.legacyId.localeCompare(b.legacyId)
  );
  const sortedBlockers = [...blockers].sort((a, b) =>
    canonicalJson(a).localeCompare(canonicalJson(b))
  );
  const summary = {
    format: 'rollkeeper-magic-item-manifest' as const,
    version: 1 as const,
    family: 'magic_item' as const,
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

export function magicItemPayloadFromCustomItem(
  item: CustomMagicItem
): MagicItemPayload {
  const { id, campaignCode, ...payload } = item;
  void id;
  void campaignCode;
  return structuredClone(payload);
}

export function customMagicItemFromPayload(
  campaignCode: string,
  legacyId: string,
  payload: MagicItemPayload
): CustomMagicItem {
  return { ...structuredClone(payload), id: legacyId, campaignCode };
}

export function sortMagicItems<T extends { id: string; createdAt: string }>(
  items: T[]
): T[] {
  return [...items].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
  );
}

export function fingerprintMagicItemPayload(payload: MagicItemPayload) {
  return sha256Bytes(canonicalJson(payload));
}

export function fingerprintMagicItemTombstone(legacyId: string) {
  return sha256Bytes(canonicalJson({ legacyId, tombstoned: true }));
}
