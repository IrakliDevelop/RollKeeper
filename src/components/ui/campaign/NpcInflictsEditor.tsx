'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import {
  SelectField,
  SelectGroup,
  SelectItem,
  SelectLabel,
} from '@/components/ui/forms/select';
import { Badge } from '@/components/ui/layout/badge';
import { Section } from '@/components/ui/layout/section';
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

const KIND_LABELS: Record<CustomCondition['kind'], string> = {
  buff: 'Buff',
  debuff: 'Debuff',
  neutral: 'Neutral',
};

type PendingFocus = 'picker' | 'panel' | { remove: string } | null;

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
  /** Canonical condition snapshots loaded from the bundled rules data. */
  officialConditions?: CustomCondition[];
  officialConditionsLoading?: boolean;
  onChange: (next: CustomCondition[]) => void;
  /** Inline create also adds the new condition to the library. */
  onCreateInLibrary: (condition: CustomCondition) => void;
}

export function NpcInflictsEditor({
  conditions,
  library,
  officialConditions = [],
  officialConditionsLoading = false,
  onChange,
  onCreateInLibrary,
}: NpcInflictsEditorProps) {
  const [draft, setDraft] = useState<CustomConditionDraft | null>(null);
  const pickerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const removeButtons = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<PendingFocus>(null);
  const attachedIds = new Set(conditions.map(c => c.id));
  const available = library.filter(entry => !attachedIds.has(entry.id));
  const availableOfficial = officialConditions.filter(
    entry => !attachedIds.has(entry.id)
  );
  const resolved = resolveInflictableConditions(
    { inflictableConditions: conditions },
    library
  );

  // Focus moves after the add, remove, create or cancel has rendered. The
  // panel move waits for the picker to close (see handlePickerCloseFocus).
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target || target === 'panel') return;
    pendingFocus.current = null;
    if (target === 'picker') pickerRef.current?.focus();
    else removeButtons.current.get(target.remove)?.focus();
  }, [draft, conditions]);

  // Radix refocuses the picker trigger after it closes; "New condition…"
  // sends focus to the panel's name field instead.
  const handlePickerCloseFocus = (event: Event) => {
    if (pendingFocus.current !== 'panel') return;
    pendingFocus.current = null;
    event.preventDefault();
    panelRef.current
      ?.querySelector<HTMLElement>('[aria-label="Condition name"]')
      ?.focus();
  };

  const handleRemove = (id: string) => {
    const index = resolved.findIndex(c => c.id === id);
    const following = resolved[index + 1];
    pendingFocus.current = following ? { remove: following.id } : 'picker';
    onChange(conditions.filter(c => c.id !== id));
  };

  const handleCancel = () => {
    pendingFocus.current = 'picker';
    setDraft(null);
  };

  const handleAdd = (value: string) => {
    if (value === PLACEHOLDER || !value) return;
    if (value === ADD_NEW) {
      pendingFocus.current = 'panel';
      setDraft(EMPTY_DRAFT);
      return;
    }
    const entry = [...officialConditions, ...library].find(
      item => item.id === value
    );
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
    pendingFocus.current = 'picker';
    onChange([...conditions, { ...created }]);
    setDraft(null);
  };

  const picker = (
    <div className="w-56">
      <SelectField
        ref={pickerRef}
        value={PLACEHOLDER}
        onValueChange={handleAdd}
        triggerProps={{ 'aria-label': 'Add inflicted condition' }}
        contentProps={{ onCloseAutoFocus: handlePickerCloseFocus }}
      >
        <SelectItem value={PLACEHOLDER} disabled>
          Add condition…
        </SelectItem>
        <SelectGroup>
          <SelectLabel>Official conditions</SelectLabel>
          {officialConditionsLoading ? (
            <SelectItem value="__loading__" disabled>
              Loading official conditions…
            </SelectItem>
          ) : (
            availableOfficial.map(entry => (
              <SelectItem
                key={entry.id}
                value={entry.id}
                description={entry.rulesSource}
              >
                {entry.name}
              </SelectItem>
            ))
          )}
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Custom conditions</SelectLabel>
          {available.map(entry => (
            <SelectItem key={entry.id} value={entry.id}>
              {entry.name}
            </SelectItem>
          ))}
          <SelectItem value={ADD_NEW}>New condition…</SelectItem>
        </SelectGroup>
      </SelectField>
    </div>
  );

  return (
    <Section
      level={3}
      heading="Conditions it inflicts"
      wrapHeading
      trailing={picker}
      contentClassName="space-y-3"
    >
      {resolved.length === 0 && !draft ? (
        <p className="type-body text-muted">
          No conditions yet. Conditions you add here can be applied with one tap
          in combat.
        </p>
      ) : (
        <ul className="divide-divider divide-y">
          {resolved.map(condition => {
            const Icon = CONDITION_ICON_REGISTRY[condition.icon];
            return (
              <li
                key={condition.id}
                className="flex items-start gap-2 py-2 pointer-coarse:min-h-11"
              >
                <Icon
                  size={16}
                  aria-hidden
                  className="text-muted mt-0.5 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="type-ui text-heading">{condition.name}</p>
                  {condition.description && (
                    <p className="type-small text-muted">
                      {condition.description}
                    </p>
                  )}
                </div>
                <Badge variant="neutral" size="sm">
                  {condition.origin === 'official'
                    ? condition.rulesSource || 'Official'
                    : KIND_LABELS[condition.kind]}
                </Badge>
                <Button
                  ref={node => {
                    if (node) removeButtons.current.set(condition.id, node);
                    else removeButtons.current.delete(condition.id);
                  }}
                  variant="danger"
                  size="sm"
                  className="px-2"
                  type="button"
                  onClick={() => handleRemove(condition.id)}
                  aria-label={`Remove ${condition.name}`}
                >
                  <Trash2 size={16} aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {draft && (
        <div ref={panelRef} className="border-divider space-y-3 border-t pt-3">
          <CustomConditionFields
            value={draft}
            onChange={changes =>
              setDraft(prev => (prev ? { ...prev, ...changes } : prev))
            }
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={handleCreate}
              disabled={!draft.name.trim()}
            >
              Create and add
            </Button>
          </div>
        </div>
      )}
    </Section>
  );
}
