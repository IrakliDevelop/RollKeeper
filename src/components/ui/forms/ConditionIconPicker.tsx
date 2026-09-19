'use client';

import { useMemo, useState } from 'react';
// @radix-ui/react-popover and @radix-ui/react-dialog are both pinned exactly
// to 1.1.15 in package.json and must be bumped together: they must share
// react-dismissable-layer/react-focus-scope module instances, or this popover
// self-closes inside the modal dialogs it is used in (same note as
// calendar/MarkerField.tsx).
import * as Popover from '@radix-ui/react-popover';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import {
  CONDITION_ICON_NAMES,
  CONDITION_ICON_REGISTRY,
  type ConditionIconName,
} from '@/utils/conditionIconRegistry';

export interface ConditionIconPickerProps {
  value: ConditionIconName;
  onChange: (icon: ConditionIconName) => void;
  /** Accessible-name prefix of the trigger. */
  label?: string;
}

function filterIconNames(query: string): readonly ConditionIconName[] {
  const needle = query.trim().toLowerCase().replace(/\s+/g, '-');
  if (needle === '') return CONDITION_ICON_NAMES;
  return CONDITION_ICON_NAMES.filter(name => name.includes(needle));
}

export function ConditionIconPicker({
  value,
  onChange,
  label = 'Condition icon',
}: ConditionIconPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const names = useMemo(() => filterIconNames(query), [query]);
  const Current = CONDITION_ICON_REGISTRY[value];

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setQuery('');
  };

  const handlePick = (name: ConditionIconName) => {
    onChange(name);
    handleOpenChange(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <Button
          variant="outline"
          size="sm"
          type="button"
          aria-label={`${label}: ${value}`}
          className="h-9 w-9 shrink-0 p-0"
        >
          <Current size={16} aria-hidden />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={4}
          className="bg-surface-raised border-divider z-50 w-64 rounded-lg border p-2 shadow-lg"
        >
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search icons"
            placeholder="Search icons…"
          />
          {names.length === 0 ? (
            <p className="text-muted py-6 text-center text-xs">
              No icons found
            </p>
          ) : (
            <div
              role="group"
              aria-label="Icons"
              className="mt-2 grid max-h-56 grid-cols-6 gap-1 overflow-y-auto"
            >
              {names.map(name => {
                const Icon = CONDITION_ICON_REGISTRY[name];
                return (
                  <Button
                    key={name}
                    variant={name === value ? 'secondary' : 'ghost'}
                    size="sm"
                    type="button"
                    aria-label={name}
                    aria-pressed={name === value}
                    title={name}
                    onClick={() => handlePick(name)}
                    className="h-9 w-9 p-0"
                  >
                    <Icon size={16} aria-hidden />
                  </Button>
                );
              })}
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
