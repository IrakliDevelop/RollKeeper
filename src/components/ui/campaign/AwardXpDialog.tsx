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
import { Checkbox } from '@/components/ui/forms/checkbox';
import { NumberInput } from '@/components/ui/forms/NumberInput';
import { postXpAward } from './XpAwardControl';
import type { CampaignPlayerData } from '@/types/campaign';
import type { DmXpAward } from '@/types/sharedState';

interface AwardXpDialogProps {
  open: boolean;
  onClose: () => void;
  players: CampaignPlayerData[];
  campaignCode: string;
  dmId: string;
}

type SendOutcome = 'ok' | 'failed';

export function AwardXpDialog({
  open,
  onClose,
  players,
  campaignCode,
  dmId,
}: AwardXpDialogProps) {
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [outcomes, setOutcomes] = useState<Map<string, SendOutcome> | null>(
    null
  );
  // Awards for failed/unknown sends, kept VERBATIM (same id) for retry — a
  // lost response may still have enqueued the award; players dedupe by id.
  const [failedAwards, setFailedAwards] = useState<Map<string, DmXpAward>>(
    new Map()
  );

  const selectedPlayers = players.filter(p => !excluded.has(p.playerId));
  const valid = amount !== undefined && amount >= 1;

  const reset = () => {
    setAmount(undefined);
    setExcluded(new Set());
    setOutcomes(null);
    setFailedAwards(new Map());
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      reset();
      onClose();
    }
  };

  const sendAwards = async (targets: Map<string, DmXpAward>) => {
    setSending(true);
    const nextOutcomes = new Map(outcomes ?? []);
    const nextFailed = new Map(failedAwards);
    await Promise.all(
      [...targets.entries()].map(async ([playerId, award]) => {
        try {
          await postXpAward(campaignCode, dmId, playerId, award);
          nextOutcomes.set(playerId, 'ok');
          nextFailed.delete(playerId);
        } catch {
          nextOutcomes.set(playerId, 'failed');
          nextFailed.set(playerId, award);
        }
      })
    );
    setOutcomes(nextOutcomes);
    setFailedAwards(nextFailed);
    setSending(false);
  };

  const handleSend = () => {
    if (!valid || selectedPlayers.length === 0) return;
    const targets = new Map<string, DmXpAward>(
      selectedPlayers.map(p => [
        p.playerId,
        {
          id: crypto.randomUUID(),
          mode: 'add' as const,
          amount: amount!,
          awardedAt: new Date().toISOString(),
        },
      ])
    );
    sendAwards(targets);
  };

  const handleRetry = () => {
    if (failedAwards.size === 0) return;
    sendAwards(new Map(failedAwards));
  };

  const playerName = (playerId: string) =>
    players.find(p => p.playerId === playerId)?.characterName ?? playerId;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Award XP to Party</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-1">
            <label
              htmlFor="award-xp-amount"
              className="text-body text-sm font-medium"
            >
              XP to add
            </label>
            <NumberInput
              id="award-xp-amount"
              value={amount}
              onChange={setAmount}
              min={1}
              allowEmpty
              placeholder="e.g. 300"
            />
          </div>

          <div className="space-y-2">
            <span className="text-body text-sm font-medium">Players</span>
            {players.map(p => (
              <label
                key={p.playerId}
                className="flex items-center gap-2 text-sm"
              >
                <Checkbox
                  checked={!excluded.has(p.playerId)}
                  onCheckedChange={checked => {
                    setExcluded(prev => {
                      const next = new Set(prev);
                      if (checked) next.delete(p.playerId);
                      else next.add(p.playerId);
                      return next;
                    });
                  }}
                />
                <span className="text-heading">{p.characterName}</span>
                <span className="text-muted">({p.playerName})</span>
                {outcomes?.get(p.playerId) === 'ok' && (
                  <span className="text-accent-emerald-text text-xs">sent</span>
                )}
                {outcomes?.get(p.playerId) === 'failed' && (
                  <span className="text-accent-red-text text-xs">failed</span>
                )}
              </label>
            ))}
          </div>

          {failedAwards.size > 0 && (
            <p className="text-accent-red-text text-sm">
              Failed for: {[...failedAwards.keys()].map(playerName).join(', ')}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenChange(false)}
          >
            Close
          </Button>
          {failedAwards.size > 0 && (
            <Button
              variant="warning"
              size="sm"
              onClick={handleRetry}
              disabled={sending}
            >
              {sending ? 'Sending...' : 'Retry failed'}
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={handleSend}
            disabled={!valid || selectedPlayers.length === 0 || sending}
          >
            {sending ? 'Sending...' : `Award to ${selectedPlayers.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
