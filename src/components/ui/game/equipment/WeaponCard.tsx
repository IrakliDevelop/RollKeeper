'use client';

import React from 'react';
import { Weapon } from '@/types/character';
import { Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';

interface WeaponCardProps {
  weapon: Weapon;
  onEdit: (weapon: Weapon) => void;
  onDelete: (id: string) => void;
  onToggleEquip: (id: string, equipped: boolean) => void;
}

export function WeaponCard({
  weapon,
  onEdit,
  onDelete,
  onToggleEquip,
}: WeaponCardProps) {
  return (
    <div
      className={`rounded-lg border-2 p-4 transition-all hover:shadow-md ${
        weapon.isEquipped
          ? 'border-blue-300 bg-white'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2 flex-wrap">
            <h4 className="font-bold text-gray-800">{weapon.name}</h4>
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
          </div>

          <div className="mb-2 text-sm text-gray-600">
            {(() => {
              if (Array.isArray(weapon.damage)) {
                // New format: array of damage entries
                return weapon.damage.length > 0
                  ? weapon.damage.map((dmg, idx) => (
                      <span key={idx}>
                        <span className="font-semibold text-gray-800">
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
                // Old format: single damage object
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
            <p className="text-sm text-gray-700 mt-2">{weapon.description}</p>
          )}
        </div>

        <div className="ml-4 flex flex-col gap-2">
          <div className="flex gap-1">
            <Button
              onClick={() => onEdit(weapon)}
              variant="ghost"
              size="xs"
              title="Edit weapon"
              className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
            >
              <Edit2 size={16} />
            </Button>
            <Button
              onClick={() => onDelete(weapon.id)}
              variant="ghost"
              size="xs"
              title="Delete weapon"
              className="text-red-600 hover:text-red-800 hover:bg-red-50"
            >
              <Trash2 size={16} />
            </Button>
          </div>
          <Button
            onClick={() => onToggleEquip(weapon.id, !weapon.isEquipped)}
            variant={weapon.isEquipped ? 'success' : 'outline'}
            size="sm"
            className={
              weapon.isEquipped ? '' : 'hover:bg-blue-50 hover:border-blue-300'
            }
          >
            {weapon.isEquipped ? 'Equipped' : 'Equip'}
          </Button>
        </div>
      </div>
    </div>
  );
}

