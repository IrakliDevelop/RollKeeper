import { NPC_STORAGE_KEY } from '@/lib/durableDm/npcFamily';
import { npcUsesIndexedDbAuthority } from '@/lib/durableDm/npcLegacyAuthority';
import { isNpcClientVisible } from '@/lib/durableDm/slice11dFlags';
import { capAppliedSaleIds, capShopSalesLog } from '@/lib/shopSaleLedgerCaps';

import type { CampaignNPC } from '@/types/encounter';
import type { ShopSaleLogEntry } from '@/types/shop';

interface NpcSyncState {
  npcsByCampaign: Record<string, CampaignNPC[]>;
  appliedShopSaleIds: Record<string, string[]>;
  shopSalesLogByNpc: Record<string, ShopSaleLogEntry[]>;
}

export interface NpcStoreLike {
  getState: () => NpcSyncState;
  setState: (partial: Partial<NpcSyncState>) => void;
}

/**
 * The campaign codes whose NPCs this device no longer keeps in the legacy
 * key (mirrors `routedCampaignCodes` in `crossTabEncounterSync`). Resolved
 * once per storage event from the local and incoming NPCs. While the client
 * flag is off no campaign can be routed, so the merge stays byte-identical
 * to the pre-flag one and performs no extra localStorage reads.
 */
function routedCampaignCodes(
  local: Record<string, CampaignNPC[]>,
  incoming: Record<string, CampaignNPC[]>
): Set<string> {
  const routed = new Set<string>();
  if (!isNpcClientVisible() || typeof localStorage === 'undefined')
    return routed;
  const codes = new Set<string>([
    ...Object.keys(local),
    ...Object.keys(incoming),
  ]);
  for (const code of codes)
    if (npcUsesIndexedDbAuthority(localStorage, code)) routed.add(code);
  return routed;
}

function mergeNpcsForCampaign(
  local: CampaignNPC[],
  incoming: CampaignNPC[]
): { merged: CampaignNPC[]; changed: boolean } {
  let changed = false;
  const incomingById = new Map(
    incoming
      .filter(entry => entry && typeof entry.id === 'string')
      .map(entry => [entry.id, entry])
  );
  const merged = local.map(entry => {
    const candidate = incomingById.get(entry.id);
    incomingById.delete(entry.id);
    if (!candidate) return entry;
    if ((candidate.updatedAt ?? '') > (entry.updatedAt ?? '')) {
      changed = true;
      return candidate;
    }
    return entry;
  });
  for (const adopted of incomingById.values()) {
    merged.push(adopted);
    changed = true;
  }
  return { merged, changed };
}

/**
 * Unions the ledger, appending only ids `local` hasn't seen, then caps with
 * the SAME `capAppliedSaleIds` cap `recordAppliedShopSale` uses for its own
 * single-tab append — see that function's doc comment
 * (`shopSaleLedgerCaps.ts`) for why using two different caps here used to
 * silently undo the merge's headroom on the very next local write, and why
 * a single shared cap removes that failure mode rather than narrowing it.
 */
function mergeAppliedShopSaleIds(
  local: Record<string, string[]>,
  incoming: Record<string, string[]>
): { merged: Record<string, string[]>; changed: boolean } {
  let changed = false;
  const merged: Record<string, string[]> = { ...local };
  for (const [npcId, incomingIds] of Object.entries(incoming)) {
    const localIds = local[npcId] ?? [];
    const localSet = new Set(localIds);
    const additions = incomingIds.filter(id => !localSet.has(id));
    if (additions.length === 0) continue;
    merged[npcId] = capAppliedSaleIds([...localIds, ...additions]);
    changed = true;
  }
  return { merged, changed };
}

