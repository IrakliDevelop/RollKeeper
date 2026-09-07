import { describe, it, expect } from 'vitest';

import type { InventoryItem } from '../character';
import type { ItemTransfer } from '../sharedState';
import type {
  PublicShop,
  PublicShopItem,
  ShopLedgerEntry,
  ShopLedgerSeed,
  ShopSale,
} from '../shop';

const sampleItem: InventoryItem = {
  id: 'item-1',
  name: 'Rope, 50ft',
  category: 'misc',
  quantity: 1,
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('PublicShop / PublicShopItem shape', () => {
  it('constructs a well-formed PublicShop', () => {
    const shop: PublicShop = {
      npcId: 'npc-1',
      merchantName: 'Old Tam',
      entityIds: ['entity-1'],
      items: [
        {
          id: 'entry-1',
          name: 'Rope, 50ft',
          itemKind: 'inventory',
          priceCopper: 100,
          remainingQuantity: 3,
        },
      ],
    };
    expect(shop.items[0].priceCopper).toBe(100);
  });

  it('rejects an `item` value at compile time; a stripped runtime shape still type-checks (positive control)', () => {
    const smuggled: PublicShopItem = {
      id: 'entry-1',
      name: 'Rope, 50ft',
      itemKind: 'inventory',
      priceCopper: 100,
      remainingQuantity: 3,
      // @ts-expect-error PublicShopItem.item is `never` — the full item
      // definition (and any DM-only fields riding on it, e.g. a magic
      // item's mechanical text) must never type-check onto the public
      // projection. If a future edit widens `item` back to an optional
      // type, this directive stops being an error and `npm run type-check`
      // fails with "Unused '@ts-expect-error' directive" — a loud,
      // build-breaking signal rather than a silent regression. See
      // src/types/shop.ts's `item?: never` doc comment and
      // PublicMarkerDetail.dmNotes for the identical precedent.
      item: sampleItem,
    };
    expect(smuggled).toBeDefined();

    // Positive control: proves the assignment above fails BECAUSE of
    // `item`, not for some unrelated reason — the identical object minus
    // `item` type-checks cleanly.
    const clean: PublicShopItem = {
      id: 'entry-1',
      name: 'Rope, 50ft',
      itemKind: 'inventory',
      priceCopper: 100,
      remainingQuantity: 3,
    };
    expect(clean).toBeDefined();
  });
});

describe('ShopLedgerEntry shape', () => {
  it('carries the full item alongside the public fields', () => {
    const entry: ShopLedgerEntry = {
      id: 'entry-1',
      name: sampleItem.name,
      itemKind: 'inventory',
      priceCopper: 100,
      remainingQuantity: 3,
      soldQuantity: 0,
      item: sampleItem,
    };
    expect(entry.item).toBe(sampleItem);
  });
});

describe('ShopLedgerSeed vs ShopLedgerEntry (ruling R6 — type-level)', () => {
  it('a stored ShopLedgerEntry does not type-check as a ShopLedgerSeed; the seed shape type-checks cleanly (positive control)', () => {
    const stored: ShopLedgerEntry = {
      id: 'entry-1',
      name: sampleItem.name,
      itemKind: 'inventory',
      priceCopper: 100,
      remainingQuantity: 3,
      soldQuantity: 1,
      item: sampleItem,
    };

    // @ts-expect-error ShopLedgerSeed has no `remainingQuantity`/
    // `soldQuantity` and REQUIRES `seededQuantity` — a stored ledger row
    // (this is exactly `parseStoredShopLedger`'s return element shape) must
    // never type-check as seed input to `seedShopLedger`. This is the
    // compile-time half of ruling R6: feeding a stored ledger back into
    // seedShopLedger(redis, key, await parseStoredShopLedger(raw)) silently
    // eroded stock before this type existed. If a future edit widens
    // `ShopLedgerSeed` back to accept this shape, this directive stops
    // being an error and `npm run type-check` fails with "Unused
    // '@ts-expect-error' directive".
    const smuggled: ShopLedgerSeed = stored;
    expect(smuggled).toBeDefined();

    // Positive control: the actual seed shape — seededQuantity, no
    // soldQuantity — type-checks cleanly.
    const clean: ShopLedgerSeed = {
      id: 'entry-1',
      name: sampleItem.name,
      itemKind: 'inventory',
      priceCopper: 100,
      seededQuantity: 3,
      item: sampleItem,
    };
    expect(clean).toBeDefined();
  });
});

describe('ItemTransfer.costCopper', () => {
  it('is optional — an existing gift/loot transfer with no cost still type-checks', () => {
    const gift: ItemTransfer = {
      id: 'transfer-1',
      item: sampleItem,
      itemKind: 'inventory',
      fromPlayerName: 'DM',
      fromCharacterName: 'Old Tam',
      fromType: 'npc',
      sentAt: '2026-01-01T00:00:00.000Z',
    };
    expect(gift.costCopper).toBeUndefined();
  });

  it('accepts an integer copper cost for a purchase-backed transfer', () => {
    const purchase: ItemTransfer = {
      id: 'transfer-2',
      item: sampleItem,
      itemKind: 'inventory',
      fromPlayerName: 'DM',
      fromCharacterName: 'Old Tam',
      fromType: 'npc',
      sentAt: '2026-01-01T00:00:00.000Z',
      costCopper: 150,
    };
    expect(purchase.costCopper).toBe(150);
  });
});

describe('ShopSale shape', () => {
  it('constructs a well-formed ShopSale', () => {
    const sale: ShopSale = {
      id: 'sale-1',
      entryId: 'entry-1',
      quantity: 2,
      copper: 200,
      playerId: 'player-1',
      at: '2026-01-01T00:00:00.000Z',
    };
    expect(sale.copper).toBe(200);
  });
});
