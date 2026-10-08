import type { BattleMap, MarkerDetail } from '@/types/battlemap';

import type { TableRepository } from './repository';
import type {
  JsonObject,
  TableActorRecordV1,
  TableEncounterRecordV1,
  TableSceneRecordV1,
  TableSourceRecordV1,
} from './schema';

export interface TableAdoptionSource {
  readCampaign(sourceCampaignId: string): Promise<string>;
  readMap(sourceCampaignId: string, sourceMapId: string): Promise<string>;
  readEncounter(
    sourceCampaignId: string,
    sourceEncounterId: string
  ): Promise<string>;
}

interface SourceCapture {
  kind: TableSourceRecordV1['sourceKind'];
  id: string;
  raw: string;
  sha256: string;
}

export interface TableAdoptionPreview {
  workspaceKey: string;
  sourceCampaignId: string;
  sourceMapId: string;
  scene: TableSceneRecordV1;
  actors: TableActorRecordV1[];
  encounters: TableEncounterRecordV1[];
  sources: SourceCapture[];
}

export type TableAdoptionResult =
  | {
      status: 'committed';
      revision: number;
      sceneId: string;
      runIds: string[];
    }
  | { status: 'source-changed'; changedSourceKeys: string[] }
  | Exclude<
      Awaited<ReturnType<TableRepository['mutateWorkspace']>>,
      { status: 'committed' }
    >;

export type TableSourceComparison =
  | { status: 'current' }
  | { status: 'source-changed'; changedSourceKeys: string[] }
  | { status: 'unavailable' };

const encoder = new TextEncoder();

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Source record must be a JSON object');
  }
  return value as Record<string, unknown>;
}

function parseObject(raw: string): Record<string, unknown> {
  return record(JSON.parse(raw) as unknown);
}

async function sha256(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(raw));
  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function jsonObject(value: unknown): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (structuredClone(value) as JsonObject)
    : null;
}

/**
 * The one DM-managed actor builder for legacy encounter entities, shared by
 * adoption (`idPrefix` = encounter id) and PR06 encounter copies (`idPrefix`
 * = the new run id, R3-F7).
 */
export function actorFromEntity(
  workspaceKey: string,
  idPrefix: string,
  value: unknown,
  now: string
): TableActorRecordV1 {
  const entity = record(value);
  const entityId = text(entity.id);
  if (!entityId) throw new Error('Encounter entity is missing its source id');
  return {
    schemaVersion: 1,
    workspaceKey,
    actorId: `${idPrefix}:${entityId}`,
    actorKind: 'dm-managed',
    liveStats: {
      name: text(entity.name, 'Unnamed actor'),
      currentHp: finite(entity.currentHp, finite(entity.hp, 0)),
      maxHp: finite(entity.maxHp, 0),
      tempHp: finite(entity.tempHp, 0),
      armorClass: finite(entity.armorClass, finite(entity.ac, 10)),
      conditions: Array.isArray(entity.conditions)
        ? entity.conditions
            .filter(
              item => item && typeof item === 'object' && !Array.isArray(item)
            )
            .map(item => structuredClone(item) as JsonObject)
        : [],
    },
    playerReference: null,
    cachedPlayerData: null,
    playerConditionOverlay: null,
    createdAt: now,
    updatedAt: now,
  };
}

function encounterRun(
  workspaceKey: string,
  sceneId: string,
  sourceEncounterId: string,
  source: Record<string, unknown>,
  actors: TableActorRecordV1[],
  runId: string,
  generation: string,
  now: string
): TableEncounterRecordV1 {
  const currentTurn = Number.isSafeInteger(source.currentTurn)
    ? Number(source.currentTurn)
    : -1;
  return {
    schemaVersion: 1,
    workspaceKey,
    runId,
    sceneId,
    sourceEncounterId,
    runGeneration: generation,
    participants: actors.map((actor, index) => {
      const entity = Array.isArray(source.entities)
        ? record(source.entities[index])
        : {};
      return {
        actorId: actor.actorId,
        initiative:
          typeof entity.initiative === 'number' &&
          Number.isFinite(entity.initiative)
            ? entity.initiative
            : null,
        turnResources: {
          reactionAvailable: true,
          legendaryActionsUsed: 0,
        },
      };
    }),
    round:
      Number.isSafeInteger(source.round) && Number(source.round) >= 0
        ? Number(source.round)
        : 0,
    currentActorId:
      currentTurn >= 0 && currentTurn < actors.length
        ? actors[currentTurn]!.actorId
        : null,
    isActive: source.isActive === true,
    createdAt: now,
    updatedAt: now,
  };
}

