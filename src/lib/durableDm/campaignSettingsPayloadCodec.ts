import { parseFogPresetLibrary } from '@/lib/fogPreset';
import type { CampaignInfo } from '@/types/campaign';

export type CampaignSettingsFields = Pick<
  CampaignInfo,
  | 'bannerUrl'
  | 'playerColors'
  | 'dmDashboardUi'
  | 'stackableInspiration'
  | 'customCounterLabel'
  | 'playerCounters'
  | 'fogPresets'
>;

export const CLEARED_CAMPAIGN_SETTINGS_FIELDS: CampaignSettingsFields = {
  bannerUrl: undefined,
  playerColors: undefined,
  dmDashboardUi: undefined,
  stackableInspiration: false,
  customCounterLabel: undefined,
  playerCounters: undefined,
  fogPresets: undefined,
};

/**
 * The single untrusted-payload boundary for campaign settings. Every
 * hydrate/restore/rollback path must go through here so a newly added field
 * cannot be silently dropped by a hand-written field list.
 */
export function campaignInfoFromCampaignSettingsPayload(
  payload: Record<string, unknown>
): CampaignSettingsFields {
  const fogPresets = parseFogPresetLibrary(payload.fogPresets);
  return {
    bannerUrl:
      typeof payload.bannerUrl === 'string' ? payload.bannerUrl : undefined,
    playerColors:
      payload.playerColors && typeof payload.playerColors === 'object'
        ? (payload.playerColors as Record<string, string>)
        : undefined,
    dmDashboardUi:
      payload.dmDashboardUi && typeof payload.dmDashboardUi === 'object'
        ? (payload.dmDashboardUi as CampaignInfo['dmDashboardUi'])
        : undefined,
    stackableInspiration: payload.stackableInspiration === true,
    customCounterLabel:
      typeof payload.customCounterLabel === 'string'
        ? payload.customCounterLabel
        : undefined,
    playerCounters:
      payload.playerCounters && typeof payload.playerCounters === 'object'
        ? (payload.playerCounters as Record<string, number>)
        : undefined,
    fogPresets: fogPresets.length > 0 ? fogPresets : undefined,
  };
}
