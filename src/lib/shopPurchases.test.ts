import { describe, expect, it, vi } from 'vitest';

import {
  INVALID_SHOP_LEDGER_SEED_ERROR,
  isValidShopSale,
  MAX_SALES_LOG_ENTRIES,
  parseStoredShopLedger,
  parseStoredShopSales,
  purchaseFromShop,
  seedShopLedger,
  SHOP_LEDGER_SEED_TOO_LARGE_ERROR,
  validateShopLedgerSeed,
  validateStoredShopLedger,
} from './shopPurchases';
import type { ShopSale } from '@/types/shop';
import type { Redis } from '@upstash/redis';

/** The STORED ledger shape (`ShopLedgerEntry`) — what Redis holds and what
 *  `parseStoredShopLedger`/`validateStoredShopLedger` accept. Never valid
 *  input to `seedShopLedger` (ruling R6) — see `seedEntry` below for that. */
const entry = {
  id: 'entry-1',
  name: 'Rope, 50ft',
  itemKind: 'inventory' as const,
  priceCopper: 100,
  remainingQuantity: 3,
  soldQuantity: 0,
  item: {
    id: 'item-1',
    name: 'Rope, 50ft',
    category: 'tool',
    quantity: 1,
    location: 'Backpack',
    tags: [],
    createdAt: '2026-08-12T00:00:00Z',
    updatedAt: '2026-08-12T00:00:00Z',
  },
};

/** The SEED shape (`ShopLedgerSeed`) — `buildShopLedger`'s output and the
 *  only shape `seedShopLedger`/`validateShopLedgerSeed` accept. Has
 *  `seededQuantity` where the stored shape has `remainingQuantity`, and
 *  carries no `soldQuantity` at all. */
const seedEntry = {
  id: 'entry-1',
  name: 'Rope, 50ft',
  itemKind: 'inventory' as const,
  priceCopper: 100,
  seededQuantity: 3,
  item: entry.item,
};

describe('validateStoredShopLedger (the shape read back from Redis)', () => {
  it('accepts bounded unique entries', () => {
    expect(validateStoredShopLedger([entry])).toEqual([entry]);
  });

  it.each([
    { value: [{ ...entry, priceCopper: -1 }] },
    { value: [{ ...entry, priceCopper: 1.5 }] },
    { value: [{ ...entry, priceCopper: 100_000_001 }] },
    { value: [{ ...entry, remainingQuantity: -1 }] },
    { value: [{ ...entry, remainingQuantity: 1000 }] },
    { value: [{ ...entry, soldQuantity: -1 }] },
    { value: [{ ...entry, soldQuantity: 1.5 }] },
    { value: [{ ...entry, soldQuantity: 1_000_001 }] },
    { value: [entry, entry] },
    { value: [{ ...entry, item: { ...entry.item, name: '' } }] },
    { value: [{ ...entry, itemKind: 'weapon' }] },
    { value: [{ ...entry, id: '' }] },
    { value: 'not-an-array' },
  ])('rejects invalid or duplicate entries', ({ value }) => {
    expect(validateStoredShopLedger(value)).toBeNull();
  });

  it('accepts a magic-item entry with description and rarity', () => {
    const magicEntry = {
      ...entry,
      id: 'entry-2',
      itemKind: 'magic' as const,
      description: 'A ring of protection',
      rarity: 'rare',
      item: {
        ...entry.item,
        name: 'Ring of Protection',
      },
    };
    expect(validateStoredShopLedger([magicEntry])).toEqual([magicEntry]);
  });

  it('accepts the maximum allowed priceCopper and soldQuantity', () => {
    const boundaryEntry = {
      ...entry,
      priceCopper: 100_000_000,
      soldQuantity: 1_000_000,
    };
    expect(validateStoredShopLedger([boundaryEntry])).toEqual([boundaryEntry]);
  });

  it('defaults a missing soldQuantity to 0 (legacy ledger tolerance)', () => {
    const { soldQuantity: _soldQuantity, ...withoutSoldQuantity } = entry;
    void _soldQuantity;
    expect(validateStoredShopLedger([withoutSoldQuantity])).toEqual([
      { ...withoutSoldQuantity, soldQuantity: 0 },
    ]);
  });
});

