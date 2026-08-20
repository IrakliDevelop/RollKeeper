import { createClient } from '@supabase/supabase-js';

import {
  resolveCampaignMembershipRequest,
  type CampaignMembershipResolution,
} from '@/lib/campaignMembershipAuthority';
import { isCampaignMembershipServerEnabled } from '@/lib/campaignMembershipSecurity';
import type { Database } from '@/types/database.generated';

import {
  createCampaignMembershipApplicationGateway,
  createCampaignMembershipUserGateway,
  type CampaignMembershipRpcClient,
} from './campaignMembershipGateway';
import { createSupabaseServerClient } from './server';

const MIN_SECRET_BYTES = 32;

function validSecret(value: string | undefined): value is string {
  return Boolean(value && Buffer.byteLength(value, 'utf8') >= MIN_SECRET_BYTES);
}

export function getCampaignMembershipServerConfig() {
  if (!isCampaignMembershipServerEnabled()) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !validSecret(serviceRoleKey)) return null;
  return { url, serviceRoleKey };
}

function applicationClient(url: string, serviceRoleKey: string) {
  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  }) as unknown as CampaignMembershipRpcClient;
}

export async function createCampaignMembershipContextForRequest() {
  const config = getCampaignMembershipServerConfig();
  if (!config) return null;
  const userClient = await createSupabaseServerClient();
  const applicationGateway = createCampaignMembershipApplicationGateway(
    applicationClient(config.url, config.serviceRoleKey)
  );
  const userGateway = userClient
    ? createCampaignMembershipUserGateway(
        userClient as unknown as CampaignMembershipRpcClient
      )
    : null;
  return {
    applicationGateway,
    applicationClient: applicationClient(config.url, config.serviceRoleKey),
    userGateway,
    userClient,
  };
}

export async function authorizeCampaignMembershipRoute(
  displayCode: string,
  mutation: boolean
): Promise<CampaignMembershipResolution> {
  if (!isCampaignMembershipServerEnabled()) return { mode: 'legacy' };
  const context = await createCampaignMembershipContextForRequest();
  if (!context) return { mode: 'denied', status: 503 };
  return resolveCampaignMembershipRequest({
    enabled: true,
    displayCode,
    mutation,
    loadAuthority: code => context.applicationGateway.resolveAuthority(code),
    authorizeAccount: (campaignId, epoch) => {
      if (!context.userGateway) return Promise.reject(new Error('signed out'));
      return context.userGateway.authorize(campaignId, epoch);
    },
  });
}
