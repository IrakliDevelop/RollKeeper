'use client';

import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { NumberInput } from '@/components/ui/forms/NumberInput';
import { Switch } from '@/components/ui/forms/switch';
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
  const [error, setError] = useState<string | null>(null);
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
    setError(null);
    setSent(false);
    try {
      await postXpAward(campaignCode, dmId, playerId, award);
      setDisplayedXp(current => projectXpFromAwards(current, [award]));
      setPendingAwardCount(current => current + 1);
      setFailedAward(null);
      setAmount(undefined);
      setSent(true);
    } catch (err) {
      setFailedAward(award);
      setError(err instanceof Error ? err.message : 'Failed to send XP award');
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

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
      <XPTracker
        currentXP={displayedXp}
        currentLevel={currentLevel}
        readonly
        compact
        hideLevelUpAlert
      />
      <div className="space-y-3 lg:pt-1">
        <div className="flex items-center justify-between">
          <span className="text-heading flex items-center gap-1.5 text-sm font-medium">
            <TrendingUp size={14} />
            Award XP
          </span>
          <span className="text-faint text-right text-xs">
            {pendingAwardCount > 0
              ? `Projected · ${pendingAwardCount} pending`
              : 'Synced XP'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-medium ${mode === 'add' ? 'text-heading' : 'text-muted'}`}
          >
            Add
          </span>
          <Switch
            checked={mode === 'set'}
            onCheckedChange={checked => setMode(checked ? 'set' : 'add')}
            size="sm"
            aria-label="Toggle between add and set XP"
            disabled={sending || failedAward !== null}
          />
          <span
            className={`text-xs font-medium ${mode === 'set' ? 'text-heading' : 'text-muted'}`}
          >
            Set
          </span>
          <NumberInput
            value={amount}
            onChange={setAmount}
            min={minAmount}
            allowEmpty
            placeholder={mode === 'add' ? 'XP to add...' : 'Total XP...'}
            aria-label={mode === 'add' ? 'XP to add' : 'Total XP'}
            className="flex-1"
            disabled={sending || failedAward !== null}
          />
          {failedAward ? (
            <Button
              variant="warning"
              size="sm"
              onClick={() => send(failedAward)}
              disabled={sending}
            >
              {sending ? 'Sending...' : 'Retry'}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={handleSend}
              disabled={!valid || sending}
            >
              {sending ? 'Sending...' : 'Send'}
            </Button>
          )}
        </div>
        {failedAward && (
          <p className="text-accent-amber-text text-xs">
            Retry will resend the original{' '}
            {failedAward.mode === 'add' ? 'add' : 'set'} award of{' '}
            {failedAward.amount.toLocaleString()} XP with the same delivery ID.
          </p>
        )}
        {mode === 'set' && (
          <p className="text-faint text-xs">
            Sets the player&apos;s total XP — overwrites changes they made since
            the last sync.
          </p>
        )}
        {error && <p className="text-accent-red-text text-xs">{error}</p>}
        {sent && !error && (
          <p className="text-accent-emerald-text text-xs">XP award sent.</p>
        )}
      </div>
    </div>
  );
}
