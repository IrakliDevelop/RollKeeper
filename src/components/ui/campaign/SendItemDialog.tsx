'use client';

import { useState } from 'react';
import { Send, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/feedback/dialog';
import { Button } from '@/components/ui/forms/button';
import type { InventoryItem } from '@/types/character';
import { formatRarity } from '@/utils/formatRarity';

export interface SendItemTarget {
  playerId: string;
  playerName: string;
  characterName: string;
  characterId: string;
}

interface SendItemDialogProps {
  open: boolean;
  onClose: () => void;
  item: InventoryItem | null;
  targets: SendItemTarget[];
  onSend: (item: InventoryItem, target: SendItemTarget) => Promise<void>;
  sending?: boolean;
}

export function SendItemDialog({
  open,
  onClose,
  item,
  targets,
  onSend,
  sending = false,
}: SendItemDialogProps) {
  const [selectedTarget, setSelectedTarget] = useState<SendItemTarget | null>(
    null
  );

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setSelectedTarget(null);
      onClose();
    }
  };

  const handleSend = async () => {
    if (!item || !selectedTarget) return;
    await onSend(item, selectedTarget);
    setSelectedTarget(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Send item</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {item && (
            <div className="border-divider border-b pb-3">
              <p className="text-heading text-sm font-bold">{item.name}</p>
              {item.quantity > 1 && (
                <p className="text-muted text-sm">Sends all {item.quantity}</p>
              )}
              {item.rarity && (
                <p className="text-muted mt-1 text-sm">
                  {formatRarity(item.rarity)}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-body text-sm font-medium">Send to</p>
            {targets.length === 0 ? (
              <p className="text-muted text-sm">
                No other players in this campaign
              </p>
            ) : (
              <div className="space-y-1">
                {targets.map(target => (
                  <button
                    key={target.playerId}
                    type="button"
                    onClick={() => setSelectedTarget(target)}
                    aria-pressed={selectedTarget?.playerId === target.playerId}
                    className={`border-divider flex w-full items-center gap-3 border-b p-3 text-left transition-colors ${
                      selectedTarget?.playerId === target.playerId
                        ? 'bg-surface-hover'
                        : 'hover:bg-surface-hover'
                    }`}
                  >
                    <div
                      className="bg-surface-secondary rounded-full p-1.5"
                      aria-hidden="true"
                    >
                      <User size={14} className="text-muted" />
                    </div>
                    <div>
                      <p className="text-heading text-sm font-medium">
                        {target.characterName}
                      </p>
                      <p className="text-muted text-xs">{target.playerName}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Send size={14} />}
            onClick={handleSend}
            disabled={!selectedTarget || sending}
          >
            {sending ? 'Sending…' : 'Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
