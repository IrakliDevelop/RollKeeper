export const TABLE_SCHEMA_VERSION = 1 as const;

export interface TableLimits {
  maxScenes: number;
  maxMembersPerScene: number;
  maxActors: number;
  maxEncounterRuns: number;
  maxCombatArchives: number;
  maxOperations: number;
  maxMetadataRecordBytes: number;
  maxCanvasCheckpointBytes: number;
  maxCombatArchiveBytes: number;
  maxWorkspaceBytes: number;
}

export const TABLE_LIMITS: Readonly<TableLimits> = {
  maxScenes: 100,
  maxMembersPerScene: 500,
  maxActors: 2_000,
  maxEncounterRuns: 1_000,
  maxCombatArchives: 100,
  maxOperations: 256,
  maxMetadataRecordBytes: 1_048_576,
  maxCanvasCheckpointBytes: 20_971_520,
  // The existing combat-log family has the stricter per-archive admission cap.
  maxCombatArchiveBytes: 262_144,
  maxWorkspaceBytes: 104_857_600,
};

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;
export type JsonObject = { [key: string]: JsonValue };

export interface TableSourceMappingV1 {
  sourceCampaignId: string;
  sourceMapId: string;
  sceneId: string;
}

export interface TableCampaignRecordV1 {
  schemaVersion: 1;
  workspaceKey: string;
  namespaceKey: string;
  localWorkspaceId: string;
  sourceCampaignCode: string | null;
  /** Explicit campaign route under which this local workspace may be opened. */
  routeCampaignCode?: string | null;
  revision: number;
  selectedRunId: string | null;
  activeRunId: string | null;
  sourceMappings: TableSourceMappingV1[];
  adoptionVersion: 1;
}

export interface TableCanvasCheckpointV1 {
  protocolVersion: 1;
  generation: string;
  revision: number;
  capturedAt: string;
  state: JsonObject;
}

/**
 * Explicit control assignment for a scene member (PR02). Absent means the
 * control is derived from the actor (player reference vs DM-managed).
 */
export type TableMemberControlV1 =
  | { kind: 'player'; legacyPlayerId: string; characterId?: string }
  | { kind: 'dm' };

export interface TableSceneMemberV1 {
  actorId: string;
  /** Explicit DM token bindings; legacy aliases are derived, never stored. */
  tokenIds: string[];
  /** Stable local binding key, allocated once and never reused (R2). Not an auth principal. */
  sceneMemberId?: string;
  control?: TableMemberControlV1;
  /** Membership tombstone; the actor and its other scenes are untouched. */
  removedAt?: string;
}

export interface TableSceneRecordV1 {
  schemaVersion: 1;
  workspaceKey: string;
  sceneId: string;
  originalMapId: string | null;
  map: {
    name: string;
    mapImageUrl: string;
    mapImageSize: { w: number; h: number };
    gridEnabled: boolean;
    gridSettings: JsonObject | null;
    markers: JsonObject[];
    dmOnlyElements: Record<string, boolean>;
    cameraViews?: JsonObject[];
    fogAppearance?: JsonValue;
  };
  canvasCheckpoint: TableCanvasCheckpointV1 | null;
  localDraft?: TableCanvasCheckpointV1 | null;
  members: TableSceneMemberV1[];
  arrivalPoint: { x: number; y: number } | null;
  createdAt: string;
  updatedAt: string;
}

export interface TableActorLiveStatsV1 {
  name: string;
  currentHp: number;
  maxHp: number;
  tempHp: number;
  armorClass: number;
  conditions: JsonObject[];
}

export interface TablePlayerReferenceV1 {
  campaignId: string;
  playerId: string;
  /** Server-authorized campaign player identity used as the relay principal. */
  legacyPlayerId?: string;
  /** Verified character mapping when it differs from the legacy player id. */
  characterId?: string;
}

/** Display/source metadata for DM-managed actors created in Table (PR02). */
export interface TableActorProfileV1 {
  category: 'pc' | 'npc' | 'monster';
  sourceKind?: 'bestiary' | 'campaign-npc' | 'manual';
  sourceId?: string;
  avatarUrl?: string;
  tokenCells?: number;
  walkFeet?: number;
}

export interface TablePlayerConditionOverlayV1 {
  suppressedSourceConditionIds: string[];
  dmConditions: JsonObject[];
}

