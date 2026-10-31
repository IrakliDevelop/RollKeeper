'use client';

import React, { useState } from 'react';
import type { Weapon, WeaponCharge } from '@/types/character';
import {
  ChevronDown,
  ChevronRight,
  Edit2,
  Trash2,
  Swords,
  Zap,
  Minus,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { ChargePoolDisplay } from './ChargePoolDisplay';
import { calculateWeaponChargeMax } from '@/utils/calculations';

interface WeaponRowProps {
  weapon: Weapon;
  characterLevel: number;
  onEdit: (weapon: Weapon) => void;
  onDelete: (id: string) => void;
  onToggleEquip: (id: string, equipped: boolean) => void;
  onExpendCharge?: (weaponId: string, chargeId: string) => void;
  onRestoreCharge?: (weaponId: string, chargeId: string) => void;
  onExpendChargePoolAbility?: (weaponId: string, abilityId: string) => void;
  onRestoreChargePool?: (weaponId: string, amount: number) => void;
  onSetChargePoolUsed?: (weaponId: string, usedCount: number) => void;
  onUse?: (weaponId: string) => boolean;
  inventoryItems?: Array<{ id: string; name: string; quantity: number }>;
}

export function WeaponRow({
  weapon,
  characterLevel,
  onEdit,
  onDelete,
  onToggleEquip,
  onExpendCharge,
  onRestoreCharge,
  onExpendChargePoolAbility,
  onRestoreChargePool,
  onSetChargePoolUsed,
  onUse,
  inventoryItems,
}: WeaponRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const pool = weapon.chargePool;
  const linkedItem = weapon.inventoryCost
    ? inventoryItems?.find(i => i.id === weapon.inventoryCost!.inventoryItemId)
    : undefined;
  const useBlocked =
    !!weapon.inventoryCost &&
    (!linkedItem || linkedItem.quantity < weapon.inventoryCost.quantity);

  const hasCharges = !!weapon.charges && weapon.charges.length > 0;

  let individualRemaining = 0;
  let individualMax = 0;
  if (hasCharges) {
    for (const charge of weapon.charges!) {
      const max = calculateWeaponChargeMax(charge, characterLevel);
      individualMax += max;
      individualRemaining += max - (charge.usedCharges || 0);
    }
  }

  const damageText =
    Array.isArray(weapon.damage) && weapon.damage.length > 0
      ? weapon.damage.map(d => `${d.dice} ${d.type}`).join(', ')
      : 'No damage';

  return (
    <div
      className="border-divider border-b py-2"
      data-inventory-row={weapon.id}
    >
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-label={`Details: ${weapon.name}`}
        aria-expanded={isExpanded}
        className="flex w-full min-w-0 items-start gap-2 px-3 py-2 text-left pointer-coarse:min-h-11"
      >
        <span className="text-muted mt-1 shrink-0" aria-hidden="true">
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <div className="min-w-0 flex-1">
          <span className="text-heading block font-semibold break-words">
            {weapon.name}
          </span>
          <div className="text-muted mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span>{damageText}</span>
            <span className="capitalize">{weapon.category}</span>
            {weapon.enhancementBonus > 0 && (
              <span>+{weapon.enhancementBonus}</span>
            )}
            {weapon.isEquipped && (
              <Badge variant="neutral" size="sm">
                Equipped
              </Badge>
            )}
            {weapon.requiresAttunement && (
              <Badge variant="neutral" size="sm">
                {weapon.isAttuned ? 'Attuned' : 'Not attuned'}
              </Badge>
            )}
            {weapon.bonusSpellAttack != null && weapon.bonusSpellAttack > 0 && (
              <span>Spell +{weapon.bonusSpellAttack}</span>
            )}
            {hasCharges && (
              <span className="inline-flex items-center gap-1">
                <Zap size={12} aria-hidden="true" />
                <span>
                  {individualRemaining}/{individualMax}
                </span>
              </span>
            )}
            {pool && (
              <ChargePoolDisplay
                pool={pool}
                itemName={weapon.name}
                onExpendAbility={() => {}}
                onRestorePool={() => {}}
                onSetPoolUsed={() => {}}
                compact
              />
            )}
          </div>
        </div>
      </button>

      <div className="flex flex-wrap gap-2 px-3 pb-2">
        {weapon.inventoryCost && (
          <Button
            onClick={() => onUse?.(weapon.id)}
            variant="outline"
            size="sm"
            disabled={useBlocked}
            title={
              useBlocked
                ? 'Linked inventory item is missing or out of stock'
                : 'Use weapon and consume its linked inventory item'
            }
          >
            <Swords size={14} className="mr-1" />
            Attack · {weapon.inventoryCost.quantity}×{' '}
            {linkedItem?.name ?? 'Missing item'} ({linkedItem?.quantity ?? 0})
          </Button>
        )}
        <Button
          onClick={() => onToggleEquip(weapon.id, !weapon.isEquipped)}
          variant="outline"
          size="sm"
        >
          {weapon.isEquipped ? 'Unequip' : 'Equip'}
        </Button>
      </div>

      {isExpanded && (
        <div className="border-divider space-y-3 border-t px-3 pt-3 pb-4">
          <div className="text-muted text-sm">
            {damageText} &middot;{' '}
            <span className="capitalize">{weapon.category}</span>
            {weapon.range && (
              <>
                {' '}
                &middot; Range {weapon.range.normal}
                {weapon.range.long ? `/${weapon.range.long}` : ''} ft
              </>
            )}
          </div>

          {weapon.description && (
            <div
              className="text-body prose-sm prose max-w-none text-sm"
              dangerouslySetInnerHTML={{ __html: weapon.description }}
            />
          )}

          {weapon.bonusSpellSaveDc != null && weapon.bonusSpellSaveDc > 0 && (
            <div className="flex gap-2">
              <Badge variant="neutral" size="sm">
                Spell save DC +{weapon.bonusSpellSaveDc}
              </Badge>
            </div>
          )}

          {hasCharges && (
            <div className="space-y-1.5">
              <span className="text-body text-sm font-semibold">Charges</span>
              <div className="flex flex-wrap gap-2">
                {weapon.charges!.map(charge => (
                  <IndividualChargeChip
                    key={charge.id}
                    charge={charge}
                    characterLevel={characterLevel}
                    onExpend={() => onExpendCharge?.(weapon.id, charge.id)}
                    onRestore={() => onRestoreCharge?.(weapon.id, charge.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {pool && (
            <ChargePoolDisplay
              pool={pool}
              itemName={weapon.name}
              onExpendAbility={abilityId =>
                onExpendChargePoolAbility?.(weapon.id, abilityId)
              }
              onRestorePool={amount => onRestoreChargePool?.(weapon.id, amount)}
              onSetPoolUsed={used => onSetChargePoolUsed?.(weapon.id, used)}
            />
          )}

          <div className="border-divider flex flex-wrap items-center gap-2 border-t pt-3">
            <Button
              onClick={() => onEdit(weapon)}
              variant="outline"
              size="sm"
              aria-label={`Edit ${weapon.name}`}
            >
              <Edit2 size={14} className="mr-1" />
              Edit
            </Button>
            <Button
              onClick={() => onDelete(weapon.id)}
              variant="danger"
              size="sm"
              aria-label={`Delete ${weapon.name}`}
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
  charge: WeaponCharge;
  characterLevel: number;
  onExpend: () => void;
  onRestore: () => void;
}) {
  const maxCharges = calculateWeaponChargeMax(charge, characterLevel);
  const used = charge.usedCharges || 0;
  const remaining = maxCharges - used;
  const isExhausted = remaining <= 0;
  const isFull = used <= 0;

  return (
    <div className="border-divider inline-flex min-w-0 flex-wrap items-center gap-1.5 border px-2 py-1.5">
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
