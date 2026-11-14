'use client';

import { Star } from 'lucide-react';

import { Section } from '@/components/ui/layout/section';
import { useCharacterStore } from '@/store/characterStore';
import { isSheetFavorite } from '@/utils/sheetFavorites';
import { cn } from '@/utils/cn';

import type { ToastData } from '@/components/ui/feedback/Toast';

import type {
  InventoryEntryView,
  InventoryGroupView,
} from '../SheetDrawer.types';
import { useConsumableUse } from './useConsumableUse';

export interface InventoryGridProps {
  groups: InventoryGroupView[];
  addToast: (t: Omit<ToastData, 'id'>) => void;
}

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
  const caption = [
    entry.rarity &&
      entry.rarity !== 'common' &&
      entry.rarity.charAt(0).toUpperCase() + entry.rarity.slice(1),
    entry.equipped && 'Equipped',
    quantity > 1 && `×${quantity}`,
  ]
    .filter(Boolean)
    .join(' · ');

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
      className="border-divider bg-surface focus-visible:outline-ring relative flex min-h-16 flex-col items-start justify-between gap-1 rounded-md border p-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {!isUsable && (
        <Star
          aria-hidden="true"
          className={cn(
            'absolute top-1.5 right-1.5 size-3.5',
            pinned ? 'text-brass-text fill-current' : 'text-muted'
          )}
        />
      )}
      <span className="type-small text-heading pr-4 break-words">
        {entry.name}
      </span>
      {caption && <span className="type-caption text-muted">{caption}</span>}
    </button>
  );
}

/** Grid tiles for the Inventory tab's grid view. */
export function InventoryGrid({ groups, addToast }: InventoryGridProps) {
  return (
    <div className="space-y-6">
      {groups.map(group => (
        <Section
          key={group.key}
          level={4}
          heading={`${group.label} (${group.entries.length})`}
        >
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {group.entries.map(entry => (
              <InventoryGridTile
                key={entry.id}
                entry={entry}
                addToast={addToast}
              />
            ))}
          </div>
        </Section>
      ))}
    </div>
  );
}
