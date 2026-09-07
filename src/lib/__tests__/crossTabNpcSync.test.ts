import { beforeEach, describe, expect, it } from 'vitest';

import { initCrossTabNpcSync } from '@/lib/crossTabNpcSync';
import { NPC_STORAGE_KEY } from '@/lib/durableDm/npcFamily';
import type { CampaignNPC } from '@/types/encounter';
import type { ShopSaleLogEntry } from '@/types/shop';

function npc(id: string, updatedAt: string, name = id): CampaignNPC {
  return {
    id,
    campaignCode: 'ABC123',
    name,
    createdAt: '2026-09-08T00:00:00.000Z',
    updatedAt,
  } as CampaignNPC;
}

function sale(id: string, at: string): ShopSaleLogEntry {
  return {
    id,
    entryId: 'entry-1',
    itemName: 'Rope',
    quantity: 1,
    copper: 100,
    playerId: 'char-1',
    at,
    reconciled: true,
  };
}

interface State {
  npcsByCampaign: Record<string, CampaignNPC[]>;
  appliedShopSaleIds: Record<string, string[]>;
  shopSalesLogByNpc: Record<string, ShopSaleLogEntry[]>;
}

function makeStore(initial: State) {
  let state = initial;
  const writes: State[] = [];
  return {
    getState: () => state,
    setState: (partial: Partial<State>) => {
      state = { ...state, ...partial };
      writes.push(state);
    },
    writes,
  };
}

function fireStorage(state: State) {
  window.dispatchEvent(
    new StorageEvent('storage', {
      key: NPC_STORAGE_KEY,
      newValue: JSON.stringify({ state }),
    })
  );
}

describe('initCrossTabNpcSync', () => {
  let dispose: () => void;
  beforeEach(() => {
    localStorage.clear();
  });

  it('adopts an NPC created in another tab', () => {
    const store = makeStore({
      npcsByCampaign: { ABC123: [] },
      appliedShopSaleIds: {},
      shopSalesLogByNpc: {},
    });
    dispose = initCrossTabNpcSync(store);
    fireStorage({
      npcsByCampaign: { ABC123: [npc('npc-1', '2026-09-08T01:00:00.000Z')] },
      appliedShopSaleIds: {},
      shopSalesLogByNpc: {},
    });
    expect(store.getState().npcsByCampaign.ABC123).toHaveLength(1);
    dispose();
  });

  it('takes the strictly newer NPC and keeps the local one otherwise', () => {
    const store = makeStore({
      npcsByCampaign: {
        ABC123: [npc('npc-1', '2026-09-08T02:00:00.000Z', 'local')],
      },
      appliedShopSaleIds: {},
      shopSalesLogByNpc: {},
    });
    dispose = initCrossTabNpcSync(store);

    fireStorage({
      npcsByCampaign: {
        ABC123: [npc('npc-1', '2026-09-08T01:00:00.000Z', 'older')],
      },
      appliedShopSaleIds: {},
      shopSalesLogByNpc: {},
    });
    expect(store.getState().npcsByCampaign.ABC123[0].name).toBe('local');

    fireStorage({
      npcsByCampaign: {
        ABC123: [npc('npc-1', '2026-09-08T03:00:00.000Z', 'newer')],
      },
      appliedShopSaleIds: {},
      shopSalesLogByNpc: {},
    });
    expect(store.getState().npcsByCampaign.ABC123[0].name).toBe('newer');
    dispose();
  });

  it('unions the applied-sale ledger instead of replacing it', () => {
    const store = makeStore({
      npcsByCampaign: {},
      appliedShopSaleIds: { 'npc-1': ['sale-a'] },
      shopSalesLogByNpc: {},
    });
    dispose = initCrossTabNpcSync(store);
    fireStorage({
      npcsByCampaign: {},
      appliedShopSaleIds: { 'npc-1': ['sale-b'] },
      shopSalesLogByNpc: {},
    });
    expect(store.getState().appliedShopSaleIds['npc-1']).toEqual([
      'sale-a',
      'sale-b',
    ]);
    dispose();
  });

  it('unions the sales log by entry id, oldest first', () => {
    const store = makeStore({
      npcsByCampaign: {},
      appliedShopSaleIds: {},
      shopSalesLogByNpc: {
        'npc-1': [sale('sale-a', '2026-09-08T01:00:00.000Z')],
      },
    });
    dispose = initCrossTabNpcSync(store);
    fireStorage({
      npcsByCampaign: {},
      appliedShopSaleIds: {},
      shopSalesLogByNpc: {
        'npc-1': [
          sale('sale-a', '2026-09-08T01:00:00.000Z'),
          sale('sale-b', '2026-09-08T00:30:00.000Z'),
        ],
      },
    });
    expect(
      store.getState().shopSalesLogByNpc['npc-1'].map(entry => entry.id)
    ).toEqual(['sale-b', 'sale-a']);
    dispose();
  });

  it('does not write when nothing changed (echo terminates)', () => {
    const identical: State = {
      npcsByCampaign: { ABC123: [npc('npc-1', '2026-09-08T01:00:00.000Z')] },
      appliedShopSaleIds: { 'npc-1': ['sale-a'] },
      shopSalesLogByNpc: {},
    };
    const store = makeStore(identical);
    dispose = initCrossTabNpcSync(store);
    fireStorage(identical);
    expect(store.writes).toHaveLength(0);
    dispose();
  });

  it('ignores events for other keys and unparseable payloads', () => {
    const store = makeStore({
      npcsByCampaign: {},
      appliedShopSaleIds: {},
      shopSalesLogByNpc: {},
    });
    dispose = initCrossTabNpcSync(store);
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'other', newValue: '{}' })
    );
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: NPC_STORAGE_KEY,
        newValue: 'not json',
      })
    );
    expect(store.writes).toHaveLength(0);
    dispose();
  });
});
