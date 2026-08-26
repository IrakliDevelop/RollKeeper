'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  RefreshCw,
  ChevronDown,
  Link2,
  Link2Off,
  Wifi,
  WifiOff,
  Heart,
} from 'lucide-react';
import { Badge } from '@/components/ui/layout/badge';
import { Switch } from '@/components/ui/forms/switch';
import { Button } from '@/components/ui/forms/button';
import { CharacterState } from '@/types/character';

interface SyncIndicatorProps {
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  lastSyncedAt: string | null;
  campaignCode: string | null;
  campaignName: string | null;
  autoSync: boolean;
  syncEnabled: boolean;
  onSyncNow: (characterData: CharacterState) => Promise<void>;
  onToggleAutoSync: () => void;
  onLeaveCampaign: () => void;
  characterData: CharacterState;
  shareHpWithParty: boolean;
  onToggleShareHp: () => void;
}

function formatSyncTime(dateString: string | null): string {
  if (!dateString) return 'Never';
  const seconds = Math.floor(
    (Date.now() - new Date(dateString).getTime()) / 1000
  );
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'synced':
      return 'bg-green-500';
    case 'syncing':
      return 'bg-blue-500 animate-pulse';
    case 'error':
      return 'bg-red-500';
    default:
      return 'bg-gray-400';
  }
}

export function SyncIndicator({
  syncStatus,
  lastSyncedAt,
  campaignCode,
  campaignName,
  autoSync,
  syncEnabled,
  onSyncNow,
  onToggleAutoSync,
  onLeaveCampaign,
  characterData,
  shareHpWithParty,
  onToggleShareHp,
}: SyncIndicatorProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [displayTime, setDisplayTime] = useState(formatSyncTime(lastSyncedAt));
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setDisplayTime(formatSyncTime(lastSyncedAt));
    }, 5000);
    return () => clearInterval(timer);
  }, [lastSyncedAt]);

  useEffect(() => {
    setDisplayTime(formatSyncTime(lastSyncedAt));
  }, [lastSyncedAt]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  if (!syncEnabled || !campaignCode) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="border-divider bg-surface-secondary hover:bg-surface-hover flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors"
      >
        <div className={`h-2 w-2 rounded-full ${getStatusColor(syncStatus)}`} />
        <Link2 size={14} className="text-muted" />
        <span className="text-body max-w-[120px] truncate text-xs">
          {campaignName || campaignCode}
        </span>
        <span className="text-muted text-xs">
          {syncStatus === 'syncing' ? 'Syncing...' : displayTime}
        </span>
        <ChevronDown size={12} className="text-muted" />
      </button>

      {menuOpen && (
        <div className="border-divider bg-surface-raised absolute right-0 z-50 mt-1 w-64 rounded-lg border-2 p-3 shadow-xl">
          <div className="mb-3">
            <div className="flex items-center gap-2">
              <Badge variant="info" size="sm" className="font-mono">
                {campaignCode}
              </Badge>
              <span className="text-body truncate text-xs">{campaignName}</span>
            </div>
          </div>

          <div className="border-divider space-y-3 border-t pt-3">
            {/* Auto-sync toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {autoSync ? (
                  <Wifi size={14} className="text-green-500" />
                ) : (
                  <WifiOff size={14} className="text-muted" />
                )}
                <span className="text-heading text-sm">Auto-sync</span>
              </div>
              <Switch checked={autoSync} onCheckedChange={onToggleAutoSync} />
            </div>

            {/* Manual sync button */}
            {!autoSync && (
              <Button
                variant="secondary"
                size="sm"
                fullWidth
                leftIcon={
                  <RefreshCw
                    size={14}
                    className={syncStatus === 'syncing' ? 'animate-spin' : ''}
                  />
                }
                onClick={() => {
                  onSyncNow(characterData);
                  setMenuOpen(false);
                }}
                disabled={syncStatus === 'syncing'}
              >
                Sync Now
              </Button>
            )}

            {/* Share HP with party toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart
                  size={14}
                  className={shareHpWithParty ? 'text-red-500' : 'text-muted'}
                />
                <span className="text-heading text-sm">Share HP</span>
              </div>
              <Switch
                checked={shareHpWithParty}
                onCheckedChange={onToggleShareHp}
              />
            </div>

            {/* Leave campaign */}
            <button
              onClick={() => {
                if (
                  confirm(
                    'Leave this campaign? Your character data will remain locally.'
                  )
                ) {
                  onLeaveCampaign();
                  setMenuOpen(false);
                }
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950/20"
            >
              <Link2Off size={14} />
              Leave Campaign
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
