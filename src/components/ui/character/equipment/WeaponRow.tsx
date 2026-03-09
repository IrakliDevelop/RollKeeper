'use client';

import React, { useState } from 'react';
import type { Weapon } from '@/types/character';
import { ChevronDown, ChevronRight, Edit2, Trash2, Swords } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { ChargePoolDisplay } from './ChargePoolDisplay';

interface WeaponRowProps {
  weapon: Weapon;
  onEdit: (weapon: Weapon) => void;
  onDelete: (id: string) => void;
  onToggleEquip: (id: string, equipped: boolean) => void;
  onExpendChargePoolAbility?: (weaponId: string, abilityId: string) => void;
  onRestoreChargePool?: (weaponId: string, amount: number) => void;
  onSetChargePoolUsed?: (weaponId: string, usedCount: number) => void;
}

export function WeaponRow({
  weapon,
  onEdit,
  onDelete,
  onToggleEquip,
  onExpendChargePoolAbility,
  onRestoreChargePool,
  onSetChargePoolUsed,
}: WeaponRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const pool = weapon.chargePool;

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
