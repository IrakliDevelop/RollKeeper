'use client';

import React, { useState } from 'react';
import {
  Trash2,
  Package,
  Plus,
  Minus,
  Scale,
  Coins,
  Pencil,
  Send,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/feedback/dialog';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import {
  AppIcon,
  ITEM_CATEGORY_ICONS,
  getIconName,
} from '@/components/ui/icons';
import RichTextRenderer from '@/components/ui/utils/RichTextRenderer';
import {
  ItemForm,
  initialInventoryFormData,
} from '@/components/ui/game/inventory/ItemForm';
import type { InventoryFormData } from '@/components/ui/game/inventory/ItemForm';
import { useItemsData } from '@/hooks/useItemsData';
import { useMagicItemsData } from '@/hooks/useMagicItemsData';
import type { CampaignNPC, NPCInventoryItem } from '@/types/encounter';
import type { Currency } from '@/types/character';
import { formatCurrencyFromCopper } from '@/utils/currency';
import {
  npcInventoryItemToFormData,
  formDataToNpcInventoryPatch,
} from '@/utils/npcInventoryItemForm';
import { formatRarity } from '@/utils/formatRarity';
import { useNPCStore } from '@/store/npcStore';
import { NPCCurrencyStrip } from '../NPCCurrencyStrip';

const EMPTY_CURRENCY: Currency = {
  platinum: 0,
  gold: 0,
  electrum: 0,
  silver: 0,
  copper: 0,
};

const RARITY_VARIANTS: Record<
  string,
  'neutral' | 'info' | 'success' | 'warning' | 'danger'
> = {
  common: 'neutral',
  uncommon: 'success',
  rare: 'info',
  'very rare': 'warning',
  legendary: 'danger',
  artifact: 'danger',
};

const RARITY_BORDER: Record<string, string> = {
  common: 'border-divider',
  uncommon: 'border-accent-emerald-border',
  rare: 'border-accent-blue-border',
  'very rare': 'border-accent-purple-border',
  legendary: 'border-accent-amber-border',
  artifact: 'border-accent-red-border',
};