export interface TableActorRecordV1 {
  schemaVersion: 1;
  workspaceKey: string;
  actorId: string;
  actorKind: 'dm-managed' | 'player-reference';
  liveStats: TableActorLiveStatsV1 | null;
  playerReference: TablePlayerReferenceV1 | null;
  cachedPlayerData: JsonObject | null;
  playerConditionOverlay: TablePlayerConditionOverlayV1 | null;
  profile?: TableActorProfileV1;
  createdAt: string;
  updatedAt: string;
}

export interface TableTurnResourcesV1 {
  reactionAvailable: boolean;
  legendaryActionsUsed: number;
  resources?: Record<string, number>;
}

export interface TableEncounterParticipantV1 {
  actorId: string;
  initiative: number | null;
  turnResources: TableTurnResourcesV1;
  /** PR03: masked in the player-facing initiative (absent ≡ visible). */
  hidden?: true;
}

/** PR03: pending remote publication intent for one combat generation. */
export interface TableRunPublicationV1 {
  intent: 'publish' | 'end';
  combatGeneration: number;
  acknowledged: boolean;
}

export interface TableEncounterRecordV1 {
  schemaVersion: 1;
  workspaceKey: string;
  runId: string;
  sceneId: string;
  sourceEncounterId: string | null;
  runGeneration: string;
  participants: TableEncounterParticipantV1[];
  round: number;
  currentActorId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  /** PR03: DM-facing run label (1–200 Unicode characters). */
  label?: string;
  /**
   * PR03: integer combat generation (absent ≡ 0). `runGeneration` keeps its
   * PR01 meaning (immutable run instance id); each start increments this.
   */
  combatGeneration?: number;
  publication?: TableRunPublicationV1;
}

export interface TableLogRecordV1 {
  schemaVersion: 1;
  workspaceKey: string;
  archiveId: string;
  runId: string;
  events: JsonObject[];
  startedAt: string;
  endedAt: string | null;
  /** PR03 scene-run archive metadata (`archiveId = ${runId}:${generation}`). */
  sceneId?: string;
  combatGeneration?: number;
  /** PR03: an append would exceed the archive cap; combat continued. */
  loggingPaused?: true;
}

export interface TableOperationRecordV1 {
  schemaVersion: 1;
  workspaceKey: string;
  operationId: string;
  commandDigest: string;
  expectedRevision: number;
  committedRevision: number;
  result: TableCommittedResult;
  createdAt: string;
}

export interface TableSourceRecordV1 {
  schemaVersion: 1;
  workspaceKey: string;
  sourceKey: string;
  sourceKind: 'campaign' | 'map' | 'encounter';
  sourceId: string;
  rawJson: string;
  sha256: string;
  byteCount: number;
  capturedAt: string;
}

export type TableTombstoneKind = 'scene' | 'actor' | 'encounter' | 'log';

export interface TableTombstoneRecordV1 {
  schemaVersion: 1;
  workspaceKey: string;
  kind: TableTombstoneKind;
  id: string;
  deletedAt: string;
}

export interface TableRuntimeCommandV1 {
  type: 'runtime.commit';
  campaign: {
    selectedRunId: string | null;
    activeRunId: string | null;
  };
  actors: { put: TableActorRecordV1[]; delete: string[] };
  encounters: { put: TableEncounterRecordV1[]; delete: string[] };
  logs: { put: TableLogRecordV1[]; delete: string[] };
}

export interface TableRuntimeCommandResultV1 {
  actorIds: string[];
  runIds: string[];
  archiveIds: string[];
  deletedActorIds: string[];
  deletedRunIds: string[];
  deletedArchiveIds: string[];
}

export interface TableCommittedResult {
  status: 'committed';
  revision: number;
  result: TableRuntimeCommandResultV1;
}

export type TableCommitResult =
  | TableCommittedResult
  | { status: 'conflict'; actualRevision: number }
  | {
      status: 'rejected';
      reason:
        | 'invalid-command'
        | 'operation-digest-mismatch'
        | 'unknown-schema'
        | 'limit-exceeded'
        | 'invalid-reference';
      detail?: string;
    }
  | {
      status: 'failed';
      reason: 'indexeddb-unavailable' | 'quota-exceeded' | 'transaction-failed';
    };

export interface TableWorkspaceSnapshotV1 {
  workspaceKey: string;
  campaign: TableCampaignRecordV1 | null;
  scenes: TableSceneRecordV1[];
  actors: TableActorRecordV1[];
  encounters: TableEncounterRecordV1[];
  logs: TableLogRecordV1[];
  sources: TableSourceRecordV1[];
  tombstones: TableTombstoneRecordV1[];
  operations?: TableOperationRecordV1[];
}

