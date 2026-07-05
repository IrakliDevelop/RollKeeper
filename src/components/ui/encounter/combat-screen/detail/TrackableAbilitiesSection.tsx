'use client';

import React from 'react';
import { RotateCcw } from 'lucide-react';
import type { DetailSectionProps } from './DetailHeader';

export function TrackableAbilitiesSection({
  entity,
  actions,
}: DetailSectionProps) {
  const abilities = entity.abilities;
  if (!abilities || abilities.length === 0) return null;

  return (
    <div className="space-y-1">
      <h4 className="text-heading text-xs font-semibold tracking-wider uppercase">
        Abilities
      </h4>
      {abilities.map(ability => {
        const max = ability.maxUses ?? 1;
        const used = ability.usedUses;
        const showPips = max > 1;

        return (
          <div
            key={ability.id}
            className="bg-surface-raised flex items-center justify-between rounded px-2 py-1.5 shadow-sm"
          >
            <div className="min-w-0 flex-1">
              <span className="text-body text-sm font-medium">
                {ability.name}
              </span>
              {ability.usageType === 'recharge' &&
                ability.rechargeOn != null && (
                  <span className="text-muted ml-1 text-xs">
                    (Recharge {ability.rechargeOn}-6)
                  </span>
                )}
              {ability.usageType === 'per-day' && max > 0 && (
                <span className="text-muted ml-1 text-xs">({max}/Day)</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {showPips ? (
                <div className="flex items-center gap-1">
                  {Array.from({ length: max }).map((_, i) => {
                    const isUsed = i < used;
                    return (
                      <button
                        key={i}
                        onClick={() =>
                          isUsed
                            ? actions.onRestoreAbility(entity.id, ability.id)
                            : actions.onUseAbility(entity.id, ability.id)
                        }
                        title={isUsed ? `Restore use` : `Use`}
                        className={`h-4 w-4 rounded-full border-2 transition-colors ${
                          isUsed
                            ? 'border-accent-red-border bg-accent-red-bg'
                            : 'border-accent-emerald-border bg-accent-emerald-bg'
                        }`}
                      />
                    );
                  })}
                </div>
              ) : used > 0 ? (
                <>
                  <span className="text-accent-red-text text-xs font-medium">
                    Used
                  </span>
                  <button
                    onClick={() =>
                      actions.onRestoreAbility(entity.id, ability.id)
                    }
                    className="text-muted hover:text-accent-emerald-text rounded p-0.5"
                    title="Restore"
                  >
                    <RotateCcw size={12} />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => actions.onUseAbility(entity.id, ability.id)}
                  className="bg-accent-amber-bg text-accent-amber-text rounded px-2 py-0.5 text-xs font-medium hover:opacity-80"
                >
                  Use
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
