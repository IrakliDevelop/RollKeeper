import { describe, expect, it, vi } from 'vitest';
import type { MarkerLootEntry } from '@/types/battlemap';
import type { CampaignNPC } from '@/types/encounter';
import { deliverMarkerLoot } from './markerLootDelivery';

function loot(overrides: Partial<MarkerLootEntry> = {}): MarkerLootEntry {
  return {
    id: 'loot-1',
    itemKind: 'inventory',
    item: {
      id: 'item-1',
      name: 'Ruby',
      category: 'treasure',
      quantity: 8,
      tags: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    quantity: 2,
    claimedQuantity: 0,
    ...overrides,
  };
}

describe('deliverMarkerLoot', () => {
  it('queues exactly one inventory item for a player', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    await deliverMarkerLoot({
      campaignCode: 'CAMP',
      dmId: 'dm-1',
      entry: loot(),
      recipient: { kind: 'player', playerId: 'player-1' },
      fetcher: fetcher as unknown as typeof fetch,
      findNpc: () => undefined,
      updateNpc: vi.fn(),
    });

    expect(fetcher).toHaveBeenCalledOnce();
    const [, init] = fetcher.mock.calls[0];
    const payload = JSON.parse(init.body as string);
    expect(payload.data.playerId).toBe('player-1');
    expect(payload.dmId).toBe('dm-1');
    expect(payload.data.transfer.item.quantity).toBe(1);
    expect(payload.data.transfer.itemKind).toBe('inventory');
  });

  it('rejects a failed player transfer', async () => {
    await expect(
      deliverMarkerLoot({
        campaignCode: 'CAMP',
        dmId: 'dm-1',
        entry: loot(),
        recipient: { kind: 'player', playerId: 'player-1' },
        fetcher: vi
          .fn()
          .mockResolvedValue({ ok: false }) as unknown as typeof fetch,
        findNpc: () => undefined,
        updateNpc: vi.fn(),
      })
    ).rejects.toThrow('Could not give');
  });

  it('appends one item to an NPC inventory without calling fetch', async () => {
    const fetcher = vi.fn();
    const updateNpc = vi.fn();
    await deliverMarkerLoot({
      campaignCode: 'CAMP',
      dmId: 'dm-1',
      entry: loot(),
      recipient: { kind: 'npc', npcId: 'npc-1' },
      fetcher: fetcher as unknown as typeof fetch,
      findNpc: () =>
        ({
          id: 'npc-1',
          campaignCode: 'CAMP',
          name: 'Goblin',
          inventory: [],
        }) as unknown as CampaignNPC,
      updateNpc,
    });

    expect(fetcher).not.toHaveBeenCalled();
    expect(updateNpc).toHaveBeenCalledWith('npc-1', [
      expect.objectContaining({ name: 'Ruby', quantity: 1 }),
    ]);
  });

  it('refuses depleted loot before attempting delivery', async () => {
    const fetcher = vi.fn();
    await expect(
      deliverMarkerLoot({
        campaignCode: 'CAMP',
        dmId: 'dm-1',
        entry: loot({ quantity: 1, claimedQuantity: 1 }),
        recipient: { kind: 'player', playerId: 'player-1' },
        fetcher: fetcher as unknown as typeof fetch,
        findNpc: () => undefined,
        updateNpc: vi.fn(),
      })
    ).rejects.toThrow('depleted');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
