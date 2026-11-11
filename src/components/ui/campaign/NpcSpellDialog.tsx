'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/feedback/dialog';
import { Button } from '@/components/ui/forms/button';
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
import type { SpellFormData } from '@/utils/spellConversion';

interface NpcSpellDialogProps {
  open: boolean;
  mode: 'add' | 'edit';
  title: string;
  spell?: Spell;
  existingTags: string[];
  onSubmit: (spell: Spell) => void;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
}

function buildSpell(
  mode: 'add' | 'edit',
  form: SpellFormData,
  tags: string[],
  spell?: Spell
): Spell {
  if (mode === 'add' || !spell) {
    const created = convertFormDataToSpell(form);
    if (tags.length > 0) created.tags = [...tags];
    return created;
  }
  const updates = convertFormDataToSpell(form, spell.id);
  return {
    ...spell,
    ...updates,
    createdAt: spell.createdAt,
    freeCastsUsed:
      updates.freeCastMax !== undefined
        ? (spell.freeCastsUsed ?? 0)
        : updates.freeCastsUsed,
    tags: tags.length > 0 ? tags : undefined,
  };
}

export function NpcSpellDialog({
  open,
  mode,
  title,
  spell,
  existingTags,
  onSubmit,
  onOpenChange,
  onCloseAutoFocus,
}: NpcSpellDialogProps) {
  const { spells: dbSpells, loading } = useSpellsData();
  const [form, setForm] = useState<SpellFormData>(() =>
    open && mode === 'edit' && spell
      ? spellToFormData(spell)
      : createInitialSpellFormData()
  );
  const [tags, setTags] = useState<string[]>(() =>
    open && mode === 'edit' && spell ? (spell.tags ?? []) : []
  );

  // Start from a clean form each time the dialog opens. Adjusting state
  // during render avoids painting the previous form for one frame.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      const editing = mode === 'edit' && spell;
      setForm(editing ? spellToFormData(spell) : createInitialSpellFormData());
      setTags(editing ? (spell.tags ?? []) : []);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {mode === 'add' && (
            <SpellAutocomplete
              spells={dbSpells}
              onSelect={processed =>
                setForm(convertProcessedSpellToFormData(processed))
              }
              loading={loading}
              label="Search spells"
              placeholder="Fireball"
            />
          )}
          <SpellFormFields
            formData={form}
            onChange={setForm}
            tags={tags}
            onTagsChange={setTags}
            existingTags={existingTags}
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!form.name.trim()}
            onClick={() => onSubmit(buildSpell(mode, form, tags, spell))}
          >
            {mode === 'add' ? 'Add spell' : 'Save spell'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