describe('validateShopLedgerSeed (the DM-authored input to seedShopLedger)', () => {
  it('accepts bounded unique seed entries', () => {
    expect(validateShopLedgerSeed([seedEntry])).toEqual([seedEntry]);
  });

  it.each([
    { value: [{ ...seedEntry, priceCopper: -1 }] },
    { value: [{ ...seedEntry, priceCopper: 1.5 }] },
    { value: [{ ...seedEntry, priceCopper: 100_000_001 }] },
    { value: [{ ...seedEntry, seededQuantity: -1 }] },
    { value: [{ ...seedEntry, seededQuantity: 1000 }] },
    { value: [seedEntry, seedEntry] },
    { value: [{ ...seedEntry, item: { ...seedEntry.item, name: '' } }] },
    { value: [{ ...seedEntry, itemKind: 'weapon' }] },
    { value: [{ ...seedEntry, id: '' }] },
    { value: 'not-an-array' },
  ])('rejects invalid or duplicate seed entries', ({ value }) => {
    expect(validateShopLedgerSeed(value)).toBeNull();
  });

  it('accepts a magic-item seed entry with description and rarity', () => {
    const magicSeed = {
      ...seedEntry,
      id: 'entry-2',
      itemKind: 'magic' as const,
      description: 'A ring of protection',
      rarity: 'rare',
      item: {
        ...seedEntry.item,
        name: 'Ring of Protection',
      },
    };
    expect(validateShopLedgerSeed([magicSeed])).toEqual([magicSeed]);
  });

  it('accepts the maximum allowed priceCopper and seededQuantity', () => {
    const boundarySeed = {
      ...seedEntry,
      priceCopper: 100_000_000,
      seededQuantity: 999,
    };
    expect(validateShopLedgerSeed([boundarySeed])).toEqual([boundarySeed]);
  });

  // The type-level guarantee (ruling R6) made concrete at runtime: the
  // STORED shape (remainingQuantity/soldQuantity) must never validate as a
  // seed, even though `validateShopLedgerSeed` accepts `unknown` and cannot
  // rely on the compiler to keep the two shapes apart at this boundary.
  it('rejects the stored ledger shape outright — the round-trip hazard the type split exists to prevent', () => {
    expect(validateShopLedgerSeed([entry])).toBeNull();
  });

  it('rejects a seed entry that smuggles a soldQuantity field', () => {
    expect(
      validateShopLedgerSeed([{ ...seedEntry, soldQuantity: 0 }])
    ).toBeNull();
  });
});

describe('parseStoredShopLedger', () => {
  it('returns an empty ledger for a null/absent value', () => {
    expect(parseStoredShopLedger(null)).toEqual([]);
  });

  it('normalizes the Redis Lua empty-table encoding to an empty ledger', () => {
    expect(parseStoredShopLedger('{}')).toEqual([]);
  });

  it('parses a well-formed stored ledger', () => {
    expect(parseStoredShopLedger(JSON.stringify([entry]))).toEqual([entry]);
  });

  it('throws on a malformed stored ledger rather than silently dropping it', () => {
    expect(() =>
      parseStoredShopLedger(JSON.stringify([{ ...entry, priceCopper: -1 }]))
    ).toThrow('Invalid shop ledger');
  });
});

const sale: ShopSale = {
  id: 'sale-req-1',
  entryId: 'entry-1',
  quantity: 2,
  copper: 200,
  playerId: 'player-1',
  at: '2026-09-07T00:00:00Z',
};

describe('isValidShopSale', () => {
  it('accepts a well-formed sale', () => {
    expect(isValidShopSale(sale)).toBe(true);
  });

  it.each([
    ['id', { ...sale, id: '' }],
    ['entryId', { ...sale, entryId: 42 }],
    ['quantity is zero', { ...sale, quantity: 0 }],
    ['quantity is fractional', { ...sale, quantity: 1.5 }],
    ['copper is negative', { ...sale, copper: -1 }],
    ['copper is fractional', { ...sale, copper: 1.5 }],
    ['playerId', { ...sale, playerId: '' }],
    ['at is empty', { ...sale, at: '' }],
    ['at is missing', { ...sale, at: undefined }],
  ])('rejects a malformed sale: %s', (_label, malformed) => {
    expect(isValidShopSale(malformed)).toBe(false);
  });

  it('rejects a non-object value', () => {
    expect(isValidShopSale(null)).toBe(false);
    expect(isValidShopSale('sale-req-1')).toBe(false);
    expect(isValidShopSale(undefined)).toBe(false);
  });
});

