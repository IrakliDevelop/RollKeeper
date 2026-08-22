import { sha256Bytes } from '@/lib/indexeddb/migrationCapture';
import type {
  CalendarConfig,
  CalendarEvent,
  CalendarEventReference,
  CampaignCalendar,
  WeatherType,
} from '@/types/calendar';

export const registeredDurableDmFamilies = [
  'campaign_settings',
  'calendar',
] as const;

export const CALENDAR_FAMILY_INVENTORY = {
  family: 'calendar',
  localStorageKeys: ['rollkeeper-calendar-data'],
  persistenceVersions: { 'rollkeeper-calendar-data': 3 },
  stableIdentity: 'campaignCode',
  stableChildIdentity: 'events[].id',
  completeEnvelopeFields: ['calendars'],
  documentFields: ['config', 'currentTime', 'startTime', 'events', 'weather'],
  privateFields: ['campaignCode', 'events[visibility=private]', 'createdAt'],
  publicFields: [
    'config',
    'currentTime',
    'startTime',
    'weather',
    'events[visibility=public]',
  ],
  discoveredFields: ['events[visibility=discovered]'],
  typedCrossFamilyReferences: ['location', 'encounter_definition'],
  redisProjectionKinds: ['calendar_v1'],
  excludedFamilies: [
    'campaign_settings',
    'character',
    'membership',
    'location',
    'encounter_definition',
    'combat_log_archive',
    'magic_item',
    'npc',
    'battle_map',
    'map_asset',
    'live_combat',
    'relay',
  ],
} as const;

export interface CalendarPayload {
  config: CalendarConfig;
  currentTime: number;
  startTime: number;
  events: CalendarEvent[];
  weather?: WeatherType;
}

export interface CalendarReference extends CalendarEventReference {
  path: string;
}

export interface CalendarManifestRecord {
  legacyId: string;
  schemaVersion: 1;
  byteCount: number;
  payloadFingerprint: string;
  payload: CalendarPayload;
  references: CalendarReference[];
}

export interface CalendarManifestBlocker {
  kind:
    | 'malformed-json'
    | 'future-schema'
    | 'incomplete-envelope'
    | 'duplicate-id'
    | 'id-mismatch'
    | 'unclassified-field'
    | 'invalid-calendar'
    | 'duplicate-event-id'
    | 'invalid-event-id'
    | 'unsupported-reference'
    | 'oversized-record';
  legacyId: string | null;
  detail: string;
}

export interface CalendarManifest {
  format: 'rollkeeper-calendar-manifest';
  version: 1;
  family: 'calendar';
  campaignCode: string;
  recordCount: number;
  totalBytes: number;
  records: CalendarManifestRecord[];
  blockers: CalendarManifestBlocker[];
  rawCandidates: Array<{
    sourceKey: 'rollkeeper-calendar-data';
    rawValue: string;
    byteCount: number;
    fingerprint: string;
  }>;
  fingerprint: string;
}

const encoder = new TextEncoder();
const CALENDAR_FIELDS = new Set(CALENDAR_FAMILY_INVENTORY.documentFields);
const MAX_RECORD_BYTES = 262_144;
const MAX_EVENTS = 1_000;

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

function hasCalendarShape(value: Record<string, unknown>) {
  return (
    record(value.config) &&
    Number.isFinite(value.currentTime) &&
    Number.isFinite(value.startTime) &&
    Array.isArray(value.events)
  );
}

function referencesFor(
  events: CalendarEvent[],
  blockers: CalendarManifestBlocker[],
  legacyId: string
) {
  const references: CalendarReference[] = [];
  events.forEach((event, eventIndex) => {
    event.references?.forEach((reference, referenceIndex) => {
      if (
        !['location', 'encounter_definition'].includes(reference.family) ||
        typeof reference.legacyId !== 'string' ||
        reference.legacyId.length === 0
      ) {
        blockers.push({
          kind: 'unsupported-reference',
          legacyId,
          detail: `events[${eventIndex}].references[${referenceIndex}] is not a supported typed reference`,
        });
        return;
      }
      references.push({
        family: reference.family,
        legacyId: reference.legacyId,
        path: `events[${eventIndex}].references[${referenceIndex}]`,
      });
    });
  });
  return references;
}

