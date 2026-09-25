'use client';

import { Star } from 'lucide-react';

import { useCharacterStore } from '@/store/characterStore';
import { isSheetFavorite } from '@/utils/sheetFavorites';
import { cn } from '@/utils/cn';

import type { SheetFavoriteKind } from '@/types/character';

export interface FavoriteStarProps {
  kind: SheetFavoriteKind;
  id: string;
  name: string;
}

/** Pin/unpin toggle for the sheet drawer's favorites strip. */
export function FavoriteStar({ kind, id, name }: FavoriteStarProps) {
  const pinned = useCharacterStore(s => isSheetFavorite(s.character, kind, id));
  const setSheetFavorite = useCharacterStore(s => s.setSheetFavorite);

  return (
    <button
      type="button"
      aria-label={pinned ? `Unpin ${name}` : `Pin ${name}`}
      aria-pressed={pinned}
      onClick={() => setSheetFavorite(kind, id, !pinned)}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center"
    >
      <Star
        aria-hidden="true"
        className={cn(
          'h-4 w-4',
          pinned ? 'text-accent-amber-text fill-current' : 'text-faint'
        )}
      />
    </button>
  );
}