async function capture(
  source: TableAdoptionSource,
  sourceCampaignId: string,
  sourceMapId: string
): Promise<{ map: Record<string, unknown>; captures: SourceCapture[] }> {
  const campaignRaw = await source.readCampaign(sourceCampaignId);
  const mapRaw = await source.readMap(sourceCampaignId, sourceMapId);
  const map = parseObject(mapRaw);
  if (text(map.id) !== sourceMapId) throw new Error('Source map id changed');
  const encounterIds = Array.isArray(map.linkedEncounterIds)
    ? map.linkedEncounterIds.filter(
        (value): value is string =>
          typeof value === 'string' && value.length > 0
      )
    : [];
  const encounterRaws = await Promise.all(
    encounterIds.map(id => source.readEncounter(sourceCampaignId, id))
  );
  const values = [
    { kind: 'campaign' as const, id: sourceCampaignId, raw: campaignRaw },
    { kind: 'map' as const, id: sourceMapId, raw: mapRaw },
    ...encounterIds.map((id, index) => ({
      kind: 'encounter' as const,
      id,
      raw: encounterRaws[index]!,
    })),
  ];
  return {
    map,
    captures: await Promise.all(
      values.map(async value => ({ ...value, sha256: await sha256(value.raw) }))
    ),
  };
}

/** Captures immutable exact source bytes and builds a no-write preview. */
export async function captureAdoptionPreview(options: {
  source: TableAdoptionSource;
  workspaceKey: string;
  sourceCampaignId: string;
  sourceMapId: string;
  newId?: () => string;
  now?: () => string;
}): Promise<TableAdoptionPreview> {
  const { map, captures } = await capture(
    options.source,
    options.sourceCampaignId,
    options.sourceMapId
  );
  const newId = options.newId ?? (() => crypto.randomUUID());
  const now = (options.now ?? (() => new Date().toISOString()))();
  const sceneId = newId();
  // W9: a never-opened legacy map persists `canvasState: ''` (list page and
  // picker create it that way); its adoption checkpoint is an empty state.
  const canvasText = text(map.canvasState, '{}');
  const canvasRaw = canvasText.trim().length === 0 ? '{}' : canvasText;
  const canvasState = parseObject(canvasRaw);
  const mapSize = record(map.mapImageSize ?? {});
  const scene: TableSceneRecordV1 = {
    schemaVersion: 1,
    workspaceKey: options.workspaceKey,
    sceneId,
    originalMapId: options.sourceMapId,
    map: {
      name: text(map.name, 'Untitled scene'),
      mapImageUrl: text(map.mapImageUrl),
      mapImageSize: {
        w: finite(mapSize.w, 1024),
        h: finite(mapSize.h, 1024),
      },
      gridEnabled: map.gridEnabled === true,
      gridSettings: jsonObject(map.gridSettings),
      markers: Array.isArray(map.markers)
        ? map.markers
            .filter(
              item => item && typeof item === 'object' && !Array.isArray(item)
            )
            .map(item => structuredClone(item) as unknown as JsonObject)
        : [],
      dmOnlyElements:
        (jsonObject(map.dmOnlyElements) as Record<string, boolean> | null) ??
        {},
    },
    canvasCheckpoint: {
      protocolVersion: 1,
      generation: `adoption:${sceneId}`,
      revision: 0,
      capturedAt: now,
      state: canvasState as JsonObject,
    },
    members: [],
    arrivalPoint: null,
    createdAt: now,
    updatedAt: now,
  };

  const actors: TableActorRecordV1[] = [];
  const encounters: TableEncounterRecordV1[] = [];
  for (const sourceCapture of captures.filter(
    value => value.kind === 'encounter'
  )) {
    const sourceEncounter = parseObject(sourceCapture.raw);
    const runActors = Array.isArray(sourceEncounter.entities)
      ? sourceEncounter.entities.map(entity =>
          actorFromEntity(options.workspaceKey, sourceCapture.id, entity, now)
        )
      : [];
    const runId = newId();
    const generation = newId();
    actors.push(...runActors);
    encounters.push(
      encounterRun(
        options.workspaceKey,
        sceneId,
        sourceCapture.id,
        sourceEncounter,
        runActors,
        runId,
        generation,
        now
      )
    );
    scene.members.push(
      ...runActors.map(actor => ({ actorId: actor.actorId, tokenIds: [] }))
    );
  }
  return {
    workspaceKey: options.workspaceKey,
    sourceCampaignId: options.sourceCampaignId,
    sourceMapId: options.sourceMapId,
    scene,
    actors,
    encounters,
    sources: captures,
  };
}

