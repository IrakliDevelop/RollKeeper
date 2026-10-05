import { openTableDatabase, transactionComplete } from './database';
import {
  resolveTableWorkspaceKey,
  type TableRepository,
  type TableWorkspaceSelection,
} from './repository';
import {
  TABLE_LIMITS,
  canonicalJson,
  validateActorRecord,
  validateCampaignRecord,
  validateEncounterRecord,
  validateLogRecord,
  validateOperationRecord,
  validateSceneRecord,
  validateSourceRecord,
  validateTombstoneRecord,
  validateWorkspaceLimits,
  type TableActorRecordV1,
  type TableCampaignRecordV1,
  type TableEncounterRecordV1,
  type TableLogRecordV1,
  type TableOperationRecordV1,
  type TableSceneRecordV1,
  type TableSourceRecordV1,
  type TableTombstoneRecordV1,
  type TableWorkspaceSnapshotV1,
} from './schema';

const encoder = new TextEncoder();
const MAX_BUNDLE_BYTES = TABLE_LIMITS.maxWorkspaceBytes;

function credentialKey(key: string): boolean {
  const normalized = key.replace(/[^a-z0-9]/giu, '').toLowerCase();
  if (
    [
      'authorization',
      'cookie',
      'setcookie',
      'bearer',
      'accesstoken',
      'refreshtoken',
      'authtoken',
      'sessiontoken',
      'idtoken',
      'authcontext',
      'writerfence',
      'capability',
      'capabilities',
      'token',
      'apikey',
      'secret',
      'password',
    ].includes(normalized)
  ) {
    return true;
  }
  return (
    normalized.endsWith('apikey') ||
    normalized.endsWith('secret') ||
    normalized.endsWith('password') ||
    normalized.endsWith('token')
  );
}

type BundleRecords = {
  campaign: TableCampaignRecordV1;
  scenes: TableSceneRecordV1[];
  actors: TableActorRecordV1[];
  encounters: TableEncounterRecordV1[];
  logs: TableLogRecordV1[];
  operations: TableOperationRecordV1[];
  sources: TableSourceRecordV1[];
  tombstones: TableTombstoneRecordV1[];
};

