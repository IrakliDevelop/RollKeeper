'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtime } from '@/contexts/RealtimeContext';
import { createCharacterUpdate, createCombatUpdate, type CharacterUpdateType, type CombatUpdateType } from '@/lib/realtime';

export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'conflict' | 'error' | 'offline';

export interface SyncState {
  status: SyncStatus;
  lastSyncTime: number;
  pendingChanges: Change[];
  conflictData?: ConflictData;
  errorMessage?: string;
}

export interface Change {
  id: string;
  type: 'character' | 'combat';
  characterId?: string;
  campaignId?: string;
  data: any;
  timestamp: number;
  retryCount: number;
}

export interface ConflictData {
  localValue: any;
  remoteValue: any;
  path: string;
  timestamp: number;
}

const MAX_RETRY_ATTEMPTS = 3;
const SYNC_DEBOUNCE_MS = 1000;
const OFFLINE_STORAGE_KEY = 'rollkeeper-offline-changes';

export function useSync() {
  const { isAuthenticated, accessToken } = useAuth();
  const { sendUpdate, isConnected } = useRealtime();
  
  const [syncState, setSyncState] = useState<SyncState>({
    status: 'synced',
    lastSyncTime: Date.now(),
    pendingChanges: [],
  });

  const [syncTimeout, setSyncTimeout] = useState<NodeJS.Timeout | null>(null);

  // Load pending changes from localStorage on mount
  useEffect(() => {
    loadPendingChanges();
  }, []);

  // Save pending changes to localStorage whenever they change
  useEffect(() => {
    savePendingChanges();
  }, [syncState.pendingChanges]);

  // Update sync status based on connection and auth state
  useEffect(() => {
    if (!isAuthenticated) {
      setSyncState(prev => ({ ...prev, status: 'offline' }));
    } else if (!isConnected) {
      setSyncState(prev => ({ ...prev, status: 'offline' }));
    } else if (syncState.pendingChanges.length > 0) {
      setSyncState(prev => ({ ...prev, status: 'pending' }));
    } else {
      setSyncState(prev => ({ ...prev, status: 'synced' }));
    }
  }, [isAuthenticated, isConnected, syncState.pendingChanges.length]);

  // Auto-sync when connection is restored
  useEffect(() => {
    if (isConnected && isAuthenticated && syncState.pendingChanges.length > 0) {
      triggerSync();
    }
  }, [isConnected, isAuthenticated]);

  const loadPendingChanges = () => {
    try {
      const stored = localStorage.getItem(OFFLINE_STORAGE_KEY);
      if (stored) {
        const changes: Change[] = JSON.parse(stored);
        setSyncState(prev => ({ ...prev, pendingChanges: changes }));
      }
    } catch (error) {
      console.error('Error loading pending changes:', error);
    }
  };

  const savePendingChanges = () => {
    try {
      localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(syncState.pendingChanges));
    } catch (error) {
      console.error('Error saving pending changes:', error);
    }
  };

  const addChange = useCallback((change: Omit<Change, 'id' | 'timestamp' | 'retryCount'>) => {
    const newChange: Change = {
      ...change,
      id: generateChangeId(),
      timestamp: Date.now(),
      retryCount: 0,
    };

    setSyncState(prev => ({
      ...prev,
      pendingChanges: [...prev.pendingChanges, newChange],
      status: isConnected ? 'pending' : 'offline',
    }));

    // Debounce sync
    if (syncTimeout) {
      clearTimeout(syncTimeout);
    }

    const timeout = setTimeout(() => {
      if (isConnected && isAuthenticated) {
        triggerSync();
      }
    }, SYNC_DEBOUNCE_MS);

    setSyncTimeout(timeout);
  }, [isConnected, isAuthenticated, syncTimeout]);

  const triggerSync = useCallback(async () => {
    if (!isConnected || !isAuthenticated || syncState.pendingChanges.length === 0) {
      return;
    }

    setSyncState(prev => ({ ...prev, status: 'syncing' }));

    const changesToSync = [...syncState.pendingChanges];
    const successfulChanges: string[] = [];
    const failedChanges: Change[] = [];

    for (const change of changesToSync) {
      try {
        if (change.type === 'character' && change.characterId && change.campaignId) {
          await sendUpdate({
            type: 'character_update',
            campaignId: change.campaignId,
            characterId: change.characterId,
            data: change.data,
          });
        } else if (change.type === 'combat' && change.characterId && change.campaignId) {
          await sendUpdate({
            type: 'combat_update',
            campaignId: change.campaignId,
            characterId: change.characterId,
            data: change.data,
          });
        }

        successfulChanges.push(change.id);
      } catch (error) {
        console.error('Error syncing change:', error);
        
        const updatedChange = {
          ...change,
          retryCount: change.retryCount + 1,
        };

        if (updatedChange.retryCount < MAX_RETRY_ATTEMPTS) {
          failedChanges.push(updatedChange);
        } else {
          console.error('Max retry attempts reached for change:', change.id);
        }
      }
    }

    setSyncState(prev => ({
      ...prev,
      pendingChanges: failedChanges,
      lastSyncTime: Date.now(),
      status: failedChanges.length > 0 ? 'error' : 'synced',
      errorMessage: failedChanges.length > 0 ? 'Some changes failed to sync' : undefined,
    }));
  }, [isConnected, isAuthenticated, syncState.pendingChanges, sendUpdate]);

  const queueCharacterUpdate = useCallback((
    characterId: string,
    campaignId: string,
    updateType: CharacterUpdateType,
    path: string,
    value: any,
    previousValue?: any
  ) => {
    const updateData = createCharacterUpdate(updateType, path, value, previousValue);
    
    addChange({
      type: 'character',
      characterId,
      campaignId,
      data: updateData,
    });
  }, [addChange]);

  const queueCombatUpdate = useCallback((
    characterId: string,
    campaignId: string,
    updateType: CombatUpdateType,
    data: any,
    source: 'player' | 'dm' = 'player'
  ) => {
    const updateData = createCombatUpdate(updateType, characterId, campaignId, data, source);
    
    addChange({
      type: 'combat',
      characterId,
      campaignId,
      data: updateData,
    });
  }, [addChange]);

  const clearPendingChanges = useCallback(() => {
    setSyncState(prev => ({
      ...prev,
      pendingChanges: [],
      status: 'synced',
      errorMessage: undefined,
    }));
    localStorage.removeItem(OFFLINE_STORAGE_KEY);
  }, []);

  const retryFailedChanges = useCallback(() => {
    if (syncState.status === 'error') {
      triggerSync();
    }
  }, [syncState.status, triggerSync]);

  return {
    syncState,
    triggerSync,
    queueCharacterUpdate,
    queueCombatUpdate,
    clearPendingChanges,
    retryFailedChanges,
    hasPendingChanges: syncState.pendingChanges.length > 0,
    isOnline: isConnected && isAuthenticated,
  };
}

function generateChangeId(): string {
  return `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
