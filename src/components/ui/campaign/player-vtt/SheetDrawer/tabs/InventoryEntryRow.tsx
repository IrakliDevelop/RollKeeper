'use client';

import { Badge } from '@/components/ui/layout/badge';

import type { ToastData } from '@/components/ui/feedback/Toast';

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
    <li className="py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="type-ui text-heading">{name}</span>
            {entry.rarity && entry.rarity !== 'common' && (
              <Badge variant="neutral">{entry.rarity}</Badge>
            )}
          </div>
          <div className="type-small text-muted">
            {entry.meta}
            {entry.weightText ? ` · ${entry.weightText}` : ''}
          </div>
          {entry.attackText && (
            <div className="type-small text-body mt-0.5">
              {entry.attackText}
            </div>
          )}
          {entry.poolText && (
            <div className="type-small text-muted mt-0.5">{entry.poolText}</div>
          )}
        </div>
        <FavoriteStar kind="item" id={entry.id} name={name} />
      </div>

      <InventoryEntryControls
        entry={entry}
        summary={summary}
        addToast={addToast}
      />
    </li>
  );
}