/** Rechecks every byte immediately before the one IndexedDB commit. */
export async function adoptTableScene(options: {
  repository: TableRepository;
  source: TableAdoptionSource;
  preview: TableAdoptionPreview;
  expectedRevision: number;
  operationId: string;
}): Promise<TableAdoptionResult> {
  const recaptured = await capture(
    options.source,
    options.preview.sourceCampaignId,
    options.preview.sourceMapId
  );
  const current = new Map(
    recaptured.captures.map(value => [
      `${value.kind}:${value.id}`,
      value.sha256,
    ])
  );
  const changedSourceKeys = options.preview.sources
    .filter(value => current.get(`${value.kind}:${value.id}`) !== value.sha256)
    .map(value => `${value.kind}:${value.id}`);
  if (changedSourceKeys.length > 0) {
    return { status: 'source-changed', changedSourceKeys };
  }

  const sources: TableSourceRecordV1[] = options.preview.sources.map(value => ({
    schemaVersion: 1,
    workspaceKey: options.preview.workspaceKey,
    sourceKey: `${value.kind}:${value.id}`,
    sourceKind: value.kind,
    sourceId: value.id,
    rawJson: value.raw,
    sha256: value.sha256,
    byteCount: encoder.encode(value.raw).byteLength,
    capturedAt: options.preview.scene.createdAt,
  }));
  const existing = options.repository.getCurrent();
  const mappings =
    existing?.status === 'ready'
      ? (existing.snapshot.campaign?.sourceMappings ?? [])
      : [];
  const mapping = mappings.find(
    value =>
      value.sourceCampaignId === options.preview.sourceCampaignId &&
      value.sourceMapId === options.preview.sourceMapId
  );
  if (mapping && mapping.sceneId !== options.preview.scene.sceneId) {
    return {
      status: 'rejected',
      reason: 'invalid-reference',
      detail: 'Source map is already adopted by another scene',
    };
  }
  const outcome = await options.repository.mutateWorkspace(
    options.expectedRevision,
    options.operationId,
    {
      campaign: {
        sourceMappings: mapping
          ? [...mappings]
          : [
              ...mappings,
              {
                sourceCampaignId: options.preview.sourceCampaignId,
                sourceMapId: options.preview.sourceMapId,
                sceneId: options.preview.scene.sceneId,
              },
            ],
      },
      scenes: { put: [options.preview.scene] },
      actors: { put: options.preview.actors },
      encounters: { put: options.preview.encounters },
      sources: { put: sources },
    }
  );
  if (outcome.status !== 'committed') return outcome;
  return {
    status: 'committed',
    revision: outcome.revision,
    sceneId: options.preview.scene.sceneId,
    runIds: options.preview.encounters.map(value => value.runId),
  };
}

/** Rechecks an adopted scene against current persisted source bytes. */
export async function compareTableSceneSource(options: {
  repository: TableRepository;
  source: TableAdoptionSource;
  sceneId: string;
}): Promise<TableSourceComparison> {
  const current = options.repository.getCurrent();
  if (current?.status !== 'ready') return { status: 'unavailable' };
  const mapping = current.snapshot.campaign?.sourceMappings.find(
    value => value.sceneId === options.sceneId
  );
  if (!mapping) return { status: 'unavailable' };
  let recaptured: Awaited<ReturnType<typeof capture>>;
  try {
    recaptured = await capture(
      options.source,
      mapping.sourceCampaignId,
      mapping.sourceMapId
    );
  } catch {
    return { status: 'unavailable' };
  }
  const stored = new Map(
    current.snapshot.sources.map(value => [value.sourceKey, value.sha256])
  );
  const changedSourceKeys = recaptured.captures
    .filter(value => stored.get(`${value.kind}:${value.id}`) !== value.sha256)
    .map(value => `${value.kind}:${value.id}`);
  return changedSourceKeys.length
    ? { status: 'source-changed', changedSourceKeys }
    : { status: 'current' };
}

/** A source reader for the existing in-memory legacy stores, with no writers. */
export function createLegacyTableAdoptionSource(options: {
  campaign: (id: string) => unknown;
  map: (campaignId: string, mapId: string) => BattleMap | undefined;
  encounter: (campaignId: string, encounterId: string) => unknown;
}): TableAdoptionSource {
  const exact = (value: unknown, label: string): string => {
    if (value === undefined) throw new Error(`${label} source is unavailable`);
    return JSON.stringify(value);
  };
  return {
    readCampaign: async id => exact(options.campaign(id), 'Campaign'),
    readMap: async (campaignId, mapId) =>
      exact(options.map(campaignId, mapId), 'Map'),
    readEncounter: async (campaignId, encounterId) =>
      exact(options.encounter(campaignId, encounterId), 'Encounter'),
  };
}

