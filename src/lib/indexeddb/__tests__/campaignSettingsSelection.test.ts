import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  hasCampaignSettingsSelection,
  isCampaignSettingsParticipant,
  readCampaignSettingsSelection,
  selectCampaignSettings,
} from '../campaignSettingsSelection';

describe('campaign_settings explicit selection', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is disabled and unselected by default without reading storage', () => {
    const storage = { getItem: vi.fn(() => null) };
    expect(isCampaignSettingsParticipant(storage, 'user:a', 'campaign-a')).toBe(
      false
    );
    expect(storage.getItem).not.toHaveBeenCalled();
  });

  it('requires client visibility plus exact account/campaign selection', () => {
    vi.stubEnv('NEXT_PUBLIC_CAMPAIGN_SETTINGS_SYNC_VISIBLE', 'true');
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    expect(() =>
      selectCampaignSettings(storage, {
        namespace: 'user:a',
        campaignId: 'campaign-a',
        confirmed: false,
        recovery: {
          runId: 'run',
          manifestHash: 'a'.repeat(64),
          createdAt: 'now',
        },
        now: () => 'now',
      })
    ).toThrow(/confirmation/i);
    selectCampaignSettings(storage, {
      namespace: 'user:a',
      campaignId: 'campaign-a',
      confirmed: true,
      recovery: {
        runId: 'run',
        manifestHash: 'a'.repeat(64),
        createdAt: 'now',
      },
      now: () => 'now',
    });
    expect(hasCampaignSettingsSelection(storage, 'user:a', 'campaign-a')).toBe(
      true
    );
    expect(isCampaignSettingsParticipant(storage, 'user:a', 'campaign-a')).toBe(
      true
    );
    expect(isCampaignSettingsParticipant(storage, 'user:b', 'campaign-a')).toBe(
      false
    );
    expect(isCampaignSettingsParticipant(storage, 'user:a', 'campaign-b')).toBe(
      false
    );
    expect(
      readCampaignSettingsSelection(storage, 'user:a', 'campaign-a')
    ).toMatchObject({ family: 'campaign_settings' });
  });

  it('rejects guest, invalid receipts, malformed records, and mismatched scopes', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const base = {
      campaignId: 'campaign-a',
      confirmed: true,
      recovery: {
        runId: 'run',
        manifestHash: 'a'.repeat(64),
        createdAt: 'now',
      },
      now: () => 'now',
    } as const;
    expect(() =>
      selectCampaignSettings(storage, { ...base, namespace: 'guest' })
    ).toThrow(/owner/i);
    expect(() =>
      selectCampaignSettings(storage, {
        ...base,
        namespace: 'user:a',
        recovery: { ...base.recovery, manifestHash: 'bad' },
      })
    ).toThrow(/receipt/i);
    values.set('rollkeeper:campaign-settings-selection:user:a:campaign-a', '{');
    expect(
      readCampaignSettingsSelection(storage, 'user:a', 'campaign-a')
    ).toBeNull();
    values.set(
      'rollkeeper:campaign-settings-selection:user:a:campaign-a',
      JSON.stringify({
        version: 1,
        namespace: 'user:b',
        campaignId: 'campaign-a',
        family: 'campaign_settings',
        selectedAt: 'now',
        recovery: base.recovery,
      })
    );
    expect(hasCampaignSettingsSelection(storage, 'user:a', 'campaign-a')).toBe(
      false
    );
  });
});