interface TableBundleV1 {
  bundleVersion: 1;
  schemaVersion: 1;
  exportedAt: string;
  sourceWorkspaceKey: string;
  counts: Record<keyof BundleRecords, number>;
  digests: {
    campaign: string;
    scenes: string[];
    actors: string[];
    encounters: string[];
    logs: string[];
    operations: string[];
    sources: string[];
    tombstones: string[];
  };
  records: BundleRecords;
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function digest(value: unknown): Promise<string> {
  const bytes = encoder.encode(canonicalJson(value));
  const result = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(result)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function digestRaw(raw: string): Promise<string> {
  const result = await crypto.subtle.digest('SHA-256', encoder.encode(raw));
  return [...new Uint8Array(result)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

function containsCredential(value: unknown, depth = 0): boolean {
  if (depth > 64) return true;
  if (Array.isArray(value)) {
    return value.some(entry => containsCredential(entry, depth + 1));
  }
  const item = object(value);
  if (!item) return false;
  return Object.entries(item).some(
    ([key, nested]) =>
      credentialKey(key) || containsCredential(nested, depth + 1)
  );
}

function sourceContainsCredential(record: TableSourceRecordV1): boolean {
  try {
    return containsCredential(JSON.parse(record.rawJson) as unknown);
  } catch {
    return true;
  }
}

const familyKeys = [
  'campaign',
  'scenes',
  'actors',
  'encounters',
  'logs',
  'operations',
  'sources',
  'tombstones',
] as const satisfies readonly (keyof BundleRecords)[];

function exportableScene(record: TableSceneRecordV1): TableSceneRecordV1 {
  const copy = structuredClone(record);
  for (const checkpoint of [copy.canvasCheckpoint, copy.localDraft]) {
    if (!checkpoint) continue;
    // Relay CAS is a transient write capability. The checkpoint document
    // remains fully reloadable/restorable without exporting that credential;
    // restore captures a fresh generation+CAS guard from the live authority.
    delete checkpoint.state.casToken;
  }
  return copy;
}

export async function exportTableBundle(
  repository: TableRepository,
  now: () => string = () => new Date().toISOString()
): Promise<string> {
  const raw = await repository.readRawForExport();
  if (raw.campaign === null || !validateCampaignRecord(raw.campaign).ok) {
    throw new Error('Table workspace is not exportable');
  }
  const records: BundleRecords = {
    campaign: structuredClone(raw.campaign) as TableCampaignRecordV1,
    scenes: (structuredClone(raw.scenes) as TableSceneRecordV1[]).map(
      exportableScene
    ),
    actors: structuredClone(raw.actors) as TableActorRecordV1[],
    encounters: structuredClone(raw.encounters) as TableEncounterRecordV1[],
    logs: structuredClone(raw.logs) as TableLogRecordV1[],
    operations: structuredClone(raw.operations) as TableOperationRecordV1[],
    sources: structuredClone(raw.sources) as TableSourceRecordV1[],
    tombstones: structuredClone(raw.tombstones) as TableTombstoneRecordV1[],
  };
  if (
    containsCredential(records) ||
    records.sources.some(sourceContainsCredential) ||
    (
      await Promise.all(
        records.sources.map(
          async source => source.sha256 === (await digestRaw(source.rawJson))
        )
      )
    ).some(matches => !matches)
  ) {
    throw new Error('Table data contains credential material');
  }
  const counts = Object.fromEntries(
    familyKeys.map(key => [
      key,
      key === 'campaign' ? 1 : (records[key] as unknown[]).length,
    ])
  ) as Record<keyof BundleRecords, number>;
  const digests: TableBundleV1['digests'] = {
    campaign: await digest(records.campaign),
    scenes: await Promise.all(records.scenes.map(digest)),
    actors: await Promise.all(records.actors.map(digest)),
    encounters: await Promise.all(records.encounters.map(digest)),
    logs: await Promise.all(records.logs.map(digest)),
    operations: await Promise.all(records.operations.map(digest)),
    sources: await Promise.all(records.sources.map(digest)),
    tombstones: await Promise.all(records.tombstones.map(digest)),
  };
  return canonicalJson({
    bundleVersion: 1,
    schemaVersion: 1,
    exportedAt: now(),
    sourceWorkspaceKey: raw.workspaceKey,
    counts,
    digests,
    records,
  } satisfies TableBundleV1);
}

/** Raw escape hatch for frozen future/invalid workspaces; never importable. */
export async function exportRawTableWorkspace(
  repository: TableRepository,
  now: () => string = () => new Date().toISOString()
): Promise<string> {
  const raw = await repository.readRawForExport();
  return JSON.stringify({
    format: 'rollkeeper-table-raw',
    exportedAt: now(),
    workspaceKey: raw.workspaceKey,
    records: raw,
  });
}

function namespaceFor(account: TableWorkspaceSelection['account']): string {
  return account.kind === 'guest'
    ? 'guest'
    : `user:${encodeURIComponent(account.accountId)}`;
}

async function validateBundle(value: unknown): Promise<TableBundleV1 | null> {
  const bundle = object(value);
  const records = object(bundle?.records);
  const counts = object(bundle?.counts);
  const digests = object(bundle?.digests);
  if (
    !bundle ||
    bundle.bundleVersion !== 1 ||
    bundle.schemaVersion !== 1 ||
    typeof bundle.exportedAt !== 'string' ||
    !Number.isFinite(Date.parse(bundle.exportedAt)) ||
    typeof bundle.sourceWorkspaceKey !== 'string' ||
    !records ||
    !counts ||
    !digests ||
    containsCredential(records)
  ) {
    return null;
  }
  if (familyKeys.some(key => !Object.hasOwn(records, key))) return null;
  const campaign = records.campaign;
  const arrays = familyKeys.filter(key => key !== 'campaign');
  if (!validateCampaignRecord(campaign).ok) return null;
  if (arrays.some(key => !Array.isArray(records[key]))) return null;
  const typed: BundleRecords = {
    campaign: campaign as TableCampaignRecordV1,
    scenes: records.scenes as TableSceneRecordV1[],
    actors: records.actors as TableActorRecordV1[],
    encounters: records.encounters as TableEncounterRecordV1[],
    logs: records.logs as TableLogRecordV1[],
    operations: records.operations as TableOperationRecordV1[],
    sources: records.sources as TableSourceRecordV1[],
    tombstones: records.tombstones as TableTombstoneRecordV1[],
  };
  const valid =
    typed.scenes.every(item => validateSceneRecord(item).ok) &&
    typed.actors.every(item => validateActorRecord(item).ok) &&
    typed.encounters.every(item => validateEncounterRecord(item).ok) &&
    typed.logs.every(item => validateLogRecord(item).ok) &&
    typed.operations.every(item => validateOperationRecord(item).ok) &&
    typed.sources.every(
      item => validateSourceRecord(item).ok && !sourceContainsCredential(item)
    ) &&
    typed.tombstones.every(item => validateTombstoneRecord(item).ok);
  if (!valid) return null;
  if (
    (
      await Promise.all(
        typed.sources.map(
          async source => source.sha256 === (await digestRaw(source.rawJson))
        )
      )
    ).some(matches => !matches)
  ) {
    return null;
  }
  for (const key of familyKeys) {
    const expectedCount =
      key === 'campaign' ? 1 : (typed[key] as unknown[]).length;
    if (counts[key] !== expectedCount) return null;
    if (key === 'campaign') {
      if (digests.campaign !== (await digest(typed.campaign))) return null;
      continue;
    }
    if (!Array.isArray(digests[key])) return null;
    const expected = await Promise.all(
      (typed[key] as unknown[]).map(record => digest(record))
    );
    if (
      digests[key].length !== expected.length ||
      digests[key].some((value, index) => value !== expected[index])
    ) {
      return null;
    }
  }
  return {
    bundleVersion: 1,
    schemaVersion: 1,
    exportedAt: bundle.exportedAt,
    sourceWorkspaceKey: bundle.sourceWorkspaceKey,
    counts: counts as TableBundleV1['counts'],
    digests: digests as TableBundleV1['digests'],
    records: typed,
  };
}

export type TableBundleImportResult =
  | { status: 'imported'; localWorkspaceId: string; workspaceKey: string }
  | {
      status: 'rejected';
      reason:
        | 'malformed'
        | 'future-bundle'
        | 'oversized'
        | 'active-workspace'
        | 'target-exists'
        | 'invalid-records';
      rawExportAvailable?: boolean;
    }
  | {
      status: 'failed';
      reason: 'indexeddb-unavailable' | 'transaction-failed' | 'quota-exceeded';
    };

export async function importTableBundle(options: {
  factory?: IDBFactory | null;
  account: TableWorkspaceSelection['account'];
  activeWorkspaceKey: string;
  targetCampaignCode: string;
  raw: string;
  newWorkspaceId?: () => string;
  now?: () => string;
  beforePublish?: () => void;
}): Promise<TableBundleImportResult> {
  if (encoder.encode(options.raw).byteLength > MAX_BUNDLE_BYTES) {
    return { status: 'rejected', reason: 'oversized' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(options.raw) as unknown;
  } catch {
    return { status: 'rejected', reason: 'malformed' };
  }
  const parsedRecord = object(parsed);
  if (
    typeof parsedRecord?.bundleVersion === 'number' &&
    parsedRecord.bundleVersion > 1
  ) {
    return {
      status: 'rejected',
      reason: 'future-bundle',
      rawExportAvailable: true,
    };
  }
  const bundle = await validateBundle(parsed);
  if (!bundle) return { status: 'rejected', reason: 'malformed' };

  const localWorkspaceId = options.newWorkspaceId?.() ?? crypto.randomUUID();
  const selection: TableWorkspaceSelection = {
    account: structuredClone(options.account),
    workspace: { localWorkspaceId },
  };
  const workspaceKey = resolveTableWorkspaceKey(selection);
  if (workspaceKey === options.activeWorkspaceKey) {
    return { status: 'rejected', reason: 'active-workspace' };
  }
  const rewrite = <T extends { workspaceKey: string }>(value: T): T => ({
    ...structuredClone(value),
    workspaceKey,
  });
  const records: BundleRecords = {
    campaign: {
      ...rewrite(bundle.records.campaign),
      namespaceKey: namespaceFor(options.account),
      localWorkspaceId,
      // A fork is deliberately not auto-associated with the active legacy
      // campaign. The user selects it explicitly; otherwise source lookup
      // would become ambiguous and could displace the active workspace.
      sourceCampaignCode: null,
      routeCampaignCode: options.targetCampaignCode,
      revision: bundle.records.campaign.revision,
    },
    scenes: bundle.records.scenes.map(rewrite),
    actors: bundle.records.actors.map(rewrite),
    encounters: bundle.records.encounters.map(rewrite),
    logs: bundle.records.logs.map(rewrite),
    operations: bundle.records.operations.map(rewrite),
    sources: bundle.records.sources.map(rewrite),
    tombstones: bundle.records.tombstones.map(rewrite),
  };
  const candidate: TableWorkspaceSnapshotV1 = {
    workspaceKey,
    campaign: records.campaign,
    scenes: records.scenes,
    actors: records.actors,
    encounters: records.encounters,
    logs: records.logs,
    sources: records.sources,
    tombstones: records.tombstones,
    operations: records.operations,
  };
  const limits = validateWorkspaceLimits(candidate);
  const sceneIds = new Set(records.scenes.map(item => item.sceneId));
  const actorIds = new Set(records.actors.map(item => item.actorId));
  const runIds = new Set(records.encounters.map(item => item.runId));
  if (
    !limits.ok ||
    records.encounters.some(
      run =>
        !sceneIds.has(run.sceneId) ||
        run.participants.some(participant => !actorIds.has(participant.actorId))
    ) ||
    records.logs.some(log => !runIds.has(log.runId)) ||
    records.scenes.some(scene =>
      scene.members.some(member => !actorIds.has(member.actorId))
    )
  ) {
    return { status: 'rejected', reason: 'invalid-records' };
  }

  let database: IDBDatabase;
  try {
    database = await openTableDatabase({ factory: options.factory });
  } catch {
    return { status: 'failed', reason: 'indexeddb-unavailable' };
  }
  const stores = [
    'campaigns',
    'scenes',
    'actors',
    'encounters',
    'logs',
    'operations',
    'sources',
    'tombstones',
  ] as const;
  let transaction: IDBTransaction | null = null;
  let completed: Promise<void> | null = null;
  try {
    transaction = database.transaction(stores, 'readwrite');
    completed = transactionComplete(transaction);
    const existing = await new Promise<unknown>((resolve, reject) => {
      const request = transaction!.objectStore('campaigns').get(workspaceKey);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (existing !== undefined) {
      transaction.abort();
      await completed.catch(() => undefined);
      return { status: 'rejected', reason: 'target-exists' };
    }
    options.beforePublish?.();
    const families = [
      ['scenes', records.scenes],
      ['actors', records.actors],
      ['encounters', records.encounters],
      ['logs', records.logs],
      ['operations', records.operations],
      ['sources', records.sources],
      ['tombstones', records.tombstones],
    ] as const;
    for (const [name, values] of families) {
      const store = transaction.objectStore(name);
      for (const value of values) store.put(structuredClone(value));
    }
    // Campaign is the publication marker and is deliberately queued last.
    transaction.objectStore('campaigns').put(records.campaign);
    await completed;
    return { status: 'imported', localWorkspaceId, workspaceKey };
  } catch (error) {
    try {
      transaction?.abort();
    } catch {
      // Already completed or aborted.
    }
    await completed?.catch(() => undefined);
    const name =
      error && typeof error === 'object' && 'name' in error
        ? String(error.name)
        : transaction?.error?.name;
    return {
      status: 'failed',
      reason:
        name === 'QuotaExceededError' ? 'quota-exceeded' : 'transaction-failed',
    };
  } finally {
    database.close();
  }
}
