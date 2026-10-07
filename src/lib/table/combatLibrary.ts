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
  type TableCampaignRecordV1,
  type TableEncounterRecordV1,
} from './schema';

export interface TableSceneRunLink {
  runId: string;
  sceneId: string;
  label: string | null;
  localWorkspaceId: string;
  /** Opened by the campaign route without an explicit workspace selection. */
  defaultWorkspace: boolean;
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
export async function findSceneRunsForCampaign(options: {
  factory?: IDBFactory | null;
  account: TableWorkspaceSelection['account'];
  campaignCode: string;
}): Promise<Map<string, TableSceneRunLink[]>> {
  const empty = new Map<string, TableSceneRunLink[]>();
  const factory =
    options.factory === null
      ? null
      : (options.factory ??
        (typeof indexedDB === 'undefined' ? null : indexedDB));
  if (!factory || typeof factory.databases !== 'function') return empty;
  let names: Array<string | undefined>;
  try {
    names = (await factory.databases()).map(database => database.name);
  } catch {
    return empty;
  }
  if (!names.includes(TABLE_DATABASE_NAME)) return empty;

  let database: IDBDatabase;
  try {
    database = await openTableDatabase({ factory });
  } catch {
    return empty;
  }
  try {
    const transaction = database.transaction(
      ['campaigns', 'encounters', 'tombstones'],
      'readonly'
    );
    const completed = transactionComplete(transaction);
    const [campaigns, encounters, tombstones] = await Promise.all([
      requestResult(transaction.objectStore('campaigns').getAll()),
      requestResult(transaction.objectStore('encounters').getAll()),
      requestResult(transaction.objectStore('tombstones').getAll()),
    ]);
    await completed;
    const namespace = namespaceOf(options.account);
    const workspaces = (campaigns as unknown[])
      .filter(value => validateCampaignRecord(value).ok)
      .map(value => value as TableCampaignRecordV1)
      .filter(
        campaign =>
          campaign.namespaceKey === namespace &&
          (campaign.routeCampaignCode ?? campaign.sourceCampaignCode) ===
            options.campaignCode
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
        });
        result.set(run.sourceEncounterId!, list);
      }
    }
    return result;
  } catch {
    return empty;
  } finally {
    database.close();
  }
}
