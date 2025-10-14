import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { CharacterState } from '@/types/character';

export type CharacterSyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'conflict';

interface UseCharacterSyncProps {
  characterId?: string;
  backendId?: string;
  autoSync?: boolean;
  syncInterval?: number; // in milliseconds
  onConflict?: (localData: CharacterState, remoteData: CharacterState) => void;
  onSyncSuccess?: (data: any) => void;
  onSyncError?: (error: string) => void;
}

interface CharacterSyncState {
  status: CharacterSyncStatus;
  error: string | null;
  lastSynced: Date | null;
  hasConflict: boolean;
  conflictData?: {
    local: CharacterState;
    remote: CharacterState;
  };
}

export const useCharacterSync = ({
  characterId,
  backendId,
  autoSync = false,
  syncInterval = 30000,
  onConflict,
  onSyncSuccess,
  onSyncError,
}: UseCharacterSyncProps) => {
  const { isAuthenticated, accessToken } = useAuth();
  const [syncState, setSyncState] = useState<CharacterSyncState>({
    status: 'idle',
    error: null,
    lastSynced: null,
    hasConflict: false,
  });

  const syncTimeoutRef = useRef<NodeJS.Timeout>();
  const autoSyncIntervalRef = useRef<NodeJS.Timeout>();

  // Helper function to make authenticated API calls
  const apiCall = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return response.json();
  }, [accessToken]);

  // Sync character to backend
  const syncToBackend = useCallback(async (characterData: CharacterState, options: {
    syncType?: 'manual' | 'auto' | 'partial';
    updateFields?: string[];
  } = {}) => {
    if (!isAuthenticated || !backendId) {
      throw new Error('Authentication or backend ID required');
    }

    setSyncState(prev => ({ ...prev, status: 'syncing', error: null }));

    try {
      const response = await apiCall(`/api/characters/${backendId}/sync`, {
        method: 'POST',
        body: JSON.stringify({
          character_data: characterData,
          sync_type: options.syncType || 'manual',
          update_fields: options.updateFields,
        }),
      });

      setSyncState(prev => ({
        ...prev,
        status: 'success',
        lastSynced: new Date(),
        hasConflict: false,
        conflictData: undefined,
      }));

      if (onSyncSuccess) {
        onSyncSuccess(response);
      }

      // Reset to idle after 3 seconds
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      syncTimeoutRef.current = setTimeout(() => {
        setSyncState(prev => ({ ...prev, status: 'idle' }));
      }, 3000);

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';
      setSyncState(prev => ({
        ...prev,
        status: 'error',
        error: errorMessage,
      }));

      if (onSyncError) {
        onSyncError(errorMessage);
      }

      throw error;
    }
  }, [isAuthenticated, backendId, apiCall, onSyncSuccess, onSyncError]);

  // Pull character from backend
  const pullFromBackend = useCallback(async () => {
    if (!isAuthenticated || !backendId) {
      throw new Error('Authentication or backend ID required');
    }

    setSyncState(prev => ({ ...prev, status: 'syncing', error: null }));

    try {
      const response = await apiCall(`/api/characters/${backendId}`);
      
      setSyncState(prev => ({
        ...prev,
        status: 'success',
        lastSynced: new Date(),
      }));

      return response.character;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Pull failed';
      setSyncState(prev => ({
        ...prev,
        status: 'error',
        error: errorMessage,
      }));

      throw error;
    }
  }, [isAuthenticated, backendId, apiCall]);

  // Create character in backend
  const createInBackend = useCallback(async (characterData: CharacterState, metadata: {
    name: string;
    campaignId?: string;
    isPublic?: boolean;
  }) => {
    if (!isAuthenticated) {
      throw new Error('Authentication required');
    }

    setSyncState(prev => ({ ...prev, status: 'syncing', error: null }));

    try {
      const response = await apiCall('/api/characters', {
        method: 'POST',
        body: JSON.stringify({
          name: metadata.name,
          character_data: characterData,
          campaign_id: metadata.campaignId,
          is_public: metadata.isPublic || false,
        }),
      });

      setSyncState(prev => ({
        ...prev,
        status: 'success',
        lastSynced: new Date(),
      }));

      return response.character;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Create failed';
      setSyncState(prev => ({
        ...prev,
        status: 'error',
        error: errorMessage,
      }));

      throw error;
    }
  }, [isAuthenticated, apiCall]);

  // Handle conflict resolution
  const resolveConflict = useCallback(async (resolution: 'local' | 'remote', localData?: CharacterState) => {
    if (!syncState.hasConflict || !syncState.conflictData) {
      return;
    }

    try {
      if (resolution === 'local' && localData) {
        // Push local data to backend
        await syncToBackend(localData, { syncType: 'manual' });
      } else if (resolution === 'remote') {
        // Pull remote data
        const remoteCharacter = await pullFromBackend();
        return remoteCharacter;
      }

      setSyncState(prev => ({
        ...prev,
        hasConflict: false,
        conflictData: undefined,
      }));
    } catch (error) {
      console.error('Error resolving conflict:', error);
    }
  }, [syncState.hasConflict, syncState.conflictData, syncToBackend, pullFromBackend]);

  // Auto-sync setup
  useEffect(() => {
    if (!autoSync || !isAuthenticated || !backendId) {
      return;
    }

    const interval = setInterval(async () => {
      // This would typically sync with local character data
      // For now, we'll just check if there are any updates needed
      console.log('Auto-sync check for character:', characterId);
    }, syncInterval);

    autoSyncIntervalRef.current = interval;

    return () => {
      if (autoSyncIntervalRef.current) {
        clearInterval(autoSyncIntervalRef.current);
      }
    };
  }, [autoSync, isAuthenticated, backendId, characterId, syncInterval]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      if (autoSyncIntervalRef.current) {
        clearInterval(autoSyncIntervalRef.current);
      }
    };
  }, []);

  return {
    // State
    ...syncState,
    isIdle: syncState.status === 'idle',
    isSyncing: syncState.status === 'syncing',
    isSuccess: syncState.status === 'success',
    isError: syncState.status === 'error',
    canSync: isAuthenticated && !!backendId,

    // Actions
    syncToBackend,
    pullFromBackend,
    createInBackend,
    resolveConflict,
    
    // Utilities
    clearError: () => setSyncState(prev => ({ ...prev, error: null })),
    resetStatus: () => setSyncState(prev => ({ ...prev, status: 'idle' })),
  };
};

// Hook for managing multiple character syncs
export const useMultipleCharacterSync = (characters: Array<{ id: string; backendId?: string }>) => {
  const { isAuthenticated } = useAuth();
  const [syncStates, setSyncStates] = useState<Record<string, CharacterSyncState>>({});

  const syncAll = useCallback(async () => {
    if (!isAuthenticated) return;

    const syncPromises = characters
      .filter(char => char.backendId)
      .map(async (char) => {
        // This would integrate with individual character sync logic
        // For now, just a placeholder
        return { characterId: char.id, success: true };
      });

    try {
      const results = await Promise.allSettled(syncPromises);
      console.log('Bulk sync results:', results);
    } catch (error) {
      console.error('Bulk sync error:', error);
    }
  }, [characters, isAuthenticated]);

  const getSyncStatus = useCallback((characterId: string) => {
    return syncStates[characterId] || {
      status: 'idle' as CharacterSyncStatus,
      error: null,
      lastSynced: null,
      hasConflict: false,
    };
  }, [syncStates]);

  return {
    syncAll,
    getSyncStatus,
    hasPendingSync: Object.values(syncStates).some(state => state.status === 'syncing'),
    hasErrors: Object.values(syncStates).some(state => state.status === 'error'),
  };
};
