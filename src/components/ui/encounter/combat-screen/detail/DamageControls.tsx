'use client';

import React, { useState } from 'react';
import { Minus, Plus } from 'lucide-react';

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
  const [amount, setAmount] = useState('');

  const parsed = parseInt(amount, 10);
  const valid = !isNaN(parsed) && parsed > 0;

  const handleDamage = () => {
    if (valid) {
      onDamage(entityId, parsed);
      setAmount('');
    }
  };

  const handleHeal = () => {
    if (valid) {
      onHeal(entityId, parsed);
      setAmount('');
    }
  };

  const handleTemp = () => {
    if (valid) {
      onAddTempHp(entityId, parsed);
      setAmount('');
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="number"
        value={amount}
        onChange={e => setAmount(e.target.value)}
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
            const val = parseInt(amount, 10);
            if (!isNaN(val) && val > 0) setAmount(String(Math.floor(val / 2)));
          }}
          className="bg-surface-raised text-muted hover:text-heading rounded-md px-2.5 py-1.5 text-xs font-bold shadow-sm transition-colors"
          title="Half damage (resistance)"
        >
          ½×
        </button>
        <button
          onClick={() => {
            const val = parseInt(amount, 10);
            if (!isNaN(val) && val > 0) setAmount(String(val * 2));
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
