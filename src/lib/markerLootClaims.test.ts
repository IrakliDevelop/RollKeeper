import { describe, expect, it, vi } from 'vitest';

import {
  claimMarkerLoot,
  seedMarkerLoot,
  validateMarkerLootSeed,
} from './markerLootClaims';
import type { Redis } from '@upstash/redis';

const entry = {
  markerId: 'marker-1',
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

  it('returns the idempotent claim receipt produced by the atomic script', async () => {
    const claim = {
      requestId: 'request-1',
      markerId: 'marker-1',
      entryId: 'entry-1',
      remainingQuantity: 1,
      transferId: 'transfer-1',
    };
    const evalMock = vi.fn().mockResolvedValue(JSON.stringify(claim));
    const result = await claimMarkerLoot(
      { eval: evalMock } as unknown as Redis,
      { ledger: 'ledger', transfers: 'queue', receipt: 'receipt' },
      {
        markerId: 'marker-1',
        entryId: 'entry-1',
        requestId: 'request-1',
        transferId: 'transfer-1',
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
          transferId: 'transfer-2',
          now: '2026-08-12T00:00:00Z',
        },
        60
      )
    ).resolves.toEqual({ ok: false, error: 'depleted' });
  });
});
