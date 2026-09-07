import { describe, it, expect } from 'vitest';

import {
  buildPublicShop,
  buildShopLedger,
  sanitizePublicShop,
} from '@/lib/shopProjection';
import type { CampaignNPC, NPCInventoryItem } from '@/types/encounter';
import type { PublicShop, PublicShopItem } from '@/types/shop';
import type { MagicItem } from '@/types/character';

function makeNpc(overrides: Partial<CampaignNPC> = {}): CampaignNPC {
  return {
    id: 'npc-1',
    campaignCode: 'ABCD',
    name: 'Merchant Mo',
    armorClass: '10',
    maxHp: 10,
    speed: '30 ft',
    inventory: [],
    shop: { open: true, updatedAt: '2026-01-01T00:00:00.000Z' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeItem(overrides: Partial<NPCInventoryItem> = {}): NPCInventoryItem {
  return { id: 'item-1', name: 'Test Item', quantity: 1, ...overrides };
}

function makeMagicItem(overrides: Partial<MagicItem> = {}): MagicItem {
  return {
    id: 'magic-1',
    name: 'Ring of Secrets',
    category: 'ring',
    rarity: 'rare',
    description: 'DM-only mechanical text: grants advantage on X.',
    properties: ['grants advantage on X'],
    requiresAttunement: true,
    isAttuned: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildPublicShop', () => {
  it('drops a row that is not flagged for sale', () => {
    const npc = makeNpc({
      inventory: [makeItem({ forSale: false, value: 500 })],
    });
    const shop = buildPublicShop(npc, ['entity-1']);
    expect(shop).not.toBeNull();
    expect(shop!.items).toHaveLength(0);
  });

  it('drops a row flagged for sale but unpriceable (forSale/priceability are independent)', () => {
    const npc = makeNpc({
      inventory: [makeItem({ forSale: true })], // no priceCopper, no value, no rarity
    });
    const shop = buildPublicShop(npc, ['entity-1']);
    expect(shop).not.toBeNull();
    expect(shop!.items).toHaveLength(0);
  });

  it('includes a row that is both flagged for sale and priceable', () => {
    const npc = makeNpc({
      inventory: [
        makeItem({ forSale: true, value: 250, quantity: 3 }),
        makeItem({ id: 'item-2', forSale: true, priceCopper: 0 }), // free item is a legitimate price
      ],
    });
    const shop = buildPublicShop(npc, ['entity-1']);
    expect(shop!.items).toHaveLength(2);
    expect(shop!.items[0]).toMatchObject({
      id: 'item-1',
      priceCopper: 250,
      remainingQuantity: 3,
      itemKind: 'inventory',
    });
    expect(shop!.items[1].priceCopper).toBe(0);
  });

  it('projects null for a closed shop', () => {
    const npc = makeNpc({
      shop: { open: false, updatedAt: '2026-01-01T00:00:00.000Z' },
      inventory: [makeItem({ forSale: true, value: 100 })],
    });
    expect(buildPublicShop(npc, [])).toBeNull();
  });

  it('projects null when the NPC has no shop at all', () => {
    const npc = makeNpc({ shop: undefined });
    expect(buildPublicShop(npc, [])).toBeNull();
  });

  it('carries entityIds through untouched', () => {
    const npc = makeNpc({ inventory: [] });
    const shop = buildPublicShop(npc, ['e1', 'e2']);
    expect(shop!.entityIds).toEqual(['e1', 'e2']);
  });

  it('security: a row carrying a full magicItem projects no item key and no DM-only field', () => {
    const magicItem = makeMagicItem();
    const npc = makeNpc({
      inventory: [
        makeItem({
          id: 'item-magic',
          name: 'Ring of Secrets',
          forSale: true,
          magicItem,
          // DM-only authoring fields that must never reach the player:
          equipped: true,
          type: 'ring',
          category: 'magic item',
        }),
      ],
    });
    const shop = buildPublicShop(npc, []);
    expect(shop!.items).toHaveLength(1);
    const publicItem = shop!.items[0];

    expect('item' in publicItem).toBe(false);
    expect('magicItem' in publicItem).toBe(false);
    expect('equipped' in publicItem).toBe(false);
    expect(Object.keys(publicItem).sort()).toEqual(
      ['id', 'itemKind', 'name', 'priceCopper', 'remainingQuantity']
        .concat('rarity' in publicItem ? ['rarity'] : [])
        .sort()
    );
    expect(publicItem.itemKind).toBe('magic');
  });
});

describe('PublicShopItem — item is structurally unassignable (type-level)', () => {
  it('rejects an item value at compile time; the identical shape minus item type-checks cleanly (positive control)', () => {
    const smuggled: PublicShopItem = {
      id: 'item-1',
      name: 'Ring of Secrets',
      itemKind: 'magic',
      priceCopper: 5000,
      remainingQuantity: 1,
      // @ts-expect-error PublicShopItem.item is `never` — a DM-side
      // NPCInventoryItem's full magicItem/InventoryItem definition must
      // never type-check onto the public shop projection. If a future edit
      // widens `item` back to an optional type, this directive stops being
      // an error and `npm run type-check` fails with "Unused
      // '@ts-expect-error' directive" — a loud, build-breaking signal
      // rather than a silent regression.
      item: { id: 'x', name: 'Y' },
    };
    expect(smuggled).toBeDefined();

    // Positive control: proves the assignment above fails BECAUSE of
    // `item`, not for some unrelated reason (e.g. a missing required field).
    const clean: PublicShopItem = {
      id: 'item-1',
      name: 'Ring of Secrets',
      itemKind: 'magic',
      priceCopper: 5000,
      remainingQuantity: 1,
    };
    expect(clean).toBeDefined();
  });
});

describe('buildShopLedger', () => {
  it('applies the same forSale + priceable inclusion rule as buildPublicShop', () => {
    const npc = makeNpc({
      inventory: [
        makeItem({ id: 'a', forSale: false, value: 10 }),
        makeItem({ id: 'b', forSale: true }),
        makeItem({ id: 'c', forSale: true, value: 40 }),
      ],
    });
    const ledger = buildShopLedger(npc);
    expect(ledger.map(entry => entry.id)).toEqual(['c']);
  });

  it('carries the full magicItem definition for a magic-kind row', () => {
    const magicItem = makeMagicItem();
    const npc = makeNpc({
      inventory: [
        makeItem({ id: 'ring', forSale: true, magicItem, priceCopper: 5000 }),
      ],
    });
    const [entry] = buildShopLedger(npc);
    expect(entry.item).toEqual(magicItem);
    expect(entry.item).not.toBe(magicItem); // cloned, not aliased
  });

  it('reconstructs a valid InventoryItem for a plain inventory-kind row', () => {
    const npc = makeNpc({
      inventory: [
        makeItem({
          id: 'sword',
          name: 'Longsword',
          forSale: true,
          value: 1500,
          quantity: 2,
          category: 'weapon',
        }),
      ],
    });
    const [entry] = buildShopLedger(npc);
    expect(entry.itemKind).toBe('inventory');
    expect(entry.item).toMatchObject({
      id: 'sword',
      name: 'Longsword',
      category: 'weapon',
      quantity: 2,
      tags: [],
    });
  });
});

describe('sanitizePublicShop', () => {
  const valid: PublicShop = {
    npcId: 'npc-1',
    merchantName: 'Merchant Mo',
    entityIds: ['entity-1'],
    items: [
      {
        id: 'item-1',
        name: 'Rope',
        itemKind: 'inventory',
        priceCopper: 100,
        remainingQuantity: 5,
      },
    ],
  };

  it('accepts a well-formed PublicShop', () => {
    expect(sanitizePublicShop(valid)).toEqual(valid);
  });

  it('rejects non-object input', () => {
    expect(sanitizePublicShop(null)).toBeNull();
    expect(sanitizePublicShop('shop')).toBeNull();
    expect(sanitizePublicShop(42)).toBeNull();
  });

  it('rejects a missing/invalid npcId', () => {
    expect(sanitizePublicShop({ ...valid, npcId: '' })).toBeNull();
    expect(sanitizePublicShop({ ...valid, npcId: undefined })).toBeNull();
  });

  it('rejects a non-array items field', () => {
    expect(sanitizePublicShop({ ...valid, items: 'nope' })).toBeNull();
  });

  it('rejects an item missing required fields', () => {
    expect(
      sanitizePublicShop({
        ...valid,
        items: [{ id: 'x', name: 'Y' }],
      })
    ).toBeNull();
  });

  it('rejects an item with a negative priceCopper or non-integer priceCopper', () => {
    expect(
      sanitizePublicShop({
        ...valid,
        items: [{ ...valid.items[0], priceCopper: -1 }],
      })
    ).toBeNull();
    expect(
      sanitizePublicShop({
        ...valid,
        items: [{ ...valid.items[0], priceCopper: 1.5 }],
      })
    ).toBeNull();
  });

  it('rejects duplicate item ids', () => {
    expect(
      sanitizePublicShop({
        ...valid,
        items: [valid.items[0], valid.items[0]],
      })
    ).toBeNull();
  });

  it('rejects an item that smuggles an `item` field', () => {
    expect(
      sanitizePublicShop({
        ...valid,
        items: [{ ...valid.items[0], item: { id: 'x', name: 'Y' } }],
      })
    ).toBeNull();
  });

  it('drops the item field even if isPublicShopItem somehow let it through (defense in depth)', () => {
    // sanitizePublicShop re-projects field-by-field regardless, so even a
    // permissive validator upstream could not smuggle `item` through.
    const result = sanitizePublicShop(valid);
    expect(result!.items[0]).not.toHaveProperty('item');
  });
});
