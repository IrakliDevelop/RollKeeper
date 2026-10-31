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
  itemName?: string;
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
  itemName = 'item',
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
      <div className="text-muted inline-flex items-center gap-1.5 text-sm">
        <Zap size={12} aria-hidden="true" />
        <span>
          {remaining}/{pool.maxCharges}
        </span>
      </div>
    );
  }

  const rechargeLabel = RECHARGE_LABELS[pool.rechargeType] || pool.rechargeType;

  return (
    <div className="border-divider border-t pt-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={14} aria-hidden="true" className="text-muted" />
          <span className="text-heading text-sm font-semibold">
            Shared charges
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleRestoreOne}
            disabled={used <= 0}
            className="text-body disabled:text-faint inline-flex min-h-9 min-w-9 items-center justify-center rounded pointer-coarse:min-h-11 pointer-coarse:min-w-11"
            aria-label={`Restore one ${itemName} charge`}
          >
            <Plus size={14} />
          </button>
          <span className="text-heading min-w-9 text-center text-sm font-semibold">
            {remaining}/{pool.maxCharges}
          </span>
          <button
            type="button"
            onClick={handleUseOne}
            disabled={remaining <= 0}
            className="text-body disabled:text-faint inline-flex min-h-9 min-w-9 items-center justify-center rounded pointer-coarse:min-h-11 pointer-coarse:min-w-11"
            aria-label={`Use one ${itemName} charge`}
          >
            <Minus size={14} />
          </button>
        </div>
      </div>

      {pool.maxCharges > 0 && (
        <div className="bg-surface-hover mb-2 h-1.5 w-full rounded-full">
          <div
            className="bg-divider-strong h-1.5 rounded-full transition-all duration-300"
            style={{
              width: `${pool.maxCharges > 0 ? (remaining / pool.maxCharges) * 100 : 0}%`,
            }}
          />
        </div>
      )}

      <div className="text-muted mb-2 text-sm">
        Regains {pool.rechargeAmount || 'all charges'} at {rechargeLabel}
      </div>

      {pool.abilities.length > 0 && (
        <div className="space-y-1">
          {pool.abilities.map(ability => {
            const canUse = ability.cost === 0 || ability.cost <= remaining;

            return (
              <div
                key={ability.id}
                className="border-divider flex min-w-0 items-center justify-between gap-2 border-t py-2 text-sm"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  {ability.isSpell && (
                    <Sparkles size={10} className="text-muted shrink-0" />
                  )}
                  <span className="text-heading font-medium break-words">
                    {ability.name}
                  </span>
                  {ability.description && (
                    <span className="text-muted text-xs">
                      ({ability.description})
                    </span>
                  )}
                </div>
                {ability.cost > 0 ? (
                  <button
                    type="button"
                    onClick={() =>
                      handleExpendAbility(ability.id, ability.cost)
                    }
                    disabled={!canUse}
                    className="border-divider text-body disabled:text-faint shrink-0 rounded border px-2 py-1.5 text-sm pointer-coarse:min-h-11"
                    aria-label={`Use ${ability.name} (${ability.cost} charges)`}
                  >
                    Use ({ability.cost}{' '}
                    {ability.cost === 1 ? 'charge' : 'charges'})
                  </button>
                ) : (
                  <Badge variant="neutral" size="sm">
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
