'use client';

import React from 'react';
import { 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  Check, 
  AlertTriangle, 
  Wifi, 
  WifiOff,
  Clock
} from 'lucide-react';
import { useSync, type SyncStatus } from '@/hooks/useSync';
import { useRealtime } from '@/contexts/RealtimeContext';
import { useAuth } from '@/contexts/AuthContext';

interface SyncIndicatorProps {
  compact?: boolean;
  showText?: boolean;
  className?: string;
}

export function SyncIndicator({ 
  compact = false, 
  showText = true, 
  className = '' 
}: SyncIndicatorProps) {
  const { syncState, triggerSync, retryFailedChanges, hasPendingChanges } = useSync();
  const { isConnected } = useRealtime();
  const { isAuthenticated } = useAuth();

  const getStatusInfo = () => {
    if (!isAuthenticated) {
      return {
        icon: CloudOff,
        color: 'text-gray-500',
        bgColor: 'bg-gray-100',
        text: 'Not logged in',
        description: 'Sign in to sync your data',
      };
    }

    if (!isConnected) {
      return {
        icon: WifiOff,
        color: 'text-orange-600',
        bgColor: 'bg-orange-100',
        text: 'Offline',
        description: 'Changes will sync when connection is restored',
      };
    }

    switch (syncState.status) {
      case 'synced':
        return {
          icon: Check,
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          text: 'Synced',
          description: 'All changes are saved to the cloud',
        };
      
      case 'pending':
        return {
          icon: Clock,
          color: 'text-blue-600',
          bgColor: 'bg-blue-100',
          text: `${syncState.pendingChanges.length} pending`,
          description: 'Changes are waiting to be synced',
        };
      
      case 'syncing':
        return {
          icon: RefreshCw,
          color: 'text-blue-600',
          bgColor: 'bg-blue-100',
          text: 'Syncing...',
          description: 'Uploading changes to the cloud',
          animate: true,
        };
      
      case 'conflict':
        return {
          icon: AlertTriangle,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100',
          text: 'Conflict',
          description: 'There are conflicting changes that need resolution',
        };
      
      case 'error':
        return {
          icon: AlertTriangle,
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          text: 'Sync failed',
          description: syncState.errorMessage || 'Failed to sync some changes',
        };
      
      case 'offline':
      default:
        return {
          icon: CloudOff,
          color: 'text-gray-500',
          bgColor: 'bg-gray-100',
          text: 'Offline',
          description: 'No internet connection',
        };
    }
  };

  const statusInfo = getStatusInfo();
  const Icon = statusInfo.icon;

  const handleClick = () => {
    if (syncState.status === 'error') {
      retryFailedChanges();
    } else if (hasPendingChanges && isConnected) {
      triggerSync();
    }
  };

  const isClickable = syncState.status === 'error' || (hasPendingChanges && isConnected);

  if (compact) {
    return (
      <button
        onClick={handleClick}
        disabled={!isClickable}
        className={`
          inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium
          ${statusInfo.bgColor} ${statusInfo.color}
          ${isClickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}
          ${className}
        `}
        title={statusInfo.description}
      >
        <Icon 
          size={12} 
          className={statusInfo.animate ? 'animate-spin' : ''} 
        />
        {syncState.pendingChanges.length > 0 && (
          <span>{syncState.pendingChanges.length}</span>
        )}
      </button>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {/* Connection Status */}
      <div className="flex items-center gap-1">
        {isConnected ? (
          <Wifi size={14} className="text-green-600" title="Connected" />
        ) : (
          <WifiOff size={14} className="text-gray-500" title="Disconnected" />
        )}
      </div>

      {/* Sync Status */}
      <button
        onClick={handleClick}
        disabled={!isClickable}
        className={`
          inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium
          ${statusInfo.bgColor} ${statusInfo.color}
          ${isClickable ? 'cursor-pointer hover:opacity-80 active:scale-95' : 'cursor-default'}
          transition-all duration-200
        `}
        title={statusInfo.description}
      >
        <Icon 
          size={16} 
          className={statusInfo.animate ? 'animate-spin' : ''} 
        />
        
        {showText && (
          <span>{statusInfo.text}</span>
        )}

        {syncState.pendingChanges.length > 0 && (
          <span className={`
            inline-flex items-center justify-center w-5 h-5 text-xs font-bold
            rounded-full bg-white ${statusInfo.color}
          `}>
            {syncState.pendingChanges.length}
          </span>
        )}
      </button>

      {/* Last Sync Time */}
      {syncState.lastSyncTime && syncState.status === 'synced' && (
        <span className="text-xs text-gray-500">
          {formatLastSyncTime(syncState.lastSyncTime)}
        </span>
      )}
    </div>
  );
}

function formatLastSyncTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

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

// Compact version for use in headers or tight spaces
export function CompactSyncIndicator({ className = '' }: { className?: string }) {
  return (
    <SyncIndicator 
      compact 
      showText={false} 
      className={className}
    />
  );
}

// Status-only indicator (just the icon)
export function SyncStatusIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  const { syncState } = useSync();
  const { isConnected } = useRealtime();
  const { isAuthenticated } = useAuth();

  const getIcon = () => {
    if (!isAuthenticated || !isConnected) return CloudOff;
    
    switch (syncState.status) {
      case 'synced': return Check;
      case 'pending': return Clock;
      case 'syncing': return RefreshCw;
      case 'conflict': return AlertTriangle;
      case 'error': return AlertTriangle;
      default: return CloudOff;
    }
  };

  const getColor = () => {
    if (!isAuthenticated || !isConnected) return 'text-gray-500';
    
    switch (syncState.status) {
      case 'synced': return 'text-green-600';
      case 'pending': return 'text-blue-600';
      case 'syncing': return 'text-blue-600';
      case 'conflict': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-500';
    }
  };

  const Icon = getIcon();
  const isAnimating = syncState.status === 'syncing';

  return (
    <Icon 
      size={size} 
      className={`${getColor()} ${isAnimating ? 'animate-spin' : ''} ${className}`}
    />
  );
}
