'use client';

import React, { useState } from 'react';
import type { MagicItem, MagicItemCharge } from '@/types/character';
import {
  ChevronDown,
  ChevronRight,
  Edit2,
  Trash2,
  Sparkles,
  Minus,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { ChargePoolDisplay } from './ChargePoolDisplay';
import { calculateMagicItemChargeMax } from '@/utils/calculations';

interface MagicItemRowProps {
  item: MagicItem;
  characterLevel: number;
  onEdit: (item: MagicItem) => void;
  onDelete: (id: string) => void;
  onToggleAttunement: (item: MagicItem, shouldAttune: boolean) => void;
  onExpendCharge: (itemId: string, chargeId: string) => void;
  onRestoreCharge: (itemId: string, chargeId: string) => void;
  onExpendChargePoolAbility?: (itemId: string, abilityId: string) => void;
  onRestoreChargePool?: (itemId: string, amount: number) => void;
  onSetChargePoolUsed?: (itemId: string, usedCount: number) => void;
}

export function MagicItemRow({
  item,
  characterLevel,
  onEdit,
  onDelete,
  onToggleAttunement,
  onExpendCharge,
  onRestoreCharge,
  onExpendChargePoolAbility,
  onRestoreChargePool,
  onSetChargePoolUsed,
}: MagicItemRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasCharges = item.charges && item.charges.length > 0;
  const hasPool = !!item.chargePool;
  return (
    <div className="border-divider border-b py-2" data-inventory-row={item.id}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-label={`Details: ${item.name}`}
        aria-expanded={isExpanded}
        className="flex w-full min-w-0 items-start gap-2 px-3 py-2 text-left pointer-coarse:min-h-11"
      >
        <span className="text-muted mt-1 shrink-0" aria-hidden="true">
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <div className="min-w-0 flex-1">
          <span className="text-heading block font-semibold break-words">
            {item.name}
          </span>
          <div className="text-muted mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span>
              {item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1)}
            </span>
            <span className="capitalize">{item.category}</span>
            {item.requiresAttunement && (
              <Badge variant="neutral" size="sm">
                {item.isAttuned ? 'Attuned' : 'Not attuned'}
              </Badge>
            )}
            {item.bonusSpellAttack != null && item.bonusSpellAttack > 0 && (
              <span>Spell +{item.bonusSpellAttack}</span>
            )}
            {hasPool && item.chargePool && (
              <ChargePoolDisplay
                pool={item.chargePool}
                itemName={item.name}
                onExpendAbility={() => {}}
                onRestorePool={() => {}}
                onSetPoolUsed={() => {}}
                compact
              />
            )}
          </div>
        </div>
      </button>

      {item.requiresAttunement && (
        <div className="px-3 pb-2">
          <Button
            onClick={() => onToggleAttunement(item, !item.isAttuned)}
            variant="outline"
            size="sm"
          >
            {item.isAttuned ? 'End attunement' : 'Attune'}
          </Button>
        </div>
      )}

      {isExpanded && (
        <div className="border-divider space-y-3 border-t px-3 pt-3 pb-4">
          <div className="text-muted text-sm capitalize">{item.category}</div>

          {item.description && (
            <div
              className="text-body prose-sm prose max-w-none text-sm"
              dangerouslySetInnerHTML={{ __html: item.description }}
            />
          )}

          {item.bonusSpellSaveDc != null && item.bonusSpellSaveDc > 0 && (
            <div className="flex gap-2">
              <Badge variant="info" size="sm">
                Spell save DC +{item.bonusSpellSaveDc}
              </Badge>
            </div>
          )}

          {/* Individual charges */}
          {hasCharges && (
            <div className="space-y-1.5">
              <span className="text-body text-sm font-semibold">Charges</span>
              <div className="flex flex-wrap gap-2">
                {item.charges!.map(charge => (
                  <IndividualChargeChip
                    key={charge.id}
                    charge={charge}
                    characterLevel={characterLevel}
                    onExpend={() => onExpendCharge(item.id, charge.id)}
                    onRestore={() => onRestoreCharge(item.id, charge.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Charge pool */}
          {hasPool && item.chargePool && (
            <ChargePoolDisplay
              pool={item.chargePool}
              itemName={item.name}
              onExpendAbility={abilityId =>
                onExpendChargePoolAbility?.(item.id, abilityId)
              }
              onRestorePool={amount => onRestoreChargePool?.(item.id, amount)}
              onSetPoolUsed={used => onSetChargePoolUsed?.(item.id, used)}
            />
          )}

          <div className="border-divider flex flex-wrap items-center gap-2 border-t pt-3">
            <Button
              onClick={() => onEdit(item)}
              variant="outline"
              size="sm"
              aria-label={`Edit ${item.name}`}
            >
              <Edit2 size={14} className="mr-1" />
              Edit
            </Button>
            <Button
              onClick={() => onDelete(item.id)}
              variant="danger"
              size="sm"
              aria-label={`Delete ${item.name}`}
            >
              <Trash2 size={14} className="mr-1" />
              Delete item
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function IndividualChargeChip({
  charge,
  characterLevel,
  onExpend,
  onRestore,
}: {
  charge: MagicItemCharge;
  characterLevel: number;
  onExpend: () => void;
  onRestore: () => void;
}) {
  const maxCharges = calculateMagicItemChargeMax(charge, characterLevel);
  const used = charge.usedCharges || 0;
  const remaining = maxCharges - used;
  const isExhausted = remaining <= 0;
  const isFull = used <= 0;

  return (
    <div className="border-divider inline-flex min-w-0 flex-wrap items-center gap-1.5 border px-2 py-1.5">
      <Sparkles size={14} aria-hidden="true" className="text-muted" />
      <span className="text-heading text-sm font-medium break-words">
        {charge.name}
      </span>
      <button
        type="button"
        onClick={onRestore}
        disabled={isFull}
        className="text-body disabled:text-faint inline-flex min-h-9 min-w-9 items-center justify-center rounded pointer-coarse:min-h-11 pointer-coarse:min-w-11"
        aria-label={`Restore one ${charge.name} charge`}
      >
        <Plus size={14} />
      </button>
      <span className="text-heading text-sm font-semibold">
        {remaining}/{maxCharges}
      </span>
      <button
        type="button"
        onClick={onExpend}
        disabled={isExhausted}
        className="text-body disabled:text-faint inline-flex min-h-9 min-w-9 items-center justify-center rounded pointer-coarse:min-h-11 pointer-coarse:min-w-11"
        aria-label={`Use one ${charge.name} charge`}
      >
        <Minus size={14} />
      </button>
      <span className="text-muted text-xs">
        {charge.restType === 'dawn'
          ? 'Recharges at dawn'
          : `Recharges on a ${charge.restType} rest`}
      </span>
    </div>
  );
}
