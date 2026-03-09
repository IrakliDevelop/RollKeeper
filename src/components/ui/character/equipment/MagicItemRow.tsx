'use client';

import React, { useState } from 'react';
import type {
  MagicItem,
  MagicItemCharge,
  MagicItemRarity,
} from '@/types/character';
import {
  ChevronDown,
  ChevronRight,
  Edit2,
  Trash2,
  Sparkles,
  Clock,
  Sun,
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

const RARITY_VARIANT: Record<
  MagicItemRarity,
  'secondary' | 'success' | 'info' | 'primary' | 'warning' | 'danger'
> = {
  common: 'secondary',
  uncommon: 'success',
  rare: 'info',
  'very rare': 'primary',
  legendary: 'warning',
  artifact: 'danger',
};

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
  const poolRemaining = hasPool
    ? item.chargePool!.maxCharges - item.chargePool!.usedCharges
    : null;

  return (
    <div
      className={`rounded-lg border-2 transition-all ${
        item.isEquipped
          ? 'border-accent-purple-border-strong bg-surface-raised'
          : 'border-divider bg-surface-raised hover:border-divider-strong'
      }`}
    >
      {/* Collapsed summary */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-3 p-3 text-left"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="text-muted shrink-0">
            {isExpanded ? (
              <ChevronDown size={16} />
            ) : (
              <ChevronRight size={16} />
            )}
          </span>
          <h4 className="text-heading truncate font-semibold">{item.name}</h4>
          <Badge variant={RARITY_VARIANT[item.rarity] || 'secondary'} size="sm">
            {item.rarity}
          </Badge>
          {item.requiresAttunement && (
            <Badge variant={item.isAttuned ? 'primary' : 'secondary'} size="sm">
              {item.isAttuned ? 'Attuned' : 'Attune'}
            </Badge>
          )}
          {item.bonusSpellAttack != null && item.bonusSpellAttack > 0 && (
            <Badge variant="info" size="sm">
              Spell +{item.bonusSpellAttack}
            </Badge>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-muted hidden text-xs capitalize sm:inline">
            {item.category}
          </span>
          {hasPool && item.chargePool && (
            <ChargePoolDisplay
              pool={item.chargePool}
              onExpendAbility={() => {}}
              onRestorePool={() => {}}
              onSetPoolUsed={() => {}}
              compact
            />
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-divider space-y-3 border-t px-4 pt-3 pb-4">
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
                Spell Save DC +{item.bonusSpellSaveDc}
              </Badge>
            </div>
          )}

          {/* Individual charges */}
          {hasCharges && (
            <div className="space-y-1.5">
              <span className="text-body text-xs font-semibold uppercase">
                Individual Charges
              </span>
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
              onExpendAbility={abilityId =>
                onExpendChargePoolAbility?.(item.id, abilityId)
              }
              onRestorePool={amount => onRestoreChargePool?.(item.id, amount)}
              onSetPoolUsed={used => onSetChargePoolUsed?.(item.id, used)}
            />
          )}

          <div className="border-divider flex flex-wrap items-center gap-2 border-t pt-3">
            {item.requiresAttunement && (
              <Button
                onClick={() => onToggleAttunement(item, !item.isAttuned)}
                variant={item.isAttuned ? 'primary' : 'outline'}
                size="sm"
              >
                <Sparkles size={14} className="mr-1" />
                {item.isAttuned ? 'Attuned' : 'Attune'}
              </Button>
            )}
            <Button onClick={() => onEdit(item)} variant="outline" size="sm">
              <Edit2 size={14} className="mr-1" />
              Edit
            </Button>
            <Button
              onClick={() => onDelete(item.id)}
              variant="danger"
              size="sm"
            >
              <Trash2 size={14} className="mr-1" />
              Delete
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
    <div
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1.5 ${
        isExhausted
          ? 'border-accent-red-border bg-accent-red-bg'
          : 'border-accent-purple-border bg-accent-purple-bg'
      }`}
    >
      <Sparkles
        size={10}
        className={
          isExhausted
            ? 'text-accent-red-text-muted'
            : 'text-accent-purple-text-muted'
        }
      />
      <span className="text-heading max-w-[100px] truncate text-xs font-medium">
        {charge.name}
      </span>
      <button
        onClick={onRestore}
        disabled={isFull}
        className={`rounded p-0.5 ${isFull ? 'text-faint cursor-not-allowed' : 'text-accent-green-text-muted hover:bg-accent-green-bg'}`}
        title="Restore 1"
      >
        <Plus size={10} />
      </button>
      <span
        className={`text-xs font-bold ${isExhausted ? 'text-accent-red-text' : 'text-heading'}`}
      >
        {remaining}/{maxCharges}
      </span>
      <button
        onClick={onExpend}
        disabled={isExhausted}
        className={`rounded p-0.5 ${isExhausted ? 'text-faint cursor-not-allowed' : 'text-accent-red-text-muted hover:bg-accent-red-bg'}`}
        title="Use 1"
      >
        <Minus size={10} />
      </button>
      <span className="text-faint text-[10px]">
        {charge.restType === 'dawn' ? <Sun size={10} /> : <Clock size={10} />}
      </span>
    </div>
  );
}
