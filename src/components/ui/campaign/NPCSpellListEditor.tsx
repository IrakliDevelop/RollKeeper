'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Star } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/feedback/dialog';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { SpellAutocomplete } from '@/components/ui/forms/SpellAutocomplete';
import { SpellFormFields } from '@/components/shared/spells';
import { useSpellsData } from '@/hooks/useSpellsData';
import {
  convertProcessedSpellToFormData,
  convertFormDataToSpell,
  spellToFormData,
  createInitialSpellFormData,
} from '@/utils/spellConversion';
import type { Spell } from '@/types/character';
import type { ProcessedSpell } from '@/types/spells';
import type { SpellFormData } from '@/utils/spellConversion';

const LEVEL_NAMES: Record<number, string> = {
  0: 'Cantrips',
  1: 'Level 1',
  2: 'Level 2',
  3: 'Level 3',
  4: 'Level 4',
  5: 'Level 5',
  6: 'Level 6',
  7: 'Level 7',
  8: 'Level 8',
  9: 'Level 9',
};

interface NPCSpellListEditorProps {
  spells: Spell[];
  onChange: (spells: Spell[]) => void;
}

/**
 * Edit-mode spell list manager for the NPC form. Mirrors the add/edit/remove
 * flow of the read-mode NPCSpellTab (same SpellAutocomplete + SpellFormFields +
 * conversion utils) but operates on a local Spell[] array so changes are saved
 * with the rest of the form (works for new NPCs too), rather than persisting to
 * the store immediately. Runtime concerns (casting, slot usage) are omitted.
 */
