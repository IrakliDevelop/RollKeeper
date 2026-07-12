'use client';

import { useState } from 'react';
import { Dices, X } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';

import type { InitiativeRollRequest } from '@/types/sharedState';

export interface InitiativeRollPromptProps {
  request: InitiativeRollRequest;
  /** The character's initiative modifier (character.initiative.value). */
  modifier: number;
  /** Resolve false to show the inline error and keep the prompt open. */
  onSubmit: (value: number) => Promise<boolean>;
  onDismiss: () => void;
}

/** Floating "roll for initiative" card — mounted on the sheet and the VTT. */
export function InitiativeRollPrompt({
  request,
  modifier,
  onSubmit,
  onDismiss,
}: InitiativeRollPromptProps) {
  const [value, setValue] = useState('');
  const [breakdown, setBreakdown] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);

  const handleRoll = () => {
    const d20 = Math.floor(Math.random() * 20) + 1;
    setValue(String(d20 + modifier));
    setBreakdown(`${d20} ${modifier >= 0 ? '+' : '−'} ${Math.abs(modifier)}`);
    setError(false);
  };

  const parsed = Number(value);
  const valid = value.trim() !== '' && Number.isFinite(parsed);

  const handleConfirm = async () => {
    if (!valid || sending) return;
    setSending(true);
    setError(false);
    const ok = await onSubmit(parsed);
    setSending(false);
    if (!ok) setError(true);
  };

  return (
    <div className="bg-surface-raised border-divider pointer-events-auto fixed bottom-4 left-1/2 z-40 w-[min(92vw,380px)] -translate-x-1/2 rounded-2xl border p-3 shadow-xl">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-heading text-sm font-semibold">
          {request.encounterName}: roll for initiative!
        </p>
        <Button
          variant="ghost"
          onClick={onDismiss}
          className="min-h-[44px] min-w-[44px] p-0"
          aria-label="Dismiss"
        >
          <X size={16} />
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          onClick={handleRoll}
          className="min-h-[44px]"
          leftIcon={<Dices size={16} />}
        >
          Roll d20
        </Button>
        <Input
          value={value}
          onChange={e => {
            setValue(e.target.value);
            setBreakdown(null);
            setError(false);
          }}
          inputMode="numeric"
          placeholder="Total"
          aria-label="Initiative total"
          className="min-h-[44px] w-20 text-center"
        />
        <Button
          variant="primary"
          onClick={() => void handleConfirm()}
          disabled={!valid || sending}
          className="min-h-[44px] flex-1"
        >
          {sending ? 'Sending…' : 'Confirm'}
        </Button>
      </div>
      {breakdown && <p className="text-muted mt-1.5 text-xs">🎲 {breakdown}</p>}
      {error && (
        <p className="text-accent-red-text mt-1.5 text-xs">
          Couldn&apos;t send — try again.
        </p>
      )}
    </div>
  );
}
