'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { NumberInput } from '@/components/ui/forms/NumberInput';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { Section } from '@/components/ui/layout/section';
import { CLASS_RESOURCE_DEFINITIONS } from '@/utils/classResources';
import {
  isResourceDraftValid,
  type NpcResourceDraft,
} from '@/utils/npcResources';

const ADD_CUSTOM = '__custom__';
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
    if (value === '__placeholder__' || !value) return;
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
    <Section
      heading="Class Resources"
      level={3}
      trailing={
        <div className="w-44">
          <SelectField
            value="__placeholder__"
            onValueChange={handleAdd}
            triggerProps={{ size: 'lg', 'aria-label': 'Add resource…' }}
          >
            <SelectItem value="__placeholder__" disabled>
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
      }
    >
      {resources.length === 0 ? (
        <p className="text-faint text-xs">
          No class resources — add Wild Shape, Channel Divinity, or a custom
          pool, then link entries to it below.
        </p>
      ) : (
        <div className="divide-divider divide-y">
          {resources.map(res => {
            const valid = isResourceDraftValid(res);
            const isCustom = res.definitionId == null;
            const shortMode =
              res.shortRestReset === 'all'
                ? 'all'
                : res.shortRestReset === 0
                  ? 'none'
                  : 'custom';

            return (
              <div key={res.id} className="space-y-2 py-3">
                <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_2.75rem] items-end gap-2">
                  <Input
                    value={res.name}
                    onChange={e => update(res.id, { name: e.target.value })}
                    label="Resource name"
                    size="lg"
                    aria-label="Resource name"
                  />
                  <NumberInput
                    min={1}
                    value={res.maxUses}
                    onChange={v => update(res.id, { maxUses: v })}
                    allowEmpty
                    label="Max uses"
                    size="lg"
                    aria-label="Resource max uses"
                    title="Maximum uses (required)"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteResource(res.id)}
                    className="text-blood-text min-w-11 px-0 pointer-coarse:min-h-11"
                    aria-label={`Delete resource ${res.name || 'unnamed'}`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </Button>
                </div>

                <div
                  className={`grid gap-2 ${isCustom ? 'grid-cols-[minmax(0,1fr)_9rem]' : 'grid-cols-1'}`}
                >
                  <div className="flex min-w-0 items-end gap-2">
                    <div className="min-w-0 flex-1">
                      <SelectField
                        label="Short rest restores"
                        value={shortMode}
                        triggerProps={{ size: 'lg' }}
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
                        onChange={v =>
                          update(res.id, { shortRestReset: v ?? 1 })
                        }
                        size="lg"
                        wrapperClassName="w-14 shrink-0"
                        aria-label="Short rest restore amount"
                      />
                    )}
                  </div>
                  {isCustom && (
                    <div className="min-w-0">
                      <SelectField
                        label="Display"
                        value={res.displayStyle}
                        triggerProps={{ size: 'lg' }}
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
                  )}
                </div>

                {!valid && (
                  <p className="type-ui text-blood-text">
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
    </Section>
  );
}
