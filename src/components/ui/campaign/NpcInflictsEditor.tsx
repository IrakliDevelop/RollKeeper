'use client';

import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { Badge } from '@/components/ui/layout/badge';
import { CustomConditionFields } from '@/components/ui/encounter/custom-conditions/CustomConditionFields';
import { CONDITION_ICON_REGISTRY } from '@/utils/conditionIconRegistry';
import {
  createCustomCondition,
  resolveInflictableConditions,
  type CustomConditionDraft,
} from '@/utils/customConditions';

import type { CustomCondition } from '@/types/encounter';

// Add-picker sentinel: a Radix Select only fires onValueChange when its value
// CHANGES, so the value is pinned to a placeholder that never updates (same
// pattern as NpcResourcesEditor).
const PLACEHOLDER = '__placeholder__';
const ADD_NEW = '__new__';

const EMPTY_DRAFT: CustomConditionDraft = {
  name: '',
  description: '',
  icon: 'trending-down',
  kind: 'debuff',
};

export interface NpcInflictsEditorProps {
  /** The stat block's own full copies. */
  conditions: CustomCondition[];
  /** The local DM library (combatConfig.customConditions). */
  library: CustomCondition[];
  onChange: (next: CustomCondition[]) => void;
  /** Inline create also adds the new condition to the library. */
  onCreateInLibrary: (condition: CustomCondition) => void;
}

export function NpcInflictsEditor({
  conditions,
  library,
  onChange,
  onCreateInLibrary,
}: NpcInflictsEditorProps) {
  const [draft, setDraft] = useState<CustomConditionDraft | null>(null);
  const attachedIds = new Set(conditions.map(c => c.id));
  const available = library.filter(entry => !attachedIds.has(entry.id));
  const resolved = resolveInflictableConditions(
    { inflictableConditions: conditions },
    library
  );

  const handleAdd = (value: string) => {
    if (value === PLACEHOLDER || !value) return;
    if (value === ADD_NEW) {
      setDraft(EMPTY_DRAFT);
      return;
    }
    const entry = library.find(item => item.id === value);
    if (entry) onChange([...conditions, { ...entry }]);
  };

  const handleCreate = () => {
    if (!draft || !draft.name.trim()) return;
    const created = createCustomCondition(draft.name, {
      description: draft.description.trim(),
      icon: draft.icon,
      kind: draft.kind,
    });
    onCreateInLibrary(created);
    onChange([...conditions, { ...created }]);
    setDraft(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-heading text-sm font-medium">Inflicts</label>
        <div className="w-56">
          <SelectField
            value={PLACEHOLDER}
            onValueChange={handleAdd}
            triggerProps={{ 'aria-label': 'Add inflicted condition' }}
          >
            <SelectItem value={PLACEHOLDER} disabled>
              Add condition…
            </SelectItem>
            {available.map(entry => (
              <SelectItem key={entry.id} value={entry.id}>
                {entry.name}
              </SelectItem>
            ))}
            <SelectItem value={ADD_NEW}>New condition…</SelectItem>
          </SelectField>
        </div>
      </div>

      {resolved.length === 0 && !draft ? (
        <p className="text-faint text-xs">
          No inflicted conditions — attach the custom conditions this creature
          can cause, and they appear as one-click options in combat.
        </p>
      ) : (
        <div className="space-y-1">
          {resolved.map(condition => {
            const Icon = CONDITION_ICON_REGISTRY[condition.icon];
            return (
              <div
                key={condition.id}
                title={condition.description || undefined}
                className="border-divider bg-surface-raised flex items-center gap-2 rounded-lg border px-2 py-1"
              >
                <Icon size={14} aria-hidden className="text-body shrink-0" />
                <span className="text-body min-w-0 flex-1 truncate text-sm">
                  {condition.name}
                </span>
                <Badge variant="neutral" size="sm">
                  {condition.kind}
                </Badge>
                <Button
                  variant="ghost"
                  size="xs"
                  type="button"
                  onClick={() =>
                    onChange(conditions.filter(c => c.id !== condition.id))
                  }
                  aria-label={`Remove ${condition.name}`}
                >
                  <Trash2 size={14} className="text-muted" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {draft && (
        <div className="border-divider bg-surface-secondary space-y-2 rounded-lg border p-2">
          <CustomConditionFields
            value={draft}
            onChange={changes =>
              setDraft(prev => (prev ? { ...prev, ...changes } : prev))
            }
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setDraft(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="button"
              onClick={handleCreate}
              disabled={!draft.name.trim()}
            >
              Create & attach
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