export function NPCSpellListEditor({
  spells,
  onChange,
}: NPCSpellListEditorProps) {
  const { spells: dbSpells, loading } = useSpellsData();

  const [addOpen, setAddOpen] = useState(false);
  const [addFormData, setAddFormData] = useState<SpellFormData>(
    createInitialSpellFormData
  );
  const [addTags, setAddTags] = useState<string[]>([]);

  const [editingSpell, setEditingSpell] = useState<Spell | null>(null);
  const [editFormData, setEditFormData] = useState<SpellFormData>(
    createInitialSpellFormData
  );
  const [editTags, setEditTags] = useState<string[]>([]);

  const existingTags = useMemo(() => {
    const set = new Set<string>();
    for (const spell of spells) spell.tags?.forEach(t => set.add(t));
    return Array.from(set).sort();
  }, [spells]);

  const byLevel = useMemo(() => {
    const groups: Record<number, Spell[]> = {};
    for (const spell of spells) (groups[spell.level] ??= []).push(spell);
    return groups;
  }, [spells]);

  const levels = useMemo(
    () =>
      Object.keys(byLevel)
        .map(Number)
        .sort((a, b) => a - b),
    [byLevel]
  );

  const closeAdd = () => {
    setAddOpen(false);
    setAddFormData(createInitialSpellFormData());
    setAddTags([]);
  };

  const handleAddFromDb = (processed: ProcessedSpell) =>
    setAddFormData(convertProcessedSpellToFormData(processed));

  const handleAdd = () => {
    if (!addFormData.name.trim()) return;
    const spell = convertFormDataToSpell(addFormData);
    if (addTags.length > 0) spell.tags = [...addTags];
    onChange([...spells, spell]);
    closeAdd();
  };

  const openEdit = (spell: Spell) => {
    setEditingSpell(spell);
    setEditFormData(spellToFormData(spell));
    setEditTags(spell.tags ?? []);
  };

  const handleSaveEdit = () => {
    if (!editingSpell) return;
    const updates = convertFormDataToSpell(editFormData, editingSpell.id);
    // Preserve existing innate-usage count; don't reset when editing.
    if (updates.freeCastMax !== undefined) {
      updates.freeCastsUsed = editingSpell.freeCastsUsed ?? 0;
    }
    updates.tags = editTags.length > 0 ? editTags : undefined;
    onChange(
      spells.map(s =>
        s.id === editingSpell.id
          ? // Preserve original createdAt (convertFormDataToSpell makes a new one).
            { ...s, ...updates, createdAt: s.createdAt }
          : s
      )
    );
    setEditingSpell(null);
  };

  const handleRemove = (id: string) =>
    onChange(spells.filter(s => s.id !== id));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-heading text-sm font-medium">
          Spells{spells.length > 0 ? ` (${spells.length})` : ''}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add Spell
        </Button>
      </div>

      {spells.length === 0 ? (
        <p className="text-muted border-divider rounded-lg border border-dashed px-3 py-4 text-center text-sm">
          No spells yet. Add spells this NPC can cast.
        </p>
      ) : (
        <div className="space-y-2">
          {levels.map(level => (
            <div
              key={level}
              className="border-divider overflow-hidden rounded-lg border"
            >
              <div className="bg-surface-secondary text-heading px-3 py-1.5 text-xs font-semibold">
                {LEVEL_NAMES[level] ?? `Level ${level}`}{' '}
                <span className="text-muted">({byLevel[level].length})</span>
              </div>
              <div className="divide-y divide-[var(--border-divider)]">
                {byLevel[level].map(spell => (
                  <SpellEditRow
                    key={spell.id}
                    spell={spell}
                    onEdit={() => openEdit(spell)}
                    onRemove={() => handleRemove(spell.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Spell dialog */}
      <Dialog
        open={addOpen}
        onOpenChange={open => {
          if (!open) closeAdd();
        }}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Add Spell</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="border-accent-purple-border bg-accent-purple-bg/30 rounded-lg border-2 p-4">
              <SpellAutocomplete
                spells={dbSpells}
                onSelect={handleAddFromDb}
                loading={loading}
                placeholder="Search spells from database to auto-fill..."
              />
            </div>
            <SpellFormFields
              formData={addFormData}
              onChange={setAddFormData}
              tags={addTags}
              onTagsChange={setAddTags}
              existingTags={existingTags}
            />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={closeAdd}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleAdd}
              disabled={!addFormData.name.trim()}
            >
              Add Spell
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Spell dialog */}
      <Dialog
        open={!!editingSpell}
        onOpenChange={open => {
          if (!open) setEditingSpell(null);
        }}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Edit: {editingSpell?.name}</DialogTitle>
          </DialogHeader>
          {editingSpell && (
            <DialogBody>
              <SpellFormFields
                formData={editFormData}
                onChange={setEditFormData}
                tags={editTags}
                onTagsChange={setEditTags}
                existingTags={existingTags}
              />
            </DialogBody>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEditingSpell(null)}
            >
              Cancel
            </Button>
            <Button type="button" variant="primary" onClick={handleSaveEdit}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SpellEditRow({
  spell,
  onEdit,
  onRemove,
}: {
  spell: Spell;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const isAtWill = spell.freeCastMax !== undefined && spell.freeCastMax === 0;
  const isInnate = spell.freeCastMax !== undefined && spell.freeCastMax > 0;

  return (
    <div className="bg-surface-raised flex items-center gap-2 px-3 py-1.5">
      {(isAtWill || isInnate) && (
        <Star className="text-accent-amber-text h-3.5 w-3.5 shrink-0" />
      )}
      <span className="text-heading min-w-0 flex-1 truncate text-sm font-medium">
        {spell.name}
      </span>
      <Badge variant={spell.level === 0 ? 'warning' : 'secondary'} size="sm">
        {spell.level === 0 ? 'C' : `L${spell.level}`}
      </Badge>
      {isAtWill && (
        <Badge variant="warning" size="sm">
          At Will
        </Badge>
      )}
      {isInnate && (
        <Badge variant="secondary" size="sm">
          {spell.freeCastMax}/day
        </Badge>
      )}
      {spell.concentration && (
        <Badge variant="info" size="sm">
          C
        </Badge>
      )}
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={onEdit}
          className="text-muted hover:text-accent-amber-text rounded p-1 transition-colors"
          title="Edit spell"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="text-muted hover:text-accent-red-text rounded p-1 transition-colors"
          title="Remove spell"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