describe('parseStoredShopSales', () => {
  it('returns an empty log for a null/absent value', () => {
    expect(parseStoredShopSales(null)).toEqual([]);
  });

  it('normalizes the Redis Lua empty-table encoding to an empty log', () => {
    expect(parseStoredShopSales('{}')).toEqual([]);
  });

  it('parses a well-formed stored sales log', () => {
    expect(parseStoredShopSales(JSON.stringify([sale]))).toEqual([sale]);
  });

  it('drops only the malformed row, not the whole log — a sale is a fact', () => {
    const malformed = { ...sale, id: 'sale-req-2', copper: -1 };
    const valid = { ...sale, id: 'sale-req-3' };
    const result = parseStoredShopSales(
      JSON.stringify([sale, malformed, valid])
    );
    expect(result).toEqual([sale, valid]);
  });

  it('returns an empty log for a non-array root value rather than throwing', () => {
    expect(parseStoredShopSales('{"not":"an array"}')).toEqual([]);
  });

  it('truncates an oversized log to the most recent MAX_SALES_LOG_ENTRIES rows', () => {
    const rows: ShopSale[] = Array.from(
      { length: MAX_SALES_LOG_ENTRIES + 5 },
      (_, i) => ({ ...sale, id: `sale-req-${i}` })
    );
    const result = parseStoredShopSales(JSON.stringify(rows));
    expect(result).toHaveLength(MAX_SALES_LOG_ENTRIES);
    expect(result[0].id).toBe('sale-req-5');
    expect(result[result.length - 1].id).toBe(
      `sale-req-${MAX_SALES_LOG_ENTRIES + 4}`
    );
  });
});

describe('shop ledger atomic seed', () => {
  it('seeds through one Redis script call', async () => {
    const evalMock = vi.fn().mockResolvedValue(JSON.stringify([entry]));
    const result = await seedShopLedger(
      { eval: evalMock } as unknown as Redis,
      'ledger',
      [seedEntry],
      60
    );
    expect(result).toEqual([entry]);
    expect(evalMock).toHaveBeenCalledOnce();
    expect(evalMock.mock.calls[0][1]).toEqual(['ledger']);
    expect(evalMock.mock.calls[0][2]).toEqual([
      JSON.stringify([seedEntry]),
      60,
    ]);
  });

  it('normalizes the Redis Lua empty-table encoding to an empty ledger', async () => {
    const evalMock = vi.fn().mockResolvedValue('{}');
    await expect(
      seedShopLedger({ eval: evalMock } as unknown as Redis, 'ledger', [], 60)
    ).resolves.toEqual([]);
  });

  // Binding requirement (Task 5 review of Task 3, Critical): validate the
  // seed BEFORE the write, not just the script's return value. An
  // out-of-bounds entry must never reach `EVAL` — proven here by asserting
  // the mock (standing in for the Redis write) is never called.
  it('rejects an out-of-bounds seed entry before calling EVAL — nothing is written', async () => {
    const evalMock = vi.fn();
    const overPriced = { ...seedEntry, priceCopper: 100_000_001 };
    await expect(
      seedShopLedger(
        { eval: evalMock } as unknown as Redis,
        'ledger',
        [overPriced],
        60
      )
    ).rejects.toThrow(INVALID_SHOP_LEDGER_SEED_ERROR);
    expect(evalMock).not.toHaveBeenCalled();
  });

  it('rejects the stored ledger shape as seed input before calling EVAL (ruling R6 at runtime)', async () => {
    const evalMock = vi.fn();
    await expect(
      seedShopLedger(
        { eval: evalMock } as unknown as Redis,
        'ledger',
        // @ts-expect-error ShopLedgerEntry is not assignable to
        // ShopLedgerSeed — this is the type-level guarantee ruling R6
        // exists to provide. Cast through `unknown` is not used here on
        // purpose: the compile error itself is part of what this test
        // documents, alongside the runtime rejection below.
        [entry],
        60
      )
    ).rejects.toThrow(INVALID_SHOP_LEDGER_SEED_ERROR);
    expect(evalMock).not.toHaveBeenCalled();
  });

  // A too-large seed gets a message distinguishable from "a row is
  // malformed" (INVALID_SHOP_LEDGER_SEED_ERROR) — a DM with >500 for-sale
  // rows should see something diagnosable, not an opaque "invalid" 400.
  it('rejects a seed exceeding MAX_LEDGER_ENTRIES with a distinguishable message, before calling EVAL', async () => {
    const evalMock = vi.fn();
    const tooMany = Array.from({ length: 501 }, (_, i) => ({
      ...seedEntry,
      id: `entry-${i}`,
    }));
    await expect(
      seedShopLedger(
        { eval: evalMock } as unknown as Redis,
        'ledger',
        tooMany,
        60
      )
    ).rejects.toThrow(SHOP_LEDGER_SEED_TOO_LARGE_ERROR);
    expect(evalMock).not.toHaveBeenCalled();
  });
});

