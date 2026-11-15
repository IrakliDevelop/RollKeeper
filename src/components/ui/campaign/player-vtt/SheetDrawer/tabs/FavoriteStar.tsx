'use client';

import { Star } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { Tooltip } from '@/components/ui/primitives/Tooltip';
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

  const label = pinned ? `Unpin ${name}` : `Pin ${name}`;

  return (
    <Tooltip content={label}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-9 px-0"
        selected={pinned}
        aria-label={label}
        onClick={() => setSheetFavorite(kind, id, !pinned)}
      >
        <Star
          size={16}
          aria-hidden
          className={cn(pinned ? 'fill-current' : 'text-muted')}
        />
      </Button>
    </Tooltip>
  );
}
