'use client';

import { useEffect } from 'react';

import { Badge } from '@/components/ui/layout/badge';
import { Section } from '@/components/ui/layout/section';
import { formatCurrencyFromCopper } from '@/utils/currency';
import { usePlayerDirectory } from '../location-map/usePlayerDirectory';
import { totalSalesCopper } from './NPCShopTab.utils';
import type { ShopSaleLogEntry } from '@/types/shop';

interface ShopSalesLogProps {
  campaignCode: string;
  entries: ShopSaleLogEntry[];
}

function formatSaleTime(at: string): string {
  return new Date(at).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * The Shop tab's "Sales log" section (artboard 1a's open-with-sales state,
 * VTT merchants Slice 3, Task 13b) — a running summary ("N sale(s) · X gp")
 * plus one row per recorded sale (`useDmShopSalesSync`'s `applySaleToNpc`,
 * read here via `NPCShopTab.hooks.ts`'s `useShopSalesLog`). The empty-state
 * copy ("No sales yet...") is unchanged from Slice 2/13a — only the
 * populated case is new.
 *
 * A `reconciled: false` entry (its inventory row, or the NPC itself, was
 * gone by drain time — see `applySaleToNpc`'s doc comment) renders a "Not
 * matched to stock" badge, so a sale that could not be fully applied stays
 * visible to the DM rather than only ever reaching a console warning.
 * Reconciled entries carry no marker.
 *
 * Buyer names are resolved via the DM-only player directory
 * (`usePlayerDirectory`, `location-map/`), keyed by `ShopSale.playerId`
 * (== the purchasing character's id — see `PlayerBattleMapCanvas.tsx`'s
 * `playerId={characterId}`), never a name carried on the sale itself: a
 * later character rename should still show up here, unlike `itemName`,
 * which is deliberately frozen at sale time (see `ShopSaleLogEntry`'s doc
 * comment in `types/shop.ts`).
 */
export function ShopSalesLog({ campaignCode, entries }: ShopSalesLogProps) {
  const hasSales = entries.length > 0;
  const { directory, ensureKnown } = usePlayerDirectory(campaignCode, hasSales);

  useEffect(() => {
    if (hasSales) ensureKnown(entries.map(entry => entry.playerId));
  }, [entries, ensureKnown, hasSales]);

  return (
    <Section
      level={3}
      heading="Sales log"
      trailing={
        hasSales ? (
          <span className="type-small text-muted tabular-nums">
            {entries.length} sale{entries.length === 1 ? '' : 's'} ·{' '}
            {formatCurrencyFromCopper(totalSalesCopper(entries))}
          </span>
        ) : undefined
      }
    >
      {!hasSales ? (
        <p className="type-body text-muted">
          No sales yet. Sales appear here once the shop is open, even if your
          tab was closed at the time.
        </p>
      ) : (
        <ul className="divide-divider divide-y">
          {entries.map(entry => (
            <li
              key={entry.id}
              className="flex items-start justify-between gap-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="type-ui text-heading break-words">
                  {entry.itemName} ×{entry.quantity}
                </p>
                <p className="type-small text-muted flex flex-wrap items-center gap-1.5">
                  <span>
                    {directory?.nameOf(entry.playerId) ?? 'A player'} ·{' '}
                    {formatSaleTime(entry.at)}
                  </span>
                  {!entry.reconciled && (
                    <Badge variant="warning" size="sm">
                      Not matched to stock
                    </Badge>
                  )}
                </p>
              </div>
              <span className="type-ui text-heading shrink-0 tabular-nums">
                {formatCurrencyFromCopper(entry.copper)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
