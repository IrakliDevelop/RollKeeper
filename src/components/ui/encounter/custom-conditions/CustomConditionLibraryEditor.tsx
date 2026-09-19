'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { createCustomCondition } from '@/utils/customConditions';

import { CustomConditionFields } from './CustomConditionFields';

import type { CustomConditionDraft } from '@/utils/customConditions';
import type { CustomCondition } from '@/types/encounter';

export interface CustomConditionLibraryEditorProps {
  conditions: CustomCondition[];
  onChange: (next: CustomCondition[]) => void;
}

export function CustomConditionLibraryEditor({
  conditions,
  onChange,
}: CustomConditionLibraryEditorProps) {
  const patch = (id: string, changes: Partial<CustomConditionDraft>) =>
    onChange(conditions.map(c => (c.id === id ? { ...c, ...changes } : c)));

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-heading text-sm font-medium">Custom conditions</h3>
        <p className="text-muted mt-1 text-xs">
          Reusable conditions for every combat. Names, icons and descriptions
          are shown to players when the condition is on their character, or on a
          creature whose conditions you share.
        </p>
      </div>

      {conditions.length === 0 ? (
        <p className="text-faint text-xs">
          No custom conditions yet — add one, then attach it to the creatures
          that inflict it.
        </p>
      ) : (
        <div className="space-y-2">
          {conditions.map(condition => (
            <div
              key={condition.id}
              role="group"
              aria-label={condition.name || 'New condition'}
              className="border-divider bg-surface-raised flex items-start gap-2 rounded-lg border p-2"
            >
              <div className="min-w-0 flex-1">
                <CustomConditionFields
                  value={condition}
                  onChange={changes => patch(condition.id, changes)}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() =>
                  onChange(conditions.filter(c => c.id !== condition.id))
                }
                aria-label={`Remove ${condition.name || 'unnamed condition'}`}
              >
                <Trash2 size={14} className="text-muted" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        type="button"
        onClick={() => onChange([...conditions, createCustomCondition('')])}
      >
        <Plus size={14} />
        Add condition
      </Button>
    </div>
  );
}
