import {
  TABLE_DATABASE_NAME,
  openTableDatabase,
  requestResult,
  transactionComplete,
} from './database';
import type { TableWorkspaceSelection } from './repository';
import {
  validateCampaignRecord,
  validateEncounterRecord,
  validateSceneRecord,
  type TableCampaignRecordV1,
  type TableEncounterRecordV1,
  type TableSceneRecordV1,
} from './schema';

export interface TableSceneRunLink {
  runId: string;
  sceneId: string;
  label: string | null;
  localWorkspaceId: string;
  /** Opened by the campaign route without an explicit workspace selection. */
  defaultWorkspace: boolean;
  /** PR06 W7 run selector: the scene's local name and the run's creation. */
  sceneName: string | null;
  createdAt: string;
}

function namespaceOf(account: TableWorkspaceSelection['account']): string {
  return account.kind === 'guest'
    ? 'guest'
    : `user:${encodeURIComponent(account.accountId)}`;
}

/**
 * Read-only lookup for the encounter library's "Open scene run" (D10, R2-9).
 * It never creates the Table database: when `indexedDB.databases()` is
 * unavailable or does not list it, there is simply no affordance.
 */
export async function findSceneRunsForEncounter(options: {
  factory?: IDBFactory | null;
  account: TableWorkspaceSelection['account'];
  campaignCode: string;
  encounterId: string;
}): Promise<TableSceneRunLink[]> {
  const all = await findSceneRunsForCampaign(options);
  return all.get(options.encounterId) ?? [];
}

/**
 * Every adopted scene run of the campaign keyed by source encounter id, in
 * ONE read (F7) — the encounter library shares this per list.
 */
/**
 * Opens the Table database read-only ONLY when it already exists (never
 * creates it) and reads the listed stores in one transaction.
 */
async function readExisting<T extends string>(
  factoryOption: IDBFactory | null | undefined,
  stores: readonly T[]
): Promise<Record<T, unknown[]> | null> {
  const factory =
    factoryOption === null
      ? null
      : (factoryOption ??
        (typeof indexedDB === 'undefined' ? null : indexedDB));
  if (!factory || typeof factory.databases !== 'function') return null;
  let names: Array<string | undefined>;
  try {
    names = (await factory.databases()).map(database => database.name);
  } catch {
    return null;
  }
  if (!names.includes(TABLE_DATABASE_NAME)) return null;
  let database: IDBDatabase;
  try {
    database = await openTableDatabase({ factory });
  } catch {
    return null;
  }
  try {
    const transaction = database.transaction([...stores], 'readonly');
    const completed = transactionComplete(transaction);
    const values = await Promise.all(
      stores.map(store =>
        requestResult(transaction.objectStore(store).getAll())
      )
    );
    await completed;
    return Object.fromEntries(
      stores.map((store, index) => [store, values[index] as unknown[]])
    ) as Record<T, unknown[]>;
  } catch {
    return null;
  } finally {
    database.close();
  }
}

function campaignWorkspaces(
  campaigns: unknown[],
  account: TableWorkspaceSelection['account'],
  campaignCode: string
): TableCampaignRecordV1[] {
  const namespace = namespaceOf(account);
  return campaigns
    .filter(value => validateCampaignRecord(value).ok)
    .map(value => value as TableCampaignRecordV1)
    .filter(
      campaign =>
        campaign.namespaceKey === namespace &&
        (campaign.routeCampaignCode ?? campaign.sourceCampaignCode) ===
          campaignCode
    );
}

/**
 * PR06 W8: the adopted Table scene of an original battle map, for the
 * map route's "Open in Table" (read-only; never creates the database).
 */
export async function findTableSceneForMap(options: {
  factory?: IDBFactory | null;
  account: TableWorkspaceSelection['account'];
  campaignCode: string;
  mapId: string;
}): Promise<{
  sceneId: string;
  localWorkspaceId: string;
  defaultWorkspace: boolean;
} | null> {
  const read = await readExisting(options.factory, [
    'campaigns',
    'tombstones',
  ] as const);
  if (!read) return null;
  const deleted = new Set(
    (read.tombstones as Array<Record<string, unknown>>)
      .filter(value => value?.kind === 'scene')
      .map(value => `${String(value.workspaceKey)}|${String(value.id)}`)
  );
  const workspaces = campaignWorkspaces(
    read.campaigns,
    options.account,
    options.campaignCode
  ).sort(
    (left, right) =>
      Number(right.sourceCampaignCode === options.campaignCode) -
      Number(left.sourceCampaignCode === options.campaignCode)
  );
  for (const campaign of workspaces) {
    const mapping = campaign.sourceMappings.find(
      value =>
        value.sourceCampaignId === options.campaignCode &&
        value.sourceMapId === options.mapId &&
        !deleted.has(`${campaign.workspaceKey}|${value.sceneId}`)
    );
    if (mapping)
      return {
        sceneId: mapping.sceneId,
        localWorkspaceId: campaign.localWorkspaceId,
        defaultWorkspace: campaign.sourceCampaignCode === options.campaignCode,
      };
  }
  return null;
}

export async function findSceneRunsForCampaign(options: {
  factory?: IDBFactory | null;
  account: TableWorkspaceSelection['account'];
  campaignCode: string;
}): Promise<Map<string, TableSceneRunLink[]>> {
  const empty = new Map<string, TableSceneRunLink[]>();
  const read = await readExisting(options.factory, [
    'campaigns',
    'scenes',
    'encounters',
    'tombstones',
  ] as const);
  if (!read) return empty;
  try {
    const { encounters, tombstones, scenes } = read;
    const workspaces = campaignWorkspaces(
      read.campaigns,
      options.account,
      options.campaignCode
    );
    const sceneNames = new Map(
      (scenes as unknown[])
        .filter(value => validateSceneRecord(value).ok)
        .map(value => value as TableSceneRecordV1)
        .map(scene => [
          `${scene.workspaceKey}|${scene.sceneId}`,
          scene.map.name,
        ])
    );
    const deleted = new Set(
      (tombstones as Array<Record<string, unknown>>)
        .filter(value => value?.kind === 'encounter')
        .map(value => `${String(value.workspaceKey)}|${String(value.id)}`)
    );
    const result = new Map<string, TableSceneRunLink[]>();
    for (const campaign of workspaces) {
      const runs = (encounters as unknown[])
        .filter(value => validateEncounterRecord(value).ok)
        .map(value => value as TableEncounterRecordV1)
        .filter(
          run =>
            run.workspaceKey === campaign.workspaceKey &&
            run.sourceEncounterId !== null &&
            !deleted.has(`${run.workspaceKey}|${run.runId}`)
        )
        .sort((left, right) => left.runId.localeCompare(right.runId));
      for (const run of runs) {
        const list = result.get(run.sourceEncounterId!) ?? [];
        list.push({
          runId: run.runId,
          sceneId: run.sceneId,
          label: run.label ?? null,
          localWorkspaceId: campaign.localWorkspaceId,
          defaultWorkspace:
            campaign.sourceCampaignCode === options.campaignCode,
          sceneName:
            sceneNames.get(`${run.workspaceKey}|${run.sceneId}`) ?? null,
          createdAt: run.createdAt,
        });
        result.set(run.sourceEncounterId!, list);
      }
    }
    return result;
  } catch {
    return empty;
  }
}
