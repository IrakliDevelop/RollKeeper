'use client';

import React from 'react';
import { MessageSquare } from 'lucide-react';
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
  const char = player.characterData;
  if (!char) return null;
  const classes = ensureArray<{ className?: string; level?: number }>(
    char.classes
  );
  const level = char.totalLevel || char.level || 1;
  const charClass = classes.length
    ? classes.map(c => `${c.className} ${c.level}`).join(' / ')
    : `${char.class?.name || 'Unknown'} ${level}`;

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

        <DialogBody>
          <div className="space-y-6">
            <OverviewTab
              char={char}
              customCounterLabel={customCounterLabel}
              counterValue={counterValue}
              onAdjustCounter={onAdjustCounter}
            />
            <InventoryTab char={char} />
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
