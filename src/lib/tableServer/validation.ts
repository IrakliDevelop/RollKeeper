import type { SharedInitiativeState } from '@/types/sharedState';

export const TABLE_REQUEST_LIMIT = 16 * 1024;
const ID = /^[a-zA-Z0-9_-]{1,128}$/u;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

interface BaseCommand {
  operationId: string;
  expectedEpoch: string;
  expectedRevision: number;
  expectedFence: number;
  holderSessionId: string;
}

export type TableCommand =
  | { type: 'initialize'; operationId: string }
  | (BaseCommand & { type: 'acquire' | 'renew' | 'takeover' })
  | (BaseCommand & {
      type: 'registerScene' | 'updateScene';
      sceneId: string;
      workspaceInstanceId: string;
      sourceMapId: string | null;
      contentRevision: number;
      safeLabel: string;
      expectedRegistryRevision: number;
    })
  | (BaseCommand & {
      type: 'tombstoneScene';
      sceneId: string;
      expectedRegistryRevision: number;
    })
  | (BaseCommand & {
      type: 'adoptScene';
      sceneId: string;
      workspaceInstanceId: string;
      expectedRegistryRevision: number;
    })
  | (BaseCommand & { type: 'show'; sceneId: string })
  | (BaseCommand & { type: 'blank' | 'unpresent' })
  /** Fenced: conflicts `presentation-changed` unless this scene is presented. */
  | (BaseCommand & { type: 'deletePresented'; expectedSceneId: string })
  | (BaseCommand & {
      type: 'publishInitiative';
      initiative: SharedInitiativeState;
      runId: string;
    })
  | (BaseCommand & {
      type: 'publishInitiativeRequest';
      request: {
        requestId: string;
        encounterId: string;
        encounterName: string;
        requestedAt: number;
      } | null;
    })
  | (BaseCommand & { type: 'endInitiative' });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isId = (value: unknown): value is string =>
  typeof value === 'string' && ID.test(value);
const isRevision = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const onlyKeys = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).every(key => keys.includes(key));
const finiteNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value);

const BASE_KEYS = [
  'type',
  'operationId',
  'expectedEpoch',
  'expectedRevision',
  'expectedFence',
  'holderSessionId',
] as const;
const BASE_ONLY_TYPES: readonly string[] = [
  'acquire',
  'renew',
  'takeover',
  'blank',
  'unpresent',
  'endInitiative',
];

const INITIATIVE_KEYS = [
  'encounterId',
  'isActive',
  'round',
  'currentEntityId',
  'turnOrder',
  'enemyHpMode',
  'enemyConditionsMode',
  'updatedAt',
];
const ENTRY_KEYS = [
  'entityId',
  'displayName',
  'type',
  'playerCharacterId',
  'currentHp',
  'maxHp',
  'hpState',
  'hpPercent',
  'hpTier',
  'isDead',
  'hpMode',
  'disposition',
  'chessPiece',
  'tokenColor',
  'conditions',
  'isConcentrating',
];
const CONDITION_KEYS = ['name', 'kind', 'stackCount', 'description', 'icon'];
const HP_MODES = ['off', 'label', 'bar', 'percent', 'exact'];

function validCondition(value: unknown): boolean {
  if (!isRecord(value) || !onlyKeys(value, CONDITION_KEYS)) return false;
  return (
    typeof value.name === 'string' &&
    value.name.length <= 200 &&
    (value.kind === undefined ||
      ['buff', 'debuff', 'neutral'].includes(String(value.kind))) &&
    (value.stackCount === undefined || isRevision(value.stackCount)) &&
    (value.description === undefined ||
      (typeof value.description === 'string' &&
        value.description.length <= 1000)) &&
    (value.icon === undefined ||
      (typeof value.icon === 'string' && value.icon.length <= 100))
  );
}

function validEntry(
  value: unknown,
  hpMode: string,
  conditionsMode: string
): boolean {
  if (!isRecord(value) || !onlyKeys(value, ENTRY_KEYS)) return false;
  if (
    !isId(value.entityId) ||
    typeof value.displayName !== 'string' ||
    value.displayName.length > 200 ||
    !['player', 'monster', 'npc', 'lair'].includes(String(value.type))
  )
    return false;
  if (value.playerCharacterId !== undefined && !isId(value.playerCharacterId))
    return false;
  if (value.hpMode !== undefined && !HP_MODES.includes(String(value.hpMode)))
    return false;
  if (value.currentHp !== undefined && !finiteNumber(value.currentHp))
    return false;
  if (value.maxHp !== undefined && !finiteNumber(value.maxHp)) return false;
  if (
    value.hpPercent !== undefined &&
    (!finiteNumber(value.hpPercent) ||
      (value.hpPercent as number) < 0 ||
      (value.hpPercent as number) > 100)
  )
    return false;
  if (
    value.hpState !== undefined &&
    (typeof value.hpState !== 'string' || value.hpState.length > 100)
  )
    return false;
  if (
    value.hpTier !== undefined &&
    !['high', 'mid', 'low', 'critical'].includes(String(value.hpTier))
  )
    return false;
  if (value.isDead !== undefined && typeof value.isDead !== 'boolean')
    return false;
  if (
    value.isConcentrating !== undefined &&
    typeof value.isConcentrating !== 'boolean'
  )
    return false;
  if (
    value.disposition !== undefined &&
    !['ally', 'enemy', 'neutral'].includes(String(value.disposition))
  )
    return false;
  if (
    value.chessPiece !== undefined &&
    !['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'].includes(
      String(value.chessPiece)
    )
  )
    return false;
  if (
    value.tokenColor !== undefined &&
    (typeof value.tokenColor !== 'string' || value.tokenColor.length > 100)
  )
    return false;
  if (
    value.conditions !== undefined &&
    (!Array.isArray(value.conditions) ||
      value.conditions.length > 64 ||
      !value.conditions.every(validCondition))
  )
    return false;
  const isPlayer = value.type === 'player';
  if (!isPlayer && value.playerCharacterId !== undefined) return false;
  if (
    !isPlayer &&
    conditionsMode === 'off' &&
    (value.conditions !== undefined || value.isConcentrating !== undefined)
  )
    return false;
  const effectiveHpMode = String(value.hpMode ?? hpMode);
  if (
    !isPlayer &&
    effectiveHpMode === 'off' &&
    (value.hpState !== undefined ||
      value.hpTier !== undefined ||
      value.isDead !== undefined)
  )
    return false;
  if (!isPlayer && effectiveHpMode !== 'label' && value.hpState !== undefined)
    return false;
  if (
    (!isPlayer || value.hpMode === 'label') &&
    effectiveHpMode !== 'exact' &&
    (value.currentHp !== undefined || value.maxHp !== undefined)
  )
    return false;
  if (
    (!isPlayer || value.hpMode === 'label') &&
    effectiveHpMode !== 'bar' &&
    effectiveHpMode !== 'percent' &&
    value.hpPercent !== undefined
  )
    return false;
  return true;
}

