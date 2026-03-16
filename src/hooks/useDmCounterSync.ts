import { useEffect, useRef, useCallback } from 'react';
import { useDmStore } from '@/store/dmStore';
import type { SharedCustomCounter } from '@/types/sharedState';

const DEBOUNCE_MS = 500;

export function useDmCounterSync(campaignCode: string, dmId: string) {
  const campaign = useDmStore(state => state.getCampaign(campaignCode));
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastPushedRef = useRef<string>('');

  const pushCounters = useCallback(
    async (label: string, counters: Record<string, number>) => {
      const data: SharedCustomCounter = {
        label,
        counters,
        updatedAt: new Date().toISOString(),
      };

      try {
        await fetch(`/api/campaign/${campaignCode}/shared`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feature: 'counters', data, dmId }),
        });
      } catch (err) {
        console.warn('Failed to sync custom counter:', err);
      }
    },
    [campaignCode, dmId]
  );

  useEffect(() => {
    const label = campaign?.customCounterLabel;
    const counters = campaign?.playerCounters;

    const fingerprint = JSON.stringify({ label, counters });
    if (fingerprint === lastPushedRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      lastPushedRef.current = fingerprint;

      if (!label) return;
      pushCounters(label, counters ?? {});
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [campaign?.customCounterLabel, campaign?.playerCounters, pushCounters]);
}
