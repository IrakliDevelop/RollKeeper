import {
  TABLE_LIMITS,
  commandDigest,
  deepFreezeSnapshot,
  validateActorRecord,
  validateCampaignRecord,
  validateEncounterRecord,
  validateLogRecord,
  validateOperationRecord,
  validateRuntimeCommand,
  validateSceneRecord,
  validateSourceRecord,
  validateTombstoneRecord,
  validateWorkspaceLimits,
  type TableActorRecordV1,
  type TableCampaignRecordV1,
  type TableCommitResult,
  type TableCommittedResult,
  type TableEncounterRecordV1,
  type TableLogRecordV1,
  type TableOperationRecordV1,
  type TableRuntimeCommandResultV1,
  type TableRuntimeCommandV1,
  type TableSceneRecordV1,
  type TableSourceRecordV1,
  type TableTombstoneRecordV1,
  type TableWorkspaceSnapshotV1,
} from './schema';
import {
  openTableDatabase,
  requestResult,
  transactionComplete,
} from './database';

export type TableWorkspaceSelection = {
  account: { kind: 'authenticated'; accountId: string } | { kind: 'guest' };
  workspace: {
    localWorkspaceId: string;
    sourceCampaignCode?: string | null;
    routeCampaignCode?: string | null;
  };
};

export interface ResolveTableWorkspaceSelectionOptions {
  factory?: IDBFactory | null;
  account: TableWorkspaceSelection['account'];
  workspace: {
    localWorkspaceId?: string | null;
    sourceCampaignCode?: string | null;
    routeCampaignCode?: string | null;
  };
  randomUUID?: () => string;
  requireExistingLocalWorkspace?: boolean;
}

export interface TableBroadcastChannel {
  postMessage(value: unknown): void;
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<unknown>) => void
  ): void;
  removeEventListener(
    type: 'message',
    listener: (event: MessageEvent<unknown>) => void
  ): void;
  close?(): void;
}

export interface TableRepositoryOptions {
  factory?: IDBFactory | null;
  selection: TableWorkspaceSelection;
  broadcastChannel?: TableBroadcastChannel | null;
  events?: EventTarget | null;
  isVisible?: () => boolean;
  now?: () => string;
  transactionStarted?: (transaction: IDBTransaction) => void;
  beforeTransactionCommit?: (context: {
    operationId: string;
    transaction: IDBTransaction;
  }) => void;
}

export interface TableRawWorkspaceSnapshot {
  workspaceKey: string;
  campaign: unknown | null;
  scenes: unknown[];
  actors: unknown[];
  encounters: unknown[];
  logs: unknown[];
  operations: unknown[];
  sources: unknown[];
  tombstones: unknown[];
}

export type TableWorkspaceReadResult =
  | {
      status: 'ready';
      snapshot: Readonly<TableWorkspaceSnapshotV1>;
    }
  | {
      status: 'read-only';
      reason: 'unknown-schema' | 'invalid-schema';
      raw: Readonly<TableRawWorkspaceSnapshot>;
    }
  | { status: 'unavailable'; reason: string };

type TableSubscription = (value: TableWorkspaceReadResult | null) => void;

export interface TableWorkspaceMutation {
  campaign?: Partial<
    Pick<
      TableCampaignRecordV1,
      'selectedRunId' | 'activeRunId' | 'sourceMappings'
    >
  >;
  scenes?: { put: TableSceneRecordV1[]; delete?: string[] };
  actors?: { put: TableActorRecordV1[]; delete?: string[] };
  encounters?: { put: TableEncounterRecordV1[]; delete?: string[] };
  logs?: { put: TableLogRecordV1[]; delete?: string[] };
  sources?: { put: TableSourceRecordV1[]; delete?: string[] };
  tombstones?: { put: TableTombstoneRecordV1[]; delete?: string[] };
}

const RUNTIME_STORES = [
  'campaigns',
  'actors',
  'encounters',
  'logs',
  'operations',
] as const;

const encoder = new TextEncoder();

function boundedIdentityPart(value: unknown, label: string): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    encoder.encode(value).byteLength > 255
  ) {
    throw new Error(`A stable ${label} is required`);
  }
  return encodeURIComponent(value);
}

function namespaceKey(account: TableWorkspaceSelection['account']): string {
  if (account.kind === 'guest') return 'guest';
  return `user:${boundedIdentityPart(account.accountId, 'account id')}`;
}

/**
 * Derives Table identity only from the authenticated selection plus the
 * immutable device workspace id. Route account ids and display names are not
 * accepted inputs and extra runtime properties are deliberately ignored.
 */
export function resolveTableWorkspaceKey(
  selection: TableWorkspaceSelection
): string {
  const workspace = boundedIdentityPart(
    selection.workspace?.localWorkspaceId,
    'workspace id'
  );
  if (selection.account?.kind === 'guest') {
    return `guest/workspace:${workspace}`;
  }
  if (selection.account?.kind !== 'authenticated') {
    throw new Error('A current account selection is required');
  }
  const account = boundedIdentityPart(
    selection.account.accountId,
    'account id'
  );
  return `user:${account}/workspace:${workspace}`;
}

function initialCampaignRecord(
  selection: TableWorkspaceSelection
): TableCampaignRecordV1 {
  const workspaceKey = resolveTableWorkspaceKey(selection);
  return {
    schemaVersion: 1,
    workspaceKey,
    namespaceKey: namespaceKey(selection.account),
    localWorkspaceId: selection.workspace.localWorkspaceId,
    sourceCampaignCode: selection.workspace.sourceCampaignCode ?? null,
    routeCampaignCode:
      selection.workspace.routeCampaignCode ??
      selection.workspace.sourceCampaignCode ??
      null,
    revision: 0,
    selectedRunId: null,
    activeRunId: null,
    sourceMappings: [],
    adoptionVersion: 1,
  };
}

