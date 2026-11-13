'use client';

import { useState } from 'react';
import { Dices, X } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { AppIcon } from '@/components/ui/icons';
import { OVERLAY_SURFACE } from '@/components/ui/primitives/variants';
import { Tooltip, TooltipProvider } from '@/components/ui/primitives/Tooltip';

import type { InitiativeRollRequest } from '@/types/sharedState';

export interface InitiativeRollPromptProps {
  request: InitiativeRollRequest;
  /** The character's initiative modifier (character.initiative.value). */
  modifier: number;
  /** Resolve false to show the inline error and keep the prompt open. */
  onSubmit: (value: number) => Promise<boolean>;
  onDismiss: () => void;
  embedded?: boolean;
}

/** Floating "roll for initiative" card — mounted on the sheet and the VTT. */
export function InitiativeRollPrompt({
  request,
  modifier,
  onSubmit,
  onDismiss,
  embedded = false,
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
    <TooltipProvider>
      <div
        className={
          embedded
            ? 'bg-surface-elevated border-divider pointer-events-auto w-full rounded-md border p-3'
            : `${OVERLAY_SURFACE} pointer-events-auto fixed bottom-4 left-1/2 z-40 w-[min(92vw,380px)] -translate-x-1/2 p-3`
        }
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <p className="type-ui text-heading font-semibold">
            Roll initiative for {request.encounterName}
          </p>
          <Tooltip content="Dismiss initiative prompt">
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="w-9 p-0"
              aria-label="Dismiss initiative prompt"
            >
              <X size={16} aria-hidden />
            </Button>
          </Tooltip>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleRoll}
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
            className="w-20 text-center"
            wrapperClassName="w-20 shrink-0"
          />
          <Button
            variant="primary"
            onClick={() => void handleConfirm()}
            disabled={!valid || sending}
            className="flex-1"
          >
            {sending ? 'Sending…' : 'Confirm'}
          </Button>
        </div>
        {breakdown && (
          <p className="type-small text-muted mt-1.5 flex items-center gap-1">
            <AppIcon name="dice" className="h-3.5 w-3.5" /> {breakdown}
          </p>
        )}
        {error && (
          <p role="alert" className="type-small text-blood-text mt-1.5">
            Couldn&apos;t send your roll. Try again.
          </p>
        )}
      </div>
    </TooltipProvider>
  );
}
