import type { Redis } from '@upstash/redis';
import { campaignKey } from '@/lib/redis';
import type { CampaignData } from '@/types/campaign';

export type DmAuthResult = 'ok' | 'mismatch' | 'missing';

/**
 * Strict DM authority check. Unlike the legacy checkAndUpdateDmId helpers,
 * this NEVER rewrites the stored dmId — a mismatch is the caller's problem.
 */
export async function verifyDmAuthority(
  redis: Redis,
  code: string,
  dmId: string
): Promise<DmAuthResult> {
  const raw = await redis.get<string>(campaignKey(code));
  if (!raw) return 'missing';
  const campaign: CampaignData =
    typeof raw === 'string' ? JSON.parse(raw) : raw;
  return campaign.dmId === dmId ? 'ok' : 'mismatch';
}
