import { sha256Bytes } from '@/lib/indexeddb/migrationCapture';
import type { CampaignInfo } from '@/types/campaign';
import type { Json } from '@/types/database.generated';

export const registeredDurableDmFamilies = ['campaign_settings'] as const;

export const CAMPAIGN_SETTINGS_FAMILY_INVENTORY = {
  family: 'campaign_settings',
  localStorageKeys: ['rollkeeper-dm-data'],
  persistenceVersions: { 'rollkeeper-dm-data': 1 },
  stableIdentity: 'campaign.code',
  excludedIdentityFields: ['code', 'name', 'createdAt'],
  excludedEnvelopeFields: ['dmId'],
  privateFields: ['bannerUrl', 'playerColors', 'dmDashboardUi'],
  playerVisibleFields: [
    'stackableInspiration',
    'customCounterLabel',
    'playerCounters',
  ],
  redisProjectionKinds: ['settings', 'counters'],
  crossFamilyReferences: ['dmDashboardUi.npcCollapsedGroupNames'],
} as const;

export type CampaignSettingsPayload = {
  bannerUrl?: Json;
  playerColors?: Json;
  dmDashboardUi?: Json;
  stackableInspiration?: Json;
  customCounterLabel?: Json;
  playerCounters?: Json;
};

export interface CampaignSettingsReference {
  family: 'npc';
  legacyId: string;
  path: string;
}

export interface CampaignSettingsManifestRecord {
  legacyId: string;
  schemaVersion: number;
  byteCount: number;
  payloadFingerprint: string;
  payload: CampaignSettingsPayload;
  references: CampaignSettingsReference[];
}

export interface CampaignSettingsManifestBlocker {
  kind:
    | 'malformed-json'
    | 'future-schema'
    | 'incomplete-envelope'
    | 'duplicate-id'
    | 'id-mismatch'
    | 'unclassified-field';
  legacyId: string | null;
  detail: string;
}

export interface CampaignSettingsManifest {
  format: 'rollkeeper-campaign-settings-manifest';
  version: 1;
  family: 'campaign_settings';
  campaignCode: string;
  recordCount: number;
  totalBytes: number;
  records: CampaignSettingsManifestRecord[];
  blockers: CampaignSettingsManifestBlocker[];
  rawCandidates: Array<{
    sourceKey: 'rollkeeper-dm-data';
    rawValue: string;
    byteCount: number;
    fingerprint: string;
  }>;
  fingerprint: string;
}

const FAMILY_FIELDS: ReadonlySet<string> = new Set([
  ...CAMPAIGN_SETTINGS_FAMILY_INVENTORY.privateFields,
  ...CAMPAIGN_SETTINGS_FAMILY_INVENTORY.playerVisibleFields,
]);
const IDENTITY_FIELDS: ReadonlySet<string> = new Set(
  CAMPAIGN_SETTINGS_FAMILY_INVENTORY.excludedIdentityFields
);
const encoder = new TextEncoder();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map(key => [key, canonicalize(value[key])])
  );
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function referencesFor(payload: CampaignSettingsPayload) {
  if (!isRecord(payload.dmDashboardUi)) return [];
  const values = payload.dmDashboardUi.npcCollapsedGroupNames;
  if (!Array.isArray(values)) return [];
  return values.flatMap((legacyId, index) =>
    typeof legacyId === 'string'
      ? [
          {
            family: 'npc' as const,
            legacyId,
            path: `dmDashboardUi.npcCollapsedGroupNames[${index}]`,
          },
        ]
      : []
  );
}

