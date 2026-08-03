'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/forms/input';
import { NumberInput } from '@/components/ui/forms/NumberInput';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import {
  CLASS_RESOURCE_ICONS,
  CLASS_RESOURCE_COLORS,
} from '@/components/ui/character/classResourceStyles';
import {
  CLASS_RESOURCE_DEFINITIONS,
  type ClassResourceColor,
} from '@/utils/classResources';
import {
  isResourceDraftValid,
  type NpcResourceDraft,
} from '@/utils/npcResources';

const ADD_CUSTOM = '__custom__';
const COLORS: ClassResourceColor[] = [
  'indigo',
  'red',
  'amber',
  'emerald',
  'blue',
  'orange',
  'violet',
  'yellow',
  'green',
  'purple',
];

function generateResourceId(): string {
  return (
    'res-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

export interface NpcResourcesEditorProps {
  resources: NpcResourceDraft[];
  onChange: (resources: NpcResourceDraft[]) => void;
  /** Parent clears matching resourceCost links across all five entry lists. */
  onDeleteResource: (resourceId: string) => void;
}

export function NpcResourcesEditor({
  resources,
  onChange,
  onDeleteResource,
}: NpcResourcesEditorProps) {
  const handleAdd = (value: string) => {
    if (value === ADD_CUSTOM) {
      onChange([
        ...resources,
        {
          id: generateResourceId(),
          name: '',
          icon: 'sparkles',
          color: 'purple',
          displayStyle: 'pips',
          maxUses: undefined,
          usesExpended: 0,
          shortRestReset: 0,
        },
      ]);
      return;
    }
    const def = CLASS_RESOURCE_DEFINITIONS.find(d => d.id === value);
    if (!def) return;
    // Registry defaults sampled at the definition's minLevel (documented rule:
    // Bardic Inspiration therefore defaults to 0 = no short-rest recovery).
    const reset = def.getShortRestReset(def.minLevel);
    onChange([
      ...resources,
      {
        id: generateResourceId(),
        definitionId: def.id,
        name: def.name,
        icon: def.icon,
        color: def.color,
        displayStyle: def.displayStyle,
        maxUses: undefined,
        usesExpended: 0,
        shortRestReset: reset === 'all' ? 'all' : reset,
      },
    ]);
  };

  const update = (id: string, patch: Partial<NpcResourceDraft>) => {
    onChange(resources.map(r => (r.id === id ? { ...r, ...patch } : r)));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-heading text-sm font-medium">
          Class Resources
        </label>
        <div className="w-56">
          <SelectField value="" onValueChange={handleAdd}>
            <SelectItem value="" disabled>
              Add resource…
            </SelectItem>
            {CLASS_RESOURCE_DEFINITIONS.map(def => (
              <SelectItem key={def.id} value={def.id}>
                {def.name} ({def.className})
              </SelectItem>
            ))}
            <SelectItem value={ADD_CUSTOM}>Custom resource…</SelectItem>
          </SelectField>
        </div>
      </div>

      {resources.length === 0 ? (
        <p className="text-faint text-xs">
          No class resources — add Wild Shape, Channel Divinity, or a custom
          pool, then link entries to it below.
        </p>
      ) : (
        <div className="space-y-2">
          {resources.map(res => {
            const Icon = CLASS_RESOURCE_ICONS[res.icon];
            const colorClasses = CLASS_RESOURCE_COLORS[res.color];
            const valid = isResourceDraftValid(res);
            const isCustom = res.definitionId == null;
            const shortMode =
              res.shortRestReset === 'all'
                ? 'all'
                : res.shortRestReset === 0
                  ? 'none'
                  : 'custom';

            return (
              <div
                key={res.id}
                className="border-divider bg-surface-raised space-y-2 rounded-lg border p-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded ${colorClasses.iconBg}`}
                  >
                    <Icon size={14} aria-hidden />
                  </span>
                  <Input
                    value={res.name}
                    onChange={e => update(res.id, { name: e.target.value })}
                    placeholder="Resource name"
                    className="flex-1"
                    aria-label="Resource name"
                  />
                  <NumberInput
                    min={1}
                    value={res.maxUses}
                    onChange={v => update(res.id, { maxUses: v })}
                    allowEmpty
                    placeholder="Max"
                    className="w-18"
                    aria-label="Resource max uses"
                    title="Maximum uses (required)"
                  />
                  <button
                    onClick={() => onDeleteResource(res.id)}
                    className="text-muted hover:text-accent-red-text p-1 transition-colors"
                    aria-label={`Delete resource ${res.name || 'unnamed'}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="w-40">
                    <SelectField
                      label="Short rest restores"
                      value={shortMode}
                      onValueChange={v =>
                        update(res.id, {
                          shortRestReset:
                            v === 'all' ? 'all' : v === 'none' ? 0 : 1,
                        })
                      }
                    >
                      <SelectItem value="all">All uses</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="custom">Custom amount</SelectItem>
                    </SelectField>
                  </div>
                  {shortMode === 'custom' && (
                    <NumberInput
                      min={1}
                      max={res.maxUses}
                      value={
                        typeof res.shortRestReset === 'number'
                          ? res.shortRestReset
                          : undefined
                      }
                      onChange={v => update(res.id, { shortRestReset: v ?? 1 })}
                      className="w-18 self-end"
                      aria-label="Short rest restore amount"
                    />
                  )}
                  {isCustom && (
                    <>
                      <div className="w-32">
                        <SelectField
                          label="Color"
                          value={res.color}
                          onValueChange={v =>
                            update(res.id, { color: v as ClassResourceColor })
                          }
                        >
                          {COLORS.map(c => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectField>
                      </div>
                      <div className="w-32">
                        <SelectField
                          label="Display"
                          value={res.displayStyle}
                          onValueChange={v =>
                            update(res.id, {
                              displayStyle: v as 'pips' | 'pool',
                            })
                          }
                        >
                          <SelectItem value="pips">Pips</SelectItem>
                          <SelectItem value="pool">Pool (n/max)</SelectItem>
                        </SelectField>
                      </div>
                    </>
                  )}
                </div>

                {!valid && (
                  <p className="text-accent-red-text text-xs">
                    {!res.name.trim()
                      ? 'Name and max uses are required.'
                      : res.maxUses == null ||
                          !Number.isInteger(res.maxUses) ||
                          res.maxUses < 1
                        ? 'Max uses is required (positive whole number).'
                        : 'Short-rest restore amount cannot exceed max uses.'}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