function mergeShopSalesLogByNpc(
  local: Record<string, ShopSaleLogEntry[]>,
  incoming: Record<string, ShopSaleLogEntry[]>
): { merged: Record<string, ShopSaleLogEntry[]>; changed: boolean } {
  let changed = false;
  const merged: Record<string, ShopSaleLogEntry[]> = { ...local };
  const npcIds = new Set([...Object.keys(local), ...Object.keys(incoming)]);
  for (const npcId of npcIds) {
    const localEntries = local[npcId] ?? [];
    const incomingEntries = incoming[npcId] ?? [];
    const byId = new Map(localEntries.map(entry => [entry.id, entry]));
    let addedAny = false;
    for (const entry of incomingEntries) {
      if (!byId.has(entry.id)) {
        byId.set(entry.id, entry);
        addedAny = true;
      }
    }
    if (!addedAny) continue;
    const combined = Array.from(byId.values()).sort(
      (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
    );
    merged[npcId] = capShopSalesLog(combined);
    changed = true;
  }
  return { merged, changed };
}

/**
 * Cross-tab NPC convergence (mirrors `crossTabEncounterSync`). The DM shop
 * drain (`useDmShopSalesSync`) credits `npc.currency` and appends to the
 * sales ledgers in whichever tab happens to be leader; zustand `persist`
 * writes localStorage but never listens for the `storage` event, so
 * without this the other tab's in-memory NPC store neither sees that
 * credit nor stops silently clobbering it on its own next persist.
 *
 * Merges per campaign/NPC by `updatedAt` — strictly newer wins (every
 * `updateNPC` mutation stamps it); unknown ids are adopted (created in
 * another tab); local-only NPCs are kept. `appliedShopSaleIds` and
 * `shopSalesLogByNpc` are UNIONED, never replaced — `appliedShopSaleIds`
 * is a money-idempotency ledger, and dropping a local id would let an
 * already-applied sale re-apply and double-credit the merchant's purse.
 *
 * Limitations (same as `crossTabEncounterSync`/`crossTabRosterSync`): no
 * deletion sync, last-writer-wins on exactly equal timestamps, and
 * campaigns routed to the cloud NPC family (`npcUsesIndexedDbAuthority`)
 * are skipped — their legacy envelope is deliberately frozen by
 * `createNpcAwareStorage`. `setState` is called only when something
 * actually changed, so the echo event the other tab receives finds equal
 * state and terminates.
 *
 * Two more limitations worth naming now that a merchant's currency rides on
 * this merge (both apply identically to `crossTabEncounterSync` — they are
 * pattern-level properties of this `storage`-event merge approach, not
 * regressions introduced here):
 *
 * (a) `setState` — and therefore this tab's own `persist` write — happens
 *     ONLY when this tab adopted something from the incoming snapshot. If a
 *     second tab persists a stale snapshot and closes before this tab's own
 *     next persist can echo back to it, that stale snapshot is simply never
 *     corrected in `localStorage` — nothing here re-broadcasts a merge
 *     result to a tab that has already gone away.
 * (b) The per-record merge is last-writer-wins on `updatedAt`. A concurrent
 *     edit to the same merchant NPC in the follower tab, timestamped after
 *     the drain applied a sale's currency credit in the leader tab, wins
 *     the merge outright and discards that credit — `updatedAt` alone
 *     cannot express "these two changes should combine."
 */
export function initCrossTabNpcSync(store: NpcStoreLike): () => void {
  if (typeof window === 'undefined') return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key !== NPC_STORAGE_KEY || !event.newValue) return;
    let incoming: NpcSyncState | undefined;
    try {
      const parsed: unknown = JSON.parse(event.newValue);
      incoming = (parsed as { state?: NpcSyncState } | null)?.state;
    } catch {
      return;
    }
    if (!incoming || typeof incoming !== 'object') return;
    if (!incoming.npcsByCampaign || typeof incoming.npcsByCampaign !== 'object')
      return;

    const current = store.getState();
    const incomingNpcsByCampaign = incoming.npcsByCampaign;
    const incomingAppliedShopSaleIds = incoming.appliedShopSaleIds ?? {};
    const incomingShopSalesLogByNpc = incoming.shopSalesLogByNpc ?? {};

    const routed = routedCampaignCodes(
      current.npcsByCampaign,
      incomingNpcsByCampaign
    );

    let changed = false;
    const npcsByCampaign = { ...current.npcsByCampaign };
    const codes = new Set([
      ...Object.keys(current.npcsByCampaign),
      ...Object.keys(incomingNpcsByCampaign),
    ]);
    for (const code of codes) {
      if (routed.has(code)) continue;
      const { merged, changed: campaignChanged } = mergeNpcsForCampaign(
        current.npcsByCampaign[code] ?? [],
        incomingNpcsByCampaign[code] ?? []
      );
      if (campaignChanged) {
        npcsByCampaign[code] = merged;
        changed = true;
      }
    }

    const { merged: appliedShopSaleIds, changed: saleIdsChanged } =
      mergeAppliedShopSaleIds(
        current.appliedShopSaleIds,
        incomingAppliedShopSaleIds
      );
    if (saleIdsChanged) changed = true;

    const { merged: shopSalesLogByNpc, changed: salesLogChanged } =
      mergeShopSalesLogByNpc(
        current.shopSalesLogByNpc,
        incomingShopSalesLogByNpc
      );
    if (salesLogChanged) changed = true;

    if (changed)
      store.setState({ npcsByCampaign, appliedShopSaleIds, shopSalesLogByNpc });
  };

  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}
