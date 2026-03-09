'use client';

import React, { useState } from 'react';
import type { ChargePool } from '@/types/character';
import { Zap, Minus, Plus, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/layout/badge';

interface ChargePoolDisplayProps {
  pool: ChargePool;
  onExpendAbility: (abilityId: string) => void;
  onRestorePool: (amount: number) => void;
  onSetPoolUsed: (usedCount: number) => void;
  compact?: boolean;
}

const RECHARGE_LABELS: Record<string, string> = {
  dawn: 'dawn',
  dusk: 'dusk',
  midnight: 'midnight',
  short: 'short rest',
  long: 'long rest',
};

export function ChargePoolDisplay({
  pool,
  onExpendAbility,
  onRestorePool,
  onSetPoolUsed,
  compact = false,
}: ChargePoolDisplayProps) {
  const [localUsed, setLocalUsed] = useState<number | null>(null);
  const used = localUsed ?? pool.usedCharges;
  const remaining = pool.maxCharges - used;

  const handleUseOne = () => {
    if (remaining <= 0) return;
    const newUsed = used + 1;
    setLocalUsed(newUsed);
    onSetPoolUsed(newUsed);
  };

  const handleRestoreOne = () => {
    if (used <= 0) return;
    setLocalUsed(Math.max(0, used - 1));
    onRestorePool(1);
  };

  const handleExpendAbility = (abilityId: string, cost: number) => {
    if (cost > 0 && remaining < cost) return;
    const newUsed = used + cost;
    setLocalUsed(newUsed);
    onExpendAbility(abilityId);
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <Zap size={12} className="text-accent-amber-text" />
        <span
          className={`text-xs font-bold ${
            remaining <= 0
              ? 'text-accent-red-text-muted'
              : remaining <= Math.ceil(pool.maxCharges * 0.25)
                ? 'text-accent-orange-text-muted'
                : 'text-accent-amber-text'
          }`}
        >
          {remaining}/{pool.maxCharges}
        </span>
      </div>
    );
  }

  const rechargeLabel = RECHARGE_LABELS[pool.rechargeType] || pool.rechargeType;

  return (
    <div className="border-accent-amber-border bg-accent-amber-bg rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-accent-amber-text" />
          <span className="text-heading text-xs font-bold tracking-wider uppercase">
            Charges
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleRestoreOne}
            disabled={used <= 0}
            className={`rounded p-0.5 ${
              used <= 0
                ? 'text-faint cursor-not-allowed'
                : 'text-accent-green-text-muted hover:bg-accent-green-bg'
            }`}
            title="Restore 1 charge"
          >
            <Plus size={14} />
          </button>
          <span
            className={`min-w-[36px] text-center text-sm font-bold ${
              remaining <= 0
                ? 'text-accent-red-text-muted'
                : remaining <= Math.ceil(pool.maxCharges * 0.25)
                  ? 'text-accent-orange-text-muted'
                  : 'text-accent-amber-text'
            }`}
          >
            {remaining}/{pool.maxCharges}
          </span>
          <button
            onClick={handleUseOne}
            disabled={remaining <= 0}
            className={`rounded p-0.5 ${
              remaining <= 0
                ? 'text-faint cursor-not-allowed'
                : 'text-accent-red-text-muted hover:bg-accent-red-bg'
            }`}
            title="Use 1 charge"
          >
            <Minus size={14} />
          </button>
        </div>
      </div>

      {pool.maxCharges > 0 && (
        <div className="bg-surface-hover mb-2 h-1.5 w-full rounded-full">
          <div
            className={`h-1.5 rounded-full transition-all duration-300 ${
              remaining <= 0
                ? 'bg-accent-red-bg-strong'
                : remaining <= Math.ceil(pool.maxCharges * 0.25)
                  ? 'bg-accent-orange-bg-strong'
                  : 'bg-accent-amber-bg-strong'
            }`}
            style={{
              width: `${pool.maxCharges > 0 ? (remaining / pool.maxCharges) * 100 : 0}%`,
            }}
          />
        </div>
      )}

      <div className="text-muted mb-2 text-[10px]">
        Regains {pool.rechargeAmount || 'all charges'} at {rechargeLabel}
      </div>

      {pool.abilities.length > 0 && (
        <div className="space-y-1">
          {pool.abilities.map(ability => {
            const canUse = ability.cost === 0 || ability.cost <= remaining;

            return (
              <div
                key={ability.id}
                className={`flex items-center justify-between gap-2 rounded px-2 py-1 text-xs ${
                  canUse ? 'bg-surface-raised' : 'bg-surface-inset opacity-50'
                }`}
              >
                <div className="flex items-center gap-1.5 overflow-hidden">
                  {ability.isSpell && (
                    <Sparkles
                      size={10}
                      className="text-accent-purple-text-muted shrink-0"
                    />
                  )}
                  <span className="text-heading truncate font-medium">
                    {ability.name}
                  </span>
                  {ability.description && (
                    <span className="text-faint shrink-0 text-[10px]">
                      ({ability.description})
                    </span>
                  )}
                </div>
                {ability.cost > 0 ? (
                  <button
                    onClick={() =>
                      handleExpendAbility(ability.id, ability.cost)
                    }
                    disabled={!canUse}
                    className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold transition-colors ${
                      canUse
                        ? 'bg-accent-amber-bg-strong text-accent-amber-text hover:bg-accent-amber-border cursor-pointer'
                        : 'text-faint cursor-not-allowed'
                    }`}
                    title={`Use ${ability.cost} charge${ability.cost !== 1 ? 's' : ''}`}
                  >
                    {ability.cost} chg
                  </button>
                ) : (
                  <Badge variant="success" size="sm">
                    {ability.description === 'Ritual only' ? 'Ritual' : 'Free'}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
