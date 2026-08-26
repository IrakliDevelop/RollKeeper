import { createClient } from '@supabase/supabase-js';

import { isCampaignSettingsServerEnabled } from '@/lib/durableDm/slice11aFlags';
import type { Database } from '@/types/database.generated';

import { createSupabaseServerClient } from './server';

const MIN_SECRET_BYTES = 32;

export interface CampaignSettingsRpcClient {
  rpc(
    name: string,
    args: Record<string, unknown>
  ): Promise<{
    data: unknown;
    error: { code?: string; message: string } | null;
  }>;
}

function applicationConfig() {
  if (!isCampaignSettingsServerEnabled()) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || Buffer.byteLength(key, 'utf8') < MIN_SECRET_BYTES)
    return null;
  return { url, key };
}

export async function createCampaignSettingsUserClient(): Promise<CampaignSettingsRpcClient | null> {
  if (!isCampaignSettingsServerEnabled()) return null;
  const client = await createSupabaseServerClient();
  return client as unknown as CampaignSettingsRpcClient | null;
}

export function createCampaignSettingsApplicationClient(): CampaignSettingsRpcClient | null {
  const config = applicationConfig();
  if (!config) return null;
  return createClient<Database>(config.url, config.key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  }) as unknown as CampaignSettingsRpcClient;
}

export async function callCampaignSettingsRpc(
  client: CampaignSettingsRpcClient,
  name: string,
  args: Record<string, unknown>
) {
  const { data, error } = await client.rpc(name, args);
  if (error) {
    const wrapped = new Error(
      'Campaign settings request was rejected'
    ) as Error & { code?: string };
    wrapped.code = error.code;
    throw wrapped;
  }
  return data;
}

export async function campaignSettingsProjectionWriteAllowed(
  campaignCode: string
) {
  if (!isCampaignSettingsServerEnabled()) return true;
  const client = createCampaignSettingsApplicationClient();
  if (!client) return false;
  try {
    const data = await callCampaignSettingsRpc(
      client,
      'resolve_campaign_settings_projection_authority',
      { p_campaign_code: campaignCode }
    );
    return !(
      typeof data === 'object' &&
      data !== null &&
      'authority' in data &&
      data.authority === 'postgres'
    );
  } catch {
    return false;
  }
}