interface JsonSliceNode {
  start: number;
  end: number;
  object?: Map<string, JsonSliceNode>;
  array?: JsonSliceNode[];
}

/**
 * Builds only the structural index needed to locate a record while retaining
 * byte-for-byte slices from the persisted Zustand envelope. JSON.parse alone
 * cannot be used here because it normalizes whitespace, key order and escapes.
 */
function indexJson(raw: string): JsonSliceNode {
  let offset = 0;
  const whitespace = () => {
    while (/\s/u.test(raw[offset] ?? '')) offset += 1;
  };
  const string = (): { value: string; start: number; end: number } => {
    const start = offset;
    if (raw[offset] !== '"') throw new Error('Invalid persisted JSON string');
    offset += 1;
    while (offset < raw.length) {
      if (raw[offset] === '\\') {
        offset += 2;
        continue;
      }
      if (raw[offset] === '"') {
        offset += 1;
        const end = offset;
        return {
          value: JSON.parse(raw.slice(start, end)) as string,
          start,
          end,
        };
      }
      offset += 1;
    }
    throw new Error('Unterminated persisted JSON string');
  };
  const node = (): JsonSliceNode => {
    whitespace();
    const start = offset;
    if (raw[offset] === '{') {
      offset += 1;
      const entries = new Map<string, JsonSliceNode>();
      whitespace();
      while (raw[offset] !== '}') {
        const key = string().value;
        whitespace();
        if (raw[offset] !== ':') throw new Error('Invalid persisted JSON');
        offset += 1;
        entries.set(key, node());
        whitespace();
        if (raw[offset] === ',') {
          offset += 1;
          whitespace();
        } else if (raw[offset] !== '}') {
          throw new Error('Invalid persisted JSON object');
        }
      }
      offset += 1;
      return { start, end: offset, object: entries };
    }
    if (raw[offset] === '[') {
      offset += 1;
      const entries: JsonSliceNode[] = [];
      whitespace();
      while (raw[offset] !== ']') {
        entries.push(node());
        whitespace();
        if (raw[offset] === ',') {
          offset += 1;
          whitespace();
        } else if (raw[offset] !== ']') {
          throw new Error('Invalid persisted JSON array');
        }
      }
      offset += 1;
      return { start, end: offset, array: entries };
    }
    if (raw[offset] === '"') {
      const parsed = string();
      return { start: parsed.start, end: parsed.end };
    }
    while (offset < raw.length && !/[\s,\]}]/u.test(raw[offset] ?? '')) {
      offset += 1;
    }
    if (offset === start) throw new Error('Invalid persisted JSON value');
    JSON.parse(raw.slice(start, offset));
    return { start, end: offset };
  };
  const root = node();
  whitespace();
  if (offset !== raw.length) throw new Error('Trailing persisted JSON');
  return root;
}

function child(node: JsonSliceNode | undefined, key: string): JsonSliceNode {
  const value = node?.object?.get(key);
  if (!value) throw new Error(`Persisted source path ${key} is unavailable`);
  return value;
}

function arrayRecord(
  raw: string,
  node: JsonSliceNode,
  key: string,
  id: string
): string {
  for (const entry of node.array ?? []) {
    const value = parseObject(raw.slice(entry.start, entry.end));
    if (text(value[key]) === id) return raw.slice(entry.start, entry.end);
  }
  throw new Error(`Persisted source ${id} is unavailable`);
}

export interface PersistedTableSourceStorage {
  getItem(key: string): string | null;
}

/** Reads source records directly from their persisted envelopes, pre-hydration. */
export function createPersistedLegacyTableAdoptionSource(options: {
  storage: PersistedTableSourceStorage;
}): TableAdoptionSource {
  const persisted = (key: string): { raw: string; root: JsonSliceNode } => {
    const raw = options.storage.getItem(key);
    if (raw === null) throw new Error(`${key} source is unavailable`);
    return { raw, root: indexJson(raw) };
  };
  return {
    readCampaign: async id => {
      const { raw, root } = persisted('rollkeeper-dm-data');
      return arrayRecord(
        raw,
        child(child(root, 'state'), 'campaigns'),
        'code',
        id
      );
    },
    readMap: async (campaignId, mapId) => {
      const { raw, root } = persisted('rollkeeper-battlemap-data');
      const maps = child(
        child(child(child(root, 'state'), 'battleMaps'), campaignId),
        mapId
      );
      return raw.slice(maps.start, maps.end);
    },
    readEncounter: async (_campaignId, encounterId) => {
      const { raw, root } = persisted('rollkeeper-encounter-data');
      return arrayRecord(
        raw,
        child(child(root, 'state'), 'encounters'),
        'id',
        encounterId
      );
    },
  };
}

export type { MarkerDetail };
