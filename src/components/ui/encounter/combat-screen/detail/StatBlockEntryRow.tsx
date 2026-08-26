'use client';

import React from 'react';
import {
  formatUsesLabel,
  parseRechargeFromName,
} from '@/utils/encounterConverter';
import { formatAbilityUsageLabel } from '@/utils/statBlockAbilities';
import type {
  MonsterAbility,
  NpcResource,
  StatBlockEntry,
} from '@/types/encounter';

const USE_BUTTON_ENABLED =
  'border-accent-amber-border bg-accent-amber-bg text-accent-amber-text hover:bg-accent-amber-bg-strong rounded-md border px-2.5 py-0.5 text-xs font-medium transition-colors';
const USE_BUTTON_DISABLED =
  'border-divider bg-surface-raised text-faint cursor-not-allowed rounded-md border px-2.5 py-0.5 text-xs font-medium';

export interface StatBlockEntryRowProps {
  entry: StatBlockEntry;
  ability?: MonsterAbility;
  resources?: NpcResource[];
  onUseAbility?: (entry: StatBlockEntry) => void;
  onRestoreAbility?: (entry: StatBlockEntry) => void;
  onSpendCost?: (entry: StatBlockEntry) => void;
  readOnly?: boolean;
  renderText?: (text: string) => string;
}

/**
 * One stat-block entry: name + labels + controls on line 1, description
 * ALWAYS a separate block on line 2. Trackable entries get inline pips
 * (use = atomic with resourceCost when present; restore never refunds);
 * untrackable entries with a cost get an explicit Use button.
 */
export function StatBlockEntryRow({
  entry,
  ability,
  resources,
  onUseAbility,
  onRestoreAbility,
  onSpendCost,
  readOnly = false,
  renderText,
}: StatBlockEntryRowProps) {
  // Display follows the authoritative config. A live view-model means:
  // - the NAME renders cleaned (usage notation stripped), because an
  //   entity-edited "Teleport (9/Day)" must not contradict authoritative pips;
  // - the LABEL derives from the ability config (formatAbilityUsageLabel),
  //   never from entry.uses or the entry name's parsed marker.
  // Without a view-model (untrackable rows), the entry renders verbatim.
  const displayName = ability
    ? parseRechargeFromName(entry.name).cleanName
    : entry.name;
  const usesLabel = ability
    ? formatAbilityUsageLabel(ability)
    : formatUsesLabel(entry.name, entry.uses);
  const cost = entry.resourceCost;
  const resource = cost && resources?.find(r => r.id === cost.resourceId);
  const remaining = resource
    ? Math.max(0, resource.maxUses - resource.usesExpended)
    : 0;
  const costInsufficient =
    cost != null && (!resource || remaining < cost.amount);
  const costLabel = cost
    ? resource
      ? `${cost.amount > 1 ? `${cost.amount}× ` : ''}${resource.name}`
      : 'Unknown resource'
    : null;

  const trackable = ability != null && entry.id != null;
  const max = trackable ? (ability.maxUses ?? 1) : 0;
  const used = trackable ? ability.usedUses : 0;
  const useBlocked = costInsufficient; // pips can't spend when the cost can't be covered

  return (
    <div className="text-sm">
      {/* Line 1: name · labels · controls */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-heading font-semibold italic">
          {displayName}
          {usesLabel ? ` (${usesLabel})` : ''}
        </span>
        {costLabel && (
          <span className="bg-accent-purple-bg text-accent-purple-text rounded px-1.5 py-0.5 text-[10px] font-semibold">
            {costLabel}
          </span>
        )}
        {trackable && (
          <span className="inline-flex items-center gap-1">
            {Array.from({ length: max }).map((_, i) => {
              const isUsed = i < used;
              const pipClass = `h-3.5 w-3.5 rounded-full border-2 transition-colors ${
                isUsed
                  ? 'border-accent-red-border bg-accent-red-bg'
                  : 'border-accent-emerald-border bg-accent-emerald-bg'
              }`;
              if (readOnly) {
                return (
                  <span
                    key={i}
                    aria-label={`${displayName} use ${i + 1} ${isUsed ? '(used)' : '(available)'}`}
                    className={pipClass}
                  />
                );
              }
              return (
                <button
                  key={i}
                  onClick={() =>
                    isUsed
                      ? onRestoreAbility?.(entry)
                      : !useBlocked && onUseAbility?.(entry)
                  }
                  disabled={!isUsed && useBlocked}
                  aria-label={`${displayName} use ${i + 1} ${isUsed ? '(used)' : '(available)'}`}
                  title={
                    isUsed
                      ? cost && resource
                        ? `Restore use (does not refund ${resource.name})`
                        : 'Restore use'
                      : useBlocked
                        ? resource
                          ? `Not enough ${resource.name} uses`
                          : 'Resource removed'
                        : cost && resource
                          ? `Use — spends ${cost.amount} ${resource.name}`
                          : 'Use'
                  }
                  className={`${pipClass} ${!isUsed && useBlocked ? 'cursor-not-allowed opacity-50' : ''}`}
                />
              );
            })}
          </span>
        )}
        {!trackable && cost && !readOnly && onSpendCost && (
          <button
            onClick={() => onSpendCost(entry)}
            disabled={costInsufficient}
            title={
              !resource
                ? 'Resource removed'
                : costInsufficient
                  ? `Not enough ${resource.name} uses`
                  : `Spend ${cost.amount} ${resource.name}`
            }
            className={
              costInsufficient ? USE_BUTTON_DISABLED : USE_BUTTON_ENABLED
            }
          >
            Use
          </button>
        )}
      </div>
      {/* Line 2: description — always its own block */}
      {entry.text && (
        <div
          className="text-body statblock-rich-text mt-0.5"
          dangerouslySetInnerHTML={{
            __html: renderText ? renderText(entry.text) : entry.text,
          }}
        />
      )}
    </div>
  );
}
