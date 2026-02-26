'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { characterApi } from '@/lib/api';
import { useAuthContext } from '@/contexts/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface SyncState {
  syncing: boolean;
  lastSynced: Date | null;
  error: string | null;
  connected: boolean;
}

interface UseCampaignSyncReturn extends SyncState {
  syncCharacter: (
    campaignId: string,
    characterId: string,
    characterData: Record<string, unknown>
  ) => Promise<boolean>;
  socket: Socket | null;
}

/**
 * Hook for syncing character data to a campaign.
 * Manages Socket.io connection for real-time updates.
 */
export function useCampaignSync(): UseCampaignSyncReturn {
  const { isAuthenticated } = useAuthContext();
  const [state, setState] = useState<SyncState>({
    syncing: false,
    lastSynced: null,
    error: null,
    connected: false,
  });
  const socketRef = useRef<Socket | null>(null);

  // Connect socket when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    const socket = io(API_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setState(prev => ({ ...prev, connected: true }));
    });

    socket.on('disconnect', () => {
      setState(prev => ({ ...prev, connected: false }));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated]);

  const syncCharacter = useCallback(
    async (
      campaignId: string,
      characterId: string,
      characterData: Record<string, unknown>
    ): Promise<boolean> => {
      setState(prev => ({ ...prev, syncing: true, error: null }));

      try {
        // Persist via REST API
        const result = await characterApi.sync(
          campaignId,
          characterId,
          characterData
        );

        if (!result.success) {
          setState(prev => ({
            ...prev,
            syncing: false,
            error: result.error?.message || 'Sync failed',
          }));
          return false;
        }

        // Broadcast via Socket.io for real-time DM updates
        if (socketRef.current?.connected) {
          socketRef.current.emit('sync_character', {
            campaignId,
            characterId,
            characterSnapshot: characterData,
          });
        }

        setState(prev => ({
          ...prev,
          syncing: false,
          lastSynced: new Date(),
        }));
        return true;
      } catch {
        setState(prev => ({
          ...prev,
          syncing: false,
          error: 'Network error during sync',
        }));
        return false;
      }
    },
    []
  );

  return {
    ...state,
    syncCharacter,
    socket: socketRef.current,
  };
}
