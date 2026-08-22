import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  legacyCampaignSettingsProjectionAllowed,
  writeCampaignSettingsProjectionAuthority,
} from './campaignSettingsLegacyProjection';

describe('campaign settings legacy projection authority', () => {
  beforeEach(() => localStorage.clear());

  it('is byte-compatible legacy behavior while the client gate is off', () => {
    writeCampaignSettingsProjectionAuthority(localStorage, 'ABC', {
      version: 1,
      authority: 'postgres',
      epoch: 1,
      campaignId: 'cloud-a',
    });
    expect(legacyCampaignSettingsProjectionAllowed(localStorage, 'ABC')).toBe(
      true
    );
  });

  it('suppresses legacy publication only after a gated Postgres cutover', () => {
    vi.stubEnv('NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE', 'true');
    writeCampaignSettingsProjectionAuthority(localStorage, 'ABC', {
      version: 1,
      authority: 'postgres',
      epoch: 2,
      campaignId: 'cloud-a',
    });
    expect(legacyCampaignSettingsProjectionAllowed(localStorage, 'ABC')).toBe(
      false
    );
    writeCampaignSettingsProjectionAuthority(localStorage, 'ABC', {
      version: 1,
      authority: 'legacy_restored',
      epoch: 3,
      campaignId: 'cloud-a',
    });
    expect(legacyCampaignSettingsProjectionAllowed(localStorage, 'ABC')).toBe(
      true
    );
    vi.unstubAllEnvs();
  });
});
