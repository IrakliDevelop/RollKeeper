'use client';

import React, { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { NumberField } from '@/components/ui/forms/NumberInput';
import { Button } from '@/components/ui/forms/button';

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
        className="bg-surface border-divider text-body w-24 rounded-sm border px-2.5 py-1.5 text-base pointer-coarse:min-h-11"
      />
      <div className="flex gap-1">
        <Button
          type="button"
          variant="secondary"
          size="xs"
          onClick={() => {
            if (amount != null && amount > 0) setAmount(Math.floor(amount / 2));
          }}
        >
          ½× <span className="sr-only">Halve damage (resistance)</span>
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="xs"
          onClick={() => {
            if (amount != null && amount > 0) setAmount(amount * 2);
          }}
        >
          2× <span className="sr-only">Double damage (vulnerability)</span>
        </Button>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={handleDamage}
        disabled={!valid}
        className="text-blood-text"
      >
        <Minus size={11} className="mr-1 inline" aria-hidden />
        Damage
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={handleHeal}
        disabled={!valid}
        className="text-verdigris-text"
      >
        <Plus size={11} className="mr-1 inline" aria-hidden />
        Heal
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={handleTemp}
        disabled={!valid}
      >
        Add temp HP
      </Button>
    </div>
  );
}
