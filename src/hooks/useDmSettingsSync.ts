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
        await fetch(`/api/campaign/${campaignCode}/shared`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            feature: 'settings',
            data: { stackableInspiration },
            dmId,
          }),
        });
      } catch (err) {
        console.warn('Failed to sync campaign settings:', err);
      }
    },
    [campaignCode, dmId]
  );

  const stackableInspiration = campaign?.stackableInspiration ?? false;

  useEffect(() => {
    const fingerprint = JSON.stringify({ stackableInspiration });
    if (fingerprint === lastPushedRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      lastPushedRef.current = fingerprint;
      pushSettings(stackableInspiration);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [stackableInspiration, pushSettings]);
}
