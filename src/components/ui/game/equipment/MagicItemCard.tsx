'use client';

import React from 'react';
import { MagicItem, MagicItemRarity } from '@/types/character';
import { Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';

interface MagicItemCardProps {
  item: MagicItem;
  onEdit: (item: MagicItem) => void;
  onDelete: (id: string) => void;
  onToggleAttunement: (item: MagicItem, shouldAttune: boolean) => void;
}

const getRarityVariant = (
  rarity: MagicItemRarity
): 'secondary' | 'success' | 'info' | 'primary' | 'warning' | 'danger' => {
  switch (rarity) {
    case 'common':
      return 'secondary';
    case 'uncommon':
      return 'success';
    case 'rare':
      return 'info';
    case 'very rare':
      return 'primary';
    case 'legendary':
      return 'warning';
    case 'artifact':
      return 'danger';
    default:
      return 'secondary';
  }
};

export function MagicItemCard({
  item,
  onEdit,
  onDelete,
  onToggleAttunement,
}: MagicItemCardProps) {
  return (
    <div
      className={`rounded-lg border-2 p-4 transition-all hover:shadow-md ${
        item.isEquipped
          ? 'border-purple-300 bg-white'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2 flex-wrap">
            <h4 className="font-bold text-gray-800">{item.name}</h4>
            <Badge variant={getRarityVariant(item.rarity)} size="sm">
              {item.rarity}
            </Badge>
            {item.requiresAttunement && (
              <Badge
                variant={item.isAttuned ? 'primary' : 'secondary'}
                size="sm"
              >
                {item.isAttuned ? 'Attuned' : 'Requires Attunement'}
              </Badge>
            )}
          </div>

          <div className="mb-2 text-sm text-gray-600 capitalize">
            {item.category}
          </div>

          <p className="mb-2 text-sm text-gray-700">{item.description}</p>

          {item.charges && (
            <Badge variant="info" size="sm">
              Charges: {item.charges.current}/{item.charges.max}
            </Badge>
          )}
        </div>

        <div className="ml-4 flex flex-col gap-2">
          <div className="flex gap-1">
            <Button
              onClick={() => onEdit(item)}
              variant="ghost"
              size="xs"
              title="Edit item"
              className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
            >
              <Edit2 size={16} />
            </Button>
            <Button
              onClick={() => onDelete(item.id)}
              variant="ghost"
              size="xs"
              title="Delete item"
              className="text-red-600 hover:text-red-800 hover:bg-red-50"
            >
              <Trash2 size={16} />
            </Button>
          </div>
          {item.requiresAttunement && (
            <Button
              onClick={() => onToggleAttunement(item, !item.isAttuned)}
              variant={item.isAttuned ? 'primary' : 'outline'}
              size="sm"
              className={
                item.isAttuned
                  ? 'bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700'
                  : 'hover:bg-purple-50 hover:border-purple-300'
              }
            >
              {item.isAttuned ? 'Unattune' : 'Attune'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

