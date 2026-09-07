import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useItemTransferAutoMerge } from '../useItemTransferAutoMerge';
import type { ItemTransfer } from '@/types/sharedState';
import type { Currency, InventoryItem, MagicItem } from '@/types/character';

const DEFAULT_CURRENCY: Currency = {
  copper: 0,
  silver: 0,
  electrum: 0,
  gold: 0,
  platinum: 0,
};

function makeTransfer(overrides: Partial<ItemTransfer> = {}): ItemTransfer {
  const item: InventoryItem = {
    id: 'item-1',
    name: 'Potion of Healing',
    category: 'consumable',
    quantity: 1,
    tags: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  return {
    id: 'transfer-1',
    item,
    itemKind: 'inventory',
    fromPlayerName: 'DM',
    fromCharacterName: 'DM',
    fromType: 'dm',
    sentAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** In-memory stand-in for the slice of `characterStore` this hook depends
 * on, so tests can control exactly what "persisted" state a fresh render
 * (i.e. a remount) sees — mirroring how the real store is a module-level
 * singleton that survives a component unmount/remount within the same
 * process, unlike a `useRef`. */
function makeStore(initialIds: string[] = []) {
  let appliedTransferIds = initialIds;
  const recordAppliedTransfer = vi.fn((id: string) => {
    if (!appliedTransferIds.includes(id)) {
      appliedTransferIds = [...appliedTransferIds, id];
    }
  });
  return {
    get appliedTransferIds() {
      return appliedTransferIds;
    },
    recordAppliedTransfer,
  };
}

describe('useItemTransferAutoMerge', () => {
  it('applies a new transfer and acknowledges it', () => {
    const store = makeStore();
    const addInventoryItem = vi.fn();
    const addMagicItem = vi.fn();
    const acknowledgeTransfers = vi.fn().mockResolvedValue(undefined);
    const transfer = makeTransfer();

    const updateCurrency = vi.fn();

    renderHook(() =>
      useItemTransferAutoMerge({
        transfers: [transfer],
        appliedTransferIds: store.appliedTransferIds,
        recordAppliedTransfer: store.recordAppliedTransfer,
        addInventoryItem,
        addMagicItem,
        acknowledgeTransfers,
        currency: DEFAULT_CURRENCY,
        updateCurrency,
      })
    );

    expect(addInventoryItem).toHaveBeenCalledTimes(1);
    expect(addMagicItem).not.toHaveBeenCalled();
    expect(store.recordAppliedTransfer).toHaveBeenCalledWith('transfer-1');
    expect(acknowledgeTransfers).toHaveBeenCalledTimes(1);
    // No cost on this transfer — the purse must not be touched at all.
    expect(updateCurrency).not.toHaveBeenCalled();
  });

  it('skips a transfer whose id is already in appliedTransferIds', () => {
    const store = makeStore(['transfer-1']);
    const addInventoryItem = vi.fn();
    const addMagicItem = vi.fn();
    const acknowledgeTransfers = vi.fn().mockResolvedValue(undefined);
    const transfer = makeTransfer();

    const updateCurrency = vi.fn();

    renderHook(() =>
      useItemTransferAutoMerge({
        transfers: [transfer],
        appliedTransferIds: store.appliedTransferIds,
        recordAppliedTransfer: store.recordAppliedTransfer,
        addInventoryItem,
        addMagicItem,
        acknowledgeTransfers,
        currency: DEFAULT_CURRENCY,
        updateCurrency,
      })
    );

    expect(addInventoryItem).not.toHaveBeenCalled();
    expect(addMagicItem).not.toHaveBeenCalled();
    expect(store.recordAppliedTransfer).not.toHaveBeenCalled();
    // Nothing was added, so there's nothing new to acknowledge.
    expect(acknowledgeTransfers).not.toHaveBeenCalled();
    expect(updateCurrency).not.toHaveBeenCalled();
  });

  it(
    'REGRESSION: after a failed acknowledgeTransfers, remounting does not ' +
      're-apply the transfer — this fails against a useRef-based dedup set',
    async () => {
      // A dedup implementation scoped to the COMPONENT INSTANCE (the old
      // `useRef<Set<string>>`) is fresh on every mount. A dedup ledger that
      // instead lives in the persisted store (simulated here by `makeStore`,
      // which survives across renderHook instances the same way the real
      // Zustand store singleton survives a React remount) must not
      // re-apply the transfer even though the server-side queue is still
      // populated (acknowledge failed and never cleared it).
      const store = makeStore();
      const addInventoryItem = vi.fn();
      const addMagicItem = vi.fn();
      const acknowledgeTransfers = vi
        .fn()
        .mockRejectedValue(new Error('network error'));
      const transfer = makeTransfer();

      const updateCurrency = vi.fn();

      // --- First mount: applies the transfer, acknowledge fails ---
      const first = renderHook(() =>
        useItemTransferAutoMerge({
          transfers: [transfer],
          appliedTransferIds: store.appliedTransferIds,
          recordAppliedTransfer: store.recordAppliedTransfer,
          addInventoryItem,
          addMagicItem,
          acknowledgeTransfers,
          currency: DEFAULT_CURRENCY,
          updateCurrency,
        })
      );
      expect(addInventoryItem).toHaveBeenCalledTimes(1);
      expect(acknowledgeTransfers).toHaveBeenCalledTimes(1);
      // Let the rejected acknowledge promise settle without an unhandled
      // rejection failing the test.
      await acknowledgeTransfers.mock.results[0]?.value.catch(() => {});

      first.unmount();

      // --- Remount: the server queue is still populated (acknowledge
      // never cleared it), so the effect sees the SAME transfer again. ---
      renderHook(() =>
        useItemTransferAutoMerge({
          transfers: [transfer],
          appliedTransferIds: store.appliedTransferIds,
          recordAppliedTransfer: store.recordAppliedTransfer,
          addInventoryItem,
          addMagicItem,
          acknowledgeTransfers,
          currency: DEFAULT_CURRENCY,
          updateCurrency,
        })
      );

      // The item must be added exactly once across both mounts.
      expect(addInventoryItem).toHaveBeenCalledTimes(1);
    }
  );

  describe('coin debit', () => {
    it('a costCopper: 0 transfer debits nothing and does not reshape the purse', () => {
      const store = makeStore();
      const addInventoryItem = vi.fn();
      const addMagicItem = vi.fn();
      const acknowledgeTransfers = vi.fn().mockResolvedValue(undefined);
      const updateCurrency = vi.fn();
      const transfer = makeTransfer({ costCopper: 0 });
      const currency: Currency = {
        copper: 4,
        silver: 3,
        electrum: 0,
        gold: 2,
        platinum: 0,
      };

      renderHook(() =>
        useItemTransferAutoMerge({
          transfers: [transfer],
          appliedTransferIds: store.appliedTransferIds,
          recordAppliedTransfer: store.recordAppliedTransfer,
          addInventoryItem,
          addMagicItem,
          acknowledgeTransfers,
          currency,
          updateCurrency,
        })
      );

      expect(addInventoryItem).toHaveBeenCalledTimes(1);
      expect(updateCurrency).not.toHaveBeenCalled();
    });

    it('an absent costCopper debits nothing (gift/loot transfer)', () => {
      const store = makeStore();
      const addInventoryItem = vi.fn();
      const addMagicItem = vi.fn();
      const acknowledgeTransfers = vi.fn().mockResolvedValue(undefined);
      const updateCurrency = vi.fn();
      const transfer = makeTransfer();
      expect(transfer.costCopper).toBeUndefined();

      renderHook(() =>
        useItemTransferAutoMerge({
          transfers: [transfer],
          appliedTransferIds: store.appliedTransferIds,
          recordAppliedTransfer: store.recordAppliedTransfer,
          addInventoryItem,
          addMagicItem,
          acknowledgeTransfers,
          currency: DEFAULT_CURRENCY,
          updateCurrency,
        })
      );

      expect(updateCurrency).not.toHaveBeenCalled();
    });

    it('debits exactly once for a normal single-transfer purchase, pinning the resulting coin composition', () => {
      const store = makeStore();
      const addInventoryItem = vi.fn();
      const addMagicItem = vi.fn();
      const acknowledgeTransfers = vi.fn().mockResolvedValue(undefined);
      const updateCurrency = vi.fn();
      // 235 cp on hand; a 50 cp purchase pays from copper/silver on hand
      // without breaking anything.
      const currency: Currency = {
        copper: 5,
        silver: 3,
        electrum: 0,
        gold: 2,
        platinum: 0,
      };
      const transfer = makeTransfer({ costCopper: 50 });

      renderHook(() =>
        useItemTransferAutoMerge({
          transfers: [transfer],
          appliedTransferIds: store.appliedTransferIds,
          recordAppliedTransfer: store.recordAppliedTransfer,
          addInventoryItem,
          addMagicItem,
          acknowledgeTransfers,
          currency,
          updateCurrency,
        })
      );

      expect(addInventoryItem).toHaveBeenCalledTimes(1);
      expect(updateCurrency).toHaveBeenCalledTimes(1);
      // 235 cp - 50 cp = 185 cp. spendCopper pays 5 cp + 30 cp from the
      // copper/silver on hand (owed 15), breaks one gold into 10 silver and
      // pays 10 more (owed 5), then breaks one of those silver into 10
      // copper and pays the last 5 from copper — landing on
      // {copper: 5, silver: 8, gold: 1}, matching spendCopper's documented
      // one-coin-at-a-time break behavior, not a re-denominated purse.
      expect(updateCurrency).toHaveBeenCalledWith({
        copper: 5,
        silver: 8,
        electrum: 0,
        gold: 1,
        platinum: 0,
      });
    });

    it('debits exactly once across an N-transfer magic-item purchase (cost on the first, 0 on the rest)', () => {
      const store = makeStore();
      const addInventoryItem = vi.fn();
      const addMagicItem = vi.fn();
      const acknowledgeTransfers = vi.fn().mockResolvedValue(undefined);
      const updateCurrency = vi.fn();
      const currency: Currency = {
        copper: 0,
        silver: 0,
        electrum: 0,
        gold: 10,
        platinum: 0,
      };
      const magicItem: MagicItem = {
        id: 'wand-1',
        name: 'Wand of Magic Missiles',
        category: 'wand',
        rarity: 'uncommon',
        description: 'Fires magic missiles.',
        properties: [],
        requiresAttunement: false,
        isAttuned: false,
        isEquipped: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      // A purchase of 3 units of a 300 cp (3 gp) item: the server puts the
      // whole cost on the first transfer and 0 on the rest.
      const transfers: ItemTransfer[] = [
        makeTransfer({
          id: 'wand-1',
          itemKind: 'magic',
          item: magicItem,
          costCopper: 300,
        }),
        makeTransfer({
          id: 'wand-2',
          itemKind: 'magic',
          item: { ...magicItem, id: 'wand-2' },
          costCopper: 0,
        }),
        makeTransfer({
          id: 'wand-3',
          itemKind: 'magic',
          item: { ...magicItem, id: 'wand-3' },
          costCopper: 0,
        }),
      ];

      renderHook(() =>
        useItemTransferAutoMerge({
          transfers,
          appliedTransferIds: store.appliedTransferIds,
          recordAppliedTransfer: store.recordAppliedTransfer,
          addInventoryItem,
          addMagicItem,
          acknowledgeTransfers,
          currency,
          updateCurrency,
        })
      );

      expect(addMagicItem).toHaveBeenCalledTimes(3);
      // Exactly one debit for the whole purchase, not three (and not a
      // double-charge from re-running spendCopper against a stale purse).
      expect(updateCurrency).toHaveBeenCalledTimes(1);
      // 10 gp (1000 cp) - 300 cp = 700 cp = 7 gp.
      expect(updateCurrency).toHaveBeenCalledWith({
        copper: 0,
        silver: 0,
        electrum: 0,
        gold: 7,
        platinum: 0,
      });
    });

    it('an already-applied transfer id neither re-adds the item nor re-charges', () => {
      const store = makeStore(['transfer-1']);
      const addInventoryItem = vi.fn();
      const addMagicItem = vi.fn();
      const acknowledgeTransfers = vi.fn().mockResolvedValue(undefined);
      const updateCurrency = vi.fn();
      const currency: Currency = {
        copper: 0,
        silver: 0,
        electrum: 0,
        gold: 10,
        platinum: 0,
      };
      const transfer = makeTransfer({ id: 'transfer-1', costCopper: 300 });

      renderHook(() =>
        useItemTransferAutoMerge({
          transfers: [transfer],
          appliedTransferIds: store.appliedTransferIds,
          recordAppliedTransfer: store.recordAppliedTransfer,
          addInventoryItem,
          addMagicItem,
          acknowledgeTransfers,
          currency,
          updateCurrency,
        })
      );

      expect(addInventoryItem).not.toHaveBeenCalled();
      expect(addMagicItem).not.toHaveBeenCalled();
      expect(updateCurrency).not.toHaveBeenCalled();
    });

    it('applies the item and drains the purse (logging loudly) when spendCopper cannot cover the cost', () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      try {
        const store = makeStore();
        const addInventoryItem = vi.fn();
        const addMagicItem = vi.fn();
        const acknowledgeTransfers = vi.fn().mockResolvedValue(undefined);
        const updateCurrency = vi.fn();
        // Only 40 cp on hand; the server-committed cost is 300 cp — this
        // can only happen if the purse was drained from another tab
        // between the dialog's pre-flight affordability check and this
        // transfer landing.
        const currency: Currency = {
          copper: 0,
          silver: 4,
          electrum: 0,
          gold: 0,
          platinum: 0,
        };
        const transfer = makeTransfer({ costCopper: 300 });

        renderHook(() =>
          useItemTransferAutoMerge({
            transfers: [transfer],
            appliedTransferIds: store.appliedTransferIds,
            recordAppliedTransfer: store.recordAppliedTransfer,
            addInventoryItem,
            addMagicItem,
            acknowledgeTransfers,
            currency,
            updateCurrency,
          })
        );

        // The server already committed the sale — the item is kept.
        expect(addInventoryItem).toHaveBeenCalledTimes(1);
        // The purse is drained to what it could bear (everything it had),
        // not left untouched (which would be a silent free item) and not
        // left partially paid (spendCopper never partial-spends).
        expect(updateCurrency).toHaveBeenCalledTimes(1);
        expect(updateCurrency).toHaveBeenCalledWith({
          copper: 0,
          silver: 0,
          electrum: 0,
          gold: 0,
          platinum: 0,
        });
        // Never silent: the shortfall is logged.
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy.mock.calls[0][0]).toContain('transfer-1');
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });
  });
});
