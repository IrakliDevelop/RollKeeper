'use client';

import React from 'react';
import { Weapon } from '@/types/character';
import { Edit2, Trash2, Minus, Plus, Zap } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';

interface WeaponCardProps {
  weapon: Weapon;
  onEdit: (weapon: Weapon) => void;
  onDelete: (id: string) => void;
  onToggleEquip: (id: string, equipped: boolean) => void;
  onExpendWeaponChargePoolAbility?: (
    weaponId: string,
    abilityId: string
  ) => void;
  onRestoreWeaponChargePool?: (weaponId: string, amount: number) => void;
  onSetWeaponChargePoolUsed?: (weaponId: string, usedCount: number) => void;
}

export function WeaponCard({
  weapon,
  onEdit,
  onDelete,
  onToggleEquip,
  onExpendWeaponChargePoolAbility,
  onRestoreWeaponChargePool,
  onSetWeaponChargePoolUsed,
}: WeaponCardProps) {
  const pool = weapon.chargePool;
  const remaining = pool ? pool.maxCharges - pool.usedCharges : 0;

  return (
    <div
      className={`rounded-lg border-2 p-4 transition-all hover:shadow-md ${
        weapon.isEquipped
          ? 'border-accent-blue-border-strong bg-surface-raised'
          : 'border-divider bg-surface-raised hover:border-divider-strong'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h4 className="text-heading font-bold">{weapon.name}</h4>
            {weapon.enhancementBonus > 0 && (
              <Badge variant="warning" size="sm">
                +{weapon.enhancementBonus}
              </Badge>
            )}
            {weapon.requiresAttunement && (
              <Badge
                variant={weapon.isAttuned ? 'primary' : 'secondary'}
                size="sm"
              >
                {weapon.isAttuned ? 'Attuned' : 'Requires Attunement'}
              </Badge>
            )}
            {weapon.bonusSpellAttack != null && weapon.bonusSpellAttack > 0 && (
              <Badge variant="info" size="sm">
                Spell Atk +{weapon.bonusSpellAttack}
              </Badge>
            )}
            {weapon.bonusSpellSaveDc != null && weapon.bonusSpellSaveDc > 0 && (
              <Badge variant="info" size="sm">
                Spell DC +{weapon.bonusSpellSaveDc}
              </Badge>
            )}
          </div>

          <div className="text-muted mb-2 text-sm">
            {(() => {
              if (Array.isArray(weapon.damage)) {
                return weapon.damage.length > 0
                  ? weapon.damage.map((dmg, idx) => (
                      <span key={idx}>
                        <span className="text-heading font-semibold">
                          {dmg.dice}
                        </span>{' '}
                        {dmg.type}
                        {dmg.label &&
                          dmg.label !== 'Weapon Damage' &&
                          ` (${dmg.label})`}
                        {idx < weapon.damage.length - 1 && ', '}
                      </span>
                    ))
                  : 'No damage defined';
              } else {
                const legacyDamage = weapon.damage as {
                  dice: string;
                  type: string;
                  versatiledice?: string;
                };
                return legacyDamage && legacyDamage.dice && legacyDamage.type
                  ? `${legacyDamage.dice} ${legacyDamage.type}`
                  : 'No damage defined';
              }
            })()}{' '}
            • <span className="capitalize">{weapon.category}</span>
          </div>

          {weapon.description && (
            <p className="text-body mt-2 text-sm">{weapon.description}</p>
          )}

          {/* Charge Pool UI */}
          {pool && (
            <div className="border-divider mt-3 border-t pt-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap size={14} className="text-accent-amber-text" />
                  <span className="text-body text-xs font-semibold uppercase">
                    Charges
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onSetWeaponChargePoolUsed?.(
                        weapon.id,
                        pool.usedCharges + 1
                      )
                    }
                    disabled={remaining <= 0}
                    className="text-muted hover:text-body disabled:text-faint rounded p-0.5 disabled:cursor-not-allowed"
                    title="Use 1 charge"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="text-heading min-w-[4ch] text-center text-sm font-bold">
                    {remaining}/{pool.maxCharges}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRestoreWeaponChargePool?.(weapon.id, 1)}
                    disabled={pool.usedCharges <= 0}
                    className="text-muted hover:text-body disabled:text-faint rounded p-0.5 disabled:cursor-not-allowed"
                    title="Restore 1 charge"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {pool.rechargeAmount && (
                <p className="text-faint mb-2 text-xs">
                  Recharges {pool.rechargeAmount} at{' '}
                  {pool.rechargeType === 'dawn'
                    ? 'dawn'
                    : pool.rechargeType === 'dusk'
                      ? 'dusk'
                      : pool.rechargeType === 'midnight'
                        ? 'midnight'
                        : pool.rechargeType === 'short'
                          ? 'short rest'
                          : pool.rechargeType === 'long'
                            ? 'long rest'
                            : pool.rechargeType}
                </p>
              )}

              {pool.abilities.length > 0 && (
                <div className="space-y-1">
                  {pool.abilities.map(ability => {
                    const canUse =
                      ability.cost === 0 || remaining >= ability.cost;
                    return (
                      <div
                        key={ability.id}
                        className="flex items-center justify-between gap-2 py-0.5"
                      >
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={ability.cost === 0 ? 'success' : 'warning'}
                            size="sm"
                          >
                            {ability.cost === 0
                              ? 'Free'
                              : `${ability.cost} chg`}
                          </Badge>
                          <span className="text-body text-sm">
                            {ability.name}
                          </span>
                        </div>
                        {ability.cost > 0 && (
                          <Button
                            onClick={() =>
                              onExpendWeaponChargePoolAbility?.(
                                weapon.id,
                                ability.id
                              )
                            }
                            variant="ghost"
                            size="xs"
                            disabled={!canUse}
                            className="text-xs"
                          >
                            Use
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="ml-4 flex flex-col gap-2">
          <div className="flex gap-1">
            <Button
              onClick={() => onEdit(weapon)}
              variant="ghost"
              size="xs"
              title="Edit weapon"
              className="text-accent-blue-text-muted hover:text-accent-blue-text hover:bg-surface-hover"
            >
              <Edit2 size={16} />
            </Button>
            <Button
              onClick={() => onDelete(weapon.id)}
              variant="ghost"
              size="xs"
              title="Delete weapon"
              className="text-accent-red-text-muted hover:text-accent-red-text hover:bg-surface-hover"
            >
              <Trash2 size={16} />
            </Button>
          </div>
          <Button
            onClick={() => onToggleEquip(weapon.id, !weapon.isEquipped)}
            variant={weapon.isEquipped ? 'success' : 'outline'}
            size="sm"
            className={
              weapon.isEquipped
                ? ''
                : 'hover:bg-surface-hover hover:border-accent-blue-border'
            }
          >
            {weapon.isEquipped ? 'Equipped' : 'Equip'}
          </Button>
        </div>
      </div>
    </div>
  );
}
