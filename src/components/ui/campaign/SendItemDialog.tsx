'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/feedback/dialog';
import { Button } from '@/components/ui/forms/button';
import {
  RadioGroupField,
  RadioGroupItem,
} from '@/components/ui/forms/radio-group';
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
  /** Shown under "Send to" when there is nobody to send to. */
  emptyMessage?: string;
}

export function SendItemDialog({
  open,
  onClose,
  item,
  targets,
  onSend,
  sending = false,
  emptyMessage = 'No other players in this campaign',
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

  const detail = item
    ? [
        item.quantity > 1 && `Sends all ${item.quantity}`,
        item.rarity && formatRarity(item.rarity),
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Send item</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {item && (
            <div>
              <p className="type-ui text-heading">{item.name}</p>
              {detail && <p className="type-small text-muted">{detail}</p>}
            </div>
          )}

          {targets.length === 0 ? (
            <div className="space-y-2">
              <p className="type-ui text-heading">Send to</p>
              <p className="type-small text-muted">{emptyMessage}</p>
            </div>
          ) : (
            <RadioGroupField
              label="Send to"
              value={selectedTarget?.playerId ?? ''}
              onValueChange={id =>
                setSelectedTarget(targets.find(t => t.playerId === id) ?? null)
              }
            >
              {targets.map(target => (
                <RadioGroupItem
                  key={target.playerId}
                  value={target.playerId}
                  label={target.characterName}
                  description={target.playerName}
                />
              ))}
            </RadioGroupField>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSend}
            disabled={!selectedTarget || sending}
          >
            {sending ? 'Sending…' : 'Send item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
