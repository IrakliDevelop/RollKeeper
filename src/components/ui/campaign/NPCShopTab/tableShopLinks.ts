'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import type { TableWorkspaceSelection } from '@/lib/table/repository';
import { readTableShopEntityIds } from '@/lib/table/shopLinks';

/**
 * The account whose Table this browser opens: the signed-in user, else the
 * guest namespace (the same rule as `useAuthenticatedTableWorkspace`).
 */
async function currentTableAccount(): Promise<
  TableWorkspaceSelection['account']
> {
  const client = createSupabaseBrowserClient();
  if (!client) return { kind: 'guest' };
  try {
    const { data } = await client.auth.getUser();
    return data.user?.id
      ? { kind: 'authenticated', accountId: data.user.id }
      : { kind: 'guest' };
  } catch {
    return { kind: 'guest' };
  }
}

/**
 * Repair 09 (D2): the Table token ids linked to this NPC in the campaign's
 * saved Table on this device (none when there is no Table yet).
 */
export async function loadTableShopEntityIds(
  campaignCode: string,
  npcId: string
): Promise<string[]> {
  return readTableShopEntityIds({
    account: await currentTableAccount(),
    sourceCampaignCode: campaignCode,
    npcId,
  });
}
