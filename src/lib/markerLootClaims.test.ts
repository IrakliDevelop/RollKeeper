import { describe, expect, it, vi } from 'vitest';

import {
  claimMarkerLoot,
  seedMarkerLoot,
  validateMarkerLootSeed,
} from './markerLootClaims';
import type { Redis } from '@upstash/redis';

const entry = {
  markerId: 'marker-1',
  locked: false,
  id: 'entry-1',
  itemKind: 'inventory' as const,
  item: {
    id: 'item-1',
    name: 'Rope',
    category: 'tool',
    quantity: 8,
    location: 'Backpack',
    tags: [],
    createdAt: '2026-08-12T00:00:00Z',
    updatedAt: '2026-08-12T00:00:00Z',
  },
  quantity: 2,
  claimedQuantity: 0,
};

describe('marker loot validation', () => {
  it('accepts bounded unique entries', () => {
    expect(validateMarkerLootSeed([entry])).toEqual([entry]);
  });

  it.each([
    { value: [{ ...entry, quantity: 0 }] },
    { value: [{ ...entry, claimedQuantity: 3 }] },
    { value: [entry, entry] },
    { value: [{ ...entry, item: { ...entry.item, name: '' } }] },
  ])('rejects invalid or duplicate entries', ({ value }) => {
    expect(validateMarkerLootSeed(value)).toBeNull();
  });

  it('rejects a ledger entry with a non-boolean locked flag', () => {
    expect(
      validateMarkerLootSeed([
        { ...entry, locked: 'yes' as unknown as boolean },
      ])
    ).toBeNull();
  });

  it('defaults a missing locked flag to false', () => {
    const { locked: _locked, ...withoutLocked } = entry;
    void _locked;
    expect(validateMarkerLootSeed([withoutLocked])).toEqual([
      { ...withoutLocked, locked: false },
    ]);
  });

  it('accepts a locked ledger entry', () => {
    expect(validateMarkerLootSeed([{ ...entry, locked: true }])).toEqual([
      { ...entry, locked: true },
    ]);
  });
});

describe('marker loot atomic scripts', () => {
  it('seeds through one Redis script call', async () => {
    const evalMock = vi.fn().mockResolvedValue(JSON.stringify([entry]));
    const result = await seedMarkerLoot(
      { eval: evalMock } as unknown as Redis,
      'ledger',
      [entry],
      60
    );
    expect(result).toEqual([entry]);
    expect(evalMock).toHaveBeenCalledOnce();
    expect(evalMock.mock.calls[0][1]).toEqual(['ledger']);
  });

  it('normalizes the Redis Lua empty-table encoding to an empty ledger', async () => {
    const evalMock = vi.fn().mockResolvedValue('{}');

    await expect(
      seedMarkerLoot({ eval: evalMock } as unknown as Redis, 'ledger', [], 60)
    ).resolves.toEqual([]);
  });

  it('returns the idempotent claim receipt produced by the atomic script', async () => {
    const claim = {
      requestId: 'request-1',
      markerId: 'marker-1',
      entryId: 'entry-1',
      grantedQuantity: 1,
      remainingQuantity: 1,
      transferId: 'transfer-1-0',
    };
    const evalMock = vi.fn().mockResolvedValue(JSON.stringify(claim));
    const result = await claimMarkerLoot(
      { eval: evalMock } as unknown as Redis,
      { ledger: 'ledger', transfers: 'queue', receipt: 'receipt' },
      {
        markerId: 'marker-1',
        entryId: 'entry-1',
        requestId: 'request-1',
        transferIdPrefix: 'transfer-1',
        quantity: 1,
        now: '2026-08-12T00:00:00Z',
      },
      60
    );
    expect(result).toEqual({ ok: true, claim });
    expect(evalMock.mock.calls[0][1]).toEqual(['ledger', 'queue', 'receipt']);
  });

  it('surfaces depletion without minting a transfer', async () => {
    const evalMock = vi.fn().mockResolvedValue('{"error":"depleted"}');
    await expect(
      claimMarkerLoot(
        { eval: evalMock } as unknown as Redis,
        { ledger: 'ledger', transfers: 'queue', receipt: 'receipt' },
        {
          markerId: 'marker-1',
          entryId: 'entry-1',
          requestId: 'request-2',
          transferIdPrefix: 'transfer-2',
          quantity: 1,
          now: '2026-08-12T00:00:00Z',
        },
        60
      )
    ).resolves.toEqual({ ok: false, error: 'depleted' });
  });
});

describe('claimMarkerLoot arguments and result mapping', () => {
  const keys = { ledger: 'L', transfers: 'T', receipt: 'R' };
  const input = {
    markerId: 'ref-1',
    entryId: 'loot-1',
    requestId: 'req-1',
    transferIdPrefix: 'transfer-loot-req-1',
    quantity: 3,
    now: '2026-09-06T00:00:00.000Z',
  };

  it('forwards the requested quantity and the transfer id prefix', async () => {
    const evaluate = vi.fn().mockResolvedValue(
      JSON.stringify({
        requestId: 'req-1',
        markerId: 'ref-1',
        entryId: 'loot-1',
        grantedQuantity: 3,
        remainingQuantity: 0,
        transferId: 'transfer-loot-req-1-0',
      })
    );
    const result = await claimMarkerLoot(
      { eval: evaluate } as unknown as Redis,
      keys,
      input,
      300
    );
    expect(result).toEqual({
      ok: true,
      claim: expect.objectContaining({ grantedQuantity: 3 }),
    });
    expect(evaluate.mock.calls[0][1]).toEqual(['L', 'T', 'R']);
    const argv = evaluate.mock.calls[0][2];
    expect(argv).toEqual([
      'ref-1',
      'loot-1',
      'req-1',
      'transfer-loot-req-1',
      '2026-09-06T00:00:00.000Z',
      300,
      3,
    ]);
  });

  it('maps a locked reply to the locked error', async () => {
    const evaluate = vi
      .fn()
      .mockResolvedValue(JSON.stringify({ error: 'locked' }));
    const result = await claimMarkerLoot(
      { eval: evaluate } as unknown as Redis,
      keys,
      input,
      300
    );
    expect(result).toEqual({ ok: false, error: 'locked' });
  });
});
