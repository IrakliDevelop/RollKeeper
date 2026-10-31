'use client';

import React, { useState } from 'react';
import type { ArmorItem } from '@/types/character';
import { ChevronDown, ChevronRight, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';

interface ArmorRowProps {
  armor: ArmorItem;
  onEdit: (armor: ArmorItem) => void;
  onDelete: (id: string) => void;
  onToggleEquip: (id: string, equipped: boolean) => void;
}

export function ArmorRow({
  armor,
  onEdit,
  onDelete,
  onToggleEquip,
}: ArmorRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const totalAC = armor.baseAC + (armor.enhancementBonus || 0);

  return (
    <div className="border-divider border-b py-2" data-inventory-row={armor.id}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-label={`Details: ${armor.name}`}
        aria-expanded={isExpanded}
        className="flex w-full min-w-0 items-start gap-2 px-3 py-2 text-left pointer-coarse:min-h-11"
      >
        <span className="text-muted mt-1 shrink-0" aria-hidden="true">
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <div className="min-w-0 flex-1">
          <span className="text-heading block font-semibold break-words">
            {armor.name}
          </span>
          <div className="text-muted mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span>AC {totalAC}</span>
            <span className="capitalize">{armor.category}</span>
            {armor.enhancementBonus > 0 && (
              <span>+{armor.enhancementBonus}</span>
            )}
            {armor.isEquipped && (
              <Badge variant="neutral" size="sm">
                Equipped
              </Badge>
            )}
            {armor.requiresAttunement && (
              <Badge variant="neutral" size="sm">
                {armor.isAttuned ? 'Attuned' : 'Not attuned'}
              </Badge>
            )}
          </div>
        </div>
      </button>

      <div className="px-3 pb-2">
        <Button
          onClick={() => onToggleEquip(armor.id, !armor.isEquipped)}
          variant="outline"
          size="sm"
        >
          {armor.isEquipped ? 'Unequip' : 'Equip'}
        </Button>
      </div>

      {isExpanded && (
        <div className="border-divider space-y-3 border-t px-3 pt-3 pb-4">
          <div className="text-muted flex flex-wrap gap-3 text-sm">
            <span>Base AC: {armor.baseAC}</span>
            {armor.enhancementBonus > 0 && (
              <span>Bonus: +{armor.enhancementBonus}</span>
            )}
            <span className="capitalize">
              Type: {armor.type.replace('-', ' ')}
            </span>
            <span className="capitalize">Category: {armor.category}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {armor.stealthDisadvantage && (
              <Badge variant="warning" size="sm">
                Stealth disadvantage
              </Badge>
            )}
            {armor.strengthRequirement && (
              <Badge variant="neutral" size="sm">
                Str {armor.strengthRequirement}
              </Badge>
            )}
            {armor.maxDexBonus !== undefined && armor.maxDexBonus !== null && (
              <Badge variant="neutral" size="sm">
                Max Dex +{armor.maxDexBonus}
              </Badge>
            )}
            {armor.weight && (
              <Badge variant="neutral" size="sm">
                {armor.weight} lb
              </Badge>
            )}
          </div>

          {armor.description && (
            <div
              className="text-body prose-sm prose max-w-none text-sm"
              dangerouslySetInnerHTML={{ __html: armor.description }}
            />
          )}

          <div className="border-divider flex flex-wrap items-center gap-2 border-t pt-3">
            <Button
              onClick={() => onEdit(armor)}
              variant="outline"
              size="sm"
              aria-label={`Edit ${armor.name}`}
            >
              <Edit2 size={14} className="mr-1" />
              Edit
            </Button>
            <Button
              onClick={() => onDelete(armor.id)}
              variant="danger"
              size="sm"
              aria-label={`Delete ${armor.name}`}
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
