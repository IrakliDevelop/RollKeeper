'use client';

import React, { useState } from 'react';
import type { ArmorItem } from '@/types/character';
import { ChevronDown, ChevronRight, Edit2, Trash2, Shield } from 'lucide-react';
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
    <div
      className={`rounded-lg border-2 transition-all ${
        armor.isEquipped
          ? 'border-accent-blue-border-strong bg-surface-raised'
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
          <h4 className="text-heading truncate font-semibold">{armor.name}</h4>
          {armor.enhancementBonus > 0 && (
            <Badge variant="warning" size="sm">
              +{armor.enhancementBonus}
            </Badge>
          )}
          {armor.isEquipped && (
            <Badge variant="success" size="sm">
              Equipped
            </Badge>
          )}
          {armor.requiresAttunement && (
            <Badge
              variant={armor.isAttuned ? 'primary' : 'secondary'}
              size="sm"
            >
              {armor.isAttuned ? 'Attuned' : 'Attune'}
            </Badge>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-heading text-sm font-bold">AC {totalAC}</span>
          <span className="text-muted hidden text-xs capitalize sm:inline">
            {armor.category}
          </span>
        </div>
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-divider space-y-3 border-t px-4 pt-3 pb-4">
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
              <Badge variant="danger" size="sm">
                Stealth Disadvantage
              </Badge>
            )}
            {armor.strengthRequirement && (
              <Badge variant="warning" size="sm">
                Str {armor.strengthRequirement}
              </Badge>
            )}
            {armor.maxDexBonus !== undefined && armor.maxDexBonus !== null && (
              <Badge variant="info" size="sm">
                Max Dex +{armor.maxDexBonus}
              </Badge>
            )}
            {armor.weight && (
              <Badge variant="secondary" size="sm">
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
              onClick={() => onToggleEquip(armor.id, !armor.isEquipped)}
              variant={armor.isEquipped ? 'success' : 'outline'}
              size="sm"
            >
              <Shield size={14} className="mr-1" />
              {armor.isEquipped ? 'Equipped' : 'Equip'}
            </Button>
            <Button onClick={() => onEdit(armor)} variant="outline" size="sm">
              <Edit2 size={14} className="mr-1" />
              Edit
            </Button>
            <Button
              onClick={() => onDelete(armor.id)}
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
