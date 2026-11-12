'use client';

import { useId, useState } from 'react';
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
  const [sendingKind, setSendingKind] = useState<'award' | 'resend' | null>(
    null
  );
  const sending = sendingKind !== null;
  const idBase = useId();
  const playersId = `${idBase}-players`;
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

  const sendAwards = async (
    targets: Map<string, DmXpAward>,
    kind: 'award' | 'resend'
  ) => {
    setSendingKind(kind);
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
    // Clear amount after successful send (no failures remain)
    if (nextFailed.size === 0) {
      setAmount(undefined);
    }
    setSendingKind(null);
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
    sendAwards(targets, 'award');
  };

  const handleRetry = () => {
    if (failedAwards.size === 0) return;
    sendAwards(new Map(failedAwards), 'resend');
  };

  const playerName = (playerId: string) =>
    players.find(p => p.playerId === playerId)?.characterName ?? playerId;

  const n = selectedPlayers.length;
  const awardLabel =
    n === 1 ? 'Award XP to 1 player' : `Award XP to ${n} players`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Award XP</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <NumberInput
            id="award-xp-amount"
            label="XP to add"
            value={amount}
            onChange={setAmount}
            min={1}
            allowEmpty
            placeholder="300"
          />

          <div role="group" aria-labelledby={playersId} className="space-y-2">
            <p id={playersId} className="type-ui text-heading">
              Players
            </p>
            {players.map(p => {
              const nameId = `${idBase}-name-${p.playerId}`;
              const outcome = outcomes?.get(p.playerId);
              return (
                <label
                  key={p.playerId}
                  className="flex items-center gap-2 pointer-coarse:min-h-11"
                >
                  <Checkbox
                    aria-labelledby={nameId}
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
                  <span id={nameId} className="type-ui text-heading">
                    {p.characterName}
                  </span>
                  <span className="type-small text-muted">
                    ({p.playerName})
                  </span>
                  {outcome === 'ok' && (
                    <span className="type-small text-muted">Sent</span>
                  )}
                  {outcome === 'failed' && (
                    <span className="type-small text-muted">Not sent</span>
                  )}
                </label>
              );
            })}
          </div>

          {failedAwards.size > 0 && (
            <p role="alert" className="type-small text-blood-text">
              {`Not sent to ${[...failedAwards.keys()].map(playerName).join(', ')}. Resending gives them the same award.`}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenChange(false)}
          >
            Close
          </Button>
          {failedAwards.size > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRetry}
              disabled={sending}
            >
              {sendingKind === 'resend'
                ? 'Sending…'
                : `Resend to ${failedAwards.size}`}
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={handleSend}
            disabled={!valid || selectedPlayers.length === 0 || sending}
          >
            {sendingKind === 'award' ? 'Sending…' : awardLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