export type TableValidation =
  | { ok: true }
  | {
      ok: false;
      reason: string;
      detail?: string;
    };

const encoder = new TextEncoder();
const MAX_ID_BYTES = 255;
const MAX_WORKSPACE_KEY_BYTES = 1_024;
const SHA_256 = /^[a-f0-9]{64}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = []
): boolean {
  const allowed = new Set([...required, ...optional]);
  return (
    required.every(key => Object.hasOwn(value, key)) &&
    Object.keys(value).every(key => allowed.has(key))
  );
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isStableId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    encoder.encode(value).byteLength <= MAX_ID_BYTES
  );
}

function isWorkspaceKey(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    encoder.encode(value).byteLength <= MAX_WORKSPACE_KEY_BYTES
  );
}

function isNullableStableId(value: unknown): value is string | null {
  return value === null || isStableId(value);
}

function isTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    !Number.isNaN(Date.parse(value))
  );
}

function isMapImageReference(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    !value.trimStart().toLowerCase().startsWith('data:')
  );
}

function isJsonValue(value: unknown, depth = 0): value is JsonValue {
  if (depth > 64) return false;
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return true;
  }
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) {
    return value.every(entry => isJsonValue(entry, depth + 1));
  }
  if (!isRecord(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Object.values(value).every(entry => isJsonValue(entry, depth + 1));
}

function canonicalize(value: unknown): JsonValue {
  if (!isJsonValue(value)) {
    throw new TypeError('Value must be finite, JSON-compatible data');
  }
  if (Array.isArray(value)) return value.map(entry => canonicalize(entry));
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map(key => [key, canonicalize(value[key])])
  );
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function serializedByteCount(value: unknown): number {
  return encoder.encode(canonicalJson(value)).byteLength;
}

export async function commandDigest(
  command: TableRuntimeCommandV1
): Promise<string> {
  const bytes = encoder.encode(canonicalJson(command));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

function freezeInPlace(value: unknown): void {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value))
    return;
  for (const nested of Object.values(value)) freezeInPlace(nested);
  Object.freeze(value);
}

export function deepFreezeSnapshot<T>(value: T): Readonly<T> {
  const copy = structuredClone(value);
  freezeInPlace(copy);
  return copy;
}

export function validateCampaignRecord(value: unknown): TableValidation {
  if (!isRecord(value)) return { ok: false, reason: 'invalid-record' };
  if (value.schemaVersion !== 1) {
    return { ok: false, reason: 'unsupported-schema' };
  }
  if (
    !hasExactKeys(
      value,
      [
        'schemaVersion',
        'workspaceKey',
        'namespaceKey',
        'localWorkspaceId',
        'sourceCampaignCode',
        'revision',
        'selectedRunId',
        'activeRunId',
        'sourceMappings',
        'adoptionVersion',
      ],
      ['routeCampaignCode']
    ) ||
    !isWorkspaceKey(value.workspaceKey) ||
    !isWorkspaceKey(value.namespaceKey) ||
    !isStableId(value.localWorkspaceId) ||
    !isNullableStableId(value.sourceCampaignCode) ||
    (value.routeCampaignCode !== undefined &&
      !isNullableStableId(value.routeCampaignCode)) ||
    !isSafeNonNegativeInteger(value.revision) ||
    !isNullableStableId(value.selectedRunId) ||
    !isNullableStableId(value.activeRunId) ||
    value.adoptionVersion !== 1 ||
    !Array.isArray(value.sourceMappings) ||
    !value.sourceMappings.every(
      mapping =>
        isRecord(mapping) &&
        hasExactKeys(mapping, ['sourceCampaignId', 'sourceMapId', 'sceneId']) &&
        isStableId(mapping.sourceCampaignId) &&
        isStableId(mapping.sourceMapId) &&
        isStableId(mapping.sceneId)
    )
  ) {
    return { ok: false, reason: 'invalid-record' };
  }
  return { ok: true };
}