function campaignMatchesSelection(
  campaign: TableCampaignRecordV1,
  selection: TableWorkspaceSelection
): boolean {
  return (
    campaign.workspaceKey === resolveTableWorkspaceKey(selection) &&
    campaign.namespaceKey === namespaceKey(selection.account) &&
    campaign.localWorkspaceId === selection.workspace.localWorkspaceId &&
    (selection.workspace.sourceCampaignCode === undefined ||
      campaign.sourceCampaignCode ===
        (selection.workspace.sourceCampaignCode ?? null)) &&
    (selection.workspace.routeCampaignCode === undefined ||
      (campaign.routeCampaignCode ?? campaign.sourceCampaignCode) ===
        (selection.workspace.routeCampaignCode ?? null))
  );
}

/**
 * Resolves a trusted account/workspace selection. Legacy campaigns without an
 * immutable local id receive one UUID exactly once, persisted in the isolated
 * Table campaign store against the existing campaign code. Conflicting
 * mappings fail closed for explicit user resolution.
 */
export async function resolveTableWorkspaceSelection(
  options: ResolveTableWorkspaceSelectionOptions
): Promise<TableWorkspaceSelection> {
  const sourceCampaignCode = options.workspace.sourceCampaignCode ?? null;
  const routeCampaignCode =
    options.workspace.routeCampaignCode ?? sourceCampaignCode;
  if (sourceCampaignCode !== null) {
    boundedIdentityPart(sourceCampaignCode, 'source campaign code');
  }
  if (routeCampaignCode !== null) {
    boundedIdentityPart(routeCampaignCode, 'route campaign code');
  }
  const suppliedLocalId = options.workspace.localWorkspaceId ?? null;
  if (suppliedLocalId !== null) {
    boundedIdentityPart(suppliedLocalId, 'workspace id');
  }
  if (suppliedLocalId === null && sourceCampaignCode === null) {
    throw new Error(
      'A source campaign code is required to assign a Table workspace id'
    );
  }

  const database = await openTableDatabase({ factory: options.factory });
  let transaction: IDBTransaction | null = null;
  let completed: Promise<void> | null = null;
  try {
    transaction = database.transaction('campaigns', 'readwrite');
    completed = transactionComplete(transaction);
    const store = transaction.objectStore('campaigns');
    const stored = (await requestResult(store.getAll())) as unknown[];
    const currentNamespace = namespaceKey(options.account);
    const namespaceCampaigns = stored.filter(value => {
      if (!isRecord(value) || value.namespaceKey !== currentNamespace) {
        return false;
      }
      if (schemaVersion(value) !== 1 || !validateCampaignRecord(value).ok) {
        throw new Error('Existing Table workspace mapping is incompatible');
      }
      return true;
    }) as TableCampaignRecordV1[];
    const sourceMatches =
      sourceCampaignCode === null
        ? []
        : namespaceCampaigns.filter(
            campaign => campaign.sourceCampaignCode === sourceCampaignCode
          );
    if (suppliedLocalId === null && sourceMatches.length > 1) {
      throw new Error('Table workspace mapping collision requires selection');
    }

    let localWorkspaceId = suppliedLocalId;
    if (localWorkspaceId === null) {
      localWorkspaceId =
        sourceMatches[0]?.localWorkspaceId ??
        (options.randomUUID ?? (() => crypto.randomUUID()))();
      boundedIdentityPart(localWorkspaceId, 'workspace id');
    }

    let selection: TableWorkspaceSelection = {
      account: structuredClone(options.account),
      workspace: {
        localWorkspaceId,
        sourceCampaignCode,
        routeCampaignCode,
      },
    };
    const existing = (await requestResult(
      store.get(resolveTableWorkspaceKey(selection))
    )) as unknown;
    if (existing !== undefined) {
      if (
        schemaVersion(existing) !== 1 ||
        !validateCampaignRecord(existing).ok
      ) {
        throw new Error('Existing Table workspace mapping is incompatible');
      }
      const campaign = existing as TableCampaignRecordV1;
      const storedRoute =
        campaign.routeCampaignCode ?? campaign.sourceCampaignCode;
      if (
        campaign.namespaceKey !== currentNamespace ||
        campaign.localWorkspaceId !== localWorkspaceId ||
        (routeCampaignCode !== null && storedRoute !== routeCampaignCode)
      ) {
        throw new Error('Table workspace is not bound to this campaign route');
      }
      selection = {
        account: structuredClone(options.account),
        workspace: {
          localWorkspaceId,
          sourceCampaignCode: campaign.sourceCampaignCode,
          routeCampaignCode: storedRoute,
        },
      };
    } else if (options.requireExistingLocalWorkspace) {
      throw new Error('Table workspace is not bound to this campaign route');
    } else if (
      sourceCampaignCode !== null &&
      sourceMatches.some(
        campaign => campaign.localWorkspaceId !== localWorkspaceId
      )
    ) {
      throw new Error('Table workspace mapping collision requires selection');
    } else {
      store.add(initialCampaignRecord(selection));
    }
    await completed;
    return selection;
  } catch (error) {
    try {
      transaction?.abort();
    } catch {
      // The transaction may already have completed or aborted.
    }
    await completed?.catch(() => undefined);
    throw error;
  } finally {
    database.close();
  }
}

function createDefaultBroadcastChannel(): TableBroadcastChannel | null {
  if (
    typeof window === 'undefined' ||
    typeof BroadcastChannel === 'undefined'
  ) {
    return null;
  }
  return new BroadcastChannel('rollkeeper-table-v1');
}

function createDefaultEvents(): EventTarget | null {
  return typeof window === 'undefined' ? null : window;
}

