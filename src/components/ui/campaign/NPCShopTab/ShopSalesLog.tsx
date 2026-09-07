'use client';

import { useEffect } from 'react';

import { Badge } from '@/components/ui/layout/badge';
import { Card } from '@/components/ui/layout/card';
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
 * gone by drain time — see `applySaleToNpc`'s doc comment) renders an
 * "unreconciled" badge instead of the plain "· reconciled" suffix, so a sale
 * that could not be fully applied stays visible to the DM rather than only
 * ever reaching a console warning.
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
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-heading text-sm font-semibold">Sales log</h3>
        {hasSales && (
          <span className="text-muted text-xs">
            {entries.length} sale{entries.length === 1 ? '' : 's'} ·{' '}
            {formatCurrencyFromCopper(totalSalesCopper(entries))}
          </span>
        )}
      </div>

      {!hasSales ? (
        <Card padding="md" className="text-muted text-sm">
          No sales yet. Sales appear here once the shop is open, even if your
          tab was closed at the time.
        </Card>
      ) : (
        <div className="space-y-2">
          {entries.map(entry => (
            <div
              key={entry.id}
              className="border-divider bg-surface-raised flex items-center gap-3 rounded-lg border p-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-heading truncate text-sm font-semibold">
                  {entry.itemName} ×{entry.quantity}
                </p>
                <p className="text-faint flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span>
                    {directory?.nameOf(entry.playerId) ?? 'A player'} ·{' '}
                    {formatSaleTime(entry.at)}
                    {entry.reconciled ? ' · reconciled' : ''}
                  </span>
                  {!entry.reconciled && (
                    <Badge variant="warning" size="sm">
                      unreconciled
                    </Badge>
                  )}
                </p>
              </div>
              <span className="text-accent-emerald-text shrink-0 text-sm font-bold tabular-nums">
                {formatCurrencyFromCopper(entry.copper)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
