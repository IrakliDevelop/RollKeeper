'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Checkbox } from '@/components/ui/forms/checkbox';
import { Input } from '@/components/ui/forms/input';
import { NumberInput } from '@/components/ui/forms/NumberInput';
import { itemKindParts } from '../NPCDetailDialog/NPCDetailDialog.utils';
import { formatCurrencyFromCopper } from '@/utils/currency';
import type { NPCInventoryItem } from '@/types/encounter';

interface NpcFormInventoryRowProps {
  item: NPCInventoryItem;
  onChange: (next: NPCInventoryItem) => void;
  onEdit: () => void;
  onRemove: () => void;
  /** Registers the name field as a focus target. */
  nameRef?: (el: HTMLInputElement | null) => void;
}

/** One carried item in the NPC form: name, quantity, edit, remove, equipped. */
export function NpcFormInventoryRow({
  item,
  onChange,
  onEdit,
  onRemove,
  nameRef,
}: NpcFormInventoryRowProps) {
  const label = item.name.trim() || 'unnamed item';
  const meta = [
    ...itemKindParts(item),
    ...(item.weight !== undefined ? [`${item.weight} lb`] : []),
    ...(item.value !== undefined ? [formatCurrencyFromCopper(item.value)] : []),
  ].join(' · ');

  return (
    <li className="py-2 pointer-coarse:min-h-11">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Input
          ref={nameRef}
          size="sm"
          aria-label="Item name"
          placeholder="Rope"
          value={item.name}
          onChange={e => onChange({ ...item, name: e.target.value })}
          wrapperClassName="min-w-0 flex-[1_1_12rem]"
        />
        <NumberInput
          size="sm"
          min={1}
          aria-label={`Quantity: ${label}`}
          value={item.quantity}
          onChange={v => onChange({ ...item, quantity: v ?? 1 })}
          wrapperClassName="w-20"
        />
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="px-2"
            aria-label={`Edit ${label}`}
            onClick={onEdit}
          >
            <Pencil size={16} aria-hidden="true" />
          </Button>
          <Button
            variant="danger"
            size="sm"
            className="px-2"
            aria-label={`Remove ${label}`}
            onClick={onRemove}
          >
            <Trash2 size={16} aria-hidden="true" />
          </Button>
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        {meta && <p className="type-small text-muted">{meta}</p>}
        <div className="ml-auto">
          <Checkbox
            size="sm"
            label="Equipped"
            aria-label={`Equipped: ${label}`}
            checked={item.equipped ?? false}
            onCheckedChange={checked =>
              onChange({ ...item, equipped: checked === true })
            }
          />
        </div>
      </div>
    </li>
  );
}
