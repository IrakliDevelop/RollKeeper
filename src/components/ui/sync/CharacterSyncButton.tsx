import React from 'react';
import { 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  Check, 
  AlertTriangle, 
  Upload,
  Download,
  Loader2
} from 'lucide-react';
import { useCharacterSync, type CharacterSyncStatus } from '@/hooks/useCharacterSync';
import { useAuth } from '@/contexts/AuthContext';
import { CharacterState } from '@/types/character';

interface CharacterSyncButtonProps {
  characterId: string;
  backendId?: string;
  characterData?: CharacterState;
  characterName?: string;
  campaignId?: string;
  compact?: boolean;
  showText?: boolean;
  className?: string;
  onSyncSuccess?: (data: CharacterState) => void;
  onSyncError?: (error: string) => void;
  onBackendIdUpdate?: (backendId: string) => void;
}

export function CharacterSyncButton({
  characterId,
  backendId,
  characterData,
  characterName = 'Character',
  campaignId,
  compact = false,
  showText = true,
  className = '',
  onSyncSuccess,
  onSyncError,
  onBackendIdUpdate,
}: CharacterSyncButtonProps) {
  const { isAuthenticated } = useAuth();
  
  const {
    status,
    error,
    lastSynced,
    isSyncing,
    canSync,
    syncToBackend,
    createInBackend,
    pullFromBackend,
    clearError,
  } = useCharacterSync({
    characterId,
    backendId,
    onSyncSuccess,
    onSyncError,
  });

  const getStatusInfo = () => {
    if (!isAuthenticated) {
      return {
        icon: CloudOff,
        color: 'text-gray-500',
        bgColor: 'bg-gray-100',
        text: 'Sign in to sync',
        description: 'Authentication required for cloud sync',
      };
    }

    if (!backendId) {
      return {
        icon: Upload,
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
        text: 'Save to cloud',
        description: 'Save this character to the cloud for the first time',
      };
    }

    switch (status) {
      case 'idle':
        return {
          icon: Cloud,
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          text: 'Sync',
          description: 'Sync character data with the cloud',
        };
      
      case 'syncing':
        return {
          icon: Loader2,
          color: 'text-blue-600',
          bgColor: 'bg-blue-100',
          text: 'Syncing...',
          description: 'Uploading character data to the cloud',
          animate: true,
        };
      
      case 'success':
        return {
          icon: Check,
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          text: 'Synced',
          description: `Character synced successfully${lastSynced ? ` at ${lastSynced.toLocaleTimeString()}` : ''}`,
        };
      
      case 'error':
        return {
          icon: AlertTriangle,
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          text: 'Sync failed',
          description: error || 'Failed to sync character data',
        };
      
      case 'conflict':
        return {
          icon: AlertTriangle,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100',
          text: 'Conflict',
          description: 'There are conflicting changes that need resolution',
        };
      
      default:
        return {
          icon: Cloud,
          color: 'text-gray-600',
          bgColor: 'bg-gray-100',
          text: 'Sync',
          description: 'Sync character data with the cloud',
        };
    }
  };

  const statusInfo = getStatusInfo();
  const Icon = statusInfo.icon;

  const handleSync = async () => {
    if (!canSync || !characterData) return;

    clearError();

    try {
      if (!backendId) {
        // Create character in backend for the first time
        const newCharacter = await createInBackend(characterData, {
          name: characterName,
          campaignId,
          isPublic: false,
        });
        
        if (onBackendIdUpdate) {
          onBackendIdUpdate(newCharacter.id);
        }
      } else {
        // Sync existing character
        await syncToBackend(characterData, { syncType: 'manual' });
      }
    } catch (error) {
      console.error('Sync error:', error);
    }
  };

  const handlePull = async () => {
    if (!canSync || !backendId) return;

    try {
      const remoteCharacter = await pullFromBackend();
      if (onSyncSuccess) {
        onSyncSuccess(remoteCharacter);
      }
    } catch (error) {
      console.error('Pull error:', error);
    }
  };

  if (compact) {
    return (
      <button
        onClick={handleSync}
        disabled={!canSync || isSyncing}
        className={`
          inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium
          ${statusInfo.bgColor} ${statusInfo.color}
          ${canSync && !isSyncing ? 'cursor-pointer hover:opacity-80' : 'cursor-default opacity-60'}
          transition-all duration-200
          ${className}
        `}
        title={statusInfo.description}
      >
        <Icon 
          size={12} 
          className={statusInfo.animate ? 'animate-spin' : ''} 
        />
        {showText && !backendId && <span>Save</span>}
        {showText && backendId && status === 'success' && <span>✓</span>}
      </button>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {/* Main sync button */}
      <button
        onClick={handleSync}
        disabled={!canSync || isSyncing}
        className={`
          inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium
          ${statusInfo.bgColor} ${statusInfo.color}
          ${canSync && !isSyncing ? 'cursor-pointer hover:opacity-80 active:scale-95' : 'cursor-default opacity-60'}
          transition-all duration-200
        `}
        title={statusInfo.description}
      >
        <Icon 
          size={16} 
          className={statusInfo.animate ? 'animate-spin' : ''} 
        />
        
        {showText && <span>{statusInfo.text}</span>}
      </button>

      {/* Pull button (only show if character exists in backend) */}
      {backendId && status !== 'syncing' && (
        <button
          onClick={handlePull}
          disabled={!canSync}
          className={`
            inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm
            text-gray-600 bg-gray-100 hover:bg-gray-200
            ${canSync ? 'cursor-pointer' : 'cursor-default opacity-60'}
            transition-all duration-200
          `}
          title="Pull latest version from cloud"
        >
          <Download size={14} />
        </button>
      )}

      {/* Error retry button */}
      {status === 'error' && (
        <button
          onClick={() => {
            clearError();
            handleSync();
          }}
          disabled={!canSync}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50 transition-colors"
          title="Retry sync"
        >
          <RefreshCw size={12} />
          Retry
        </button>
      )}

      {/* Last sync time */}
      {lastSynced && status === 'success' && (
        <span className="text-xs text-gray-500">
          {formatLastSyncTime(lastSynced)}
        </span>
      )}
    </div>
  );
}

function formatLastSyncTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) { // Less than 1 minute
    return 'Just now';
  } else if (diff < 3600000) { // Less than 1 hour
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m ago`;
  } else if (diff < 86400000) { // Less than 1 day
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  } else {
    const days = Math.floor(diff / 86400000);
    return `${days}d ago`;
  }
}

// Compact version for use in character cards or lists
export function CompactCharacterSyncButton(props: Omit<CharacterSyncButtonProps, 'compact' | 'showText'>) {
  return (
    <CharacterSyncButton 
      {...props}
      compact 
      showText={false}
    />
  );
}

// Status-only indicator for showing sync status
export function CharacterSyncStatus({ 
  status, 
  size = 16, 
  className = '' 
}: { 
  status: CharacterSyncStatus; 
  size?: number; 
  className?: string; 
}) {
  const getIcon = () => {
    switch (status) {
      case 'idle': return Cloud;
      case 'syncing': return Loader2;
      case 'success': return Check;
      case 'error': return AlertTriangle;
      case 'conflict': return AlertTriangle;
      default: return Cloud;
    }
  };

  const getColor = () => {
    switch (status) {
      case 'idle': return 'text-gray-600';
      case 'syncing': return 'text-blue-600';
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'conflict': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const Icon = getIcon();
  const isAnimating = status === 'syncing';

  return (
    <Icon 
      size={size} 
      className={`${getColor()} ${isAnimating ? 'animate-spin' : ''} ${className}`}
    />
  );
}