function validInitiative(
  value: unknown,
  runId: string
): value is SharedInitiativeState {
  if (!isRecord(value) || !onlyKeys(value, INITIATIVE_KEYS)) return false;
  if (
    value.encounterId !== runId ||
    value.isActive !== true ||
    !isRevision(value.round) ||
    (value.currentEntityId !== null && !isId(value.currentEntityId)) ||
    !HP_MODES.includes(String(value.enemyHpMode)) ||
    !['off', 'on'].includes(String(value.enemyConditionsMode)) ||
    typeof value.updatedAt !== 'string' ||
    value.updatedAt.length > 64 ||
    !Array.isArray(value.turnOrder) ||
    value.turnOrder.length > 256
  )
    return false;
  return value.turnOrder.every(entry =>
    validEntry(
      entry,
      String(value.enemyHpMode),
      String(value.enemyConditionsMode)
    )
  );
}

export function parseTableCommand(value: unknown): TableCommand | null {
  if (!isRecord(value) || !isId(value.operationId)) return null;
  if (value.type === 'initialize') {
    return Object.keys(value).length === 2
      ? (value as unknown as TableCommand)
      : null;
  }
  if (
    typeof value.expectedEpoch !== 'string' ||
    !UUID.test(value.expectedEpoch) ||
    !isRevision(value.expectedRevision) ||
    !isRevision(value.expectedFence) ||
    !isId(value.holderSessionId)
  ) {
    return null;
  }
  // PR04 P2/Q5: base-only commands, show and deletePresented are exact-key
  // validated, so no extra field reaches the digest or the Lua script.
  if (BASE_ONLY_TYPES.includes(String(value.type))) {
    return onlyKeys(value, BASE_KEYS) ? (value as TableCommand) : null;
  }
  if (value.type === 'show') {
    return isId(value.sceneId) && onlyKeys(value, [...BASE_KEYS, 'sceneId'])
      ? (value as unknown as TableCommand)
      : null;
  }
  if (value.type === 'deletePresented') {
    return isId(value.expectedSceneId) &&
      onlyKeys(value, [...BASE_KEYS, 'expectedSceneId'])
      ? (value as unknown as TableCommand)
      : null;
  }
  if (value.type === 'tombstoneScene') {
    return isId(value.sceneId) && isRevision(value.expectedRegistryRevision)
      ? (value as unknown as TableCommand)
      : null;
  }
  if (value.type === 'adoptScene') {
    return isId(value.sceneId) &&
      isId(value.workspaceInstanceId) &&
      isRevision(value.expectedRegistryRevision)
      ? (value as unknown as TableCommand)
      : null;
  }
  if (value.type === 'registerScene' || value.type === 'updateScene') {
    return isId(value.sceneId) &&
      isId(value.workspaceInstanceId) &&
      (value.sourceMapId === null || isId(value.sourceMapId)) &&
      isRevision(value.contentRevision) &&
      typeof value.safeLabel === 'string' &&
      [...value.safeLabel].length <= 200 &&
      value.safeLabel.trim().length > 0 &&
      isRevision(value.expectedRegistryRevision)
      ? (value as unknown as TableCommand)
      : null;
  }
  if (value.type === 'publishInitiative') {
    return isId(value.runId) && validInitiative(value.initiative, value.runId)
      ? (value as unknown as TableCommand)
      : null;
  }
  if (value.type === 'publishInitiativeRequest') {
    const request = value.request;
    return request === null ||
      (isRecord(request) &&
        onlyKeys(request, [
          'requestId',
          'encounterId',
          'encounterName',
          'requestedAt',
        ]) &&
        isId(request.requestId) &&
        isId(request.encounterId) &&
        typeof request.encounterName === 'string' &&
        [...request.encounterName].length <= 200 &&
        isRevision(request.requestedAt))
      ? (value as unknown as TableCommand)
      : null;
  }
  return null;
}

export async function readBoundedJson(request: Request): Promise<unknown> {
  const length = Number(request.headers.get('content-length'));
  if (Number.isFinite(length) && length > TABLE_REQUEST_LIMIT) {
    throw new Error('Request body exceeds 16 KiB');
  }
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > TABLE_REQUEST_LIMIT)
        throw new Error('Request body exceeds 16 KiB');
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}
