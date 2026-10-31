'use client';

import React from 'react';
import { InventoryItem } from '@/types/character';
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
} from '@/components/ui/feedback/dialog';

interface ItemViewModalProps {
  item: InventoryItem | null;
  onClose: () => void;
  onEdit?: (item: InventoryItem) => void;
}

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
            <Package className="text-muted h-5 w-5" />
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
                <Badge variant="neutral" size="md">
                  {item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1)}
                </Badge>
              )}
              {item.type && (
                <Badge variant="neutral" size="md">
                  {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                </Badge>
              )}
            </div>
          )}

          {/* Details Grid */}
          <div className="border-divider border-y py-3">
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <span className="text-muted text-sm font-medium">Category</span>
                <p className="text-heading mt-0.5 font-medium capitalize">
                  {item.category}
                </p>
              </div>

              {item.location && (
                <div>
                  <span className="text-muted text-sm font-medium">
                    Location
                  </span>
                  <p className="text-heading mt-0.5 flex items-center gap-1 font-medium">
                    <MapPin className="h-3 w-3" />
                    {item.location}
                  </p>
                </div>
              )}

              <div>
                <span className="text-muted text-sm font-medium">Quantity</span>
                <p className="text-heading mt-0.5 font-semibold">
                  {item.quantity}
                </p>
              </div>

              {item.weight !== undefined && (
                <div>
                  <span className="text-muted text-sm font-medium">Weight</span>
                  <p className="text-heading mt-0.5 flex items-center gap-1 font-medium">
                    <Scale className="h-3 w-3" />
                    {item.weight} lb each
                    {item.quantity > 1 && totalWeight !== undefined && (
                      <span className="text-muted">
                        ({totalWeight} lb total)
                      </span>
                    )}
                  </p>
                </div>
              )}

              {item.value !== undefined && (
                <div>
                  <span className="text-muted text-sm font-medium">Value</span>
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
          {(item.tags ?? []).length > 0 && (
            <div>
              <h4 className="text-heading mb-1.5 text-sm font-semibold">
                Tags
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {(item.tags ?? []).map((tag, index) => (
                  <Badge key={index} variant="neutral" size="sm">
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
