import { describe, expect, it, vi } from 'vitest';

import {
  parseStoredShopLedger,
  purchaseFromShop,
  seedShopLedger,
  validateShopLedgerSeed,
} from './shopPurchases';
import type { Redis } from '@upstash/redis';

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

describe('shop ledger validation', () => {
  it('accepts bounded unique entries', () => {
    expect(validateShopLedgerSeed([entry])).toEqual([entry]);
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
    expect(validateShopLedgerSeed(value)).toBeNull();
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
    expect(validateShopLedgerSeed([magicEntry])).toEqual([magicEntry]);
  });

  it('accepts the maximum allowed priceCopper and soldQuantity', () => {
    const boundaryEntry = {
      ...entry,
      priceCopper: 100_000_000,
      soldQuantity: 1_000_000,
    };
    expect(validateShopLedgerSeed([boundaryEntry])).toEqual([boundaryEntry]);
  });

  it('defaults a missing soldQuantity to 0 (legacy ledger tolerance)', () => {
    const { soldQuantity: _soldQuantity, ...withoutSoldQuantity } = entry;
    void _soldQuantity;
    expect(validateShopLedgerSeed([withoutSoldQuantity])).toEqual([
      { ...withoutSoldQuantity, soldQuantity: 0 },
    ]);
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

describe('shop ledger atomic seed', () => {
  it('seeds through one Redis script call', async () => {
    const evalMock = vi.fn().mockResolvedValue(JSON.stringify([entry]));
    const result = await seedShopLedger(
      { eval: evalMock } as unknown as Redis,
      'ledger',
      [entry],
      60
    );
    expect(result).toEqual([entry]);
    expect(evalMock).toHaveBeenCalledOnce();
    expect(evalMock.mock.calls[0][1]).toEqual(['ledger']);
    expect(evalMock.mock.calls[0][2]).toEqual([JSON.stringify([entry]), 60]);
  });

  it('normalizes the Redis Lua empty-table encoding to an empty ledger', async () => {
    const evalMock = vi.fn().mockResolvedValue('{}');
    await expect(
      seedShopLedger({ eval: evalMock } as unknown as Redis, 'ledger', [], 60)
    ).resolves.toEqual([]);
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
