import { useCallback, useRef, useState } from 'react';
import { CharacterState } from '@/types/character';
import { usePlayerStore, PlayerCharacter } from '@/store/playerStore';

interface UsePlayerSyncOptions {
  characterId: string;
}

interface UsePlayerSyncResult {
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  lastSyncedAt: string | null;
  campaignCode: string | null;
  campaignName: string | null;
  autoSync: boolean;
  syncEnabled: boolean;
  syncNow: (characterData: CharacterState) => Promise<void>;
  toggleAutoSync: () => void;
  leaveCampaign: () => void;
}

export function usePlayerSync({
  characterId,
}: UsePlayerSyncOptions): UsePlayerSyncResult {
  const { getCharacterById, updateCharacter } = usePlayerStore();
  const character = getCharacterById(characterId);

  const [syncStatus, setSyncStatus] = useState<
    'idle' | 'syncing' | 'synced' | 'error'
  >('idle');
  const syncInFlight = useRef(false);
  const pendingSyncData = useRef<CharacterState | null>(null);

  const campaignCode = character?.campaignCode ?? null;
  const campaignName = character?.campaignName ?? null;
  const autoSync = character?.autoSync ?? true;
  const syncEnabled = character?.syncEnabled ?? false;
  const lastSyncedAt = character?.lastSyncedAt ?? null;

  const rejoinInFlight = useRef(false);

  const attemptRejoin = useCallback(
    async (characterData: CharacterState) => {
      if (rejoinInFlight.current || !campaignCode) return false;
      rejoinInFlight.current = true;
      try {
        const res = await fetch(`/api/campaign/${campaignCode}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerId: characterId,
            playerName: characterData.playerName || characterData.name,
            characterId,
            characterName: characterData.name,
            characterData,
          }),
        });
        return res.ok;
      } catch {
        return false;
      } finally {
        rejoinInFlight.current = false;
      }
    },
    [campaignCode, characterId]
  );

  const syncNow = useCallback(
    async (characterData: CharacterState) => {
      if (!campaignCode || !syncEnabled) return;

      if (syncInFlight.current) {
        pendingSyncData.current = characterData;
        return;
      }

      syncInFlight.current = true;
      setSyncStatus('syncing');

      try {
        const res = await fetch(`/api/campaign/${campaignCode}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerId: characterId,
            playerName: characterData.playerName || characterData.name,
            characterId,
            characterName: characterData.name,
            characterData,
          }),
        });

        if (!res.ok) {
          const rejoined = await attemptRejoin(characterData);
          if (!rejoined) {
            throw new Error('Sync failed');
          }
        }

        const data = res.ok ? await res.json() : null;
        const syncedAt = data?.lastSynced || new Date().toISOString();

        updateCharacter(characterId, { lastSyncedAt: syncedAt });
        setSyncStatus('synced');
      } catch (err) {
        console.warn('Campaign sync failed (non-blocking):', err);
        setSyncStatus('error');
      } finally {
        syncInFlight.current = false;

        const pending = pendingSyncData.current;
        if (pending) {
          pendingSyncData.current = null;
          syncNow(pending);
        }
      }
    },
    [campaignCode, syncEnabled, characterId, updateCharacter, attemptRejoin]
  );

  const toggleAutoSync = useCallback(() => {
    if (!character) return;
    updateCharacter(characterId, { autoSync: !autoSync });
  }, [character, characterId, autoSync, updateCharacter]);

  const leaveCampaign = useCallback(() => {
    updateCharacter(characterId, {
      campaignCode: undefined,
      campaignName: undefined,
      syncEnabled: undefined,
      autoSync: undefined,
      lastSyncedAt: undefined,
    } as Partial<PlayerCharacter>);
    setSyncStatus('idle');
  }, [characterId, updateCharacter]);

  return {
    syncStatus,
    lastSyncedAt,
    campaignCode,
    campaignName,
    autoSync,
    syncEnabled,
    syncNow,
    toggleAutoSync,
    leaveCampaign,
  };
}
