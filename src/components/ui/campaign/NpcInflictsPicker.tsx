'use client';

import type { Ref } from 'react';
import {
  SelectField,
  SelectGroup,
  SelectItem,
  SelectLabel,
} from '@/components/ui/forms/select';
import type { CustomCondition } from '@/types/encounter';

// Add-picker sentinel: a Radix Select only fires onValueChange when its value
// CHANGES, so the value is pinned to a placeholder that never updates (same
// pattern as NpcResourcesEditor).
export const PLACEHOLDER = '__placeholder__';
export const ADD_NEW = '__new__';

interface NpcInflictsPickerProps {
  /** Ref to the picker's trigger button. */
  ref?: Ref<HTMLButtonElement>;
  available: CustomCondition[];
  availableOfficial: CustomCondition[];
  officialConditionsLoading: boolean;
  onSelect: (value: string) => void;
  onCloseAutoFocus: (event: Event) => void;
}

export function NpcInflictsPicker({
  ref,
  available,
  availableOfficial,
  officialConditionsLoading,
  onSelect,
  onCloseAutoFocus,
}: NpcInflictsPickerProps) {
  return (
    <div className="w-56">
      <SelectField
        ref={ref}
        value={PLACEHOLDER}
        onValueChange={onSelect}
        triggerProps={{ 'aria-label': 'Add inflicted condition' }}
        contentProps={{ onCloseAutoFocus }}
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
}