export function validateSceneRecord(value: unknown): TableValidation {
  if (!isRecord(value)) return { ok: false, reason: 'invalid-record' };
  if (value.schemaVersion !== 1) {
    return { ok: false, reason: 'unsupported-schema' };
  }
  if (
    !hasExactKeys(
      value,
      [
        'schemaVersion',
        'workspaceKey',
        'sceneId',
        'originalMapId',
        'map',
        'canvasCheckpoint',
        'members',
        'arrivalPoint',
        'createdAt',
        'updatedAt',
      ],
      ['localDraft']
    ) ||
    !isWorkspaceKey(value.workspaceKey) ||
    !isStableId(value.sceneId) ||
    !isNullableStableId(value.originalMapId) ||
    !isTimestamp(value.createdAt) ||
    !isTimestamp(value.updatedAt) ||
    !isRecord(value.map) ||
    !hasExactKeys(
      value.map,
      [
        'name',
        'mapImageUrl',
        'mapImageSize',
        'gridEnabled',
        'gridSettings',
        'markers',
        'dmOnlyElements',
      ],
      ['cameraViews', 'fogAppearance']
    ) ||
    typeof value.map.name !== 'string' ||
    !isMapImageReference(value.map.mapImageUrl) ||
    !isRecord(value.map.mapImageSize) ||
    !hasExactKeys(value.map.mapImageSize, ['w', 'h']) ||
    !isFiniteNumber(value.map.mapImageSize.w) ||
    !isFiniteNumber(value.map.mapImageSize.h) ||
    typeof value.map.gridEnabled !== 'boolean' ||
    (value.map.gridSettings !== null &&
      (!isRecord(value.map.gridSettings) ||
        !isJsonValue(value.map.gridSettings))) ||
    !Array.isArray(value.map.markers) ||
    !value.map.markers.every(
      marker => isRecord(marker) && isJsonValue(marker)
    ) ||
    !isRecord(value.map.dmOnlyElements) ||
    !Object.values(value.map.dmOnlyElements).every(
      entry => typeof entry === 'boolean'
    ) ||
    (value.map.cameraViews !== undefined &&
      (!Array.isArray(value.map.cameraViews) ||
        !value.map.cameraViews.every(
          view => isRecord(view) && isJsonValue(view)
        ))) ||
    (value.map.fogAppearance !== undefined &&
      !isJsonValue(value.map.fogAppearance)) ||
    !Array.isArray(value.members) ||
    !value.members.every(validateSceneMember) ||
    !sceneMembersAreUnique(value.members as TableSceneMemberV1[]) ||
    (value.arrivalPoint !== null &&
      (!isRecord(value.arrivalPoint) ||
        !hasExactKeys(value.arrivalPoint, ['x', 'y']) ||
        !isFiniteNumber(value.arrivalPoint.x) ||
        !isFiniteNumber(value.arrivalPoint.y)))
  ) {
    return { ok: false, reason: 'invalid-record' };
  }
  if (value.canvasCheckpoint !== null) {
    const checkpoint = value.canvasCheckpoint;
    if (
      !isRecord(checkpoint) ||
      !hasExactKeys(checkpoint, [
        'protocolVersion',
        'generation',
        'revision',
        'capturedAt',
        'state',
      ]) ||
      checkpoint.protocolVersion !== 1 ||
      !isStableId(checkpoint.generation) ||
      !isSafeNonNegativeInteger(checkpoint.revision) ||
      !isTimestamp(checkpoint.capturedAt) ||
      !isJsonValue(checkpoint.state) ||
      Array.isArray(checkpoint.state) ||
      checkpoint.state === null
    ) {
      return { ok: false, reason: 'invalid-record' };
    }
  }
  if (value.localDraft !== undefined && value.localDraft !== null) {
    const draft = value.localDraft;
    if (
      !isRecord(draft) ||
      !hasExactKeys(draft, [
        'protocolVersion',
        'generation',
        'revision',
        'capturedAt',
        'state',
      ]) ||
      draft.protocolVersion !== 1 ||
      !isStableId(draft.generation) ||
      !isSafeNonNegativeInteger(draft.revision) ||
      !isTimestamp(draft.capturedAt) ||
      !isRecord(draft.state) ||
      !isJsonValue(draft.state)
    ) {
      return { ok: false, reason: 'invalid-record' };
    }
  }
  return { ok: true };
}

function validateMemberControl(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value.kind === 'dm') return hasExactKeys(value, ['kind']);
  return (
    value.kind === 'player' &&
    hasExactKeys(value, ['kind', 'legacyPlayerId'], ['characterId']) &&
    isStableId(value.legacyPlayerId) &&
    (value.characterId === undefined || isStableId(value.characterId))
  );
}

function validateSceneMember(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasExactKeys(
      value,
      ['actorId', 'tokenIds'],
      ['sceneMemberId', 'control', 'removedAt']
    ) &&
    isStableId(value.actorId) &&
    Array.isArray(value.tokenIds) &&
    value.tokenIds.every(isStableId) &&
    (value.sceneMemberId === undefined || isStableId(value.sceneMemberId)) &&
    (value.control === undefined || validateMemberControl(value.control)) &&
    (value.removedAt === undefined || isTimestamp(value.removedAt))
  );
}

