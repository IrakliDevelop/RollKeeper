'use client';

import React, { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { NumberField } from '@/components/ui/forms/NumberInput';

interface DamageControlsProps {
  entityId: string;
  onDamage: (id: string, amount: number) => void;
  onHeal: (id: string, amount: number) => void;
  onAddTempHp: (id: string, amount: number) => void;
}

export function DamageControls({
  entityId,
  onDamage,
  onHeal,
  onAddTempHp,
}: DamageControlsProps) {
  const [amount, setAmount] = useState<number | undefined>(undefined);

  const valid = amount != null && amount > 0;

  const handleDamage = () => {
    if (amount != null && amount > 0) {
      onDamage(entityId, amount);
      setAmount(undefined);
    }
  };

  const handleHeal = () => {
    if (amount != null && amount > 0) {
      onHeal(entityId, amount);
      setAmount(undefined);
    }
  };

  const handleTemp = () => {
    if (amount != null && amount > 0) {
      onAddTempHp(entityId, amount);
      setAmount(undefined);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <NumberField
        value={amount}
        onChange={setAmount}
        allowEmpty
        onKeyDown={e => {
          if (e.key === 'Enter') handleDamage();
        }}
        placeholder="Amount"
        aria-label="Amount"
        min={0}
        className="bg-surface-raised text-body placeholder:text-faint w-24 rounded-lg px-2.5 py-1.5 text-sm shadow-sm"
      />
      <div className="flex gap-1">
        <button
          onClick={() => {
            if (amount != null && amount > 0) setAmount(Math.floor(amount / 2));
          }}
          className="bg-surface-raised text-muted hover:text-heading rounded-md px-2.5 py-1.5 text-xs font-bold shadow-sm transition-colors"
          title="Half damage (resistance)"
        >
          ½×
        </button>
        <button
          onClick={() => {
            if (amount != null && amount > 0) setAmount(amount * 2);
          }}
          className="bg-surface-raised text-muted hover:text-heading rounded-md px-2.5 py-1.5 text-xs font-bold shadow-sm transition-colors"
          title="Double damage (vulnerability)"
        >
          2×
        </button>
      </div>
      <button
        onClick={handleDamage}
        disabled={!valid}
        className="bg-accent-red-bg text-accent-red-text hover:bg-accent-red-bg-strong rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Minus size={11} className="mr-1 inline" aria-hidden />
        Damage
      </button>
      <button
        onClick={handleHeal}
        disabled={!valid}
        className="bg-accent-emerald-bg text-accent-emerald-text hover:bg-accent-emerald-bg-strong rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus size={11} className="mr-1 inline" aria-hidden />
        Heal
      </button>
      <button
        onClick={handleTemp}
        disabled={!valid}
        className="border-divider bg-surface-raised text-body rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
      >
        + Temp
      </button>
    </div>
  );
}
