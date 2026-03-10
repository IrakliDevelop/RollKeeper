import { useState, useEffect, useCallback, useRef } from 'react';
import { CampaignPlayerData } from '@/types/campaign';

interface UseCampaignSyncOptions {
  code: string;
  dmId: string;
  campaignName: string;
  createdAt: string;
  interval?: number;
  enabled?: boolean;
}

interface UseCampaignSyncResult {
  players: CampaignPlayerData[];
  campaignName: string | null;
  loading: boolean;
  error: string | null;
  lastFetched: Date | null;
  refresh: () => Promise<void>;
}

export function useCampaignSync({
  code,
  dmId,
  campaignName: localCampaignName,
  createdAt,
  interval = 10000,
  enabled = true,
}: UseCampaignSyncOptions): UseCampaignSyncResult {
  const [players, setPlayers] = useState<CampaignPlayerData[]>([]);
  const [campaignName, setCampaignName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const restoringRef = useRef(false);

  const restoreCampaign = useCallback(async () => {
    if (restoringRef.current) return;
    restoringRef.current = true;
    try {
      await fetch(`/api/campaign/${code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dmId,
          campaignName: localCampaignName,
          createdAt,
        }),
      });
    } finally {
      restoringRef.current = false;
    }
  }, [code, dmId, localCampaignName, createdAt]);

  const fetchPlayers = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaign/${code}/players`);
      if (!res.ok) {
        throw new Error('Failed to fetch players');
      }

      const data = await res.json();

      if (data.campaign === null) {
        await restoreCampaign();
        setCampaignName(localCampaignName);
      } else {
        setCampaignName(data.campaign?.name ?? null);
      }

      setPlayers(data.players ?? []);
      setError(null);
      setLastFetched(new Date());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch player data'
      );
    } finally {
      setLoading(false);
    }
  }, [code, localCampaignName, restoreCampaign]);

  useEffect(() => {
    if (!enabled || !code) return;

    fetchPlayers();

    intervalRef.current = setInterval(fetchPlayers, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [code, interval, enabled, fetchPlayers]);

  return {
    players,
    campaignName,
    loading,
    error,
    lastFetched,
    refresh: fetchPlayers,
  };
}