/** One member per actor, unique binding keys, and one owner per token id. */
function sceneMembersAreUnique(members: TableSceneMemberV1[]): boolean {
  const memberIds = members.flatMap(member =>
    member.sceneMemberId === undefined ? [] : [member.sceneMemberId]
  );
  return (
    unique(members.map(member => member.actorId)) &&
    unique(memberIds) &&
    unique(members.flatMap(member => member.tokenIds))
  );
}

function validateActorProfile(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasExactKeys(
      value,
      ['category'],
      ['sourceKind', 'sourceId', 'avatarUrl', 'tokenCells', 'walkFeet']
    ) &&
    ['pc', 'npc', 'monster'].includes(String(value.category)) &&
    (value.sourceKind === undefined ||
      ['bestiary', 'campaign-npc', 'manual'].includes(
        String(value.sourceKind)
      )) &&
    (value.sourceId === undefined || isStableId(value.sourceId)) &&
    (value.avatarUrl === undefined ||
      (isMapImageReference(value.avatarUrl) &&
        encoder.encode(value.avatarUrl).byteLength <= 2_048)) &&
    (value.tokenCells === undefined ||
      (Number.isSafeInteger(value.tokenCells) &&
        Number(value.tokenCells) >= 1 &&
        Number(value.tokenCells) <= 4)) &&
    (value.walkFeet === undefined ||
      (isFiniteNumber(value.walkFeet) && value.walkFeet >= 0))
  );
}

export function validateActorRecord(value: unknown): TableValidation {
  if (!isRecord(value)) return { ok: false, reason: 'invalid-record' };
  if (value.schemaVersion !== 1) {
    return { ok: false, reason: 'unsupported-schema' };
  }
  if (
    !hasExactKeys(
      value,
      [
        'schemaVersion',
        'workspaceKey',
        'actorId',
        'actorKind',
        'liveStats',
        'playerReference',
        'cachedPlayerData',
        'playerConditionOverlay',
        'createdAt',
        'updatedAt',
      ],
      ['profile']
    ) ||
    (value.profile !== undefined && !validateActorProfile(value.profile)) ||
    !isWorkspaceKey(value.workspaceKey) ||
    !isStableId(value.actorId) ||
    !['dm-managed', 'player-reference'].includes(String(value.actorKind)) ||
    !isTimestamp(value.createdAt) ||
    !isTimestamp(value.updatedAt)
  ) {
    return { ok: false, reason: 'invalid-record' };
  }
  const liveStatsValid =
    value.liveStats === null ||
    (isRecord(value.liveStats) &&
      hasExactKeys(value.liveStats, [
        'name',
        'currentHp',
        'maxHp',
        'tempHp',
        'armorClass',
        'conditions',
      ]) &&
      typeof value.liveStats.name === 'string' &&
      isFiniteNumber(value.liveStats.currentHp) &&
      isFiniteNumber(value.liveStats.maxHp) &&
      isFiniteNumber(value.liveStats.tempHp) &&
      isFiniteNumber(value.liveStats.armorClass) &&
      Array.isArray(value.liveStats.conditions) &&
      value.liveStats.conditions.every(
        condition => isRecord(condition) && isJsonValue(condition)
      ));
  const playerReferenceValid =
    value.playerReference === null ||
    (isRecord(value.playerReference) &&
      hasExactKeys(
        value.playerReference,
        ['campaignId', 'playerId'],
        ['legacyPlayerId', 'characterId']
      ) &&
      isStableId(value.playerReference.campaignId) &&
      isStableId(value.playerReference.playerId) &&
      (value.playerReference.legacyPlayerId === undefined ||
        isStableId(value.playerReference.legacyPlayerId)) &&
      (value.playerReference.characterId === undefined ||
        isStableId(value.playerReference.characterId)));
  const playerConditionOverlayValid =
    value.playerConditionOverlay === null ||
    (isRecord(value.playerConditionOverlay) &&
      hasExactKeys(value.playerConditionOverlay, [
        'suppressedSourceConditionIds',
        'dmConditions',
      ]) &&
      Array.isArray(
        value.playerConditionOverlay.suppressedSourceConditionIds
      ) &&
      value.playerConditionOverlay.suppressedSourceConditionIds.every(
        isStableId
      ) &&
      unique(value.playerConditionOverlay.suppressedSourceConditionIds) &&
      Array.isArray(value.playerConditionOverlay.dmConditions) &&
      value.playerConditionOverlay.dmConditions.every(
        condition => isRecord(condition) && isJsonValue(condition)
      ));
  if (
    !liveStatsValid ||
    !playerReferenceValid ||
    !playerConditionOverlayValid ||
    (value.cachedPlayerData !== null &&
      (!isRecord(value.cachedPlayerData) ||
        !isJsonValue(value.cachedPlayerData))) ||
    (value.actorKind === 'dm-managed' &&
      (value.liveStats === null ||
        value.playerReference !== null ||
        value.playerConditionOverlay !== null)) ||
    (value.actorKind === 'player-reference' &&
      (value.playerReference === null ||
        value.liveStats !== null ||
        value.playerConditionOverlay === null))
  ) {
    return { ok: false, reason: 'invalid-record' };
  }
  return { ok: true };
}