export async function buildCampaignSettingsManifest(input: {
  campaignCode: string;
  rawEnvelope: string;
}): Promise<CampaignSettingsManifest> {
  const rawCandidate = {
    sourceKey: 'rollkeeper-dm-data' as const,
    rawValue: input.rawEnvelope,
    byteCount: encoder.encode(input.rawEnvelope).byteLength,
    fingerprint: await sha256Bytes(input.rawEnvelope),
  };
  const blockers: CampaignSettingsManifestBlocker[] = [];
  const records: CampaignSettingsManifestRecord[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(input.rawEnvelope);
  } catch {
    blockers.push({
      kind: 'malformed-json',
      legacyId: null,
      detail: 'rollkeeper-dm-data is not valid JSON',
    });
    return finalizeManifest(input.campaignCode, records, blockers, [
      rawCandidate,
    ]);
  }

  if (!isRecord(parsed) || !isRecord(parsed.state)) {
    blockers.push({
      kind: 'incomplete-envelope',
      legacyId: null,
      detail: 'Missing Zustand state envelope',
    });
    return finalizeManifest(input.campaignCode, records, blockers, [
      rawCandidate,
    ]);
  }
  const persistenceVersion =
    typeof parsed.version === 'number' ? parsed.version : 0;
  if (persistenceVersion > 1) {
    blockers.push({
      kind: 'future-schema',
      legacyId: null,
      detail: `Persistence version ${persistenceVersion} exceeds 1`,
    });
    return finalizeManifest(input.campaignCode, records, blockers, [
      rawCandidate,
    ]);
  }
  if (!Array.isArray(parsed.state.campaigns)) {
    blockers.push({
      kind: 'incomplete-envelope',
      legacyId: null,
      detail: 'The complete campaigns array is missing',
    });
    return finalizeManifest(input.campaignCode, records, blockers, [
      rawCandidate,
    ]);
  }

  const matching = parsed.state.campaigns.filter(
    candidate => isRecord(candidate) && candidate.code === input.campaignCode
  );
  if (matching.length === 0) {
    blockers.push({
      kind: 'id-mismatch',
      legacyId: input.campaignCode,
      detail: 'Selected campaign is absent from the captured envelope',
    });
  }
  if (matching.length > 1) {
    blockers.push({
      kind: 'duplicate-id',
      legacyId: input.campaignCode,
      detail: 'Captured envelope contains duplicate campaign IDs',
    });
  }

  for (const candidate of matching) {
    const payload: CampaignSettingsPayload = {};
    for (const [key, value] of Object.entries(candidate)) {
      if (FAMILY_FIELDS.has(key)) {
        payload[key as keyof CampaignSettingsPayload] = structuredClone(
          value
        ) as Json;
      } else if (!IDENTITY_FIELDS.has(key)) {
        blockers.push({
          kind: 'unclassified-field',
          legacyId: input.campaignCode,
          detail: `Campaign field ${key} is not classified in Slice 11A`,
        });
      }
    }
    const encoded = canonicalJson(payload);
    records.push({
      legacyId: input.campaignCode,
      schemaVersion: 1,
      byteCount: encoder.encode(encoded).byteLength,
      payloadFingerprint: await sha256Bytes(encoded),
      payload: canonicalize(payload) as CampaignSettingsPayload,
      references: referencesFor(payload),
    });
  }

  return finalizeManifest(input.campaignCode, records, blockers, [
    rawCandidate,
  ]);
}

export async function buildCampaignSettingsWorkingCopyManifest(input: {
  source: CampaignSettingsManifest;
  payload: CampaignSettingsPayload;
  schemaVersion: number;
}): Promise<CampaignSettingsManifest> {
  if (
    input.source.format !== 'rollkeeper-campaign-settings-manifest' ||
    input.source.family !== 'campaign_settings' ||
    input.source.version !== 1 ||
    input.source.blockers.length > 0 ||
    input.source.records.length !== 1 ||
    !Number.isSafeInteger(input.schemaVersion) ||
    input.schemaVersion < 1
  ) {
    throw new Error(
      'A validated campaign settings source manifest is required'
    );
  }
  const payload = canonicalize(input.payload) as CampaignSettingsPayload;
  const encoded = canonicalJson(payload);
  return finalizeManifest(
    input.source.campaignCode,
    [
      {
        legacyId: input.source.records[0].legacyId,
        schemaVersion: input.schemaVersion,
        byteCount: encoder.encode(encoded).byteLength,
        payloadFingerprint: await sha256Bytes(encoded),
        payload,
        references: referencesFor(payload),
      },
    ],
    [],
    structuredClone(input.source.rawCandidates)
  );
}

