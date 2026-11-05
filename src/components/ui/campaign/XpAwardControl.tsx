'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/forms/button';
import { NumberInput } from '@/components/ui/forms/NumberInput';
import { Section } from '@/components/ui/layout/section';
import { XPTracker } from '@/components/shared/character';
import type { DmXpAward } from '@/types/sharedState';
import { projectXpFromAwards } from '@/lib/xpAwardQueue';

interface XpAwardControlProps {
  campaignCode: string;
  dmId: string;
  playerId: string;
  /** XP from the player's last synced snapshot — may be stale. */
  lastSyncedXp: number;
  /** Level from the same synced snapshot, used for XP progress. */
  currentLevel: number;
  projectedXp?: number;
  pendingAwardCount?: number;
}

export async function postXpAward(
  campaignCode: string,
  dmId: string,
  playerId: string,
  award: DmXpAward
): Promise<void> {
  const res = await fetch(`/api/campaign/${campaignCode}/shared`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ feature: 'xp', data: { playerId, award }, dmId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed (${res.status})`);
  }
}

export function XpAwardControl({
  campaignCode,
  dmId,
  playerId,
  lastSyncedXp,
  currentLevel,
  projectedXp: serverProjectedXp,
  pendingAwardCount: serverPendingAwardCount = 0,
}: XpAwardControlProps) {
  const [mode, setMode] = useState<'add' | 'set'>('add');
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);
  const [sent, setSent] = useState(false);
  // Retained on failure so Retry re-sends the ORIGINAL award (same id) — a
  // lost response may still have enqueued it; the player dedupes by id.
  const [failedAward, setFailedAward] = useState<DmXpAward | null>(null);
  const [displayedXp, setDisplayedXp] = useState(
    serverProjectedXp ?? lastSyncedXp
  );
  const [pendingAwardCount, setPendingAwardCount] = useState(
    serverPendingAwardCount
  );

  useEffect(() => {
    setDisplayedXp(serverProjectedXp ?? lastSyncedXp);
    setPendingAwardCount(serverPendingAwardCount);
  }, [lastSyncedXp, serverProjectedXp, serverPendingAwardCount]);

  const minAmount = mode === 'add' ? 1 : 0;
  const valid = amount !== undefined && amount >= minAmount;

  const send = async (award: DmXpAward) => {
    setSending(true);
    setError(false);
    setSent(false);
    try {
      await postXpAward(campaignCode, dmId, playerId, award);
      setDisplayedXp(current => projectXpFromAwards(current, [award]));
      setPendingAwardCount(current => current + 1);
      setFailedAward(null);
      setAmount(undefined);
      setSent(true);
    } catch {
      setFailedAward(award);
      setError(true);
    } finally {
      setSending(false);
    }
  };

  const handleSend = () => {
    if (!valid) return;
    send({
      id: crypto.randomUUID(),
      mode,
      amount: amount!,
      awardedAt: new Date().toISOString(),
    });
  };

  const pending = pendingAwardCount;
  const status =
    pending === 0
      ? 'From the last sync'
      : pending === 1
        ? 'Includes 1 award not yet received'
        : `Includes ${pending} awards not yet received`;
  const locked = sending || failedAward !== null;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
      <XPTracker
        currentXP={displayedXp}
        currentLevel={currentLevel}
        readonly
        compact
        hideLevelUpAlert
      />
      <Section
        level={3}
        heading="Award XP"
        wrapHeading
        trailing={<p className="type-small text-muted">{status}</p>}
      >
        <div className="space-y-3">
          <div role="group" aria-label="Award XP" className="flex gap-2">
            <Button
              size="sm"
              selected={mode === 'add'}
              aria-pressed={mode === 'add'}
              disabled={locked}
              onClick={() => setMode('add')}
            >
              Add XP
            </Button>
            <Button
              size="sm"
              selected={mode === 'set'}
              aria-pressed={mode === 'set'}
              disabled={locked}
              onClick={() => setMode('set')}
            >
              Set total
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <NumberInput
              value={amount}
              onChange={setAmount}
              aria-label={mode === 'add' ? 'XP to add' : 'Total XP'}
              placeholder={mode === 'add' ? '300' : '6500'}
              min={minAmount}
              allowEmpty
              disabled={locked}
              wrapperClassName="min-w-0 flex-1"
            />
            {failedAward ? (
              <Button
                variant="secondary"
                size="sm"
                className="shrink-0"
                onClick={() => send(failedAward)}
                disabled={sending}
              >
                {sending ? 'Sending…' : 'Resend'}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                className="shrink-0"
                onClick={handleSend}
                disabled={!valid || sending}
              >
                {sending ? 'Sending…' : 'Send award'}
              </Button>
            )}
          </div>
          {failedAward && (
            <p className="type-small text-muted">
              Resending gives the same {failedAward.amount.toLocaleString()} XP
              award. The player gets it once.
            </p>
          )}
          {mode === 'set' && (
            <p className="type-small text-muted">
              Replaces the character&apos;s XP total, including changes since
              the last sync.
            </p>
          )}
          {error && (
            <p role="alert" className="type-small text-blood-text">
              The XP award wasn&apos;t sent. Resend to try again.
            </p>
          )}
          {sent && !error && (
            <p role="status" className="type-small text-verdigris-text">
              XP award sent
            </p>
          )}
        </div>
      </Section>
    </div>
  );
}