function InventoryItemCard({
  item,
  onRemove,
  onClick,
  onEdit,
  onQuantityChange,
  onSend,
}: {
  item: NPCInventoryItem;
  onRemove?: () => void;
  onClick?: () => void;
  onEdit?: () => void;
  onQuantityChange?: (quantity: number) => void;
  onSend?: () => void;
}) {
  const borderClass =
    (item.rarity && RARITY_BORDER[item.rarity]) || 'border-divider';
  const icon = getIconName(ITEM_CATEGORY_ICONS, item.category, 'item');

  return (
    <div
      className={`bg-surface-raised flex overflow-hidden rounded-lg border-2 ${borderClass} ${onClick ? 'cursor-pointer transition-shadow hover:shadow-md' : ''}`}
      onClick={onClick}
    >
      {/* Full-height icon strip */}
      <div className="bg-surface-secondary border-divider flex w-9 shrink-0 items-center justify-center self-stretch border-r-2 text-base">
        <AppIcon name={icon} className="h-4 w-4" />
      </div>
      {/* Content */}
      <div className="min-w-0 flex-1 px-2 py-1.5">
        <div className="flex items-center justify-between gap-1">
          <span
            className="text-heading truncate text-xs font-bold"
            title={item.name}
          >
            {item.name}
          </span>
          <div
            className="flex shrink-0 items-center gap-0.5"
            onClick={e => e.stopPropagation()}
          >
            {onSend && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  onSend();
                }}
                className="text-accent-amber-text-muted hover:bg-accent-amber-bg hover:text-accent-amber-text rounded p-0.5 transition-colors"
                title="Send to player"
              >
                <Send size={12} />
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="text-muted hover:text-accent-blue-text p-0.5 transition-colors"
                title="Edit item"
              >
                <Pencil size={12} />
              </button>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                className="text-muted hover:text-accent-red-text p-0.5 transition-colors"
                title="Remove"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>
        {/* Meta badges + quantity controls */}
        <div
          className="mt-0.5 flex flex-wrap items-center gap-1"
          onClick={e => e.stopPropagation()}
        >
          {onQuantityChange ? (
            <span className="bg-surface-secondary inline-flex items-center gap-0.5 rounded px-0.5 text-[10px] font-medium">
              <button
                onClick={() => onQuantityChange(Math.max(0, item.quantity - 1))}
                className="text-muted hover:text-accent-red-text rounded p-0.5 transition-colors disabled:opacity-30"
                disabled={item.quantity <= 0}
                title="Decrease"
              >
                <Minus size={10} />
              </button>
              <span className="text-heading min-w-[1rem] text-center font-bold">
                {item.quantity}
              </span>
              <button
                onClick={() => onQuantityChange(item.quantity + 1)}
                className="text-muted hover:text-accent-emerald-text rounded p-0.5 transition-colors"
                title="Increase"
              >
                <Plus size={10} />
              </button>
            </span>
          ) : item.quantity > 1 ? (
            <span className="bg-surface-secondary text-muted rounded px-1 text-[10px] font-medium">
              ×{item.quantity}
            </span>
          ) : null}
          {item.rarity && item.rarity !== 'none' && (
            <Badge
              variant={RARITY_VARIANTS[item.rarity] || 'neutral'}
              size="sm"
            >
              {item.rarity}
            </Badge>
          )}
          {item.equipped && (
            <Badge variant="success" size="sm">
              Eq
            </Badge>
          )}
          {item.weight !== undefined && (
            <span className="text-faint text-[10px]">{item.weight}lb</span>
          )}
          {item.value !== undefined && (
            <span className="text-faint text-[10px]">
              {formatCurrencyFromCopper(item.value)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function NPCItemViewModal({
  item,
  onClose,
  onEdit,
}: {
  item: NPCInventoryItem | null;
  onClose: () => void;
  onEdit?: () => void;
}) {
  if (!item) return null;

  const totalWeight = item.weight
    ? parseFloat((item.weight * item.quantity).toFixed(2))
    : undefined;
  const totalValue = item.value
    ? parseFloat((item.value * item.quantity).toFixed(2))
    : undefined;

  return (
    <Dialog open={!!item} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-purple-600" />
            {item.name}
            {item.equipped && (
              <Badge variant="success" size="sm">
                Equipped
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {/* Rarity and Type */}
          {(item.rarity || item.type) && (
            <div className="flex flex-wrap gap-2">
              {item.rarity && (
                <Badge
                  variant={RARITY_VARIANTS[item.rarity] || 'neutral'}
                  size="md"
                >
                  {formatRarity(item.rarity)}
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
              {item.category && (
                <div>
                  <span className="text-muted text-xs font-medium uppercase">
                    Category
                  </span>
                  <p className="text-heading mt-0.5 font-medium capitalize">
                    {item.category}
                  </p>
                </div>
              )}

              <div>
                <span className="text-muted text-xs font-medium uppercase">
                  Quantity
                </span>
                <p className="text-heading mt-0.5 font-bold">{item.quantity}</p>
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
              <RichTextRenderer content={item.description} />
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          {onEdit && (
            <Button onClick={onEdit} variant="primary" size="sm">
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
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

interface InventoryTabProps {
  npc: CampaignNPC;
  readOnly?: boolean;
  onUpdateInventory?: (npcId: string, inventory: NPCInventoryItem[]) => void;
  onSendItemToPlayer?: (item: NPCInventoryItem, npcName: string) => void;
}

export function InventoryTab({
  npc,
  readOnly,
  onUpdateInventory,
  onSendItemToPlayer,
}: InventoryTabProps) {
  const [inventoryFormOpen, setInventoryFormOpen] = useState(false);
  const [inventoryFormEditingItem, setInventoryFormEditingItem] =
    useState<NPCInventoryItem | null>(null);
  const [viewingItem, setViewingItem] = useState<NPCInventoryItem | null>(null);

  const { items: dbItems, loading: dbItemsLoading } = useItemsData();
  const { items: dbMagicItems } = useMagicItemsData();

  const handleInventoryFormSubmit = (data: InventoryFormData) => {
    if (!onUpdateInventory) return;
    if (inventoryFormEditingItem) {
      const updated = (npc.inventory ?? []).map(i =>
        i.id === inventoryFormEditingItem.id
          ? formDataToNpcInventoryPatch(data, i)
          : i
      );
      onUpdateInventory(npc.id, updated);
    } else {
      const newItem: NPCInventoryItem = {
        id: `inv-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: data.name,
        quantity: data.quantity,
        category: data.category,
        weight: data.weight,
        value: data.value,
        rarity: data.rarity,
        description: data.description || undefined,
        type: data.type,
      };
      onUpdateInventory(npc.id, [...(npc.inventory ?? []), newItem]);
    }
    setInventoryFormOpen(false);
    setInventoryFormEditingItem(null);
  };

  const handleRemoveItem = (itemId: string) => {
    if (!onUpdateInventory) return;
    const updated = (npc.inventory ?? []).filter(i => i.id !== itemId);
    onUpdateInventory(npc.id, updated);
  };

  const handleQuantityChange = (itemId: string, quantity: number) => {
    if (!onUpdateInventory) return;
    const updated = (npc.inventory ?? []).map(i =>
      i.id === itemId ? { ...i, quantity } : i
    );
    onUpdateInventory(npc.id, updated);
  };

  const setCurrency = (type: keyof Currency, amount: number) => {
    const currency = { ...EMPTY_CURRENCY, ...npc.currency };
    useNPCStore.getState().updateNPC(npc.campaignCode, npc.id, {
      currency: {
        ...currency,
        [type]: amount,
      },
    });
  };

  return (
    <>
      <div className="space-y-4">
        <NPCCurrencyStrip
          currency={{ ...EMPTY_CURRENCY, ...npc.currency }}
          readonly={readOnly}
          onChange={readOnly ? undefined : setCurrency}
        />
        {npc.inventory && npc.inventory.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {npc.inventory.map(item => (
              <InventoryItemCard
                key={item.id}
                item={item}
                onClick={() => setViewingItem(item)}
                onEdit={
                  onUpdateInventory
                    ? () => {
                        setInventoryFormEditingItem(item);
                        setInventoryFormOpen(true);
                      }
                    : undefined
                }
                onRemove={
                  onUpdateInventory
                    ? () => handleRemoveItem(item.id)
                    : undefined
                }
                onQuantityChange={
                  onUpdateInventory
                    ? qty => handleQuantityChange(item.id, qty)
                    : undefined
                }
                onSend={
                  onSendItemToPlayer
                    ? () => onSendItemToPlayer(item, npc.name)
                    : undefined
                }
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-40 items-center justify-center text-center">
            <div>
              <Package className="text-faint mx-auto mb-3 h-10 w-10" />
              <p className="text-muted text-sm">No inventory items</p>
            </div>
          </div>
        )}
        {onUpdateInventory && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setInventoryFormEditingItem(null);
              setInventoryFormOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add Item
          </Button>
        )}
      </div>

      {/* Stacked Item View modal */}
      <NPCItemViewModal
        item={viewingItem}
        onClose={() => setViewingItem(null)}
        onEdit={
          onUpdateInventory && viewingItem
            ? () => {
                const v = viewingItem;
                setViewingItem(null);
                setInventoryFormEditingItem(v);
                setInventoryFormOpen(true);
              }
            : undefined
        }
      />

      <ItemForm
        isOpen={inventoryFormOpen}
        onClose={() => {
          setInventoryFormOpen(false);
          setInventoryFormEditingItem(null);
        }}
        onSubmit={handleInventoryFormSubmit}
        initialData={
          inventoryFormEditingItem
            ? npcInventoryItemToFormData(inventoryFormEditingItem)
            : initialInventoryFormData
        }
        availableLocations={[]}
        isEditing={!!inventoryFormEditingItem}
        databaseItems={dbItems}
        databaseMagicItems={dbMagicItems}
        itemsLoading={dbItemsLoading}
      />
    </>
  );
}
