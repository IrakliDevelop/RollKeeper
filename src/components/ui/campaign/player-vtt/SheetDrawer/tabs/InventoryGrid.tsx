'use client';

import { Star } from 'lucide-react';

import { useCharacterStore } from '@/store/characterStore';
import { isSheetFavorite } from '@/utils/sheetFavorites';
import { cn } from '@/utils/cn';

import type { ToastData } from '@/components/ui/feedback/Toast';

import { rarityBadgeVariant } from '../InventoryTabs.utils';
import { HEADING_CLASS } from '../sheetSectionStyles';
import type {
  InventoryEntryView,
  InventoryGroupView,
} from '../SheetDrawer.types';
import { useConsumableUse } from './useConsumableUse';

export interface InventoryGridProps {
  groups: InventoryGroupView[];
  addToast: (t: Omit<ToastData, 'id'>) => void;
}

const TILE_CLASS: Record<
  'neutral' | 'success' | 'info' | 'warning' | 'danger',
  string
> = {
  neutral: 'bg-surface-secondary border-divider',
  success: 'bg-accent-emerald-bg border-accent-emerald-border',
  info: 'bg-accent-blue-bg border-accent-blue-border',
  warning: 'bg-accent-amber-bg border-accent-amber-border',
  danger: 'bg-accent-red-bg border-accent-red-border',
};

function InventoryGridTile({
  entry,
  addToast,
}: {
  entry: InventoryEntryView;
  addToast: (t: Omit<ToastData, 'id'>) => void;
}) {
  const pinned = useCharacterStore(s =>
    isSheetFavorite(s.character, 'item', entry.id)
  );
  const setSheetFavorite = useCharacterStore(s => s.setSheetFavorite);
  const consumeItem = useConsumableUse(addToast);

  const quantity = entry.quantity ?? 0;
  const isUsable = entry.kind === 'item' && entry.consumable;
  const tileClass =
    TILE_CLASS[entry.rarity ? rarityBadgeVariant(entry.rarity) : 'neutral'];

  // The whole tile is itself a button (for a single, large tap target), so a
  // separate FavoriteStar button can't be nested inside it — the tile's own
  // tap toggles the pin instead. Usable consumables tap to Use and show no
  // pin star at all (pin them from the list view).
  const handleTap = () => {
    if (isUsable) {
      consumeItem(entry.id, entry.name, quantity);
      return;
    }
    setSheetFavorite('item', entry.id, !pinned);
  };

  const label = isUsable
    ? `Use ${entry.name}`
    : `${pinned ? 'Unpin' : 'Pin'} ${entry.name}`;

  return (
    <button
      type="button"
      aria-label={label}
      disabled={isUsable && quantity <= 0}
      onClick={handleTap}
      className={cn(
        'relative flex min-h-16 flex-col items-start justify-between gap-1 rounded-lg border p-2 text-left',
        tileClass
      )}
    >
      {!isUsable && (
        <Star
          aria-hidden="true"
          className={cn(
            'absolute top-1.5 right-1.5 h-3.5 w-3.5',
            pinned ? 'text-accent-amber-text fill-current' : 'text-faint'
          )}
        />
      )}
      {entry.equipped && (
        <span
          aria-hidden="true"
          className="bg-accent-emerald-text-muted h-2 w-2 rounded-full"
        />
      )}
      <span className="text-heading pr-4 text-xs font-semibold break-words">
        {entry.name}
      </span>
      {quantity > 1 && (
        <span className="text-faint text-[10px]">×{quantity}</span>
      )}
    </button>
  );
}

/** Rarity-tinted grid tiles for the Inventory tab's grid view. */
export function InventoryGrid({ groups, addToast }: InventoryGridProps) {
  return (
    <div className="space-y-3">
      {groups.map(group => (
        <div key={group.key}>
          <h3 className={HEADING_CLASS}>
            {group.label} ({group.entries.length})
          </h3>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {group.entries.map(entry => (
              <InventoryGridTile
                key={entry.id}
                entry={entry}
                addToast={addToast}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
