'use client';

import React from 'react';
import { InventoryItem, MagicItemRarity } from '@/types/character';
import { Package, MapPin, Scale, Coins, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { formatCurrencyFromCopper } from '@/utils/currency';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/feedback/dialog-new';

interface ItemViewModalProps {
  item: InventoryItem | null;
  onClose: () => void;
  onEdit?: (item: InventoryItem) => void;
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

export function ItemViewModal({ item, onClose, onEdit }: ItemViewModalProps) {
  if (!item) return null;

  const totalWeight = item.weight
    ? parseFloat((item.weight * item.quantity).toFixed(2))
    : undefined;
  const totalValue = item.value
    ? parseFloat((item.value * item.quantity).toFixed(2))
    : undefined;
  const isDepleted = item.quantity === 0;

  return (
    <Dialog open={!!item} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-purple-600" />
            {item.name}
            {isDepleted && (
              <Badge variant="neutral" size="sm">
                Depleted
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {/* Rarity and Type */}
          {(item.rarity || item.type) && (
            <div className="flex flex-wrap gap-2">
              {item.rarity && (
                <Badge variant={getRarityVariant(item.rarity)} size="md">
                  {item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1)}
                </Badge>
              )}
              {item.type && (
                <Badge variant="info" size="md">
                  {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                </Badge>
              )}
            </div>
          )}

          {/* Details Grid */}
          <div className="bg-surface-secondary rounded-lg p-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted text-xs font-medium uppercase">
                  Category
                </span>
                <p className="text-heading mt-0.5 font-medium capitalize">
                  {item.category}
                </p>
              </div>

              {item.location && (
                <div>
                  <span className="text-muted text-xs font-medium uppercase">
                    Location
                  </span>
                  <p className="text-heading mt-0.5 flex items-center gap-1 font-medium">
                    <MapPin className="h-3 w-3" />
                    {item.location}
                  </p>
                </div>
              )}

              <div>
                <span className="text-muted text-xs font-medium uppercase">
                  Quantity
                </span>
                <p
                  className={`mt-0.5 font-bold ${isDepleted ? 'text-red-500' : 'text-heading'}`}
                >
                  {item.quantity}
                </p>
              </div>

              {item.weight !== undefined && (
                <div>
                  <span className="text-muted text-xs font-medium uppercase">
                    Weight
                  </span>
                  <p className="text-heading mt-0.5 flex items-center gap-1 font-medium">
                    <Scale className="h-3 w-3" />
                    {item.weight} lbs each
                    {item.quantity > 1 && totalWeight !== undefined && (
                      <span className="text-muted">
                        ({totalWeight} lbs total)
                      </span>
                    )}
                  </p>
                </div>
              )}

              {item.value !== undefined && (
                <div>
                  <span className="text-muted text-xs font-medium uppercase">
                    Value
                  </span>
                  <p className="text-heading mt-0.5 flex items-center gap-1 font-medium">
                    <Coins className="h-3 w-3" />
                    {formatCurrencyFromCopper(item.value)} each
                    {item.quantity > 1 && totalValue !== undefined && (
                      <span className="text-muted">
                        ({formatCurrencyFromCopper(totalValue)} total)
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {item.description && (
            <div>
              <h4 className="text-heading mb-1.5 text-sm font-semibold">
                Description
              </h4>
              <p className="text-body text-sm leading-relaxed whitespace-pre-wrap">
                {item.description}
              </p>
            </div>
          )}

          {/* Tags */}
          {item.tags.length > 0 && (
            <div>
              <h4 className="text-heading mb-1.5 text-sm font-semibold">
                Tags
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {item.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary" size="sm">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          {onEdit && (
            <Button
              onClick={() => onEdit(item)}
              variant="outline"
              size="sm"
              leftIcon={<Edit2 className="h-4 w-4" />}
            >
              Edit
            </Button>
          )}
          <Button onClick={onClose} variant="ghost" size="sm">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
