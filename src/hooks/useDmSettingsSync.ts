import { useEffect, useRef, useCallback } from 'react';
import { useDmStore } from '@/store/dmStore';
import { legacyCampaignSettingsProjectionAllowed } from '@/lib/durableDm/campaignSettingsLegacyProjection';

const DEBOUNCE_MS = 500;

export function useDmSettingsSync(campaignCode: string, dmId: string) {
  const campaign = useDmStore(state => state.getCampaign(campaignCode));
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastPushedRef = useRef<string>('');
  const latestFingerprintRef = useRef<string>('');

  const pushSettings = useCallback(
    async (stackableInspiration: boolean) => {
      if (!legacyCampaignSettingsProjectionAllowed(localStorage, campaignCode))
        return true;
      try {
        const res = await fetch(`/api/campaign/${campaignCode}/shared`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            feature: 'settings',
            data: { stackableInspiration },
            dmId,
          }),
        });
        return res.ok;
      } catch (err) {
        console.warn('Failed to sync campaign settings:', err);
        return false;
      }
    },
    [campaignCode, dmId]
  );

  useEffect(() => {
    if (!campaign) return;
    if (!legacyCampaignSettingsProjectionAllowed(localStorage, campaignCode))
      return;

    const stackableInspiration = campaign.stackableInspiration ?? false;
    const fingerprint = JSON.stringify({ stackableInspiration });
    latestFingerprintRef.current = fingerprint;
    if (fingerprint === lastPushedRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Only fingerprint a delivered push — otherwise an offline/rejected POST
    // is remembered as sent and the house rule never reaches players. The
    // staleness check keeps an overlapping push that resolves late from
    // claiming delivery of a setting the DM has already changed.
    debounceRef.current = setTimeout(async () => {
      const ok = await pushSettings(stackableInspiration);
      if (ok && latestFingerprintRef.current === fingerprint) {
        lastPushedRef.current = fingerprint;
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [campaign, campaignCode, pushSettings]);
}
