'use client';

import React, { useState, useRef, useEffect } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { RefreshCw, ChevronDown, Link2, Link2Off, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/layout/badge';
import { Switch } from '@/components/ui/forms/switch';
import { Button } from '@/components/ui/forms/button';
import { OVERLAY_SURFACE } from '@/components/ui/primitives/variants';
import { CharacterState } from '@/types/character';
import { confirmDialog } from '@/components/ui/feedback/confirm-dialog';

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
  sharePartyView: boolean;
  onSharePartyViewChange: (enabled: boolean) => void;
}

function formatSyncTime(dateString: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateString).getTime()) / 1000
  );
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function syncStateLabel(
  status: SyncIndicatorProps['syncStatus'],
  lastSyncedAt: string | null
): { short: string; full: string } {
  if (status === 'syncing') return { short: 'Syncing…', full: 'Syncing…' };
  if (status === 'error') return { short: 'Sync failed', full: 'Sync failed' };
  if (lastSyncedAt === null) {
    return { short: 'Not synced', full: 'Not synced' };
  }
  return { short: 'Synced', full: `Synced ${formatSyncTime(lastSyncedAt)}` };
}

function StatusGlyph({ status }: { status: SyncIndicatorProps['syncStatus'] }) {
  if (status === 'syncing') {
    return (
      <Loader2 size={14} className="text-muted animate-spin" aria-hidden />
    );
  }
  const color =
    status === 'synced'
      ? 'bg-verdigris-fill'
      : status === 'error'
        ? 'bg-blood-fill'
        : 'bg-divider-strong';
  return <span className={`size-2 rounded-full ${color}`} aria-hidden />;
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
  sharePartyView,
  onSharePartyViewChange,
}: SyncIndicatorProps) {
  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0);
  const state = syncStateLabel(syncStatus, lastSyncedAt);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(timer);
  }, []);

  if (!syncEnabled || !campaignCode) return null;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="ghost"
          size="sm"
          selected={open}
        >
          <StatusGlyph status={syncStatus} />
          <Link2 size={14} className="text-muted hidden sm:block" aria-hidden />
          <span className="type-small text-body sr-only max-w-[120px] truncate sm:not-sr-only">
            {campaignName || campaignCode}
          </span>
          <span className="type-small text-body sm:hidden" aria-hidden>
            {state.short}
          </span>
          <span className="type-small text-muted sr-only sm:not-sr-only">
            {state.full}
          </span>
          <ChevronDown
            size={14}
            className="text-muted hidden sm:block"
            aria-hidden
          />
        </Button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          aria-label="Campaign sync"
          align="end"
          sideOffset={8}
          className={`${OVERLAY_SURFACE} z-[60] w-64 max-w-[calc(100vw-1rem)] p-3`}
        >
          <div className="mb-3">
            <div className="flex items-center gap-2">
              <Badge variant="neutral" size="sm" className="font-mono">
                {campaignCode}
              </Badge>
              <span className="type-small text-body truncate">
                {campaignName}
              </span>
            </div>
            <p className="type-small text-muted mt-1">{state.full}</p>
          </div>

          <div className="border-divider space-y-3 border-t pt-3">
            <Switch
              label="Auto-sync"
              checked={autoSync}
              onCheckedChange={onToggleAutoSync}
            />

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
                  setOpen(false);
                }}
                disabled={syncStatus === 'syncing'}
              >
                Sync now
              </Button>
            )}

            <Switch
              label="Share HP with party"
              checked={shareHpWithParty}
              onCheckedChange={onToggleShareHp}
            />

            <Switch
              label="Share sheet with party"
              description="Let party members open a limited view of this character on the battle map"
              checked={sharePartyView}
              onCheckedChange={onSharePartyViewChange}
            />

            <Button
              variant="danger"
              size="sm"
              fullWidth
              leftIcon={<Link2Off size={14} />}
              onClick={async () => {
                // Focus the trigger before closing so the confirm dialog
                // records it as the element to return focus to; Radix's own
                // focus return runs a tick later, after the dialog has
                // already taken focus.
                triggerRef.current?.focus();
                setOpen(false);
                const confirmed = await confirmDialog({
                  title: 'Leave this campaign?',
                  message:
                    'Your character stays on this device. You can rejoin with the campaign code.',
                  confirmLabel: 'Leave campaign',
                  tone: 'danger',
                });
                if (confirmed) onLeaveCampaign();
              }}
            >
              Leave campaign
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
