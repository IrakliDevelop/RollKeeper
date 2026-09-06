import { describe, expect, it } from 'vitest';
import {
  CLEARED_CAMPAIGN_SETTINGS_FIELDS,
  campaignInfoFromCampaignSettingsPayload,
} from './campaignSettingsPayloadCodec';

const preset = {
  v: 1,
  id: 'fp_1',
  name: 'Mist',
  material: { v: 1, kind: 'solid', color: '#102030' },
  createdAt: '2026-09-05T00:00:00.000Z',
  updatedAt: '2026-09-05T00:00:00.000Z',
};

describe('campaignInfoFromCampaignSettingsPayload', () => {
  it('reconstructs every family field with the legacy coercions', () => {
    expect(
      campaignInfoFromCampaignSettingsPayload({
        bannerUrl: 'https://x/banner.png',
        playerColors: { p1: '#fff' },
        dmDashboardUi: { playersSectionOpen: true },
        stackableInspiration: true,
        customCounterLabel: 'Momentum',
        playerCounters: { p1: 2 },
        fogPresets: [preset, { broken: true }],
      })
    ).toEqual({
      bannerUrl: 'https://x/banner.png',
      playerColors: { p1: '#fff' },
      dmDashboardUi: { playersSectionOpen: true },
      stackableInspiration: true,
      customCounterLabel: 'Momentum',
      playerCounters: { p1: 2 },
      fogPresets: [preset],
    });
  });

  it('maps absent, wrong-typed, and empty values to undefined (stackable to false)', () => {
    expect(
      campaignInfoFromCampaignSettingsPayload({
        bannerUrl: 7,
        stackableInspiration: 'yes',
        fogPresets: [],
      })
    ).toEqual(CLEARED_CAMPAIGN_SETTINGS_FIELDS);
    expect(campaignInfoFromCampaignSettingsPayload({})).toEqual(
      CLEARED_CAMPAIGN_SETTINGS_FIELDS
    );
  });

  it('exposes the cleared shape used by rollback and hide flows', () => {
    expect(CLEARED_CAMPAIGN_SETTINGS_FIELDS).toEqual({
      bannerUrl: undefined,
      playerColors: undefined,
      dmDashboardUi: undefined,
      stackableInspiration: false,
      customCounterLabel: undefined,
      playerCounters: undefined,
      fogPresets: undefined,
    });
  });
});
