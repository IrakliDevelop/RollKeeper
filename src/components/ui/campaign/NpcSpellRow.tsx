'use client';

import { Eye, Pencil, Trash2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import type { Spell } from '@/types/character';

interface NpcSpellRowProps {
  spell: Spell;
  /** `play` is the detail tab; `edit` is the form's draft list. */
  usage: 'play' | 'edit';
  onCast?: () => void;
  onView?: () => void;
  onEdit?: () => void;
  onRemove?: () => void;
  buttonRef?: (
    action: 'cast' | 'edit',
    element: HTMLButtonElement | null
  ) => void;
}

function innateLabel(spell: Spell, usage: 'play' | 'edit'): string | null {
  const max = spell.freeCastMax;
  if (max === undefined || max === 0) return null;
  if (usage === 'edit') return `${max} per day`;
  return `${max - (spell.freeCastsUsed ?? 0)} of ${max} left`;
}

export function NpcSpellRow({
  spell,
  usage,
  onCast,
  onView,
  onEdit,
  onRemove,
  buttonRef,
}: NpcSpellRowProps) {
  const innate = innateLabel(spell, usage);

  return (
    <li className="flex flex-wrap items-start gap-2 py-2 pointer-coarse:min-h-11">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="type-ui text-heading break-words">{spell.name}</span>
        {spell.school && spell.school !== 'Unknown' && (
          <span className="type-small text-muted hidden sm:inline">
            {spell.school}
          </span>
        )}
        {spell.freeCastMax === 0 && (
          <Badge variant="neutral" size="sm">
            At will
          </Badge>
        )}
        {innate && (
          <Badge variant="neutral" size="sm">
            {innate}
          </Badge>
        )}
        {spell.concentration && (
          <Badge variant="magic" size="sm">
            Concentration
          </Badge>
        )}
        {spell.ritual && (
          <Badge variant="neutral" size="sm">
            Ritual
          </Badge>
        )}
        {spell.tags?.map(tag => (
          <Badge key={tag} variant="neutral" size="sm">
            {tag}
          </Badge>
        ))}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {onCast && (
          <Button
            variant="ghost"
            size="sm"
            className="px-2"
            aria-label={`Cast ${spell.name}`}
            onClick={onCast}
            ref={el => buttonRef?.('cast', el)}
          >
            <Wand2 size={16} aria-hidden="true" />
          </Button>
        )}
        {onView && (
          <Button
            variant="ghost"
            size="sm"
            className="px-2"
            aria-label={`View ${spell.name}`}
            onClick={onView}
          >
            <Eye size={16} aria-hidden="true" />
          </Button>
        )}
        {onEdit && (
          <Button
            variant="ghost"
            size="sm"
            className="px-2"
            aria-label={`Edit ${spell.name}`}
            onClick={onEdit}
            ref={el => buttonRef?.('edit', el)}
          >
            <Pencil size={16} aria-hidden="true" />
          </Button>
        )}
        {onRemove && (
          <Button
            variant="danger"
            size="sm"
            className="px-2"
            aria-label={`Remove ${spell.name}`}
            onClick={onRemove}
          >
            <Trash2 size={16} aria-hidden="true" />
          </Button>
        )}
      </div>
    </li>
  );
}
