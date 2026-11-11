import { useDmStore } from '@/store/dmStore';
import type { CampaignNPC } from '@/types/encounter';

/** A non-2xx answer from `PUT /api/campaign/[code]/shops/[npcId]`. The status
 *  and server text are for the console only; the DM sees fixed copy. */
export class ShopPublishError extends Error {
  status: number | null;
  serverMessage?: string;

  constructor(status: number | null, serverMessage?: string) {
    super(serverMessage ?? `Shop publish failed (${status ?? 'no status'}).`);
    this.name = 'ShopPublishError';
    this.status = status;
    this.serverMessage = serverMessage;
  }
}

/**
 * Publishes (or tears down, when `npc.shop.open` is false) a shop through
 * `PUT /api/campaign/[code]/shops/[npcId]`. Rejects with a `ShopPublishError`
 * on a non-2xx response; a rejected `fetch` rethrows as is.
 */
export async function sendShopPublish(
  npc: CampaignNPC,
  dmId: string,
  entityIds: string[]
): Promise<void> {
  const response = await fetch(
    `/api/campaign/${encodeURIComponent(npc.campaignCode)}/shops/${encodeURIComponent(npc.id)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dmId, npc, entityIds }),
    }
  );
  if (response.ok) return;
  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  throw new ShopPublishError(response.status, body?.error);
}

/**
 * Closes the player-visible shop of an NPC that is about to be deleted. The
 * close `PUT` is the only teardown there is: without it the published shop
 * stays live and every later sale drains unreconciled. Sent for any NPC that
 * has a `shop`, whatever its local `open` flag says: a failed close leaves the
 * flag false while the published shop is still live. A no-op when the NPC has
 * no `shop`. Fire-and-forget, like the delete itself.
 */
export function closePublishedShop(npc: CampaignNPC): void {
  if (!npc.shop) return;
  sendShopPublish(
    {
      ...npc,
      shop: { ...npc.shop, open: false, updatedAt: new Date().toISOString() },
    },
    useDmStore.getState().dmId,
    []
  ).catch(console.error);
}
