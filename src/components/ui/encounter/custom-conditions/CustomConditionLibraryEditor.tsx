'use client';

import { useEffect, useRef } from 'react';
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
  const addRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  useEffect(() => {
    if (returnFocus.current) {
      addRef.current?.focus();
      returnFocus.current = false;
    }
  }, [conditions]);

  const patch = (id: string, changes: Partial<CustomConditionDraft>) =>
    onChange(conditions.map(c => (c.id === id ? { ...c, ...changes } : c)));

  const handleRemove = (id: string) => {
    returnFocus.current = true;
    onChange(conditions.filter(c => c.id !== id));
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="type-subheading text-heading">Custom conditions</h3>
        <p className="text-muted mt-1 text-xs">
          Reusable conditions for every combat. Names, icons and descriptions
          are shown to players when the condition is on their character, or on a
          creature whose conditions you share.
        </p>
      </div>

      {conditions.length === 0 ? (
        <p className="text-muted text-sm">Add a condition to use in combat.</p>
      ) : (
        <div className="space-y-2">
          {conditions.map(condition => (
            <div
              key={condition.id}
              role="group"
              aria-label={condition.name || 'New condition'}
              className="border-divider flex flex-wrap items-start gap-2 border-b py-3"
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
                onClick={() => handleRemove(condition.id)}
                aria-label={`Remove ${condition.name || 'unnamed condition'}`}
              >
                <Trash2 size={14} className="text-muted" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button
        ref={addRef}
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
