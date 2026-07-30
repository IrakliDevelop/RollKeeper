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
  Sparkles,
  Clock,
  Sun,
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
}: WeaponRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const pool = weapon.chargePool;

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
      className={`rounded-lg border-2 transition-all ${
        weapon.isEquipped
          ? 'border-accent-blue-border-strong bg-surface-raised'
          : 'border-divider bg-surface-raised hover:border-divider-strong'
      }`}
    >
      {/* Collapsed summary row */}
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
          <h4 className="text-heading truncate font-semibold">{weapon.name}</h4>
          {weapon.enhancementBonus > 0 && (
            <Badge variant="warning" size="sm">
              +{weapon.enhancementBonus}
            </Badge>
          )}
          {weapon.isEquipped && (
            <Badge variant="success" size="sm">
              Equipped
            </Badge>
          )}
          {weapon.requiresAttunement && (
            <Badge
              variant={weapon.isAttuned ? 'primary' : 'secondary'}
              size="sm"
            >
              {weapon.isAttuned ? 'Attuned' : 'Attune'}
            </Badge>
          )}
          {weapon.bonusSpellAttack != null && weapon.bonusSpellAttack > 0 && (
            <Badge variant="info" size="sm">
              Spell +{weapon.bonusSpellAttack}
            </Badge>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-muted hidden text-xs sm:inline">
            {damageText}
          </span>
          {hasCharges && (
            <div className="flex items-center gap-1.5">
              <Zap size={12} className="text-accent-amber-text" />
              <span
                className={`text-xs font-bold ${
                  individualRemaining <= 0
                    ? 'text-accent-red-text-muted'
                    : individualRemaining <= Math.ceil(individualMax * 0.25)
                      ? 'text-accent-orange-text-muted'
                      : 'text-accent-amber-text'
                }`}
              >
                {individualRemaining}/{individualMax}
              </span>
            </div>
          )}
          {pool && (
            <ChargePoolDisplay
              pool={pool}
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
              <Badge variant="info" size="sm">
                Spell Save DC +{weapon.bonusSpellSaveDc}
              </Badge>
            </div>
          )}

          {hasCharges && (
            <div className="space-y-1.5">
              <span className="text-body text-xs font-semibold uppercase">
                Individual Charges
              </span>
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
              onExpendAbility={abilityId =>
                onExpendChargePoolAbility?.(weapon.id, abilityId)
              }
              onRestorePool={amount => onRestoreChargePool?.(weapon.id, amount)}
              onSetPoolUsed={used => onSetChargePoolUsed?.(weapon.id, used)}
            />
          )}

          <div className="border-divider flex flex-wrap items-center gap-2 border-t pt-3">
            <Button
              onClick={() => onToggleEquip(weapon.id, !weapon.isEquipped)}
              variant={weapon.isEquipped ? 'success' : 'outline'}
              size="sm"
            >
              <Swords size={14} className="mr-1" />
              {weapon.isEquipped ? 'Equipped' : 'Equip'}
            </Button>
            <Button onClick={() => onEdit(weapon)} variant="outline" size="sm">
              <Edit2 size={14} className="mr-1" />
              Edit
            </Button>
            <Button
              onClick={() => onDelete(weapon.id)}
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
    <div
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1.5 ${
        isExhausted
          ? 'border-accent-red-border bg-accent-red-bg'
          : 'border-accent-amber-border bg-accent-amber-bg'
      }`}
    >
      <Sparkles
        size={10}
        className={
          isExhausted
            ? 'text-accent-red-text-muted'
            : 'text-accent-amber-text-muted'
        }
      />
      <span className="text-heading max-w-[100px] truncate text-xs font-medium">
        {charge.name}
      </span>
      <button
        type="button"
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
        type="button"
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
