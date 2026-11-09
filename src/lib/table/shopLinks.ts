import { openTableDatabase, requestResult } from './database';
import { TableRepository, type TableWorkspaceSelection } from './repository';
import { adoptedActorIdentity } from './roster';
import type { TableCampaignRecordV1, TableWorkspaceSnapshotV1 } from './schema';

/** Matches `MAX_ENTITY_IDS` in the shop route and `MAX_SHOP_ENTITY_IDS`. */
const MAX_TABLE_SHOP_ENTITY_IDS = 50;

/**
 * Repair 09 (D2): the token ids a player can tap to reach this NPC's shop on
 * a Table scene. A Table DM token's `entityId` is its scene member id
 * (`dmTokenFields`), and the NPC link lives on the Table actor, not in
 * `encounterStore`, so the encounter-only resolution found nothing.
 *
 * Counts members, across every scene, that have a member id, are not
 * removed and are not player-controlled, and whose actor is either
 * - a DM-managed actor added from this campaign NPC
 *   (`profile.sourceKind === 'campaign-npc'`; bestiary ids never match), or
 * - an adopted encounter entity whose retained source names this NPC
 *   (`npcSourceId`); its legacy entity id is linked too, because tokens
 *   copied from the encounter canvas keep it.
 */
export function tableShopEntityIds(
  snapshot: TableWorkspaceSnapshotV1,
  npcId: string
): string[] {
  const ids = new Set<string>();
  for (const scene of snapshot.scenes) {
    for (const member of scene.members) {
      if (
        !member.sceneMemberId ||
        member.removedAt !== undefined ||
        member.control?.kind === 'player'
      )
        continue;
      const actor = snapshot.actors.find(
        value => value.actorId === member.actorId
      );
      if (
        actor?.actorKind === 'dm-managed' &&
        actor.profile?.sourceKind === 'campaign-npc' &&
        actor.profile.sourceId === npcId
      ) {
        ids.add(member.sceneMemberId);
        continue;
      }
      const adopted = adoptedActorIdentity(
        snapshot,
        member.actorId,
        scene.sceneId
      );
      if (adopted?.entity?.npcSourceId === npcId) {
        ids.add(member.sceneMemberId);
        ids.add(adopted.entityId);
      }
    }
  }
  return [...ids].slice(0, MAX_TABLE_SHOP_ENTITY_IDS);
}

/**
 * Reads the default Table workspace of this campaign for `account` (the one
 * the Table page would open) and returns its shop links for `npcId`. Never
 * creates a workspace: with none, or with more than one matching saved
 * Table, it returns an empty list.
 */
export async function readTableShopEntityIds(options: {
  account: TableWorkspaceSelection['account'];
  sourceCampaignCode: string;
  npcId: string;
  factory?: IDBFactory | null;
}): Promise<string[]> {
  const namespace =
    options.account.kind === 'guest'
      ? 'guest'
      : `user:${options.account.accountId}`;
  const database = await openTableDatabase({ factory: options.factory });
  let campaigns: unknown[];
  try {
    campaigns = (await requestResult(
      database.transaction('campaigns').objectStore('campaigns').getAll()
    )) as unknown[];
  } finally {
    database.close();
  }
  const matches = (campaigns as Partial<TableCampaignRecordV1>[]).filter(
    campaign =>
      campaign?.namespaceKey === namespace &&
      campaign.sourceCampaignCode === options.sourceCampaignCode
  );
  if (matches.length !== 1 || !matches[0]?.localWorkspaceId) return [];
  const repository = new TableRepository({
    factory: options.factory,
    selection: {
      account: options.account,
      workspace: {
        localWorkspaceId: matches[0].localWorkspaceId,
        sourceCampaignCode: options.sourceCampaignCode,
        routeCampaignCode:
          matches[0].routeCampaignCode ?? options.sourceCampaignCode,
      },
    },
    broadcastChannel: null,
  });
  try {
    const read = await repository.start();
    return read.status === 'ready'
      ? tableShopEntityIds(read.snapshot, options.npcId)
      : [];
  } finally {
    repository.dispose();
  }
}
