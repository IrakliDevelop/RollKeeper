'use client';

import { Badge } from '@/components/ui/layout/badge';

import type { ToastData } from '@/components/ui/feedback/Toast';

import { rarityBadgeVariant } from '../InventoryTabs.utils';
import type {
  InventoryEntryView,
  InventorySummaryView,
} from '../SheetDrawer.types';
import { FavoriteStar } from './FavoriteStar';
import { InventoryEntryControls } from './InventoryEntryControls';

export interface InventoryEntryRowProps {
  entry: InventoryEntryView;
  summary: InventorySummaryView;
  addToast: (t: Omit<ToastData, 'id'>) => void;
}

/** One weapon/armor/magic-item/gear row in the Inventory tab's list view. */
export function InventoryEntryRow({
  entry,
  summary,
  addToast,
}: InventoryEntryRowProps) {
  const { name } = entry;

  return (
    <div className="border-divider rounded-lg border p-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-heading text-sm font-semibold">{name}</span>
            {entry.rarity && entry.rarity !== 'common' && (
              <Badge variant={rarityBadgeVariant(entry.rarity)}>
                {entry.rarity}
              </Badge>
            )}
          </div>
          <div className="text-muted text-xs">
            {entry.meta}
            {entry.weightText ? ` · ${entry.weightText}` : ''}
          </div>
          {entry.attackText && (
            <div className="text-body mt-0.5 text-xs">{entry.attackText}</div>
          )}
          {entry.poolText && (
            <div className="text-muted mt-0.5 text-xs">{entry.poolText}</div>
          )}
        </div>
        <FavoriteStar kind="item" id={entry.id} name={name} />
      </div>

      <InventoryEntryControls
        entry={entry}
        summary={summary}
        addToast={addToast}
      />
    </div>
  );
}