function defaultVisible(): boolean {
  return (
    typeof document === 'undefined' || document.visibilityState !== 'hidden'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function schemaVersion(value: unknown): number | null {
  return isRecord(value) && typeof value.schemaVersion === 'number'
    ? value.schemaVersion
    : null;
}

function belongsToWorkspace(value: unknown, workspaceKey: string): boolean {
  return isRecord(value) && value.workspaceKey === workspaceKey;
}

function errorName(error: unknown): string | null {
  return isRecord(error) && typeof error.name === 'string' ? error.name : null;
}

function immutableResult<T>(value: T): T {
  return deepFreezeSnapshot(value) as T;
}

function sortedBy<T>(values: T[], key: (value: T) => string): T[] {
  return values.sort((left, right) => key(left).localeCompare(key(right)));
}

function operationIdIsValid(operationId: unknown): operationId is string {
  return (
    typeof operationId === 'string' &&
    operationId.length > 0 &&
    encoder.encode(operationId).byteLength <= 255
  );
}

function invalidationMessage(
  value: unknown
): value is { type: 'invalidate'; workspaceKey: string; revision: number } {
  return (
    isRecord(value) &&
    value.type === 'invalidate' &&
    typeof value.workspaceKey === 'string' &&
    Number.isSafeInteger(value.revision) &&
    Number(value.revision) >= 0
  );
}

async function readRawWorkspace(
  database: IDBDatabase,
  workspaceKey: string
): Promise<TableRawWorkspaceSnapshot> {
  const transaction = database.transaction(
    [
      'campaigns',
      'scenes',
      'actors',
      'encounters',
      'logs',
      'operations',
      'sources',
      'tombstones',
    ],
    'readonly'
  );
  const completed = transactionComplete(transaction);
  const [
    campaign,
    scenes,
    actors,
    encounters,
    logs,
    operations,
    sources,
    tombstones,
  ] = await Promise.all([
    requestResult(transaction.objectStore('campaigns').get(workspaceKey)),
    requestResult(transaction.objectStore('scenes').getAll()),
    requestResult(transaction.objectStore('actors').getAll()),
    requestResult(transaction.objectStore('encounters').getAll()),
    requestResult(transaction.objectStore('logs').getAll()),
    requestResult(transaction.objectStore('operations').getAll()),
    requestResult(transaction.objectStore('sources').getAll()),
    requestResult(transaction.objectStore('tombstones').getAll()),
  ]);
  await completed;
  return {
    workspaceKey,
    campaign: campaign ?? null,
    scenes: scenes.filter(value => belongsToWorkspace(value, workspaceKey)),
    actors: actors.filter(value => belongsToWorkspace(value, workspaceKey)),
    encounters: encounters.filter(value =>
      belongsToWorkspace(value, workspaceKey)
    ),
    logs: logs.filter(value => belongsToWorkspace(value, workspaceKey)),
    operations: operations.filter(value =>
      belongsToWorkspace(value, workspaceKey)
    ),
    sources: sources.filter(value => belongsToWorkspace(value, workspaceKey)),
    tombstones: tombstones.filter(value =>
      belongsToWorkspace(value, workspaceKey)
    ),
  };
}

function parseRawWorkspace(
  raw: TableRawWorkspaceSnapshot
): TableWorkspaceReadResult {
  const values = [
    ...(raw.campaign === null ? [] : [raw.campaign]),
    ...raw.scenes,
    ...raw.actors,
    ...raw.encounters,
    ...raw.logs,
    ...raw.operations,
    ...raw.sources,
    ...raw.tombstones,
  ];
  if (values.some(value => (schemaVersion(value) ?? 0) > 1)) {
    return immutableResult({
      status: 'read-only' as const,
      reason: 'unknown-schema' as const,
      raw,
    });
  }
  const valid =
    (raw.campaign === null || validateCampaignRecord(raw.campaign).ok) &&
    raw.scenes.every(value => validateSceneRecord(value).ok) &&
    raw.actors.every(value => validateActorRecord(value).ok) &&
    raw.encounters.every(value => validateEncounterRecord(value).ok) &&
    raw.logs.every(value => validateLogRecord(value).ok) &&
    raw.operations.every(value => validateOperationRecord(value).ok) &&
    raw.sources.every(value => validateSourceRecord(value).ok) &&
    raw.tombstones.every(value => validateTombstoneRecord(value).ok);
  if (!valid) {
    return immutableResult({
      status: 'read-only' as const,
      reason: 'invalid-schema' as const,
      raw,
    });
  }

  const withOperations: TableWorkspaceSnapshotV1 = {
    workspaceKey: raw.workspaceKey,
    campaign: raw.campaign as TableCampaignRecordV1 | null,
    scenes: sortedBy(
      raw.scenes as TableSceneRecordV1[],
      value => value.sceneId
    ),
    actors: sortedBy(
      raw.actors as TableActorRecordV1[],
      value => value.actorId
    ),
    encounters: sortedBy(
      raw.encounters as TableEncounterRecordV1[],
      value => value.runId
    ),
    logs: sortedBy(raw.logs as TableLogRecordV1[], value => value.archiveId),
    sources: sortedBy(
      raw.sources as TableSourceRecordV1[],
      value => value.sourceKey
    ),
    tombstones: sortedBy(
      raw.tombstones as TableTombstoneRecordV1[],
      value => `${value.kind}:${value.id}`
    ),
    operations: raw.operations as TableOperationRecordV1[],
  };
  if (!validateWorkspaceLimits(withOperations).ok) {
    return immutableResult({
      status: 'read-only' as const,
      reason: 'invalid-schema' as const,
      raw,
    });
  }
  const snapshot: TableWorkspaceSnapshotV1 = {
    workspaceKey: withOperations.workspaceKey,
    campaign: withOperations.campaign,
    scenes: withOperations.scenes,
    actors: withOperations.actors,
    encounters: withOperations.encounters,
    logs: withOperations.logs,
    sources: withOperations.sources,
    tombstones: withOperations.tombstones,
  };
  return immutableResult({ status: 'ready' as const, snapshot });
}

export class TableRepository {
  private selection: TableWorkspaceSelection;
  private workspaceKey: string;
  private generation = 0;
  private databasePromise: Promise<IDBDatabase> | null = null;
  private current: TableWorkspaceReadResult | null = null;
  private active = false;
  private reloadQueue: Promise<unknown> = Promise.resolve();
  private readonly subscribers = new Set<TableSubscription>();
  private readonly broadcastChannel: TableBroadcastChannel | null;
  private readonly events: EventTarget | null;
  private readonly isVisible: () => boolean;
  private readonly now: () => string;

  private readonly onBroadcast = (event: MessageEvent<unknown>) => {
    if (
      !invalidationMessage(event.data) ||
      event.data.workspaceKey !== this.workspaceKey
    ) {
      return;
    }
    this.queueReload();
  };

  private readonly onFocus = () => this.queueReload();
  private readonly onVisibility = () => {
    if (this.isVisible()) this.queueReload();
  };

  constructor(private readonly options: TableRepositoryOptions) {
    this.selection = structuredClone(options.selection);
    this.workspaceKey = resolveTableWorkspaceKey(this.selection);
    this.broadcastChannel =
      options.broadcastChannel === undefined
        ? createDefaultBroadcastChannel()
        : options.broadcastChannel;
    this.events =
      options.events === undefined ? createDefaultEvents() : options.events;
    this.isVisible = options.isVisible ?? defaultVisible;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async start(): Promise<TableWorkspaceReadResult> {
    if (!this.active) {
      this.active = true;
      this.broadcastChannel?.addEventListener('message', this.onBroadcast);
      this.events?.addEventListener('focus', this.onFocus);
      this.events?.addEventListener('visibilitychange', this.onVisibility);
    }
    return this.reload();
  }

  dispose(): void {
    if (this.active) {
      this.broadcastChannel?.removeEventListener('message', this.onBroadcast);
      this.events?.removeEventListener('focus', this.onFocus);
      this.events?.removeEventListener('visibilitychange', this.onVisibility);
    }
    this.active = false;
    this.generation += 1;
    this.current = null;
    this.subscribers.clear();
    this.broadcastChannel?.close?.();
    void this.databasePromise
      ?.then(database => database.close())
      .catch(() => undefined);
    this.databasePromise = null;
  }

  subscribe(listener: TableSubscription): () => void {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  getCurrent(): TableWorkspaceReadResult | null {
    return this.current;
  }

  /** Immutable identity used by adapters; never inferred from a route. */
  get workspaceIdentity(): string {
    return this.workspaceKey;
  }

  get workspaceSelection(): TableWorkspaceSelection {
    return structuredClone(this.selection);
  }

  get indexedDbFactory(): IDBFactory | null | undefined {
    return this.options.factory;
  }

  async readRawForExport(): Promise<Readonly<TableRawWorkspaceSnapshot>> {
    const raw = await readRawWorkspace(
      await this.database(),
      this.workspaceKey
    );
    return immutableResult(raw);
  }

  /**
   * Atomic adapter mutation for adoption, scene checkpoints and tests. Runtime
   * combat edits continue to use the narrower `commit` contract above.
   */
  async mutateWorkspace(
    expectedRevision: number,
    operationId: string,
    mutation: TableWorkspaceMutation
  ): Promise<TableCommitResult> {
    const workspaceKey = this.workspaceKey;
    const generation = this.generation;
    if (
      !Number.isSafeInteger(expectedRevision) ||
      expectedRevision < 0 ||
      !operationIdIsValid(operationId)
    ) {
      return immutableResult({ status: 'rejected', reason: 'invalid-command' });
    }
    if (this.current?.status === 'read-only') {
      return immutableResult({ status: 'rejected', reason: 'unknown-schema' });
    }
    const puts = [
      ...(mutation.scenes?.put ?? []),
      ...(mutation.actors?.put ?? []),
      ...(mutation.encounters?.put ?? []),
      ...(mutation.logs?.put ?? []),
      ...(mutation.sources?.put ?? []),
      ...(mutation.tombstones?.put ?? []),
    ];
    if (puts.some(record => record.workspaceKey !== workspaceKey)) {
      return immutableResult({ status: 'rejected', reason: 'invalid-command' });
    }
    const validators: Array<[unknown[], (value: unknown) => { ok: boolean }]> =
      [
        [mutation.scenes?.put ?? [], validateSceneRecord],
        [mutation.actors?.put ?? [], validateActorRecord],
        [mutation.encounters?.put ?? [], validateEncounterRecord],
        [mutation.logs?.put ?? [], validateLogRecord],
        [mutation.sources?.put ?? [], validateSourceRecord],
        [mutation.tombstones?.put ?? [], validateTombstoneRecord],
      ];
    if (
      validators.some(([records, validate]) =>
        records.some(record => !validate(record).ok)
      )
    ) {
      return immutableResult({ status: 'rejected', reason: 'invalid-command' });
    }

    let database: IDBDatabase;
    let digest: string;
    try {
      database = await this.database();
      digest = await commandDigest(
        mutation as unknown as TableRuntimeCommandV1
      );
    } catch (error) {
      return immutableResult({
        status: 'failed',
        reason:
          this.options.factory === null ||
          (error instanceof Error &&
            error.message === 'IndexedDB is unavailable')
            ? 'indexeddb-unavailable'
            : 'transaction-failed',
      });
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
      this.options.transactionStarted?.(transaction);
      const all = await Promise.all(
        stores.map(store =>
          requestResult(transaction!.objectStore(store).getAll())
        )
      );
      const byStore = Object.fromEntries(
        stores.map((store, index) => [
          store,
          all[index]!.filter(value => belongsToWorkspace(value, workspaceKey)),
        ])
      ) as Record<(typeof stores)[number], unknown[]>;
      const existingOperation = byStore.operations.find(
        value => isRecord(value) && value.operationId === operationId
      );
      if (existingOperation !== undefined) {
        if (!validateOperationRecord(existingOperation).ok) {
          await completed;
          return immutableResult({
            status: 'rejected',
            reason: 'unknown-schema',
          });
        }
        const operation = existingOperation as TableOperationRecordV1;
        await completed;
        return immutableResult(
          operation.commandDigest === digest
            ? operation.result
            : { status: 'rejected', reason: 'operation-digest-mismatch' }
        );
      }
      const campaignValue = byStore.campaigns[0];
      if (
        campaignValue !== undefined &&
        (!validateCampaignRecord(campaignValue).ok ||
          !campaignMatchesSelection(
            campaignValue as TableCampaignRecordV1,
            this.selection
          ))
      ) {
        await completed;
        return immutableResult({
          status: 'rejected',
          reason: 'unknown-schema',
        });
      }
      const actualRevision =
        campaignValue === undefined
          ? 0
          : (campaignValue as TableCampaignRecordV1).revision;
      if (actualRevision !== expectedRevision) {
        await completed;
        return immutableResult({ status: 'conflict', actualRevision });
      }

      const records = {
        scenes: new Map(
          (byStore.scenes as TableSceneRecordV1[]).map(value => [
            value.sceneId,
            value,
          ])
        ),
        actors: new Map(
          (byStore.actors as TableActorRecordV1[]).map(value => [
            value.actorId,
            value,
          ])
        ),
        encounters: new Map(
          (byStore.encounters as TableEncounterRecordV1[]).map(value => [
            value.runId,
            value,
          ])
        ),
        logs: new Map(
          (byStore.logs as TableLogRecordV1[]).map(value => [
            value.archiveId,
            value,
          ])
        ),
        sources: new Map(
          (byStore.sources as TableSourceRecordV1[]).map(value => [
            value.sourceKey,
            value,
          ])
        ),
        tombstones: new Map(
          (byStore.tombstones as TableTombstoneRecordV1[]).map(value => [
            `${value.kind}:${value.id}`,
            value,
          ])
        ),
      };
      const apply = <T>(
        map: Map<string, T>,
        family: { put: T[]; delete?: string[] } | undefined,
        key: (value: T) => string
      ) => {
        for (const id of family?.delete ?? []) map.delete(id);
        for (const record of family?.put ?? [])
          map.set(key(record), structuredClone(record));
      };
      apply(records.scenes, mutation.scenes, value => value.sceneId);
      apply(records.actors, mutation.actors, value => value.actorId);
      apply(records.encounters, mutation.encounters, value => value.runId);
      apply(records.logs, mutation.logs, value => value.archiveId);
      apply(records.sources, mutation.sources, value => value.sourceKey);
      for (const id of mutation.tombstones?.delete ?? [])
        records.tombstones.delete(id);
      for (const record of mutation.tombstones?.put ?? []) {
        records.tombstones.set(
          `${record.kind}:${record.id}`,
          structuredClone(record)
        );
      }

      const revision = actualRevision + 1;
      const baseCampaign =
        campaignValue === undefined
          ? initialCampaignRecord(this.selection)
          : (campaignValue as TableCampaignRecordV1);
      const campaign: TableCampaignRecordV1 = {
        ...baseCampaign,
        ...structuredClone(mutation.campaign ?? {}),
        revision,
      };
      const result: TableCommittedResult = {
        status: 'committed',
        revision,
        result: {
          actorIds: mutation.actors?.put.map(value => value.actorId) ?? [],
          runIds: mutation.encounters?.put.map(value => value.runId) ?? [],
          archiveIds: mutation.logs?.put.map(value => value.archiveId) ?? [],
          deletedActorIds: mutation.actors?.delete ?? [],
          deletedRunIds: mutation.encounters?.delete ?? [],
          deletedArchiveIds: mutation.logs?.delete ?? [],
        },
      };
      const operation: TableOperationRecordV1 = {
        schemaVersion: 1,
        workspaceKey,
        operationId,
        commandDigest: digest,
        expectedRevision,
        committedRevision: revision,
        result,
        createdAt: this.now(),
      };
      const operations = (byStore.operations as TableOperationRecordV1[])
        .concat(operation)
        .sort(
          (left, right) => left.committedRevision - right.committedRevision
        );
      const evicted = operations.splice(
        0,
        Math.max(0, operations.length - TABLE_LIMITS.maxOperations)
      );
      const candidate: TableWorkspaceSnapshotV1 = {
        workspaceKey,
        campaign,
        scenes: [...records.scenes.values()],
        actors: [...records.actors.values()],
        encounters: [...records.encounters.values()],
        logs: [...records.logs.values()],
        sources: [...records.sources.values()],
        tombstones: [...records.tombstones.values()],
        operations,
      };
      const limits = validateWorkspaceLimits(candidate);
      const referencesValid =
        candidate.encounters.every(
          run =>
            records.scenes.has(run.sceneId) &&
            run.participants.every(participant =>
              records.actors.has(participant.actorId)
            )
        ) &&
        candidate.logs.every(log => records.encounters.has(log.runId)) &&
        candidate.scenes.every(item =>
          item.members.every(member => records.actors.has(member.actorId))
        );
      if (!limits.ok || !referencesValid) {
        transaction.abort();
        await completed.catch(() => undefined);
        return immutableResult({
          status: 'rejected',
          reason: !limits.ok ? 'limit-exceeded' : 'invalid-reference',
          ...(!limits.ok ? { detail: limits.reason } : {}),
        });
      }

      const writeFamily = <T>(
        storeName: 'scenes' | 'actors' | 'encounters' | 'logs' | 'sources',
        family: { put: T[]; delete?: string[] } | undefined,
        key: (id: string) => IDBValidKey
      ) => {
        const store = transaction!.objectStore(storeName);
        for (const id of family?.delete ?? []) store.delete(key(id));
        for (const record of family?.put ?? [])
          store.put(structuredClone(record));
      };
      writeFamily('scenes', mutation.scenes, id => [workspaceKey, id]);
      writeFamily('actors', mutation.actors, id => [workspaceKey, id]);
      writeFamily('encounters', mutation.encounters, id => [workspaceKey, id]);
      writeFamily('logs', mutation.logs, id => [workspaceKey, id]);
      writeFamily('sources', mutation.sources, id => [workspaceKey, id]);
      const tombstoneStore = transaction.objectStore('tombstones');
      for (const id of mutation.tombstones?.delete ?? []) {
        const [kind, recordId] = id.split(':', 2);
        tombstoneStore.delete([workspaceKey, kind, recordId]);
      }
      for (const record of mutation.tombstones?.put ?? [])
        tombstoneStore.put(structuredClone(record));
      transaction.objectStore('campaigns').put(campaign);
      transaction.objectStore('operations').put(operation);
      for (const old of evicted)
        transaction
          .objectStore('operations')
          .delete([workspaceKey, old.operationId]);
      this.options.beforeTransactionCommit?.({ operationId, transaction });
      await completed;
      if (generation === this.generation && workspaceKey === this.workspaceKey)
        await this.reload();
      this.broadcastChannel?.postMessage({
        type: 'invalidate',
        workspaceKey,
        revision,
      });
      return immutableResult(result);
    } catch (error) {
      try {
        transaction?.abort();
      } catch {
        // Already completed or aborted.
      }
      await completed?.catch(() => undefined);
      return immutableResult({
        status: 'failed',
        reason:
          errorName(error) === 'QuotaExceededError' ||
          errorName(transaction?.error) === 'QuotaExceededError'
            ? 'quota-exceeded'
            : 'transaction-failed',
      });
    }
  }

  /** Test/adapter bootstrap: real adoption uses `mutateWorkspace` directly. */
  putSceneForTest(
    scene: TableSceneRecordV1,
    expectedRevision: number
  ): Promise<TableCommitResult> {
    return this.mutateWorkspace(expectedRevision, `scene:${scene.sceneId}`, {
      scenes: { put: [scene] },
    });
  }

  async switchWorkspace(
    selection: TableWorkspaceSelection
  ): Promise<TableWorkspaceReadResult> {
    const nextSelection = structuredClone(selection);
    const nextWorkspaceKey = resolveTableWorkspaceKey(nextSelection);
    this.generation += 1;
    this.selection = nextSelection;
    this.workspaceKey = nextWorkspaceKey;
    this.current = null;
    this.notify();
    this.subscribers.clear();
    return this.reload();
  }

  async reload(): Promise<TableWorkspaceReadResult> {
    const generation = this.generation;
    const workspaceKey = this.workspaceKey;
    let result: TableWorkspaceReadResult;
    try {
      const database = await this.database();
      const raw = await readRawWorkspace(database, workspaceKey);
      result = parseRawWorkspace(raw);
      if (
        result.status === 'ready' &&
        result.snapshot.campaign !== null &&
        !campaignMatchesSelection(result.snapshot.campaign, this.selection)
      ) {
        result = immutableResult({
          status: 'read-only' as const,
          reason: 'invalid-schema' as const,
          raw,
        });
      }
    } catch (error) {
      result = immutableResult({
        status: 'unavailable' as const,
        reason:
          error instanceof Error ? error.message : 'IndexedDB is unavailable',
      });
    }
    if (generation === this.generation && workspaceKey === this.workspaceKey) {
      this.current = result;
      this.notify();
    }
    return result;
  }

  async commit(
    expectedRevision: number,
    operationId: string,
    command: TableRuntimeCommandV1
  ): Promise<TableCommitResult> {
    const workspaceKey = this.workspaceKey;
    const generation = this.generation;
    if (
      !Number.isSafeInteger(expectedRevision) ||
      expectedRevision < 0 ||
      !operationIdIsValid(operationId) ||
      !validateRuntimeCommand(command).ok ||
      !this.commandUsesWorkspace(command, workspaceKey)
    ) {
      return immutableResult({ status: 'rejected', reason: 'invalid-command' });
    }
    if (this.current?.status === 'read-only') {
      return immutableResult({ status: 'rejected', reason: 'unknown-schema' });
    }

    let database: IDBDatabase;
    try {
      database = await this.database();
    } catch (error) {
      const unavailable =
        this.options.factory === null ||
        (error instanceof Error &&
          error.message === 'IndexedDB is unavailable');
      return immutableResult({
        status: 'failed',
        reason: unavailable ? 'indexeddb-unavailable' : 'transaction-failed',
      });
    }

    let digest: string;
    try {
      digest = await commandDigest(command);
    } catch {
      return immutableResult({ status: 'rejected', reason: 'invalid-command' });
    }

    // Scene/source/tombstone records are immutable in this phase, but they
    // still participate in compatibility and workspace-size admission.
    let staticRaw: TableRawWorkspaceSnapshot;
    try {
      staticRaw = await readRawWorkspace(database, workspaceKey);
    } catch {
      return immutableResult({
        status: 'failed',
        reason: 'transaction-failed',
      });
    }
    const staticValues = [
      ...staticRaw.scenes,
      ...staticRaw.sources,
      ...staticRaw.tombstones,
    ];
    if (staticValues.some(value => (schemaVersion(value) ?? 0) > 1)) {
      return immutableResult({ status: 'rejected', reason: 'unknown-schema' });
    }
    if (
      !staticRaw.scenes.every(value => validateSceneRecord(value).ok) ||
      !staticRaw.sources.every(value => validateSourceRecord(value).ok) ||
      !staticRaw.tombstones.every(value => validateTombstoneRecord(value).ok)
    ) {
      return immutableResult({ status: 'rejected', reason: 'unknown-schema' });
    }

    let transaction: IDBTransaction | null = null;
    let completed: Promise<void> | null = null;
    try {
      transaction = database.transaction(RUNTIME_STORES, 'readwrite');
      completed = transactionComplete(transaction);
      this.options.transactionStarted?.(transaction);
      const operationsStore = transaction.objectStore('operations');
      const existingOperation = await requestResult(
        operationsStore.get([workspaceKey, operationId])
      );
      if (existingOperation !== undefined) {
        if (
          schemaVersion(existingOperation) !== 1 ||
          !validateOperationRecord(existingOperation).ok
        ) {
          await completed;
          return immutableResult({
            status: 'rejected',
            reason: 'unknown-schema',
          });
        }
        const operation = existingOperation as TableOperationRecordV1;
        if (operation.commandDigest !== digest) {
          await completed;
          return immutableResult({
            status: 'rejected',
            reason: 'operation-digest-mismatch',
          });
        }
        await completed;
        return immutableResult(operation.result);
      }

      const campaignStore = transaction.objectStore('campaigns');
      const [
        storedCampaign,
        storedActors,
        storedEncounters,
        storedLogs,
        storedOperations,
      ] = await Promise.all([
        requestResult(campaignStore.get(workspaceKey)),
        requestResult(transaction.objectStore('actors').getAll()),
        requestResult(transaction.objectStore('encounters').getAll()),
        requestResult(transaction.objectStore('logs').getAll()),
        requestResult(operationsStore.getAll()),
      ]);
      const currentValues = [
        ...(storedCampaign === undefined ? [] : [storedCampaign]),
        ...storedActors.filter(value =>
          belongsToWorkspace(value, workspaceKey)
        ),
        ...storedEncounters.filter(value =>
          belongsToWorkspace(value, workspaceKey)
        ),
        ...storedLogs.filter(value => belongsToWorkspace(value, workspaceKey)),
        ...storedOperations.filter(value =>
          belongsToWorkspace(value, workspaceKey)
        ),
      ];
      if (currentValues.some(value => (schemaVersion(value) ?? 0) > 1)) {
        await completed;
        return immutableResult({
          status: 'rejected',
          reason: 'unknown-schema',
        });
      }
      if (
        (storedCampaign !== undefined &&
          !validateCampaignRecord(storedCampaign).ok) ||
        !storedActors
          .filter(value => belongsToWorkspace(value, workspaceKey))
          .every(value => validateActorRecord(value).ok) ||
        !storedEncounters
          .filter(value => belongsToWorkspace(value, workspaceKey))
          .every(value => validateEncounterRecord(value).ok) ||
        !storedLogs
          .filter(value => belongsToWorkspace(value, workspaceKey))
          .every(value => validateLogRecord(value).ok) ||
        !storedOperations
          .filter(value => belongsToWorkspace(value, workspaceKey))
          .every(value => validateOperationRecord(value).ok)
      ) {
        await completed;
        return immutableResult({
          status: 'rejected',
          reason: 'unknown-schema',
        });
      }
      if (
        storedCampaign !== undefined &&
        !campaignMatchesSelection(
          storedCampaign as TableCampaignRecordV1,
          this.selection
        )
      ) {
        await completed;
        return immutableResult({
          status: 'rejected',
          reason: 'unknown-schema',
        });
      }

      const actualRevision =
        storedCampaign === undefined
          ? 0
          : (storedCampaign as TableCampaignRecordV1).revision;
      if (actualRevision !== expectedRevision) {
        await completed;
        return immutableResult({ status: 'conflict', actualRevision });
      }

      const actors = new Map(
        storedActors
          .filter(value => belongsToWorkspace(value, workspaceKey))
          .map(value => {
            const record = value as TableActorRecordV1;
            return [record.actorId, record] as const;
          })
      );
      const encounters = new Map(
        storedEncounters
          .filter(value => belongsToWorkspace(value, workspaceKey))
          .map(value => {
            const record = value as TableEncounterRecordV1;
            return [record.runId, record] as const;
          })
      );
      const logs = new Map(
        storedLogs
          .filter(value => belongsToWorkspace(value, workspaceKey))
          .map(value => {
            const record = value as TableLogRecordV1;
            return [record.archiveId, record] as const;
          })
      );
      for (const id of command.actors.delete) actors.delete(id);
      for (const record of command.actors.put)
        actors.set(record.actorId, structuredClone(record));
      for (const id of command.encounters.delete) encounters.delete(id);
      for (const record of command.encounters.put) {
        encounters.set(record.runId, structuredClone(record));
      }
      for (const id of command.logs.delete) logs.delete(id);
      for (const record of command.logs.put)
        logs.set(record.archiveId, structuredClone(record));

      if (!this.referencesAreValid(command, actors, encounters, logs)) {
        await completed;
        return immutableResult({
          status: 'rejected',
          reason: 'invalid-reference',
        });
      }

      const revision = actualRevision + 1;
      const campaign: TableCampaignRecordV1 = {
        ...(storedCampaign === undefined
          ? initialCampaignRecord(this.selection)
          : (storedCampaign as TableCampaignRecordV1)),
        revision,
        selectedRunId: command.campaign.selectedRunId,
        activeRunId: command.campaign.activeRunId,
        sourceMappings:
          storedCampaign === undefined
            ? []
            : structuredClone(
                (storedCampaign as TableCampaignRecordV1).sourceMappings
              ),
        adoptionVersion: 1,
      };
      const commandResult: TableRuntimeCommandResultV1 = {
        actorIds: command.actors.put.map(value => value.actorId),
        runIds: command.encounters.put.map(value => value.runId),
        archiveIds: command.logs.put.map(value => value.archiveId),
        deletedActorIds: [...command.actors.delete],
        deletedRunIds: [...command.encounters.delete],
        deletedArchiveIds: [...command.logs.delete],
      };
      const result: TableCommittedResult = {
        status: 'committed',
        revision,
        result: commandResult,
      };
      const operation: TableOperationRecordV1 = {
        schemaVersion: 1,
        workspaceKey,
        operationId,
        commandDigest: digest,
        expectedRevision,
        committedRevision: revision,
        result,
        createdAt: this.now(),
      };
      const operations = storedOperations
        .filter(value => belongsToWorkspace(value, workspaceKey))
        .map(value => value as TableOperationRecordV1)
        .concat(operation)
        .sort((left, right) =>
          left.committedRevision === right.committedRevision
            ? left.operationId.localeCompare(right.operationId)
            : left.committedRevision - right.committedRevision
        );
      const evicted = operations.splice(
        0,
        Math.max(0, operations.length - TABLE_LIMITS.maxOperations)
      );
      const candidate: TableWorkspaceSnapshotV1 = {
        workspaceKey,
        campaign,
        scenes: staticRaw.scenes as TableSceneRecordV1[],
        actors: [...actors.values()],
        encounters: [...encounters.values()],
        logs: [...logs.values()],
        sources: staticRaw.sources as TableSourceRecordV1[],
        tombstones: staticRaw.tombstones as TableTombstoneRecordV1[],
        operations,
      };
      const limits = validateWorkspaceLimits(candidate);
      if (!limits.ok) {
        await completed;
        return immutableResult({
          status: 'rejected',
          reason: 'limit-exceeded',
          detail: limits.reason,
        });
      }

      const actorStore = transaction.objectStore('actors');
      const encounterStore = transaction.objectStore('encounters');
      const logStore = transaction.objectStore('logs');
      for (const id of command.actors.delete)
        actorStore.delete([workspaceKey, id]);
      for (const record of command.actors.put)
        actorStore.put(structuredClone(record));
      for (const id of command.encounters.delete) {
        encounterStore.delete([workspaceKey, id]);
      }
      for (const record of command.encounters.put) {
        encounterStore.put(structuredClone(record));
      }
      for (const id of command.logs.delete) logStore.delete([workspaceKey, id]);
      for (const record of command.logs.put)
        logStore.put(structuredClone(record));
      campaignStore.put(campaign);
      operationsStore.put(operation);
      for (const old of evicted) {
        operationsStore.delete([workspaceKey, old.operationId]);
      }
      this.options.beforeTransactionCommit?.({ operationId, transaction });
      await completed;

      if (
        generation === this.generation &&
        workspaceKey === this.workspaceKey
      ) {
        await this.reload();
      }
      this.broadcastChannel?.postMessage({
        type: 'invalidate',
        workspaceKey,
        revision,
      });
      return immutableResult(result);
    } catch (error) {
      if (transaction) {
        try {
          transaction.abort();
        } catch {
          // The browser may already have aborted or completed the transaction.
        }
      }
      await completed?.catch(() => undefined);
      const name = errorName(error) ?? errorName(transaction?.error);
      return immutableResult({
        status: 'failed',
        reason:
          name === 'QuotaExceededError'
            ? 'quota-exceeded'
            : 'transaction-failed',
      });
    }
  }

  private async database(): Promise<IDBDatabase> {
    if (!this.databasePromise) {
      this.databasePromise = openTableDatabase({
        factory: this.options.factory,
        onVersionChange: () => {
          this.databasePromise = null;
        },
      }).catch(error => {
        this.databasePromise = null;
        throw error;
      });
    }
    return this.databasePromise;
  }

  private notify(): void {
    for (const listener of this.subscribers) listener(this.current);
  }

  private queueReload(): void {
    if (!this.active) return;
    this.reloadQueue = this.reloadQueue
      .then(() => this.reload())
      .catch(() => undefined);
  }

  private commandUsesWorkspace(
    command: TableRuntimeCommandV1,
    workspaceKey: string
  ): boolean {
    return [
      ...command.actors.put,
      ...command.encounters.put,
      ...command.logs.put,
    ].every(record => record.workspaceKey === workspaceKey);
  }

  private referencesAreValid(
    command: TableRuntimeCommandV1,
    actors: Map<string, TableActorRecordV1>,
    encounters: Map<string, TableEncounterRecordV1>,
    logs: Map<string, TableLogRecordV1>
  ): boolean {
    if (
      (command.campaign.selectedRunId !== null &&
        !encounters.has(command.campaign.selectedRunId)) ||
      (command.campaign.activeRunId !== null &&
        !encounters.has(command.campaign.activeRunId))
    ) {
      return false;
    }
    for (const encounter of encounters.values()) {
      const participantIds = new Set(
        encounter.participants.map(participant => participant.actorId)
      );
      if (
        encounter.participants.some(
          participant => !actors.has(participant.actorId)
        ) ||
        (encounter.currentActorId !== null &&
          !participantIds.has(encounter.currentActorId))
      ) {
        return false;
      }
    }
    return [...logs.values()].every(log => encounters.has(log.runId));
  }
}