export function validateEncounterRecord(value: unknown): TableValidation {
  if (!isRecord(value)) return { ok: false, reason: 'invalid-record' };
  if (value.schemaVersion !== 1) {
    return { ok: false, reason: 'unsupported-schema' };
  }
  if (
    !hasExactKeys(
      value,
      [
        'schemaVersion',
        'workspaceKey',
        'runId',
        'sceneId',
        'sourceEncounterId',
        'runGeneration',
        'participants',
        'round',
        'currentActorId',
        'isActive',
        'createdAt',
        'updatedAt',
      ],
      ['label', 'combatGeneration', 'publication']
    ) ||
    (value.label !== undefined && !isRunLabel(value.label)) ||
    (value.combatGeneration !== undefined &&
      !isSafeNonNegativeInteger(value.combatGeneration)) ||
    (value.publication !== undefined &&
      !validRunPublication(value.publication)) ||
    !isWorkspaceKey(value.workspaceKey) ||
    !isStableId(value.runId) ||
    !isStableId(value.sceneId) ||
    !isNullableStableId(value.sourceEncounterId) ||
    !isStableId(value.runGeneration) ||
    !Array.isArray(value.participants) ||
    !value.participants.every(validateParticipant) ||
    !unique(
      value.participants.map(participant =>
        isRecord(participant) && typeof participant.actorId === 'string'
          ? participant.actorId
          : ''
      )
    ) ||
    !isSafeNonNegativeInteger(value.round) ||
    !isNullableStableId(value.currentActorId) ||
    typeof value.isActive !== 'boolean' ||
    !isTimestamp(value.createdAt) ||
    !isTimestamp(value.updatedAt)
  ) {
    return { ok: false, reason: 'invalid-record' };
  }
  return { ok: true };
}

/** Run labels are 1–200 Unicode characters (code points). */
export function isRunLabel(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const length = [...value].length;
  return length >= 1 && length <= 200;
}

function validRunPublication(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['intent', 'combatGeneration', 'acknowledged']) &&
    (value.intent === 'publish' || value.intent === 'end') &&
    isSafeNonNegativeInteger(value.combatGeneration) &&
    typeof value.acknowledged === 'boolean'
  );
}

function validateParticipant(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !hasExactKeys(
      value,
      ['actorId', 'initiative', 'turnResources'],
      ['hidden']
    ) ||
    (value.hidden !== undefined && value.hidden !== true) ||
    !isStableId(value.actorId) ||
    (value.initiative !== null && !isFiniteNumber(value.initiative)) ||
    !isRecord(value.turnResources) ||
    !hasExactKeys(
      value.turnResources,
      ['reactionAvailable', 'legendaryActionsUsed'],
      ['resources']
    ) ||
    typeof value.turnResources.reactionAvailable !== 'boolean' ||
    !isSafeNonNegativeInteger(value.turnResources.legendaryActionsUsed)
  ) {
    return false;
  }
  const resources = value.turnResources.resources;
  return (
    resources === undefined ||
    (isRecord(resources) &&
      Object.values(resources).every(isSafeNonNegativeInteger))
  );
}

