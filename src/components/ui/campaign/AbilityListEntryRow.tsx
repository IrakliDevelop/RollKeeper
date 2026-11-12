'use client';

import React from 'react';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { NumberInput } from '@/components/ui/forms/NumberInput';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { CompactRichTextEditor } from '@/components/ui/forms/CompactRichTextEditor';
import { InventoryCostFields } from '@/components/shared/InventoryCostFields';
import type { NpcResourceDraft } from '@/utils/npcResources';
import type { NPCInventoryItem, StatBlockEntry } from '@/types/encounter';

const NO_COST = '__none__';

/** Controls the list can move focus to after an add, remove or move. */
export type FocusPart = 'name' | 'up' | 'down';

interface AbilityListEntryRowProps {
  entry: StatBlockEntry;
  /** Lower-case noun for the section, e.g. "bonus action". */
  singular: string;
  namePlaceholder: string;
  isFirst: boolean;
  isLast: boolean;
  onChange: (next: StatBlockEntry) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  resources?: NpcResourceDraft[];
  inventoryItems: NPCInventoryItem[];
  /** Registers a control as a focus target. */
  registerFocus: (part: FocusPart, el: HTMLElement | null) => void;
}

/** One stat block entry: name, uses, reorder, remove, costs and description. */
export function AbilityListEntryRow({
  entry,
  singular,
  namePlaceholder,
  isFirst,
  isLast,
  onChange,
  onMove,
  onRemove,
  resources,
  inventoryItems,
  registerFocus,
}: AbilityListEntryRowProps) {
  const label = entry.name.trim() || `unnamed ${singular}`;
  const cost = entry.resourceCost;

  return (
    <li className="space-y-2 py-3 pointer-coarse:min-h-11">
      <div className="flex flex-wrap items-start gap-2">
        <Input
          ref={el => registerFocus('name', el)}
          label="Name"
          placeholder={namePlaceholder}
          value={entry.name}
          onChange={e => onChange({ ...entry, name: e.target.value })}
          wrapperClassName="w-full min-w-0 sm:w-auto sm:flex-1"
        />
        <NumberInput
          label="Uses per day"
          helperText="Leave empty for unlimited."
          min={0}
          allowEmpty
          value={entry.uses}
          onChange={uses => onChange({ ...entry, uses })}
          wrapperClassName="w-40"
        />
        <div className="mt-6.5 flex gap-1">
          <Button
            ref={el => registerFocus('up', el)}
            variant="ghost"
            size="sm"
            className="px-2"
            aria-label={`Move ${label} up`}
            disabled={isFirst}
            onClick={() => onMove(-1)}
          >
            <ArrowUp size={16} aria-hidden />
          </Button>
          <Button
            ref={el => registerFocus('down', el)}
            variant="ghost"
            size="sm"
            className="px-2"
            aria-label={`Move ${label} down`}
            disabled={isLast}
            onClick={() => onMove(1)}
          >
            <ArrowDown size={16} aria-hidden />
          </Button>
          <Button
            variant="danger"
            size="sm"
            className="px-2"
            aria-label={`Remove ${label}`}
            onClick={onRemove}
          >
            <Trash2 size={16} aria-hidden />
          </Button>
        </div>
      </div>
      {(resources?.length ?? 0) > 0 && (
        <div className="flex flex-wrap items-start gap-2">
          <SelectField
            label="Resource cost"
            value={cost?.resourceId ?? NO_COST}
            onValueChange={resourceId =>
              onChange({
                ...entry,
                resourceCost:
                  resourceId === NO_COST
                    ? undefined
                    : { resourceId, amount: cost?.amount ?? 1 },
              })
            }
            wrapperClassName="w-full min-w-0 sm:w-auto sm:flex-1"
          >
            <SelectItem value={NO_COST}>No resource cost</SelectItem>
            {resources?.map(r => (
              <SelectItem key={r.id} value={r.id}>
                {r.name.trim() || 'Unnamed resource'}
              </SelectItem>
            ))}
          </SelectField>
          {cost && (
            <NumberInput
              label="Uses spent"
              min={1}
              value={cost.amount}
              onChange={amount =>
                onChange({
                  ...entry,
                  resourceCost: { ...cost, amount: amount ?? 1 },
                })
              }
              wrapperClassName="w-28"
            />
          )}
        </div>
      )}
      {(inventoryItems.length > 0 || entry.inventoryCost) && (
        <InventoryCostFields
          items={inventoryItems}
          value={entry.inventoryCost}
          onChange={inventoryCost => onChange({ ...entry, inventoryCost })}
        />
      )}
      <CompactRichTextEditor
        content={entry.text}
        onChange={text => onChange({ ...entry, text })}
        ariaLabel="Description"
        placeholder="Description"
      />
    </li>
  );
}
