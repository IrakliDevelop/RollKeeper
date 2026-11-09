import { CAMPAIGN_MEMBERSHIP_CSRF_HEADER } from '@/lib/campaignMembershipSecurity';

/**
 * Headers for every Table client request to a route that authorizes as a
 * mutation (`authorizeTableDm(..., true)` or
 * `validateCampaignMembershipMutation`): JSON body plus the CSRF marker the
 * server requires. Use this one object; a hand-written header set is how
 * the checkpoint restore shipped without the CSRF marker (PR08 desktop A1).
 */
export const TABLE_MUTATION_HEADERS: Readonly<Record<string, string>> =
  Object.freeze({
    'Content-Type': 'application/json',
    [CAMPAIGN_MEMBERSHIP_CSRF_HEADER]: '1',
  });
