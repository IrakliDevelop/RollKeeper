export function isCampaignSettingsServerEnabled(): boolean {
  return process.env.SUPABASE_CAMPAIGN_SETTINGS_SYNC_ENABLED === 'true';
}

export function isCampaignSettingsWorkerEnabled(): boolean {
  return process.env.CAMPAIGN_SETTINGS_PROJECTION_WORKER_ENABLED === 'true';
}

export function isCampaignSettingsClientVisible(): boolean {
  return process.env.NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE === 'true';
}