async function finalizeManifest(
  campaignCode: string,
  records: CampaignSettingsManifestRecord[],
  blockers: CampaignSettingsManifestBlocker[],
  rawCandidates: CampaignSettingsManifest['rawCandidates']
): Promise<CampaignSettingsManifest> {
  const stableRecords = [...records].sort((left, right) =>
    left.legacyId.localeCompare(right.legacyId)
  );
  const stableBlockers = [...blockers].sort((left, right) =>
    canonicalJson(left).localeCompare(canonicalJson(right))
  );
  const fingerprintInput = {
    format: 'rollkeeper-campaign-settings-manifest',
    version: 1,
    family: 'campaign_settings',
    campaignCode,
    records: stableRecords.map(record => ({
      legacyId: record.legacyId,
      schemaVersion: record.schemaVersion,
      byteCount: record.byteCount,
      payloadFingerprint: record.payloadFingerprint,
      references: record.references,
    })),
    blockers: stableBlockers,
    rawCandidates: rawCandidates.map(candidate => ({
      sourceKey: candidate.sourceKey,
      byteCount: candidate.byteCount,
      fingerprint: candidate.fingerprint,
    })),
  };
  return {
    ...fingerprintInput,
    format: 'rollkeeper-campaign-settings-manifest',
    version: 1,
    family: 'campaign_settings',
    recordCount: stableRecords.length,
    totalBytes: stableRecords.reduce(
      (total, record) => total + record.byteCount,
      0
    ),
    records: stableRecords,
    blockers: stableBlockers,
    rawCandidates,
    fingerprint: await sha256Bytes(canonicalJson(fingerprintInput)),
  };
}

export function projectCampaignSettingsForLegacyPlayers(
  payload: CampaignSettingsPayload
) {
  const stackableInspiration = payload.stackableInspiration === true;
  const counters = isRecord(payload.playerCounters)
    ? Object.fromEntries(
        Object.entries(payload.playerCounters)
          .filter(
            (entry): entry is [string, number] =>
              typeof entry[1] === 'number' && Number.isFinite(entry[1])
          )
          .sort(([left], [right]) => left.localeCompare(right))
      )
    : {};
  return {
    codecVersion: 1 as const,
    settings: { stackableInspiration },
    counters: {
      ...(typeof payload.customCounterLabel === 'string'
        ? { label: payload.customCounterLabel }
        : {}),
      counters,
    },
  };
}

export function campaignSettingsPayloadFromCampaign(
  campaign: CampaignInfo,
  previous?: CampaignSettingsPayload
): CampaignSettingsPayload {
  const payload = Object.fromEntries(
    Object.entries(campaign)
      .filter(([field]) => FAMILY_FIELDS.has(field))
      .map(([field, value]) => [field, structuredClone(value)])
  ) as CampaignSettingsPayload;
  if (previous) {
    for (const field of FAMILY_FIELDS) {
      if (
        previous[field as keyof CampaignSettingsPayload] === null &&
        payload[field as keyof CampaignSettingsPayload] === undefined
      ) {
        payload[field as keyof CampaignSettingsPayload] = null;
      }
    }
  }
  return payload;
}

export function fingerprintCampaignSettingsPayload(
  payload: CampaignSettingsPayload
) {
  return sha256Bytes(canonicalJson(payload));
}

export function fingerprintCampaignSettingsTombstone(legacyId: string) {
  return sha256Bytes(canonicalJson({ legacyId, tombstoned: true }));
}
