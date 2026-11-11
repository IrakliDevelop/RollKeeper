'use client';

import React, { useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Section } from '@/components/ui/layout/section';
import { AbilityListEntryRow, type FocusPart } from './AbilityListEntryRow';
import type { NpcResourceDraft } from '@/utils/npcResources';
import type { EntrySection } from '@/utils/statBlockAbilities';
import type { NPCInventoryItem, StatBlockEntry } from '@/types/encounter';

export const ENTRY_SECTION_COPY: Record<
  EntrySection,
  {
    heading: string;
    singular: string;
    addLabel: string;
    empty: string;
    placeholder: string;
  }
> = {
  traits: {
    heading: 'Traits',
    singular: 'trait',
    addLabel: 'Add trait',
    empty: 'No traits yet.',
    placeholder: 'Keen Smell',
  },
  actions: {
    heading: 'Actions',
    singular: 'action',
    addLabel: 'Add action',
    empty: 'No actions yet.',
    placeholder: 'Multiattack',
  },
  bonusActions: {
    heading: 'Bonus actions',
    singular: 'bonus action',
    addLabel: 'Add bonus action',
    empty: 'No bonus actions yet.',
    placeholder: 'Nimble Escape',
  },
  reactions: {
    heading: 'Reactions',
    singular: 'reaction',
    addLabel: 'Add reaction',
    empty: 'No reactions yet.',
    placeholder: 'Parry',
  },
  lairActions: {
    heading: 'Lair actions',
    singular: 'lair action',
    addLabel: 'Add lair action',
    empty: 'No lair actions yet.',
    placeholder: 'Tremor',
  },
};

type PendingFocus = { key: string; part: FocusPart } | 'add' | null;

export function AbilityListEditor({
  section,
  items,
  onChange,
  resources,
  inventoryItems = [],
}: {
  section: EntrySection;
  items: StatBlockEntry[];
  onChange: (items: StatBlockEntry[]) => void;
  /** When present and non-empty, each entry gets a resource cost picker. */
  resources?: NpcResourceDraft[];
  inventoryItems?: NPCInventoryItem[];
}) {
  const copy = ENTRY_SECTION_COPY[section];
  // Entries rarely have an id while editing, so rows are keyed by a local key
  // that follows the entry through moves. Never written into an entry.
  const localKeys = useRef<string[]>([]);
  const keyCounter = useRef(0);
  const focusTargets = useRef(new Map<string, HTMLElement>());
  const addButton = useRef<HTMLButtonElement>(null);
  const pendingFocus = useRef<PendingFocus>(null);

  const freshKey = () => `draft-${keyCounter.current++}`;
  while (localKeys.current.length < items.length) {
    localKeys.current.push(freshKey());
  }
  localKeys.current.length = items.length;
  const keyAt = (index: number) => items[index].id ?? localKeys.current[index];

  // Focus moves after the add, remove or move has rendered.
  useEffect(() => {
    const target = pendingFocus.current;
    pendingFocus.current = null;
    if (target === 'add') addButton.current?.focus();
    else if (target)
      focusTargets.current.get(`${target.key}:${target.part}`)?.focus();
  }, [items]);

  const handleAdd = () => {
    const key = freshKey();
    localKeys.current.push(key);
    pendingFocus.current = { key, part: 'name' };
    onChange([...items, { name: '', text: '' }]);
  };

  const handleRemove = (index: number) => {
    const neighbour = index + 1 < items.length ? index + 1 : index - 1;
    pendingFocus.current =
      neighbour >= 0 ? { key: keyAt(neighbour), part: 'name' } : 'add';
    localKeys.current.splice(index, 1);
    onChange(items.filter((_, i) => i !== index));
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    // The pressed arrow keeps focus unless the entry reached that end.
    const atEnd = direction < 0 ? target === 0 : target === items.length - 1;
    const stay: FocusPart = direction < 0 ? 'up' : 'down';
    const other: FocusPart = direction < 0 ? 'down' : 'up';
    pendingFocus.current = { key: keyAt(index), part: atEnd ? other : stay };
    const keys = localKeys.current;
    [keys[index], keys[target]] = [keys[target], keys[index]];
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <Section
      level={3}
      heading={copy.heading}
      trailing={
        <Button
          ref={addButton}
          variant="secondary"
          size="sm"
          onClick={handleAdd}
        >
          <Plus size={16} aria-hidden />
          {copy.addLabel}
        </Button>
      }
    >
      {items.length === 0 ? (
        <p className="type-body text-muted">{copy.empty}</p>
      ) : (
        <ul className="divide-divider divide-y">
          {items.map((entry, index) => {
            const key = keyAt(index);
            return (
              <AbilityListEntryRow
                key={key}
                entry={entry}
                singular={copy.singular}
                namePlaceholder={copy.placeholder}
                isFirst={index === 0}
                isLast={index === items.length - 1}
                onChange={next =>
                  onChange(items.map((it, i) => (i === index ? next : it)))
                }
                onMove={direction => handleMove(index, direction)}
                onRemove={() => handleRemove(index)}
                resources={resources}
                inventoryItems={inventoryItems}
                registerFocus={(part, el) => {
                  const id = `${key}:${part}`;
                  if (el) focusTargets.current.set(id, el);
                  else focusTargets.current.delete(id);
                }}
              />
            );
          })}
        </ul>
      )}
    </Section>
  );
}
