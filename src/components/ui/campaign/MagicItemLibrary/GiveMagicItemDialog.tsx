'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { UserRound } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/forms/select';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/feedback/dialog';
import type { CampaignNPC } from '@/types/encounter';
import type { CustomMagicItem } from '@/types/magicItemLibrary';
import type { SendItemTarget } from '../SendItemDialog';

export type GiveRecipient =
  | { kind: 'player'; target: SendItemTarget }
  | { kind: 'npc'; npc: CampaignNPC };

export interface GiveMagicItemDialogProps {
  /** The dialog is open while this is non-null. */
  item: CustomMagicItem | null;
  players: SendItemTarget[];
  npcs: CampaignNPC[];
  onGive: (item: CustomMagicItem, recipient: GiveRecipient) => Promise<void>;
  onClose: () => void;
}

const PLAYER_PREFIX = 'player:';
const NPC_PREFIX = 'npc:';

/** Asks who gets a copy of one magic item template. */
export function GiveMagicItemDialog({
  item,
  players,
  npcs,
  onGive,
  onClose,
}: GiveMagicItemDialogProps) {
  // Keep the last item on screen while the dialog plays its exit.
  const [shown, setShown] = useState(item);
  if (item && item !== shown) setShown(item);
  const [recipient, setRecipient] = useState('');
  // Start each opening without a pick. Clearing on close would flip the
  // fading dialog back to its empty state, and reopening the same template
  // passes the same object, so the item's identity cannot signal an opening.
  const [wasOpen, setWasOpen] = useState(!!item);
  if (!!item !== wasOpen) {
    setWasOpen(!!item);
    if (item) setRecipient('');
  }
  // The item a give is in flight for, so another item's dialog is not left
  // loading, and the give's end does not close a dialog opened since.
  const [givingItem, setGivingItem] = useState<CustomMagicItem | null>(null);
  const openItemRef = useRef(item);
  useEffect(() => {
    openItemRef.current = item;
  }, [item]);
  const triggerId = useId();
  const helperId = useId();

  const nobody = players.length === 0 && npcs.length === 0;

  const resolveRecipient = (): GiveRecipient | null => {
    if (recipient.startsWith(PLAYER_PREFIX)) {
      const id = recipient.slice(PLAYER_PREFIX.length);
      const target = players.find(entry => entry.playerId === id);
      return target ? { kind: 'player', target } : null;
    }
    if (recipient.startsWith(NPC_PREFIX)) {
      const id = recipient.slice(NPC_PREFIX.length);
      const npc = npcs.find(entry => entry.id === id);
      return npc ? { kind: 'npc', npc } : null;
    }
    return null;
  };

  const handleGive = async () => {
    if (!shown || !recipient) return;
    const chosen = resolveRecipient();
    if (!chosen) {
      // The pick has left the campaign since it was made.
      onClose();
      return;
    }
    setGivingItem(shown);
    try {
      await onGive(shown, chosen);
    } finally {
      setGivingItem(current => (current === shown ? null : current));
    }
    if (openItemRef.current === shown) onClose();
  };

  return (
    <Dialog
      open={!!item}
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      {shown && (
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Give a copy of {shown.name}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <DialogDescription className="type-body text-muted">
              They get their own copy. The template stays in your library.
            </DialogDescription>
            <div>
              <label
                htmlFor={triggerId}
                className="text-heading mb-1.5 block text-sm font-medium"
              >
                Give to
              </label>
              <Select value={recipient} onValueChange={setRecipient}>
                <SelectTrigger
                  id={triggerId}
                  aria-describedby={nobody ? helperId : undefined}
                >
                  <SelectValue placeholder="Choose a player or NPC" />
                </SelectTrigger>
                <SelectContent>
                  {players.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Players</SelectLabel>
                      {players.map(player => (
                        <SelectItem
                          key={`${PLAYER_PREFIX}${player.playerId}`}
                          value={`${PLAYER_PREFIX}${player.playerId}`}
                        >
                          {player.characterName}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {players.length > 0 && npcs.length > 0 && <SelectSeparator />}
                  {npcs.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>NPCs and monsters</SelectLabel>
                      {npcs.map(npc => (
                        <SelectItem
                          key={`${NPC_PREFIX}${npc.id}`}
                          value={`${NPC_PREFIX}${npc.id}`}
                        >
                          {npc.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
              {nobody && (
                <p id={helperId} className="text-body mt-1.5 text-sm">
                  No players or NPCs in this campaign yet.
                </p>
              )}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              leftIcon={<UserRound size={16} aria-hidden="true" />}
              disabled={!recipient}
              loading={!!shown && givingItem === shown}
              onClick={handleGive}
            >
              Give copy
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
