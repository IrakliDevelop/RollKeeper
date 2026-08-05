'use client';

import React from 'react';
import { Minus, Plus } from 'lucide-react';
import {
  CLASS_RESOURCE_ICONS,
  CLASS_RESOURCE_COLORS,
} from '@/components/ui/character/classResourceStyles';
import type { NpcResource } from '@/types/encounter';
import type { DetailSectionProps } from './DetailHeader';

export interface NpcResourceListProps {
  resources: NpcResource[];
  onSpend: (resourceId: string, amount: number) => void;
  onRestore: (resourceId: string, amount: number) => void;
  /** Read-only rendering: pips become static dots, pool loses its −/+ buttons. */
  readOnly?: boolean;
}

/**
 * Generic class-resource tracker: pips (click to spend/restore) for
 * displayStyle 'pips', n/max with −/+ for 'pool'. Used by the encounter
 * detail panel and the NPC detail dialog.
 */
export function NpcResourceList({
  resources,
  onSpend,
  onRestore,
  readOnly = false,
}: NpcResourceListProps) {
  if (resources.length === 0) return null;

  return (
    <div className="space-y-1">
      <h4 className="text-heading text-xs font-semibold tracking-wider uppercase">
        Class Resources
      </h4>
      {resources.map(res => {
        const Icon = CLASS_RESOURCE_ICONS[res.icon];
        const colorClasses = CLASS_RESOURCE_COLORS[res.color];
        const remaining = Math.max(0, res.maxUses - res.usesExpended);

        return (
          <div
            key={res.id}
            className="bg-surface-raised flex items-center justify-between gap-2 rounded px-2 py-1.5 shadow-sm"
          >
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${colorClasses.iconBg}`}
              >
                <Icon size={12} aria-hidden />
              </span>
              <span className="text-body truncate text-sm font-medium">
                {res.name}
              </span>
            </div>
            {res.displayStyle === 'pips' ? (
              <div className="flex flex-wrap items-center justify-end gap-1">
                {Array.from({ length: res.maxUses }).map((_, i) => {
                  const isSpent = i < res.usesExpended;
                  const pipClass = `h-4 w-4 rounded-full border-2 transition-colors ${
                    isSpent ? colorClasses.pipOff : colorClasses.pipOn
                  }`;
                  if (readOnly) {
                    return (
                      <span
                        key={i}
                        aria-label={`${res.name} use ${i + 1} ${isSpent ? '(spent)' : '(available)'}`}
                        className={pipClass}
                      />
                    );
                  }
                  return (
                    <button
                      key={i}
                      onClick={() =>
                        isSpent ? onRestore(res.id, 1) : onSpend(res.id, 1)
                      }
                      title={
                        isSpent
                          ? `Restore ${res.name} use`
                          : `Spend ${res.name} use`
                      }
                      aria-label={`${res.name} use ${i + 1} ${isSpent ? '(spent)' : '(available)'}`}
                      className={pipClass}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="flex shrink-0 items-center gap-1.5">
                {!readOnly && (
                  <button
                    onClick={() => onSpend(res.id, 1)}
                    disabled={remaining === 0}
                    aria-label={`Spend ${res.name}`}
                    className="border-divider text-muted hover:text-body disabled:text-faint rounded border p-0.5 disabled:cursor-not-allowed"
                  >
                    <Minus size={12} aria-hidden />
                  </button>
                )}
                <span className="text-body text-sm font-semibold tabular-nums">
                  {remaining}/{res.maxUses}
                </span>
                {!readOnly && (
                  <button
                    onClick={() => onRestore(res.id, 1)}
                    disabled={res.usesExpended === 0}
                    aria-label={`Restore ${res.name}`}
                    className="border-divider text-muted hover:text-body disabled:text-faint rounded border p-0.5 disabled:cursor-not-allowed"
                  >
                    <Plus size={12} aria-hidden />
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Encounter wrapper wired to EntityActions. */
export function DetailResources({ entity, actions }: DetailSectionProps) {
  const resources = entity.resources;
  if (!resources || resources.length === 0) return null;
  return (
    <NpcResourceList
      resources={resources}
      onSpend={(resourceId, amount) =>
        actions.onSpendResource(entity.id, resourceId, amount)
      }
      onRestore={(resourceId, amount) =>
        actions.onRestoreResource(entity.id, resourceId, amount)
      }
    />
  );
}