export async function buildCalendarManifest(input: {
  campaignCode: string;
  rawEnvelope: string;
}): Promise<CalendarManifest> {
  const rawCandidate = {
    sourceKey: 'rollkeeper-calendar-data' as const,
    rawValue: input.rawEnvelope,
    byteCount: encoder.encode(input.rawEnvelope).byteLength,
    fingerprint: await sha256Bytes(input.rawEnvelope),
  };
  const blockers: CalendarManifestBlocker[] = [];
  const records: CalendarManifestRecord[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.rawEnvelope);
  } catch {
    blockers.push({
      kind: 'malformed-json',
      legacyId: null,
      detail: 'rollkeeper-calendar-data is not valid JSON',
    });
    return finalize(input.campaignCode, records, blockers, [rawCandidate]);
  }
  if (
    !record(parsed) ||
    !record(parsed.state) ||
    !Array.isArray(parsed.state.calendars)
  ) {
    blockers.push({
      kind: 'incomplete-envelope',
      legacyId: null,
      detail: 'The complete Zustand calendars envelope is missing',
    });
    return finalize(input.campaignCode, records, blockers, [rawCandidate]);
  }
  const persistenceVersion =
    typeof parsed.version === 'number' ? parsed.version : 0;
  if (persistenceVersion > 3) {
    blockers.push({
      kind: 'future-schema',
      legacyId: null,
      detail: `Persistence version ${persistenceVersion} exceeds 3`,
    });
    return finalize(input.campaignCode, records, blockers, [rawCandidate]);
  }
  const matching = parsed.state.calendars.filter(
    candidate =>
      record(candidate) && candidate.campaignCode === input.campaignCode
  );
  if (matching.length === 0)
    blockers.push({
      kind: 'id-mismatch',
      legacyId: input.campaignCode,
      detail: 'Selected campaign calendar is absent from the envelope',
    });
  if (matching.length > 1)
    blockers.push({
      kind: 'duplicate-id',
      legacyId: input.campaignCode,
      detail: 'Envelope contains duplicate campaign calendars',
    });

  for (const candidate of matching) {
    for (const field of Object.keys(candidate)) {
      if (field !== 'campaignCode' && !CALENDAR_FIELDS.has(field as never)) {
        blockers.push({
          kind: 'unclassified-field',
          legacyId: input.campaignCode,
          detail: `Calendar field ${field} is not classified in Slice 11B`,
        });
      }
    }
    if (!hasCalendarShape(candidate)) {
      blockers.push({
        kind: 'invalid-calendar',
        legacyId: input.campaignCode,
        detail: 'Calendar config, time fields, or events are invalid',
      });
      continue;
    }
    const events = structuredClone(candidate.events) as CalendarEvent[];
    if (events.length > MAX_EVENTS)
      blockers.push({
        kind: 'oversized-record',
        legacyId: input.campaignCode,
        detail: `Calendar exceeds ${MAX_EVENTS} events`,
      });
    const seen = new Set<string>();
    for (const event of events) {
      if (
        !record(event) ||
        typeof event.id !== 'string' ||
        event.id.length === 0
      ) {
        blockers.push({
          kind: 'invalid-event-id',
          legacyId: input.campaignCode,
          detail: 'Every event requires a stable non-empty ID',
        });
      } else if (seen.has(event.id)) {
        blockers.push({
          kind: 'duplicate-event-id',
          legacyId: input.campaignCode,
          detail: `Duplicate event ID ${event.id}`,
        });
      } else seen.add(event.id);
    }
    const payload = canonicalize({
      config: structuredClone(candidate.config),
      currentTime: candidate.currentTime,
      startTime: candidate.startTime,
      events,
      ...(candidate.weather === undefined
        ? {}
        : { weather: candidate.weather }),
    }) as CalendarPayload;
    const encoded = canonicalJson(payload);
    const byteCount = encoder.encode(encoded).byteLength;
    if (byteCount > MAX_RECORD_BYTES)
      blockers.push({
        kind: 'oversized-record',
        legacyId: input.campaignCode,
        detail: `Calendar exceeds ${MAX_RECORD_BYTES} UTF-8 bytes`,
      });
    records.push({
      legacyId: input.campaignCode,
      schemaVersion: 1,
      byteCount,
      payloadFingerprint: await sha256Bytes(encoded),
      payload,
      references: referencesFor(events, blockers, input.campaignCode),
    });
  }
  return finalize(input.campaignCode, records, blockers, [rawCandidate]);
}

