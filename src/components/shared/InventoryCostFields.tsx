'use client';

import { NumberInput } from '@/components/ui/forms/NumberInput';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import type { InventoryCost } from '@/types/character';

const NONE = '__none__';

export interface InventoryCostOption {
  id: string;
  name: string;
  quantity: number;
}

export function InventoryCostFields({
  items,
  value,
  onChange,
}: {
  items: InventoryCostOption[];
  value?: InventoryCost;
  onChange: (value: InventoryCost | undefined) => void;
}) {
  const linked = value && items.find(item => item.id === value.inventoryItemId);

  return (
    <div className="border-divider bg-surface-secondary space-y-2 rounded-lg border p-3">
      <div>
        <p className="text-heading text-sm font-medium">Inventory cost</p>
        <p className="text-muted text-xs">
          Automatically consume an inventory item when this is used.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <SelectField
          value={value?.inventoryItemId ?? NONE}
          onValueChange={itemId =>
            onChange(
              itemId === NONE
                ? undefined
                : { inventoryItemId: itemId, quantity: value?.quantity ?? 1 }
            )
          }
        >
          <SelectItem value={NONE}>No inventory cost</SelectItem>
          {items.map(item => (
            <SelectItem key={item.id} value={item.id}>
              {item.name} ({item.quantity} remaining)
            </SelectItem>
          ))}
        </SelectField>
        {value && (
          <NumberInput
            min={1}
            value={value.quantity}
            onChange={quantity =>
              onChange({ ...value, quantity: Math.max(1, quantity ?? 1) })
            }
            className="w-20"
            aria-label="Inventory quantity consumed per use"
            title="Quantity consumed per use"
          />
        )}
      </div>
      {value && !linked && (
        <p className="text-accent-red-text-muted text-xs">
          The linked inventory item is missing. Choose another item or remove
          the cost.
        </p>
      )}
    </div>
  );
}
