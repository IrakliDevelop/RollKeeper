import { Check } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { cn } from '@/utils/cn';

import type { SpellRowView } from '../SheetDrawer.types';
import { FavoriteStar } from './FavoriteStar';

export interface SpellListRowProps {
  row: SpellRowView;
  locked: boolean;
  onTogglePrepared: () => void;
  onCast: () => void;
  onView: () => void;
}

/** One spell line in the sheet drawer's Spells tab: prepared toggle, name/badges, meta, Cast. */
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

  return (
    <div className="border-divider bg-surface flex items-center gap-2 rounded-lg border p-2">
      {showToggle ? (
        <button
          type="button"
          aria-label={`${prepared ? 'Unprepare' : 'Prepare'} ${spell.name}`}
          aria-pressed={prepared}
          onClick={onTogglePrepared}
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
            prepared
              ? 'bg-accent-emerald-text-muted border-accent-emerald-border'
              : 'border-divider'
          )}
        >
          {prepared && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
        </button>
      ) : (
        <span
          className="text-muted flex h-6 w-6 shrink-0 items-center justify-center text-xs"
          aria-hidden="true"
        >
          {showsCheck ? <Check className="h-3.5 w-3.5" /> : '—'}
        </span>
      )}

      <button
        type="button"
        onClick={onView}
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="text-body truncate text-sm font-medium">
            {spell.name}
          </span>
          {spell.concentration && (
            <Badge variant="warning" size="sm">
              C
            </Badge>
          )}
          {spell.ritual && (
            <Badge variant="info" size="sm">
              R
            </Badge>
          )}
        </div>
        <div className="text-faint truncate text-xs">
          {spell.school} · {spell.castingTime} · {spell.range}
        </div>
      </button>

      <Button
        variant="primary"
        size="sm"
        aria-label={`Cast ${spell.name}`}
        disabled={!castable}
        title={castable ? undefined : 'Not prepared or no slots left'}
        onClick={onCast}
      >
        Cast
      </Button>

      <FavoriteStar kind="spell" id={spell.id} name={spell.name} />
    </div>
  );
}
