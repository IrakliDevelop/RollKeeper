'use client';

import React, { useEffect, useState } from 'react';
import { MessageSquare, Package, ScrollText } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@/components/ui/feedback/dialog';
import { Badge } from '@/components/ui/layout/badge';
import { OverviewTab } from './OverviewTab';
import { InventoryTab } from './InventoryTab';
import { ensureArray } from './shared';
import { CampaignPlayerData } from '@/types/campaign';

type DetailTab = 'overview' | 'spells' | 'inventory';

interface PlayerDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  player: CampaignPlayerData;
  customCounterLabel?: string;
  counterValue?: number;
  onAdjustCounter?: (delta: number) => void;
  onSendMessage?: () => void;
}

export function PlayerDetailDialog({
  open,
  onOpenChange,
  player,
  customCounterLabel,
  counterValue = 0,
  onAdjustCounter,
  onSendMessage,
}: PlayerDetailDialogProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');

  // Reset to Overview each time the dialog opens
  useEffect(() => {
    if (open) setActiveTab('overview');
  }, [open]);

  const char = player.characterData;
  if (!char) return null;
  const classes = ensureArray<{ className?: string; level?: number }>(
    char.classes
  );
  const level = char.totalLevel || char.level || 1;
  const charClass = classes.length
    ? classes.map(c => `${c.className} ${c.level}`).join(' / ')
    : `${char.class?.name || 'Unknown'} ${level}`;

  const tabs: Array<{ key: DetailTab; icon: React.ReactNode; label: string }> =
    [
      {
        key: 'overview',
        icon: <ScrollText className="h-3.5 w-3.5" />,
        label: 'Overview',
      },
      {
        key: 'inventory',
        icon: <Package className="h-3.5 w-3.5" />,
        label: 'Inventory',
      },
    ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-3">
              {char.name || player.characterName}
              <Badge variant="info" size="sm">
                {charClass}
              </Badge>
            </span>
          </DialogTitle>
          <div className="flex items-center justify-between">
            <p className="text-muted text-sm">
              {char.race || 'Unknown'} · {char.alignment || 'Unaligned'} ·
              Player: {player.playerName}
            </p>
            {onSendMessage && (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<MessageSquare size={14} />}
                onClick={onSendMessage}
              >
                Message
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Tab bar */}
        <div className="bg-surface-secondary flex rounded-lg p-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-surface-raised text-heading shadow-sm'
                  : 'text-muted hover:text-body'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <DialogBody>
          {activeTab === 'overview' && (
            <OverviewTab
              char={char}
              customCounterLabel={customCounterLabel}
              counterValue={counterValue}
              onAdjustCounter={onAdjustCounter}
            />
          )}
          {activeTab === 'inventory' && <InventoryTab char={char} />}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