export function validateLogRecord(value: unknown): TableValidation {
  if (!isRecord(value)) return { ok: false, reason: 'invalid-record' };
  if (value.schemaVersion !== 1) {
    return { ok: false, reason: 'unsupported-schema' };
  }
  if (
    !hasExactKeys(
      value,
      [
        'schemaVersion',
        'workspaceKey',
        'archiveId',
        'runId',
        'events',
        'startedAt',
        'endedAt',
      ],
      ['sceneId', 'combatGeneration', 'loggingPaused']
    ) ||
    (value.sceneId !== undefined && !isStableId(value.sceneId)) ||
    (value.combatGeneration !== undefined &&
      !isSafeNonNegativeInteger(value.combatGeneration)) ||
    (value.loggingPaused !== undefined && value.loggingPaused !== true) ||
    !isWorkspaceKey(value.workspaceKey) ||
    !isStableId(value.archiveId) ||
    !isStableId(value.runId) ||
    !Array.isArray(value.events) ||
    !value.events.every(event => isJsonValue(event) && isRecord(event)) ||
    !isTimestamp(value.startedAt) ||
    (value.endedAt !== null && !isTimestamp(value.endedAt))
  ) {
    return { ok: false, reason: 'invalid-record' };
  }
  return { ok: true };
}

export function validateOperationRecord(value: unknown): TableValidation {
  if (!isRecord(value)) return { ok: false, reason: 'invalid-record' };
  if (value.schemaVersion !== 1) {
    return { ok: false, reason: 'unsupported-schema' };
  }
  if (
    !hasExactKeys(value, [
      'schemaVersion',
      'workspaceKey',
      'operationId',
      'commandDigest',
      'expectedRevision',
      'committedRevision',
      'result',
      'createdAt',
    ]) ||
    !isWorkspaceKey(value.workspaceKey) ||
    !isStableId(value.operationId) ||
    typeof value.commandDigest !== 'string' ||
    !SHA_256.test(value.commandDigest) ||
    !isSafeNonNegativeInteger(value.expectedRevision) ||
    !isSafeNonNegativeInteger(value.committedRevision) ||
    !isTimestamp(value.createdAt) ||
    !isCommittedResult(value.result) ||
    value.result.revision !== value.committedRevision
  ) {
    return { ok: false, reason: 'invalid-record' };
  }
  return { ok: true };
}

function isCommittedResult(value: unknown): value is TableCommittedResult {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['status', 'revision', 'result']) &&
    value.status === 'committed' &&
    isSafeNonNegativeInteger(value.revision) &&
    isRecord(value.result) &&
    hasExactKeys(value.result, [
      'actorIds',
      'runIds',
      'archiveIds',
      'deletedActorIds',
      'deletedRunIds',
      'deletedArchiveIds',
    ]) &&
    Object.values(value.result).every(
      entry => Array.isArray(entry) && entry.every(isStableId)
    )
  );
}

export function validateSourceRecord(value: unknown): TableValidation {
  if (!isRecord(value)) return { ok: false, reason: 'invalid-record' };
  if (value.schemaVersion !== 1) {
    return { ok: false, reason: 'unsupported-schema' };
  }
  if (
    !hasExactKeys(value, [
      'schemaVersion',
      'workspaceKey',
      'sourceKey',
      'sourceKind',
      'sourceId',
      'rawJson',
      'sha256',
      'byteCount',
      'capturedAt',
    ]) ||
    !isWorkspaceKey(value.workspaceKey) ||
    !isStableId(value.sourceKey) ||
    !['campaign', 'map', 'encounter'].includes(String(value.sourceKind)) ||
    !isStableId(value.sourceId) ||
    typeof value.rawJson !== 'string' ||
    typeof value.sha256 !== 'string' ||
    !SHA_256.test(value.sha256) ||
    !isSafeNonNegativeInteger(value.byteCount) ||
    encoder.encode(value.rawJson).byteLength !== value.byteCount ||
    !isTimestamp(value.capturedAt)
  ) {
    return { ok: false, reason: 'invalid-record' };
  }
  return { ok: true };
}

export function validateTombstoneRecord(value: unknown): TableValidation {
  if (!isRecord(value)) return { ok: false, reason: 'invalid-record' };
  if (value.schemaVersion !== 1) {
    return { ok: false, reason: 'unsupported-schema' };
  }
  if (
    !hasExactKeys(value, [
      'schemaVersion',
      'workspaceKey',
      'kind',
      'id',
      'deletedAt',
    ]) ||
    !isWorkspaceKey(value.workspaceKey) ||
    !['scene', 'actor', 'encounter', 'log'].includes(String(value.kind)) ||
    !isStableId(value.id) ||
    !isTimestamp(value.deletedAt)
  ) {
    return { ok: false, reason: 'invalid-record' };
  }
  return { ok: true };
}

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

