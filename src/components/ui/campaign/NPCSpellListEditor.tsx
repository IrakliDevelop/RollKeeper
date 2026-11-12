'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Section } from '@/components/ui/layout/section';
import { NpcSpellRow } from './NpcSpellRow';
import { NpcSpellDialog } from './NpcSpellDialog';
import { LEVEL_NAMES } from './NPCSpellTab/NPCSpellTab.utils';
import type { Spell } from '@/types/character';

interface NPCSpellListEditorProps {
  spells: Spell[];
  onChange: (spells: Spell[]) => void;
}

interface SpellEdit {
  spell: Spell;
  open: boolean;
}

/**
 * Edit-mode spell list for the NPC form. It works on the form's draft array,
 * so changes are saved with the rest of the form (new NPCs too) and removal
 * is immediate. Casting and slot use belong to the detail tab.
 */
export function NPCSpellListEditor({
  spells,
  onChange,
}: NPCSpellListEditorProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [edit, setEdit] = useState<SpellEdit | null>(null);
  const editButtons = useRef(new Map<string, HTMLButtonElement>());
  const addButton = useRef<HTMLButtonElement>(null);
  // Set before a row goes (a spell id, or 'add') or before a dialog saves.
  const afterRemove = useRef<string | 'add' | null>(null);
  const afterSave = useRef<string | null>(null);

  const existingTags = useMemo(() => {
    const set = new Set<string>();
    for (const spell of spells) spell.tags?.forEach(t => set.add(t));
    return Array.from(set).sort();
  }, [spells]);

  const groups = useMemo(() => {
    const byLevel = new Map<number, Spell[]>();
    for (const spell of spells) {
      byLevel.set(spell.level, [...(byLevel.get(spell.level) ?? []), spell]);
    }
    return Array.from(byLevel.entries()).sort(([a], [b]) => a - b);
  }, [spells]);

  const findEditButton = (id: string) => {
    const element = editButtons.current.get(id);
    return element?.isConnected ? element : null;
  };

  // After a removal, focus goes to the neighbouring row, or Add spell.
  useEffect(() => {
    const target = afterRemove.current;
    if (target === null) return;
    afterRemove.current = null;
    if (target === 'add') addButton.current?.focus();
    else findEditButton(target)?.focus();
  }, [spells]);

  // Radix would return focus to whatever opened the dialog. After a save,
  // the row it just added or changed is the better place.
  const placeFocus = (event: Event) => {
    const target = afterSave.current;
    afterSave.current = null;
    const element = target && findEditButton(target);
    if (!element) return;
    event.preventDefault();
    element.focus();
  };

  const handleAdd = (spell: Spell) => {
    afterSave.current = spell.id;
    onChange([...spells, spell]);
    setAddOpen(false);
  };

  const handleEdit = (spell: Spell) => {
    afterSave.current = spell.id;
    onChange(spells.map(s => (s.id === spell.id ? spell : s)));
    setEdit(e => (e ? { ...e, open: false } : e));
  };

  const handleRemove = (id: string) => {
    const order = groups.flatMap(([, list]) => list.map(s => s.id));
    const i = order.indexOf(id);
    afterRemove.current = order[i + 1] ?? order[i - 1] ?? 'add';
    onChange(spells.filter(s => s.id !== id));
  };

  const editName = edit?.spell.name ?? '';

  return (
    <Section
      level={3}
      heading="Spells"
      contentClassName="space-y-4"
      trailing={
        <Button
          ref={addButton}
          variant="secondary"
          size="sm"
          onClick={() => setAddOpen(true)}
        >
          <Plus size={16} aria-hidden />
          Add spell
        </Button>
      }
    >
      {spells.length === 0 ? (
        <p className="type-body text-muted">No spells yet.</p>
      ) : (
        groups.map(([level, list]) => (
          <Section
            key={level}
            level={4}
            heading={LEVEL_NAMES[level] ?? `Level ${level}`}
          >
            <ul className="divide-divider divide-y">
              {list.map(spell => (
                <NpcSpellRow
                  key={spell.id}
                  spell={spell}
                  usage="edit"
                  onEdit={() => setEdit({ spell, open: true })}
                  onRemove={() => handleRemove(spell.id)}
                  buttonRef={(action, element) => {
                    if (action === 'edit' && element) {
                      editButtons.current.set(spell.id, element);
                    }
                  }}
                />
              ))}
            </ul>
          </Section>
        ))
      )}

      <NpcSpellDialog
        open={addOpen}
        mode="add"
        title="Add spell"
        existingTags={existingTags}
        onSubmit={handleAdd}
        onOpenChange={setAddOpen}
        onCloseAutoFocus={placeFocus}
      />
      <NpcSpellDialog
        open={edit?.open ?? false}
        mode="edit"
        title={editName.trim() ? `Edit ${editName}` : 'Edit spell'}
        spell={edit?.spell}
        existingTags={existingTags}
        onSubmit={handleEdit}
        onOpenChange={open => setEdit(e => (e ? { ...e, open } : e))}
        onCloseAutoFocus={placeFocus}
      />
    </Section>
  );
}
