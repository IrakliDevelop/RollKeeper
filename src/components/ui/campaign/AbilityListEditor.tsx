'use client';

import React from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { Input } from '@/components/ui/forms/input';
import { NumberInput } from '@/components/ui/forms/NumberInput';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { CompactRichTextEditor } from '@/components/ui/forms/CompactRichTextEditor';
import type { NpcResourceDraft } from '@/utils/npcResources';
import type { StatBlockEntry } from '@/types/encounter';

const NO_COST = '__none__';

export function AbilityListEditor({
  label,
  items,
  onChange,
  resources,
}: {
  label: string;
  items: StatBlockEntry[];
  onChange: (items: StatBlockEntry[]) => void;
  /** When present and non-empty, each entry gets a "Costs" resource link. */
  resources?: NpcResourceDraft[];
}) {
  const handleAdd = () => {
    onChange([...items, { name: '', text: '' }]);
  };

  const handleUpdate = (
    index: number,
    field: 'name' | 'text',
    value: string
  ) => {
    const updated = items.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );
    onChange(updated);
  };

  const handleUsesChange = (index: number, value: number | undefined) => {
    const updated = items.map((item, i) =>
      i === index ? { ...item, uses: value } : item
    );
    onChange(updated);
  };

  const handleCostResourceChange = (index: number, resourceId: string) => {
    const updated = items.map((item, i) => {
      if (i !== index) return item;
      if (resourceId === NO_COST) return { ...item, resourceCost: undefined };
      return {
        ...item,
        resourceCost: { resourceId, amount: item.resourceCost?.amount ?? 1 },
      };
    });
    onChange(updated);
  };

  const handleCostAmountChange = (
    index: number,
    amount: number | undefined
  ) => {
    const updated = items.map((item, i) =>
      i === index && item.resourceCost
        ? {
            ...item,
            resourceCost: { ...item.resourceCost, amount: amount ?? 1 },
          }
        : item
    );
    onChange(updated);
  };

  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const updated = [...items];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    onChange(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index >= items.length - 1) return;
    const updated = [...items];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    onChange(updated);
  };

  const showCostControls = (resources?.length ?? 0) > 0;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-heading text-sm font-medium">{label}</label>
        <button
          onClick={handleAdd}
          className="text-accent-purple-text flex items-center gap-1 text-xs font-medium opacity-80 hover:opacity-100"
        >
          <Plus size={12} />
          Add
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-faint text-xs">No {label.toLowerCase()} added</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              key={index}
              className="border-divider bg-surface-raised rounded-lg border p-2"
            >
              <div className="mb-1 flex items-center gap-2">
                {/* Reorder buttons */}
                <div className="flex shrink-0 flex-col">
                  <button
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    className="text-muted hover:text-heading disabled:text-faint p-0.5 transition-colors disabled:cursor-not-allowed"
                    title="Move up"
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    onClick={() => handleMoveDown(index)}
                    disabled={index === items.length - 1}
                    className="text-muted hover:text-heading disabled:text-faint p-0.5 transition-colors disabled:cursor-not-allowed"
                    title="Move down"
                  >
                    <ArrowDown size={12} />
                  </button>
                </div>
                <Input
                  value={item.name}
                  onChange={e => handleUpdate(index, 'name', e.target.value)}
                  placeholder={`${label.slice(0, -1)} name`}
                  className="flex-1"
                />
                <NumberInput
                  min={0}
                  value={item.uses}
                  onChange={v => handleUsesChange(index, v)}
                  allowEmpty
                  placeholder="Uses"
                  className="w-18"
                  title="Uses per day (leave empty for unlimited)"
                />
                <button
                  onClick={() => handleRemove(index)}
                  className="text-muted hover:text-accent-red-text p-1 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {showCostControls && (
                <div className="mb-1 flex items-center gap-2">
                  <SelectField
                    value={item.resourceCost?.resourceId ?? NO_COST}
                    onValueChange={v => handleCostResourceChange(index, v)}
                  >
                    <SelectItem value={NO_COST}>No resource cost</SelectItem>
                    {resources!.map(r => (
                      <SelectItem key={r.id} value={r.id}>
                        Costs: {r.name.trim() || 'Unnamed resource'}
                      </SelectItem>
                    ))}
                  </SelectField>
                  {item.resourceCost && (
                    <NumberInput
                      min={1}
                      value={item.resourceCost.amount}
                      onChange={v => handleCostAmountChange(index, v)}
                      className="w-18"
                      aria-label={`${label} entry resource cost amount`}
                      title="Uses spent per activation"
                    />
                  )}
                </div>
              )}
              <CompactRichTextEditor
                content={item.text}
                onChange={value => handleUpdate(index, 'text', value)}
                placeholder="Description..."
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
