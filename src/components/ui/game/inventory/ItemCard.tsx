'use client';

import { useState } from 'react';
import type { InventoryItem } from '@/types/character';
import { ChevronDown, ChevronRight, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { formatCurrencyFromCopper } from '@/utils/currency';

interface ItemCardProps {
  item: InventoryItem;
  onEdit?: (item: InventoryItem) => void;
  onView?: (item: InventoryItem) => void;
  onDelete?: () => void;
  onQuantityChange?: (quantity: number) => void;
  onUse?: () => void;
  onSend?: (item: InventoryItem) => void;
  compact?: boolean;
}

export function ItemCard({
  item,
  onEdit,
  onView,
  onDelete,
  onQuantityChange,
  onUse,
  onSend,
  compact = false,
}: ItemCardProps) {
  const [expanded, setExpanded] = useState(false);
  const totalWeight = item.weight ? item.weight * item.quantity : undefined;
  const totalValue = item.value ? item.value * item.quantity : undefined;

  return (
    <article
      className="border-divider min-w-0 border-b py-2"
      data-inventory-row={item.id}
    >
      <button
        type="button"
        aria-label={`Details: ${item.name}`}
        aria-expanded={expanded}
        onClick={() => setExpanded(value => !value)}
        className="flex w-full min-w-0 items-start gap-2 px-3 py-2 text-left pointer-coarse:min-h-11"
      >
        <span className="text-muted mt-1 shrink-0" aria-hidden="true">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-heading block font-semibold break-words">
            {item.name}
          </span>
          <span className="text-muted mt-1 flex flex-wrap gap-x-2 gap-y-1 text-sm">
            <span className="capitalize">{item.category}</span>
            {item.rarity && (
              <span>
                {item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1)}
              </span>
            )}
            {item.type && <span>{item.type}</span>}
            {item.quantity === 0 && (
              <Badge variant="neutral" size="sm">
                Depleted
              </Badge>
            )}
          </span>
        </span>
      </button>

      <div className="flex flex-wrap items-center gap-2 px-3 pb-2">
        <span className="text-muted text-sm">Quantity:</span>
        {onQuantityChange ? (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => onQuantityChange(Math.max(0, item.quantity - 1))}
              disabled={item.quantity <= 0}
              aria-label={`Decrease quantity: ${item.name}`}
              className="pointer-coarse:min-h-11 pointer-coarse:min-w-11"
            >
              <Minus size={14} aria-hidden="true" />
            </Button>
            <span className="text-heading min-w-8 text-center font-semibold">
              {item.quantity}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => onQuantityChange(item.quantity + 1)}
              aria-label={`Increase quantity: ${item.name}`}
              className="pointer-coarse:min-h-11 pointer-coarse:min-w-11"
            >
              <Plus size={14} aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <span className="text-heading font-semibold">{item.quantity}</span>
        )}
        {onUse && item.category === 'consumable' && item.quantity > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onUse}
            aria-label={`Use ${item.name}`}
          >
            Use item
          </Button>
        )}
      </div>

      {expanded && (
        <div
          className={`border-divider space-y-3 border-t px-3 pt-3 pb-4 ${compact ? 'text-sm' : ''}`}
        >
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
            <dt className="text-muted">Category:</dt>
            <dd className="text-heading capitalize">{item.category}</dd>
            <dt className="text-muted">Quantity:</dt>
            <dd className="text-heading">{item.quantity}</dd>
            {totalWeight !== undefined && (
              <>
                <dt className="text-muted">Weight:</dt>
                <dd className="text-heading">{totalWeight} lb</dd>
              </>
            )}
            {totalValue !== undefined && (
              <>
                <dt className="text-muted">Value:</dt>
                <dd className="text-heading">
                  {formatCurrencyFromCopper(totalValue)}
                </dd>
              </>
            )}
          </dl>
          {(item.tags ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {(item.tags ?? []).map((tag, index) => (
                <Badge key={`${tag}-${index}`} variant="neutral" size="sm">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          {item.description && (
            <p className="text-body text-sm break-words">{item.description}</p>
          )}
          <div className="border-divider flex flex-wrap gap-2 border-t pt-3">
            {onView && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onView(item)}
                aria-label={`View ${item.name}`}
              >
                View details
              </Button>
            )}
            {onEdit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onEdit(item)}
                aria-label={`Edit ${item.name}`}
              >
                Edit
              </Button>
            )}
            {onSend && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onSend(item)}
                aria-label={`Send ${item.name} to a player`}
              >
                Send to a player
              </Button>
            )}
            {onDelete && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={onDelete}
                aria-label={`Delete ${item.name}`}
              >
                Delete item
              </Button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
