import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  isCampaignSettingsClientVisible,
  isCampaignSettingsServerEnabled,
  isCampaignSettingsWorkerEnabled,
} from './slice11aFlags';

describe('Slice 11A feature gates', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('keeps server, worker, and client visibility disabled by default', () => {
    expect(isCampaignSettingsServerEnabled()).toBe(false);
    expect(isCampaignSettingsWorkerEnabled()).toBe(false);
    expect(isCampaignSettingsClientVisible()).toBe(false);
  });

  it('requires separate server, worker, and client flags', () => {
    vi.stubEnv('SUPABASE_CAMPAIGN_SETTINGS_SYNC_ENABLED', 'true');
    expect(isCampaignSettingsServerEnabled()).toBe(true);
    expect(isCampaignSettingsWorkerEnabled()).toBe(false);
    expect(isCampaignSettingsClientVisible()).toBe(false);

    vi.stubEnv('CAMPAIGN_SETTINGS_PROJECTION_WORKER_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE', 'true');
    expect(isCampaignSettingsWorkerEnabled()).toBe(true);
    expect(isCampaignSettingsClientVisible()).toBe(true);
  });
});
