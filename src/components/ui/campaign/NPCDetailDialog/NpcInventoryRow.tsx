'use client';

import { Minus, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { formatCurrencyFromCopper } from '@/utils/currency';
import { formatRarity } from '@/utils/formatRarity';
import { sentenceCase } from '../PlayerDetailDialog/shared';
import type { NPCInventoryItem } from '@/types/encounter';

/** "Rare · Wondrous": the rarity and type parts that are set, in reading order. */
export function itemKindParts(item: NPCInventoryItem): string[] {
  const parts: string[] = [];
  if (item.rarity && item.rarity !== 'none') {
    parts.push(formatRarity(item.rarity));
  }
  if (item.type) parts.push(sentenceCase(item.type));
  return parts;
}

interface NpcInventoryRowProps {
  item: NPCInventoryItem;
  onView: () => void;
  onEdit?: () => void;
  onRemove?: () => void;
  onQuantityChange?: (quantity: number) => void;
  onSend?: () => void;
  /** Registers the name button as a focus target. */
  nameRef?: (el: HTMLButtonElement | null) => void;
}

/** One carried item; each control shows only with its handler. */
export function NpcInventoryRow({
  item,
  onView,
  onEdit,
  onRemove,
  onQuantityChange,
  onSend,
  nameRef,
}: NpcInventoryRowProps) {
  const meta = [
    ...itemKindParts(item),
    ...(item.weight !== undefined ? [`${item.weight} lb`] : []),
    ...(item.value !== undefined ? [formatCurrencyFromCopper(item.value)] : []),
  ].join(' · ');
  const hasControls = onQuantityChange || onSend || onEdit || onRemove;

  return (
    <li className="py-2 pointer-coarse:min-h-11">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="min-w-0 flex-[1_1_12rem]">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <button
              type="button"
              ref={nameRef}
              aria-haspopup="dialog"
              onClick={onView}
              className="type-ui text-heading focus-visible:ring-brass-fill min-w-0 rounded-sm text-left break-words hover:underline focus-visible:ring-2 focus-visible:outline-none pointer-coarse:min-h-11"
            >
              {item.name}
            </button>
            {item.equipped && (
              <Badge variant="neutral" size="sm">
                Equipped
              </Badge>
            )}
          </div>
          {meta && <p className="type-small text-muted">{meta}</p>}
        </div>
        {hasControls ? (
          <div className="flex flex-wrap items-center gap-1">
            {onQuantityChange && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-2"
                  aria-label={`Decrease quantity: ${item.name}`}
                  disabled={item.quantity <= 0}
                  onClick={() =>
                    onQuantityChange(Math.max(0, item.quantity - 1))
                  }
                >
                  <Minus size={16} aria-hidden="true" />
                </Button>
                <span className="type-ui text-heading min-w-6 text-center tabular-nums">
                  {item.quantity}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-2"
                  aria-label={`Increase quantity: ${item.name}`}
                  onClick={() => onQuantityChange(item.quantity + 1)}
                >
                  <Plus size={16} aria-hidden="true" />
                </Button>
              </>
            )}
            {onSend && (
              <Button
                variant="ghost"
                size="sm"
                className="px-2"
                aria-label={`Send ${item.name} to a player`}
                onClick={onSend}
              >
                <Send size={16} aria-hidden="true" />
              </Button>
            )}
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="px-2"
                aria-label={`Edit ${item.name}`}
                onClick={onEdit}
              >
                <Pencil size={16} aria-hidden="true" />
              </Button>
            )}
            {onRemove && (
              <Button
                variant="danger"
                size="sm"
                className="px-2"
                aria-label={`Remove ${item.name}`}
                onClick={onRemove}
              >
                <Trash2 size={16} aria-hidden="true" />
              </Button>
            )}
          </div>
        ) : (
          item.quantity > 1 && (
            <span className="type-small text-muted tabular-nums">
              ×{item.quantity}
            </span>
          )
        )}
      </div>
    </li>
  );
}
