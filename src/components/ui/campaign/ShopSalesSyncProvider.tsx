'use client';

import { useEffect, useMemo, type ReactNode } from 'react';

import { useDmShopSalesSync } from '@/hooks/useDmShopSalesSync';
import { useShopSalesDrainLeader } from '@/hooks/useShopSalesDrainLeader';
import { useDmStore } from '@/store/dmStore';
import { useNPCStore } from '@/store/npcStore';
import type { CampaignNPC } from '@/types/encounter';

const EMPTY_NPCS: CampaignNPC[] = [];

/**
 * Mounts the shop-sales reconciliation drain (`useDmShopSalesSync`, Task 12)
 * for one campaign route group (VTT merchants Slice 3, Task 13a — the hook
 * existed and was tested, but nothing ever mounted it, so a purchase's coin
 * and stock never made it back into `npcStore`).
 *
 * Deliberately NOT mounted inside `NPCDetailDialog`/`NPCShopTab`: those only
 * exist while the DM has that specific NPC's dialog open, but the entire
 * point of server-recorded sales (Task 12) is that they accumulate in Redis
 * — up to `MAX_SALES_LOG_ENTRIES` — while the DM's tab is closed, and get
 * caught up in one drain on reconnect. A dialog-scoped mount would mean a
 * shop never reconciles unless the DM happens to reopen that exact NPC.
 *
 * Mounted here, in the campaign route-group layout (alongside
 * `NpcSyncProvider`/`EncounterSyncProvider`/`CombatLogArchiveSyncProvider`),
 * it instead runs on every `/dm/campaign/[code]/*` route the DM might
 * realistically be on — the dashboard, an encounter, a battlemap — without
 * requiring any NPC to be selected at all.
 *
 * One hook call for the whole campaign, never one per NPC:
 * `useDmShopSalesSync` already loops over every id in `npcIds` inside a
 * single poll tick, so mounting it per-NPC would multiply the polling
 * cadence against the same Redis keys instead of reconciling anything a
 * single mount doesn't already cover.
 *
 * `npcIds` is every NPC that currently has a `shop` field at all — not just
 * open ones — mirroring `useDmShopSalesSync`'s own doc comment: a sale made
 * while a shop was open can still be un-drained after the DM closes it.
 *
 * Still mounts in EVERY campaign tab — it must, so any tab can take over —
 * but only the tab holding `useShopSalesDrainLeader`'s lock actually drains
 * (VTT merchants follow-ups, Task 2). A DM with the dashboard open in one tab
 * and a battlemap in another would otherwise run two independent drains
 * against the same Redis log; see `shopSalesDrainLock.ts`'s doc comment for
 * why that double-applies sales.
 *
 * The `visibilitychange`/`focus` listener below covers exactly one case:
 * the LEADER tab itself becoming visible/focused again after being
 * backgrounded — it forces an immediate `drainNow()` instead of waiting out
 * that tab's throttled `setInterval` (backgrounded tabs are throttled to
 * roughly once a minute). It does NOT cover leadership staying in a
 * backgrounded tab while the DM actively works in a different, foregrounded
 * follower tab — e.g. dashboard-tab-opened-first, then battlemap-tab-opened.
 * The leader keeps the lock deliberately (see `shopSalesDrainLock.ts` for
 * why leadership does not follow visibility), so in that arrangement the
 * DM's visible purse can lag up to roughly a minute behind the leader's
 * throttled poll. This is display latency in the DM's own view ONLY — the
 * credit is never lost or double-applied, and once the leader tab's poll
 * (or its own visibility/focus event) fires, `crossTabNpcSync` propagates
 * the update into every other tab, including the one the DM is looking at.
 */
export function ShopSalesSyncProvider({
  campaignCode,
  children,
}: {
  campaignCode: string;
  children: ReactNode;
}) {
  const dmId = useDmStore(state => state.dmId);
  const npcs =
    useNPCStore(state => state.npcsByCampaign[campaignCode]) ?? EMPTY_NPCS;
  const npcIds = useMemo(
    () => npcs.filter(npc => npc.shop).map(npc => npc.id),
    [npcs]
  );

  const isLeader = useShopSalesDrainLeader(campaignCode);
  const { drainNow } = useDmShopSalesSync({
    campaignCode,
    dmId,
    npcIds,
    enabled: isLeader,
  });

  useEffect(() => {
    if (!isLeader || npcIds.length === 0) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') void drainNow();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [isLeader, drainNow, npcIds.length]);

  return <>{children}</>;
}
