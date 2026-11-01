'use client';

import React from 'react';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { CLASS_RESOURCE_STYLE } from '@/components/ui/character/classResourceStyles';
import {
  formatUsesLabel,
  parseRechargeFromName,
} from '@/utils/encounterConverter';
import { formatAbilityUsageLabel } from '@/utils/statBlockAbilities';
import type {
  MonsterAbility,
  NpcResource,
  StatBlockEntry,
  NPCInventoryItem,
} from '@/types/encounter';

export interface StatBlockEntryRowProps {
  entry: StatBlockEntry;
  ability?: MonsterAbility;
  resources?: NpcResource[];
  inventory?: NPCInventoryItem[];
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
  inventory,
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
  const inventoryCost = entry.inventoryCost;
  const inventoryItem =
    inventoryCost &&
    inventory?.find(item => item.id === inventoryCost.inventoryItemId);
  const inventoryInsufficient =
    inventoryCost != null &&
    (!inventoryItem || inventoryItem.quantity < inventoryCost.quantity);
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
  const useBlocked = costInsufficient || inventoryInsufficient;
  const canSpend = trackable ? !!onUseAbility : !!onSpendCost;
  const blockedReason = costInsufficient
    ? resource
      ? `Not enough ${resource.name} uses`
      : 'Resource removed'
    : inventoryInsufficient
      ? inventoryItem
        ? `Not enough ${inventoryItem.name}`
        : 'Inventory item removed'
      : null;

  return (
    <div className="text-sm">
      {/* Line 1: name · labels · controls */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-heading font-semibold italic">
          {displayName}
          {usesLabel ? ` (${usesLabel})` : ''}
        </span>
        {costLabel && (
          <Badge variant="neutral" size="sm">
            {costLabel}
          </Badge>
        )}
        {inventoryCost && (
          <Badge variant="neutral" size="sm">
            {inventoryCost.quantity > 1 ? `${inventoryCost.quantity}× ` : ''}
            {inventoryItem?.name ?? 'Missing item'} ·{' '}
            {inventoryItem?.quantity ?? 0}
          </Badge>
        )}
        {trackable && (
          <span className="inline-flex flex-wrap items-center gap-1">
            {Array.from({ length: max }).map((_, i) => {
              const isUsed = i < used;
              const pipClass = `size-2.5 rounded-full border-[1.5px] ${
                isUsed
                  ? CLASS_RESOURCE_STYLE.pipOff
                  : CLASS_RESOURCE_STYLE.pipOn
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
                  type="button"
                  data-state={isUsed ? 'used' : 'available'}
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
                  className="focus-visible:outline-ring flex min-h-6 min-w-6 items-center justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                >
                  <span aria-hidden="true" className={pipClass} />
                </button>
              );
            })}
          </span>
        )}
        {!trackable && (cost || inventoryCost) && !readOnly && onSpendCost && (
          <Button
            variant="secondary"
            size="xs"
            onClick={() => onSpendCost(entry)}
            disabled={useBlocked}
            aria-label={`Use ${displayName}`}
          >
            Use
          </Button>
        )}
        {useBlocked && blockedReason && canSpend && !readOnly && (
          <span className="text-muted text-xs">{blockedReason}</span>
        )}
        {cost && resource && used > 0 && !readOnly && (
          <span className="text-muted text-xs">
            Restoring a use does not refund {resource.name}.
          </span>
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
