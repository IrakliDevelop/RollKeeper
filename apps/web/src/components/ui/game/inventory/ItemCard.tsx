'use client';

import React from 'react';
import { InventoryItem, MagicItemRarity } from '@/types/character';
import { Edit2, Trash2, Plus, Minus, Package } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { formatCurrencyFromCopper } from '@/utils/currency';

interface ItemCardProps {
  item: InventoryItem;
  onEdit?: (item: InventoryItem) => void;
  onDelete?: () => void;
  onQuantityChange?: (quantity: number) => void;
  compact?: boolean;
}

const getRarityVariant = (
  rarity?: MagicItemRarity
): 'secondary' | 'success' | 'info' | 'primary' | 'warning' | 'danger' => {
  if (!rarity) return 'secondary';

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

export function ItemCard({
  item,
  onEdit,
  onDelete,
  onQuantityChange,
  compact = false,
}: ItemCardProps) {
  const totalWeight = item.weight ? item.weight * item.quantity : undefined;
  const totalValue = item.value ? item.value * item.quantity : undefined;

  return (
    <div
      className={`group rounded-lg border-2 border-gray-200 bg-white transition-all hover:shadow-md hover:border-gray-300 ${
        compact ? 'p-2' : 'p-4'
      }`}
    >
      <div
        className={`flex items-start justify-between gap-3 ${compact ? 'mb-1' : 'mb-3'}`}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Package className={`shrink-0 text-blue-600 ${compact ? 'h-3 w-3' : 'h-4 w-4'}`} />
          <h5
            className={`font-bold text-gray-800 truncate ${compact ? 'text-xs' : 'text-sm'}`}
          >
            {item.name}
          </h5>
        </div>

        {/* Action Buttons */}
        {(onEdit || onDelete) && (
          <div className="flex items-center gap-1">
            {onEdit && (
              <Button
                onClick={() => onEdit(item)}
                variant="ghost"
                size="xs"
                title="Edit item"
                className="h-6 w-6 p-0 text-blue-600 hover:bg-blue-50 hover:text-blue-800"
              >
                <Edit2 size={14} />
              </Button>
            )}
            {onDelete && (
              <Button
                onClick={onDelete}
                variant="ghost"
                size="xs"
                title="Delete item"
                className="h-6 w-6 p-0 text-red-600 hover:bg-red-50 hover:text-red-800"
              >
                <Trash2 size={14} />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Rarity and Type Badges */}
      {(item.rarity || item.type) && !compact && (
        <div className="mb-3 flex flex-wrap gap-2">
          {item.rarity && (
            <Badge variant={getRarityVariant(item.rarity)} size="sm">
              {item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1)}
            </Badge>
          )}
          {item.type && (
            <Badge variant="info" size="sm">
              {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
            </Badge>
          )}
        </div>
      )}

      {/* Item Details */}
      <div className={`grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>
        <span className="text-gray-500">Category:</span>
        <span className="font-medium text-gray-800 capitalize">
          {item.category}
        </span>

        <span className="text-gray-500">Quantity:</span>
        {onQuantityChange ? (
          <div className="flex items-center gap-2">
            <Button
              onClick={() => onQuantityChange(Math.max(1, item.quantity - 1))}
              variant="ghost"
              size="xs"
              disabled={item.quantity <= 1}
              className="h-6 w-6 p-0 text-red-600 hover:bg-red-50 hover:text-red-800 disabled:opacity-30"
            >
              <Minus size={12} />
            </Button>
            <span className="min-w-[2rem] text-center font-bold text-gray-800">
              {item.quantity}
            </span>
            <Button
              onClick={() => onQuantityChange(item.quantity + 1)}
              variant="ghost"
              size="xs"
              className="h-6 w-6 p-0 text-green-600 hover:bg-green-50 hover:text-green-800"
            >
              <Plus size={12} />
            </Button>
          </div>
        ) : (
          <span className="font-bold text-gray-800">{item.quantity}</span>
        )}

        {totalWeight !== undefined && !compact && (
          <>
            <span className="text-gray-500">Weight:</span>
            <span className="font-medium text-gray-800">{totalWeight} lbs</span>
          </>
        )}

        {totalValue !== undefined && !compact && (
          <>
            <span className="text-gray-500">Value:</span>
            <span className="font-medium text-gray-800">
              {formatCurrencyFromCopper(totalValue)}
            </span>
          </>
        )}
      </div>

      {/* Tags */}
      {item.tags.length > 0 && !compact && (
        <div className="mt-3 flex flex-wrap gap-1">
          {item.tags.slice(0, 3).map((tag, index) => (
            <Badge key={index} variant="secondary" size="sm">
              {tag}
            </Badge>
          ))}
          {item.tags.length > 3 && (
            <Badge variant="secondary" size="sm">
              +{item.tags.length - 3}
            </Badge>
          )}
        </div>
      )}

      {/* Description */}
      {item.description && !compact && (
        <p className="mt-3 line-clamp-2 text-xs text-gray-700 border-t-2 border-gray-100 pt-3">
          {item.description}
        </p>
      )}
    </div>
  );
}

