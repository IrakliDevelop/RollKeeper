'use client';

import { useEffect, useState } from 'react';

import { Dialog, DialogContent } from '@/components/ui/feedback/dialog';
import type { PublicShopItem } from '@/types/shop';
import { PlayerShopHeader } from './PlayerShopHeader';
import { PlayerShopFooter } from './PlayerShopFooter';
import { ShopItemList } from './ShopItemList';
import { useShopData, usePurchase } from './PlayerShopDialog.hooks';
import { resolveShopPreview } from './PlayerShopDialog.utils';
import type { PlayerShopDialogProps } from './PlayerShopDialog.types';

/**
 * Player-facing shop dialog (artboard 1b, VTT merchants Slice 3 Task 10) —
 * the surface where a player actually spends money. Fetches the merchant's
 * public shop, renders one card per item, and drives purchases. Does NOT
 * decide how it gets opened — the token tap that triggers it is a later
 * task; every prop it needs is on `PlayerShopDialogProps`.
 *
 * A completed purchase's actual coin debit is applied later, client-side,
 * when the granting transfer merges (`useItemTransferAutoMerge`) — this
 * dialog only patches the purchased row's `remainingQuantity` locally (from
 * the receipt) and previews the balance change; it never mutates
 * `character.currency` itself.
 */
export function PlayerShopDialog({
  open,
  onOpenChange,
  campaignCode,
  npcId,
  playerId,
  merchantAvatarUrl,
  merchantDescription,
  purse,
}: PlayerShopDialogProps) {
  const { shop, loading, error, setShop } = useShopData(
    campaignCode,
    npcId,
    open
  );
  const { purchase, purchasingEntryId } = usePurchase(
    campaignCode,
    npcId,
    playerId
  );
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [results, setResults] = useState<
    Record<string, { message: string; tone: 'success' | 'error' }>
  >({});
  const [focusedEntryId, setFocusedEntryId] = useState<string | null>(null);

  // Fresh dialog session each time it's reopened — a stale quantity/result
  // from a previous visit to this merchant must never leak into the next.
  useEffect(() => {
    if (!open) {
      setQuantities({});
      setResults({});
      setFocusedEntryId(null);
    }
  }, [open]);

  const handleQuantityChange = (entryId: string, quantity: number) => {
    setQuantities(prev => ({ ...prev, [entryId]: quantity }));
    setResults(prev => {
      if (!(entryId in prev)) return prev;
      const next = { ...prev };
      delete next[entryId];
      return next;
    });
    setFocusedEntryId(entryId);
  };

  const handleBuy = async (item: PublicShopItem) => {
    const quantity = quantities[item.id] ?? 1;
    const outcome = await purchase(item.id, quantity);
    setResults(prev => ({
      ...prev,
      [item.id]: {
        message: outcome.message,
        tone: outcome.ok ? 'success' : 'error',
      },
    }));
    if (outcome.ok) {
      setShop(prevShop =>
        prevShop
          ? {
              ...prevShop,
              items: prevShop.items.map(existing =>
                existing.id === item.id
                  ? {
                      ...existing,
                      remainingQuantity:
                        outcome.remainingQuantity ?? existing.remainingQuantity,
                    }
                  : existing
              ),
            }
          : prevShop
      );
    }
  };

  const preview = resolveShopPreview(shop, focusedEntryId, quantities, purse);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" className="gap-5">
        <PlayerShopHeader
          merchantName={shop?.merchantName ?? 'Merchant'}
          merchantDescription={merchantDescription}
          merchantAvatarUrl={merchantAvatarUrl}
        />

        {loading && <p className="text-muted text-sm">Loading the shop…</p>}
        {!loading && error && (
          <p className="text-accent-red-text text-sm">{error}</p>
        )}
        {!loading && !error && !shop && (
          <p className="text-muted text-sm">
            This merchant isn&apos;t trading right now.
          </p>
        )}

        {shop && (
          <>
            <ShopItemList
              items={shop.items}
              purse={purse}
              quantities={quantities}
              purchasingEntryId={purchasingEntryId}
              results={results}
              onQuantityChange={handleQuantityChange}
              onBuy={handleBuy}
            />

            <PlayerShopFooter
              purse={purse}
              previewLabel={preview?.label ?? null}
              previewCostCopper={preview?.costCopper ?? 0}
              after={preview?.after ?? null}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