export async function buildCalendarWorkingCopyManifest(input: {
  source: CalendarManifest;
  payload: CalendarPayload;
  schemaVersion: number;
}): Promise<CalendarManifest> {
  if (
    input.source.format !== 'rollkeeper-calendar-manifest' ||
    input.source.version !== 1 ||
    input.source.family !== 'calendar' ||
    input.source.blockers.length > 0 ||
    input.source.records.length !== 1 ||
    input.schemaVersion !== 1
  )
    throw new Error('A validated calendar source manifest is required');
  const payload = canonicalize(input.payload) as CalendarPayload;
  const encoded = canonicalJson(payload);
  const blockers: CalendarManifestBlocker[] = [];
  const references = referencesFor(
    payload.events,
    blockers,
    input.source.campaignCode
  );
  if (blockers.length > 0)
    throw new Error('The calendar working copy contains unresolved references');
  return finalize(
    input.source.campaignCode,
    [
      {
        legacyId: input.source.records[0].legacyId,
        schemaVersion: 1,
        byteCount: encoder.encode(encoded).byteLength,
        payloadFingerprint: await sha256Bytes(encoded),
        payload,
        references,
      },
    ],
    [],
    structuredClone(input.source.rawCandidates)
  );
}

async function finalize(
  campaignCode: string,
  records: CalendarManifestRecord[],
  blockers: CalendarManifestBlocker[],
  rawCandidates: CalendarManifest['rawCandidates']
): Promise<CalendarManifest> {
  const sortedRecords = [...records].sort((a, b) =>
    a.legacyId.localeCompare(b.legacyId)
  );
  const sortedBlockers = [...blockers].sort((a, b) =>
    canonicalJson(a).localeCompare(canonicalJson(b))
  );
  const summary = {
    format: 'rollkeeper-calendar-manifest' as const,
    version: 1 as const,
    family: 'calendar' as const,
    campaignCode,
    records: sortedRecords.map(
      ({
        legacyId,
        schemaVersion,
        byteCount,
        payloadFingerprint,
        references,
      }) => ({
        legacyId,
        schemaVersion,
        byteCount,
        payloadFingerprint,
        references,
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

function safeText(value: string) {
  return value.replace(/<[^>]*>/gu, '').slice(0, 20_000);
}

export function projectCalendarForLegacyPlayers(payload: CalendarPayload) {
  return {
    codecVersion: 1 as const,
    config: structuredClone(payload.config),
    currentTime: payload.currentTime,
    startTime: payload.startTime,
    ...(payload.weather ? { weather: payload.weather } : {}),
    events: payload.events
      .filter(
        event =>
          event.visibility === 'public' || event.visibility === 'discovered'
      )
      .map(event => ({
        id: event.id,
        title: safeText(event.title),
        description: safeText(event.description),
        year: event.year,
        month: event.month,
        day: event.day,
        visibility: event.visibility as 'public' | 'discovered',
        ...(event.color ? { color: event.color } : {}),
        ...(event.emoji ? { emoji: event.emoji } : {}),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
}

export function calendarPayloadFromCampaignCalendar(
  calendar: CampaignCalendar
): CalendarPayload {
  const { campaignCode, ...payload } = calendar;
  void campaignCode;
  return structuredClone(payload);
}

export function fingerprintCalendarPayload(payload: CalendarPayload) {
  return sha256Bytes(canonicalJson(payload));
}

export function fingerprintCalendarTombstone(legacyId: string) {
  return sha256Bytes(canonicalJson({ legacyId, tombstoned: true }));
}