export function validateRuntimeCommand(value: unknown): TableValidation {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'type',
      'campaign',
      'actors',
      'encounters',
      'logs',
    ]) ||
    value.type !== 'runtime.commit' ||
    !isRecord(value.campaign) ||
    !hasExactKeys(value.campaign, ['selectedRunId', 'activeRunId']) ||
    !isNullableStableId(value.campaign.selectedRunId) ||
    !isNullableStableId(value.campaign.activeRunId)
  ) {
    return { ok: false, reason: 'invalid-command' };
  }
  const families = [
    [value.actors, validateActorRecord, 'actorId'],
    [value.encounters, validateEncounterRecord, 'runId'],
    [value.logs, validateLogRecord, 'archiveId'],
  ] as const;
  for (const [family, validator, idKey] of families) {
    if (
      !isRecord(family) ||
      !hasExactKeys(family, ['put', 'delete']) ||
      !Array.isArray(family.put) ||
      !Array.isArray(family.delete) ||
      !family.delete.every(isStableId) ||
      !family.put.every(entry => validator(entry).ok)
    ) {
      return { ok: false, reason: 'invalid-command' };
    }
    const putIds = family.put.map(
      entry => (entry as unknown as Record<string, string>)[idKey]
    );
    const deletedIds = family.delete as string[];
    if (
      !unique(putIds) ||
      !unique(deletedIds) ||
      putIds.some(id => deletedIds.includes(id))
    ) {
      return { ok: false, reason: 'invalid-command' };
    }
  }
  try {
    canonicalJson(value);
  } catch {
    return { ok: false, reason: 'invalid-command' };
  }
  return { ok: true };
}

export function validateWorkspaceLimits(
  snapshot: TableWorkspaceSnapshotV1,
  limits: Readonly<TableLimits> = TABLE_LIMITS
): TableValidation {
  const tombstonesByKind = (kind: TableTombstoneKind) =>
    snapshot.tombstones.filter(tombstone => tombstone.kind === kind).length;
  if (snapshot.scenes.length + tombstonesByKind('scene') > limits.maxScenes) {
    return { ok: false, reason: 'scene-count' };
  }
  if (snapshot.actors.length + tombstonesByKind('actor') > limits.maxActors) {
    return { ok: false, reason: 'actor-count' };
  }
  if (
    snapshot.encounters.length + tombstonesByKind('encounter') >
    limits.maxEncounterRuns
  ) {
    return { ok: false, reason: 'encounter-count' };
  }
  if (
    snapshot.logs.length + tombstonesByKind('log') >
    limits.maxCombatArchives
  ) {
    return { ok: false, reason: 'archive-count' };
  }
  if ((snapshot.operations?.length ?? 0) > limits.maxOperations) {
    return { ok: false, reason: 'operation-count' };
  }
  if (
    snapshot.scenes.some(
      scene => scene.members.length > limits.maxMembersPerScene
    )
  ) {
    return { ok: false, reason: 'scene-member-count' };
  }
  try {
    const metadataRecords: unknown[] = [
      ...(snapshot.campaign ? [snapshot.campaign] : []),
      ...snapshot.actors,
      ...snapshot.encounters,
      ...snapshot.tombstones,
      ...snapshot.scenes.map(scene => ({ ...scene, canvasCheckpoint: null })),
    ];
    if (
      metadataRecords.some(
        record => serializedByteCount(record) > limits.maxMetadataRecordBytes
      )
    ) {
      return { ok: false, reason: 'metadata-record-bytes' };
    }
    if (
      snapshot.scenes.some(
        scene =>
          scene.canvasCheckpoint !== null &&
          serializedByteCount(scene.canvasCheckpoint) >
            limits.maxCanvasCheckpointBytes
      )
    ) {
      return { ok: false, reason: 'canvas-checkpoint-bytes' };
    }
    if (
      snapshot.logs.some(
        log => serializedByteCount(log) > limits.maxCombatArchiveBytes
      )
    ) {
      return { ok: false, reason: 'archive-record-bytes' };
    }
    const allRecords: unknown[] = [
      ...(snapshot.campaign ? [snapshot.campaign] : []),
      ...snapshot.scenes,
      ...snapshot.actors,
      ...snapshot.encounters,
      ...snapshot.logs,
      ...snapshot.sources,
      ...snapshot.tombstones,
      ...(snapshot.operations ?? []),
    ];
    const total = allRecords.reduce<number>(
      (bytes, record) => bytes + serializedByteCount(record),
      0
    );
    if (total > limits.maxWorkspaceBytes) {
      return { ok: false, reason: 'workspace-bytes' };
    }
  } catch {
    return { ok: false, reason: 'invalid-json' };
  }
  return { ok: true };
}
