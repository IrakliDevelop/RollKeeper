import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

import { useDmShopSalesSync } from '../useDmShopSalesSync';
import { useNPCStore } from '@/store/npcStore';
import { creditCopper } from '@/utils/currency';
import type { Currency } from '@/types/character';
import type { ShopSale } from '@/types/shop';

const CAMPAIGN = 'ABC123';
const DM_ID = 'dm-1';

const ZERO_PURSE: Currency = {
  copper: 0,
  silver: 0,
  electrum: 0,
  gold: 0,
  platinum: 0,
};

function seedMerchant(
  npcId: string,
  overrides: {
    currency?: Currency;
    inventory?: Array<{ id: string; name: string; quantity: number }>;
  } = {}
) {
  useNPCStore.setState(state => ({
    npcsByCampaign: {
      ...state.npcsByCampaign,
      [CAMPAIGN]: [
        ...(state.npcsByCampaign[CAMPAIGN] ?? []).filter(n => n.id !== npcId),
        {
          id: npcId,
          campaignCode: CAMPAIGN,
          name: 'Merchant',
          armorClass: '10',
          maxHp: 10,
          speed: '30 ft.',
          currency: overrides.currency ?? { ...ZERO_PURSE },
          inventory: overrides.inventory ?? [
            { id: 'item-1', name: 'Rope, 50ft', quantity: 10 },
          ],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    },
  }));
}

function makeSale(overrides: Partial<ShopSale> = {}): ShopSale {
  return {
    id: 'sale-req-1',
    entryId: 'item-1',
    quantity: 2,
    copper: 200,
    playerId: 'player-1',
    at: '2026-09-07T00:00:00.000Z',
    ...overrides,
  };
}

function mockSalesResponse(sales: unknown[]) {
  return {
    ok: true,
    json: async () => ({ sales }),
  } as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  useNPCStore.setState({ npcsByCampaign: {}, appliedShopSaleIds: {} });
  fetchMock = vi.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useDmShopSalesSync', () => {
  it('credits the NPC purse by exactly the sale copper, pinning the resulting coin composition', async () => {
    seedMerchant('npc-1', { currency: { ...ZERO_PURSE, gold: 1 } });
    fetchMock.mockResolvedValue(mockSalesResponse([makeSale({ copper: 250 })]));

    const { result } = renderHook(() =>
      useDmShopSalesSync({
        campaignCode: CAMPAIGN,
        dmId: DM_ID,
        npcIds: ['npc-1'],
      })
    );

    await act(async () => {
      await result.current.drainNow();
    });

    const npc = useNPCStore.getState().getNPC(CAMPAIGN, 'npc-1');
    // creditCopper({gold:1}, 250) -> gold+2 (200), silver+5 (50) => gold:3, silver:5
    expect(npc?.currency).toEqual(
      creditCopper({ ...ZERO_PURSE, gold: 1 }, 250)
    );
    expect(npc?.currency).toEqual({ ...ZERO_PURSE, gold: 3, silver: 5 });
  });

  it("decrements the matching inventory row's quantity by exactly the sale's quantity", async () => {
    seedMerchant('npc-1', {
      inventory: [{ id: 'item-1', name: 'Rope, 50ft', quantity: 10 }],
    });
    fetchMock.mockResolvedValue(mockSalesResponse([makeSale({ quantity: 3 })]));

    const { result } = renderHook(() =>
      useDmShopSalesSync({
        campaignCode: CAMPAIGN,
        dmId: DM_ID,
        npcIds: ['npc-1'],
      })
    );
    await act(async () => {
      await result.current.drainNow();
    });

    const npc = useNPCStore.getState().getNPC(CAMPAIGN, 'npc-1');
    expect(npc?.inventory?.[0].quantity).toBe(7);
  });

  it('draining twice applies once — idempotent on sale id', async () => {
    seedMerchant('npc-1');
    fetchMock.mockResolvedValue(mockSalesResponse([makeSale()]));

    const { result } = renderHook(() =>
      useDmShopSalesSync({
        campaignCode: CAMPAIGN,
        dmId: DM_ID,
        npcIds: ['npc-1'],
      })
    );

    await act(async () => {
      await result.current.drainNow();
    });
    await act(async () => {
      await result.current.drainNow();
    });

    const npc = useNPCStore.getState().getNPC(CAMPAIGN, 'npc-1');
    // A single sale (200 copper, quantity 2) applied exactly once.
    expect(npc?.currency).toEqual(creditCopper(ZERO_PURSE, 200));
    expect(npc?.inventory?.[0].quantity).toBe(8);
    expect(useNPCStore.getState().appliedShopSaleIds['npc-1']).toEqual([
      'sale-req-1',
    ]);
  });

  it("the DM's tab being closed loses nothing: sales accumulate and all apply on the next drain", async () => {
    seedMerchant('npc-1');
    // Three sales piled up in Redis while the DM was disconnected — the
    // server never gates on the DM's hook running.
    fetchMock.mockResolvedValue(
      mockSalesResponse([
        makeSale({ id: 'sale-1', copper: 100, quantity: 1 }),
        makeSale({ id: 'sale-2', copper: 150, quantity: 1 }),
        makeSale({ id: 'sale-3', copper: 200, quantity: 2 }),
      ])
    );

    const { result } = renderHook(() =>
      useDmShopSalesSync({
        campaignCode: CAMPAIGN,
        dmId: DM_ID,
        npcIds: ['npc-1'],
      })
    );
    await act(async () => {
      await result.current.drainNow();
    });

    const npc = useNPCStore.getState().getNPC(CAMPAIGN, 'npc-1');
    expect(npc?.currency).toEqual(creditCopper(ZERO_PURSE, 450));
    expect(npc?.inventory?.[0].quantity).toBe(6); // 10 - (1 + 1 + 2)
    expect(useNPCStore.getState().appliedShopSaleIds['npc-1']).toEqual([
      'sale-1',
      'sale-2',
      'sale-3',
    ]);
  });

  it('a malformed sale row does not abort the whole drain', async () => {
    seedMerchant('npc-1');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock.mockResolvedValue(
      mockSalesResponse([
        { id: 'sale-bad', entryId: 'item-1', copper: -5 }, // malformed: negative copper, no quantity
        makeSale({ id: 'sale-good' }),
      ])
    );

    const { result } = renderHook(() =>
      useDmShopSalesSync({
        campaignCode: CAMPAIGN,
        dmId: DM_ID,
        npcIds: ['npc-1'],
      })
    );
    await act(async () => {
      await result.current.drainNow();
    });

    const npc = useNPCStore.getState().getNPC(CAMPAIGN, 'npc-1');
    expect(npc?.currency).toEqual(creditCopper(ZERO_PURSE, 200));
    expect(useNPCStore.getState().appliedShopSaleIds['npc-1']).toEqual([
      'sale-good',
    ]);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('a sale referencing a deleted inventory row still credits the coins and warns, rather than dropping the sale', async () => {
    seedMerchant('npc-1', {
      currency: { ...ZERO_PURSE, gold: 1 },
      inventory: [{ id: 'some-other-item', name: 'Torch', quantity: 5 }],
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock.mockResolvedValue(
      mockSalesResponse([makeSale({ entryId: 'item-1', copper: 50 })])
    );

    const { result } = renderHook(() =>
      useDmShopSalesSync({
        campaignCode: CAMPAIGN,
        dmId: DM_ID,
        npcIds: ['npc-1'],
      })
    );
    await act(async () => {
      await result.current.drainNow();
    });

    const npc = useNPCStore.getState().getNPC(CAMPAIGN, 'npc-1');
    // Coins still land even though the row they were for is gone.
    expect(npc?.currency).toEqual(creditCopper({ ...ZERO_PURSE, gold: 1 }, 50));
    // The unrelated item is untouched.
    expect(npc?.inventory).toEqual([
      { id: 'some-other-item', name: 'Torch', quantity: 5 },
    ]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('inventory row item-1')
    );
    // Recorded as applied so it is never retried/re-warned forever.
    expect(useNPCStore.getState().appliedShopSaleIds['npc-1']).toEqual([
      'sale-req-1',
    ]);
  });

  it('a sale referencing a deleted NPC does not crash and is still recorded so it is not retried forever', async () => {
    // No seedMerchant call for 'npc-ghost' — it does not exist in the store.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock.mockResolvedValue(mockSalesResponse([makeSale()]));

    const { result } = renderHook(() =>
      useDmShopSalesSync({
        campaignCode: CAMPAIGN,
        dmId: DM_ID,
        npcIds: ['npc-ghost'],
      })
    );

    await act(async () => {
      await result.current.drainNow();
    });

    expect(
      useNPCStore.getState().getNPC(CAMPAIGN, 'npc-ghost')
    ).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('no longer exists')
    );
    expect(useNPCStore.getState().appliedShopSaleIds['npc-ghost']).toEqual([
      'sale-req-1',
    ]);
  });

  it('fetches the DM-scoped sales endpoint with dmId as a query param', async () => {
    seedMerchant('npc-1');
    fetchMock.mockResolvedValue(mockSalesResponse([]));

    const { result } = renderHook(() =>
      useDmShopSalesSync({
        campaignCode: CAMPAIGN,
        dmId: DM_ID,
        npcIds: ['npc-1'],
      })
    );
    await act(async () => {
      await result.current.drainNow();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/campaign/${CAMPAIGN}/shops/npc-1/sales?dmId=${DM_ID}`
    );
  });

  it('does not poll when campaignCode/dmId are missing or npcIds is empty', async () => {
    renderHook(() =>
      useDmShopSalesSync({ campaignCode: null, dmId: DM_ID, npcIds: ['npc-1'] })
    );
    renderHook(() =>
      useDmShopSalesSync({
        campaignCode: CAMPAIGN,
        dmId: null,
        npcIds: ['npc-1'],
      })
    );
    renderHook(() =>
      useDmShopSalesSync({ campaignCode: CAMPAIGN, dmId: DM_ID, npcIds: [] })
    );
    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('polls again after pollIntervalMs', async () => {
    vi.useFakeTimers();
    seedMerchant('npc-1');
    fetchMock.mockResolvedValue(mockSalesResponse([]));

    renderHook(() =>
      useDmShopSalesSync({
        campaignCode: CAMPAIGN,
        dmId: DM_ID,
        npcIds: ['npc-1'],
        pollIntervalMs: 5000,
      })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('reports an error and keeps drainable state when the fetch fails, without throwing', async () => {
    seedMerchant('npc-1');
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const { result } = renderHook(() =>
      useDmShopSalesSync({
        campaignCode: CAMPAIGN,
        dmId: DM_ID,
        npcIds: ['npc-1'],
      })
    );
    await act(async () => {
      await result.current.drainNow();
    });

    await waitFor(() => expect(result.current.error).toBeTruthy());
  });

  describe('acknowledging applied sales (Task 12a)', () => {
    function mockAckResponse(ok = true) {
      return { ok, status: ok ? 200 : 500, json: async () => ({}) } as Response;
    }

    it('acknowledges every applied sale in ONE batch call, not one per sale', async () => {
      seedMerchant('npc-1');
      const sales = [
        makeSale({ id: 'sale-1', copper: 100, quantity: 1 }),
        makeSale({ id: 'sale-2', copper: 150, quantity: 1 }),
        makeSale({ id: 'sale-3', copper: 200, quantity: 2 }),
      ];
      fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        if (init?.method === 'DELETE') return mockAckResponse(true);
        return mockSalesResponse(sales);
      });

      const { result } = renderHook(() =>
        useDmShopSalesSync({
          campaignCode: CAMPAIGN,
          dmId: DM_ID,
          npcIds: ['npc-1'],
        })
      );
      await act(async () => {
        await result.current.drainNow();
      });

      const deleteCalls = fetchMock.mock.calls.filter(
        ([, init]) => (init as RequestInit | undefined)?.method === 'DELETE'
      );
      expect(deleteCalls).toHaveLength(1);
      const [url, init] = deleteCalls[0];
      expect(url).toBe(`/api/campaign/${CAMPAIGN}/shops/npc-1/sales`);
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body).toEqual({
        dmId: DM_ID,
        saleIds: ['sale-1', 'sale-2', 'sale-3'],
      });
    });

    it('a failed ack (rejected fetch) does not disturb the applied-sales ledger, so the next drain does not double-apply', async () => {
      seedMerchant('npc-1');
      fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        if (init?.method === 'DELETE') {
          throw new Error('network down');
        }
        return mockSalesResponse([makeSale({ copper: 200, quantity: 2 })]);
      });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() =>
        useDmShopSalesSync({
          campaignCode: CAMPAIGN,
          dmId: DM_ID,
          npcIds: ['npc-1'],
        })
      );

      await act(async () => {
        await result.current.drainNow();
      });
      expect(result.current.error).toBeNull();
      expect(useNPCStore.getState().appliedShopSaleIds['npc-1']).toEqual([
        'sale-req-1',
      ]);
      let npc = useNPCStore.getState().getNPC(CAMPAIGN, 'npc-1');
      expect(npc?.currency).toEqual(creditCopper(ZERO_PURSE, 200));

      // The server still holds the sale (the ack never landed) and would
      // legitimately return it again on the next poll.
      await act(async () => {
        await result.current.drainNow();
      });
      npc = useNPCStore.getState().getNPC(CAMPAIGN, 'npc-1');
      // Not re-applied: same coin total, ledger unchanged (no duplicate id).
      expect(npc?.currency).toEqual(creditCopper(ZERO_PURSE, 200));
      expect(useNPCStore.getState().appliedShopSaleIds['npc-1']).toEqual([
        'sale-req-1',
      ]);
      expect(warnSpy).toHaveBeenCalled();
    });

    it('a failed ack (non-ok HTTP status) does not disturb the applied-sales ledger, so the next drain does not double-apply', async () => {
      seedMerchant('npc-1');
      fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        if (init?.method === 'DELETE') return mockAckResponse(false);
        return mockSalesResponse([makeSale({ copper: 300, quantity: 1 })]);
      });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() =>
        useDmShopSalesSync({
          campaignCode: CAMPAIGN,
          dmId: DM_ID,
          npcIds: ['npc-1'],
        })
      );

      await act(async () => {
        await result.current.drainNow();
      });
      await act(async () => {
        await result.current.drainNow();
      });

      const npc = useNPCStore.getState().getNPC(CAMPAIGN, 'npc-1');
      expect(npc?.currency).toEqual(creditCopper(ZERO_PURSE, 300));
      expect(useNPCStore.getState().appliedShopSaleIds['npc-1']).toEqual([
        'sale-req-1',
      ]);
      expect(warnSpy).toHaveBeenCalled();
    });

    it('the property that matters: sales piling up while the DM is away are all applied and acknowledged, and the server log never grows without bound across repeated drains', async () => {
      seedMerchant('npc-1');
      // A stand-in for the server's `campaign:{code}:shop-sales:{npcId}` log
      // — GET reads it, DELETE removes acknowledged ids, exactly like the
      // real route.
      let serverLog: ShopSale[] = [
        makeSale({ id: 'sale-1', copper: 100, quantity: 1 }),
        makeSale({ id: 'sale-2', copper: 150, quantity: 1 }),
      ];
      fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        if (init?.method === 'DELETE') {
          const { saleIds } = JSON.parse(init.body as string) as {
            saleIds: string[];
          };
          const idSet = new Set(saleIds);
          serverLog = serverLog.filter(s => !idSet.has(s.id));
          return mockAckResponse(true);
        }
        return mockSalesResponse(serverLog);
      });

      const { result } = renderHook(() =>
        useDmShopSalesSync({
          campaignCode: CAMPAIGN,
          dmId: DM_ID,
          npcIds: ['npc-1'],
        })
      );

      await act(async () => {
        await result.current.drainNow();
      });
      // Both pre-existing sales applied and acknowledged: the log drains to
      // empty, not capped-but-nonzero.
      expect(serverLog).toHaveLength(0);

      // More sales accumulate while the DM is still away (a purchase
      // append never depends on this hook running).
      serverLog.push(
        makeSale({ id: 'sale-3', copper: 200, quantity: 2 }),
        makeSale({ id: 'sale-4', copper: 50, quantity: 1 }),
        makeSale({ id: 'sale-5', copper: 75, quantity: 1 })
      );

      await act(async () => {
        await result.current.drainNow();
      });
      expect(serverLog).toHaveLength(0);

      const npc = useNPCStore.getState().getNPC(CAMPAIGN, 'npc-1');
      // `creditCopper` mints per-transaction (largest-first), so the
      // expected purse is built the same way — one credit per sale, in
      // applied order — not from a single lump-sum credit.
      const expectedCurrency = [100, 150, 200, 50, 75].reduce(
        (purse, amount) => creditCopper(purse, amount),
        ZERO_PURSE
      );
      expect(npc?.currency).toEqual(expectedCurrency);
      expect(useNPCStore.getState().appliedShopSaleIds['npc-1']).toEqual([
        'sale-1',
        'sale-2',
        'sale-3',
        'sale-4',
        'sale-5',
      ]);
    });
  });
});