describe('purchaseFromShop', () => {
  const keys = {
    ledger: 'ledger',
    transfers: 'transfers',
    sales: 'sales',
    receipt: 'receipt',
  };
  const input = {
    npcId: 'npc-1',
    entryId: 'entry-1',
    playerId: 'player-1',
    requestId: 'request-1',
    merchantName: 'Old Tam',
    quantity: 2,
    now: '2026-09-07T00:00:00.000Z',
  };

  // NOTE: with redis.eval mocked, this wrapper cannot distinguish a reply
  // that came from a fresh purchase from one replayed by the receipt-first
  // check in PURCHASE_SCRIPT — both arrive as the identical JSON shape. This
  // test only proves the wrapper stamps npcId onto whatever ShopPurchaseReceipt
  // shape it receives. The actual replay guarantee (a second call with the
  // same requestId short-circuits before mutating the ledger/queue/sales and
  // returns byte-identical output) is Task 4's real-Redis harness's claim to
  // make, not this file's.
  it('returns a successful receipt and stamps the caller-supplied npcId', async () => {
    const receiptFromScript = {
      requestId: 'request-1',
      entryId: 'entry-1',
      playerId: 'player-1',
      grantedQuantity: 2,
      costCopper: 200,
      remainingQuantity: 1,
      transferIds: ['transfer-shop-request-1-0'],
    };
    const evalMock = vi
      .fn()
      .mockResolvedValue(JSON.stringify(receiptFromScript));
    const result = await purchaseFromShop(
      { eval: evalMock } as unknown as Redis,
      keys,
      input,
      60
    );
    expect(result).toEqual({
      ok: true,
      receipt: { npcId: 'npc-1', ...receiptFromScript },
    });
  });

  it('forwards KEYS in ledger/transfers/sales/receipt order and ARGV in the documented order', async () => {
    const evalMock = vi.fn().mockResolvedValue(
      JSON.stringify({
        requestId: 'request-1',
        entryId: 'entry-1',
        playerId: 'player-1',
        grantedQuantity: 2,
        costCopper: 200,
        remainingQuantity: 1,
        transferIds: ['transfer-shop-request-1-0'],
      })
    );
    await purchaseFromShop(
      { eval: evalMock } as unknown as Redis,
      keys,
      input,
      60
    );
    expect(evalMock.mock.calls[0][1]).toEqual([
      'ledger',
      'transfers',
      'sales',
      'receipt',
    ]);
    expect(evalMock.mock.calls[0][2]).toEqual([
      'entry-1',
      'request-1',
      'player-1',
      2,
      '2026-09-07T00:00:00.000Z',
      60,
      'Old Tam',
    ]);
  });

  it('never forwards a price/cost as an ARGV, even when the caller-supplied input carries one', async () => {
    const evalMock = vi.fn().mockResolvedValue(
      JSON.stringify({
        requestId: 'request-1',
        entryId: 'entry-1',
        playerId: 'player-1',
        grantedQuantity: 2,
        costCopper: 200,
        remainingQuantity: 1,
        transferIds: ['transfer-shop-request-1-0'],
      })
    );
    // A distinctive, otherwise-impossible-to-coincidentally-match value: if
    // the wrapper ever forwarded a "costCopper"-shaped field from the input
    // object, this exact number would show up in the ARGV array below.
    const forgedInput = { ...input, costCopper: 424_242 } as typeof input & {
      costCopper: number;
    };
    await purchaseFromShop(
      { eval: evalMock } as unknown as Redis,
      keys,
      forgedInput,
      60
    );
    // The ARGV array is exactly the seven documented fields — nothing more,
    // nothing forged — regardless of extra properties on the input object.
    expect(evalMock.mock.calls[0][2]).toEqual([
      'entry-1',
      'request-1',
      'player-1',
      2,
      '2026-09-07T00:00:00.000Z',
      60,
      'Old Tam',
    ]);
  });

  it.each([
    ['shop-closed'] as const,
    ['entry-not-found'] as const,
    ['insufficient-stock'] as const,
  ])('maps the %s error verbatim', async error => {
    const evalMock = vi.fn().mockResolvedValue(JSON.stringify({ error }));
    const result = await purchaseFromShop(
      { eval: evalMock } as unknown as Redis,
      keys,
      input,
      60
    );
    expect(result).toEqual({ ok: false, error });
  });
});
