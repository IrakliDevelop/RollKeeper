import type { StateStorage } from 'zustand/middleware';

import { createSafeStorage } from '@/lib/safeStorage';

import { CAMPAIGN_SETTINGS_FAMILY_INVENTORY } from './campaignSettingsFamily';
import { campaignSettingsUsesIndexedDbAuthority } from './campaignSettingsLegacyProjection';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function campaigns(value: unknown): Array<Record<string, unknown>> | null {
  if (
    !record(value) ||
    !record(value.state) ||
    !Array.isArray(value.state.campaigns)
  )
    return null;
  return value.state.campaigns.filter(record);
}

export function createCampaignSettingsAwareDmStorage(
  backing?: Storage
): StateStorage {
  const safe = createSafeStorage(backing);
  const storage =
    backing ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
  return {
    getItem: safe.getItem,
    removeItem: safe.removeItem,
    setItem(key, nextRaw) {
      if (key !== 'rollkeeper-dm-data' || !storage)
        return safe.setItem(key, nextRaw);
      const previousRaw = storage.getItem(key);
      if (!previousRaw) return safe.setItem(key, nextRaw);
      try {
        const previous = JSON.parse(previousRaw) as unknown;
        const next = JSON.parse(nextRaw) as unknown;
        const previousCampaigns = campaigns(previous);
        const nextCampaigns = campaigns(next);
        if (!previousCampaigns || !nextCampaigns)
          return safe.setItem(key, nextRaw);
        let routed = false;
        for (const nextCampaign of nextCampaigns) {
          const code =
            typeof nextCampaign.code === 'string' ? nextCampaign.code : null;
          if (!code || !campaignSettingsUsesIndexedDbAuthority(storage, code))
            continue;
          const previousCampaign = previousCampaigns.find(
            candidate => candidate.code === code
          );
          if (!previousCampaign) continue;
          routed = true;
          for (const field of [
            ...CAMPAIGN_SETTINGS_FAMILY_INVENTORY.privateFields,
            ...CAMPAIGN_SETTINGS_FAMILY_INVENTORY.playerVisibleFields,
          ]) {
            if (Object.prototype.hasOwnProperty.call(previousCampaign, field)) {
              nextCampaign[field] = structuredClone(previousCampaign[field]);
            } else {
              delete nextCampaign[field];
            }
          }
        }
        if (!routed) return safe.setItem(key, nextRaw);
        const routedRaw = JSON.stringify(next);
        if (routedRaw === previousRaw) return;
        return safe.setItem(key, routedRaw);
      } catch {
        // An invalid legacy envelope cannot be safely rewritten by the router.
        return safe.setItem(key, nextRaw);
      }
    },
  };
}
