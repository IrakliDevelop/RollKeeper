'use client';

import React, { useRef } from 'react';

import { NumberInput } from '@/components/ui/forms/NumberInput';

import { useDraftValue } from './useDraftValue';

interface CreatureMaxHpFieldProps {
  maxHp: number;
  onCommit: (maxHp: number) => void;
}

/**
 * Max HP editor that buffers typing and commits once on blur or Enter
 * (Escape reverts) — `onSetMaxHp` clamps current HP, so a per-keystroke
 * commit would turn 45/45 into 5/50 while typing "50". Same commit rule as
 * `DetailVitals.commitMaxHp`: only a positive, changed value.
 */
export function CreatureMaxHpField({
  maxHp,
  onCommit,
}: CreatureMaxHpFieldProps) {
  const [draft, setDraft, revert] = useDraftValue<number | undefined>(maxHp);
  const skipCommit = useRef(false);

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const parsed = parseInt(e.currentTarget.value, 10);
    if (skipCommit.current) {
      skipCommit.current = false;
      return;
    }
    if (!isNaN(parsed) && parsed > 0 && parsed !== maxHp) onCommit(parsed);
    else revert();
  };

  return (
    <NumberInput
      value={draft}
      onChange={setDraft}
      allowEmpty
      onBlur={handleBlur}
      onKeyDown={e => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          revert();
          skipCommit.current = true;
          e.currentTarget.blur();
        }
      }}
      size="sm"
      wrapperClassName="w-16"
      className="px-1 text-center tabular-nums"
      aria-label="Max HP"
    />
  );
}
