import { Check, Circle } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { Tooltip } from '@/components/ui/primitives/Tooltip';

import type { SpellRowView } from '../SheetDrawer.types';
import { FavoriteStar } from './FavoriteStar';

export interface SpellListRowProps {
  row: SpellRowView;
  locked: boolean;
  onTogglePrepared: () => void;
  onCast: () => void;
  onView: () => void;
}

/** One spell line in the sheet drawer's Spells tab: prepared toggle, name/tags, meta, Cast. */
export function SpellListRow({
  row,
  locked,
  onTogglePrepared,
  onCast,
  onView,
}: SpellListRowProps) {
  const { spell, prepared, alwaysPrepared, castable } = row;
  const isCantrip = spell.level === 0;
  const showToggle = !locked && !isCantrip && !alwaysPrepared;
  const showsCheck = prepared || alwaysPrepared || isCantrip;
  const toggleLabel = `${prepared ? 'Unprepare' : 'Prepare'} ${spell.name}`;
  const tags = [
    spell.concentration && 'Concentration',
    spell.ritual && 'Ritual',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className="flex items-center gap-2 py-1.5">
      {showToggle ? (
        <Tooltip content={toggleLabel}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-9 px-0"
            selected={prepared}
            aria-label={toggleLabel}
            onClick={onTogglePrepared}
          >
            {prepared ? (
              <Check size={16} aria-hidden />
            ) : (
              <Circle size={16} aria-hidden className="text-muted" />
            )}
          </Button>
        </Tooltip>
      ) : (
        <span
          className="type-small text-muted flex size-9 shrink-0 items-center justify-center pointer-coarse:size-11"
          aria-hidden="true"
        >
          {showsCheck ? <Check size={16} /> : '—'}
        </span>
      )}

      <button
        type="button"
        onClick={onView}
        className="focus-visible:outline-ring min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:min-h-11"
      >
        <span className="type-ui text-heading block truncate">
          {spell.name}
        </span>
        {tags && <span className="type-caption text-muted block">{tags}</span>}
        <span className="type-caption text-muted block truncate">
          {spell.school} · {spell.castingTime} · {spell.range}
        </span>
      </button>

      <Button
        variant="secondary"
        size="sm"
        className="shrink-0"
        aria-label={`Cast ${spell.name}`}
        disabled={!castable}
        onClick={onCast}
      >
        Cast
      </Button>

      <FavoriteStar kind="spell" id={spell.id} name={spell.name} />
    </li>
  );
}
