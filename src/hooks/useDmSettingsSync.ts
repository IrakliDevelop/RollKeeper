import { useEffect, useRef, useCallback } from 'react';
import { useDmStore } from '@/store/dmStore';

const DEBOUNCE_MS = 500;

export function useDmSettingsSync(campaignCode: string, dmId: string) {
  const campaign = useDmStore(state => state.getCampaign(campaignCode));
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastPushedRef = useRef<string>('');

  const pushSettings = useCallback(
    async (stackableInspiration: boolean) => {
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

    const stackableInspiration = campaign.stackableInspiration ?? false;
    const fingerprint = JSON.stringify({ stackableInspiration });
    if (fingerprint === lastPushedRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Only fingerprint a delivered push — otherwise an offline/rejected POST
    // is remembered as sent and the house rule never reaches players.
    debounceRef.current = setTimeout(async () => {
      if (await pushSettings(stackableInspiration)) {
        lastPushedRef.current = fingerprint;
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [campaign, pushSettings]);
}
