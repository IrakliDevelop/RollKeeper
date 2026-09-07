import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

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
  const clearAppliedTransfer = vi.fn((id: string) => {
    appliedTransferIds = appliedTransferIds.filter(x => x !== id);
  });
  return {
    get appliedTransferIds() {
      return appliedTransferIds;
    },
    recordAppliedTransfer,
    clearAppliedTransfer,
  };
}

/** Flushes the microtask queue so the effect's fire-and-forget
 * `acknowledgeTransfers(id).then(...)` chains settle before assertions. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useItemTransferAutoMerge', () => {
  it('applies a new transfer, acknowledges it in a batch, and clears the ledger entry on success', async () => {
    const store = makeStore();
    const addInventoryItem = vi.fn();
    const addMagicItem = vi.fn();
    const acknowledgeTransfers = vi.fn().mockResolvedValue(true);
    const transfer = makeTransfer();

    const updateCurrency = vi.fn();

    renderHook(() =>
      useItemTransferAutoMerge({
        transfers: [transfer],
        appliedTransferIds: store.appliedTransferIds,
        recordAppliedTransfer: store.recordAppliedTransfer,
        clearAppliedTransfer: store.clearAppliedTransfer,
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
    // One batched call carrying the whole set of ids, not a blanket
    // whole-queue acknowledge and not one call per id.
    expect(acknowledgeTransfers).toHaveBeenCalledTimes(1);
    expect(acknowledgeTransfers).toHaveBeenCalledWith(['transfer-1']);
    // No cost on this transfer — the purse must not be touched at all.
    expect(updateCurrency).not.toHaveBeenCalled();

    await flush();
    expect(store.clearAppliedTransfer).toHaveBeenCalledWith('transfer-1');
  });

  it('does NOT clear the ledger entry when the acknowledge fails', async () => {
    const store = makeStore();
    const addInventoryItem = vi.fn();
    const addMagicItem = vi.fn();
    const acknowledgeTransfers = vi.fn().mockResolvedValue(false);
    const transfer = makeTransfer();
    const updateCurrency = vi.fn();

    renderHook(() =>
      useItemTransferAutoMerge({
        transfers: [transfer],
        appliedTransferIds: store.appliedTransferIds,
        recordAppliedTransfer: store.recordAppliedTransfer,
        clearAppliedTransfer: store.clearAppliedTransfer,
        addInventoryItem,
        addMagicItem,
        acknowledgeTransfers,
        currency: DEFAULT_CURRENCY,
        updateCurrency,
      })
    );

    await flush();
    expect(store.clearAppliedTransfer).not.toHaveBeenCalled();
    // The item stays applied regardless — only the ledger bookkeeping is
    // conditional on ack success.
    expect(store.appliedTransferIds).toContain('transfer-1');
  });

  it('skips a transfer whose id is already in appliedTransferIds, but still retries acknowledging it', async () => {
    const store = makeStore(['transfer-1']);
    const addInventoryItem = vi.fn();
    const addMagicItem = vi.fn();
    const acknowledgeTransfers = vi.fn().mockResolvedValue(true);
    const transfer = makeTransfer();

    const updateCurrency = vi.fn();

    renderHook(() =>
      useItemTransferAutoMerge({
        transfers: [transfer],
        appliedTransferIds: store.appliedTransferIds,
        recordAppliedTransfer: store.recordAppliedTransfer,
        clearAppliedTransfer: store.clearAppliedTransfer,
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
    expect(updateCurrency).not.toHaveBeenCalled();
    // Still present in the live queue (its own prior ack presumably
    // failed) — worth another acknowledge attempt even though nothing was
    // (re-)applied.
    expect(acknowledgeTransfers).toHaveBeenCalledTimes(1);
    expect(acknowledgeTransfers).toHaveBeenCalledWith(['transfer-1']);

    await flush();
    expect(store.clearAppliedTransfer).toHaveBeenCalledWith('transfer-1');
  });

  it(
    'CRITICAL FIX: acknowledges a whole batch in ONE call, never one ' +
      'request per id — the route does a non-atomic read-filter-write, so ' +
      'N concurrent per-id acks would race and lose all but the last ' +
      "writer's removal (see the route's own atomicity test)",
    async () => {
      const store = makeStore();
      const addInventoryItem = vi.fn();
      const addMagicItem = vi.fn();
      const acknowledgeTransfers = vi.fn().mockResolvedValue(true);
      const updateCurrency = vi.fn();
      // Same shape as a full-size shop purchase batch.
      const transfers = Array.from({ length: 25 }, (_, i) =>
        makeTransfer({ id: `wand-${i}` })
      );

      renderHook(() =>
        useItemTransferAutoMerge({
          transfers,
          appliedTransferIds: store.appliedTransferIds,
          recordAppliedTransfer: store.recordAppliedTransfer,
          clearAppliedTransfer: store.clearAppliedTransfer,
          addInventoryItem,
          addMagicItem,
          acknowledgeTransfers,
          currency: DEFAULT_CURRENCY,
          updateCurrency,
        })
      );

      expect(acknowledgeTransfers).toHaveBeenCalledTimes(1);
      expect(acknowledgeTransfers).toHaveBeenCalledWith(
        transfers.map(t => t.id)
      );
    }
  );

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
      const acknowledgeTransfers = vi.fn().mockResolvedValue(false);
      const transfer = makeTransfer();

      const updateCurrency = vi.fn();

      // --- First mount: applies the transfer, acknowledge fails ---
      const first = renderHook(() =>
        useItemTransferAutoMerge({
          transfers: [transfer],
          appliedTransferIds: store.appliedTransferIds,
          recordAppliedTransfer: store.recordAppliedTransfer,
          clearAppliedTransfer: store.clearAppliedTransfer,
          addInventoryItem,
          addMagicItem,
          acknowledgeTransfers,
          currency: DEFAULT_CURRENCY,
          updateCurrency,
        })
      );
      expect(addInventoryItem).toHaveBeenCalledTimes(1);
      expect(acknowledgeTransfers).toHaveBeenCalledTimes(1);
      await flush();
      expect(store.clearAppliedTransfer).not.toHaveBeenCalled();

      first.unmount();

      // --- Remount: the server queue is still populated (acknowledge
      // never cleared it), so the effect sees the SAME transfer again. ---
      renderHook(() =>
        useItemTransferAutoMerge({
          transfers: [transfer],
          appliedTransferIds: store.appliedTransferIds,
          recordAppliedTransfer: store.recordAppliedTransfer,
          clearAppliedTransfer: store.clearAppliedTransfer,
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

  it('REGRESSION (StrictMode): a double-invoked mount effect applies the transfer exactly once', async () => {
    // React StrictMode runs a mount effect twice in a row (run, cleanup,
    // run again) with no re-render — and therefore no fresh
    // `appliedTransferIds` prop — between the two invocations. A guard that
    // only reads the (stale) prop would rebuild an empty `seen` set both
    // times and double-apply. `renderHook(..., { reactStrictMode: true })`
    // is this repo's established idiom for pinning this (see
    // useMarkerRegistration.test.tsx / markers.integration.test.tsx) — a
    // `<StrictMode>` wrapper does NOT double-invoke effects on this stack.
    const store = makeStore();
    const addInventoryItem = vi.fn();
    const addMagicItem = vi.fn();
    const acknowledgeTransfers = vi.fn().mockResolvedValue(true);
    const updateCurrency = vi.fn();
    const transfer = makeTransfer({ costCopper: 50 });
    const currency: Currency = {
      copper: 0,
      silver: 0,
      electrum: 0,
      gold: 1,
      platinum: 0,
    };

    renderHook(
      () =>
        useItemTransferAutoMerge({
          transfers: [transfer],
          appliedTransferIds: store.appliedTransferIds,
          recordAppliedTransfer: store.recordAppliedTransfer,
          clearAppliedTransfer: store.clearAppliedTransfer,
          addInventoryItem,
          addMagicItem,
          acknowledgeTransfers,
          currency,
          updateCurrency,
        }),
      { reactStrictMode: true }
    );

    expect(addInventoryItem).toHaveBeenCalledTimes(1);
    expect(updateCurrency).toHaveBeenCalledTimes(1);
    expect(store.recordAppliedTransfer).toHaveBeenCalledTimes(1);

    // StrictMode doubles the ack fan-out — both effect passes reach the
    // acknowledge step (the second one retries the same id it can already
    // see as applied) — but the batch-ack fix means each pass still issues
    // exactly one call carrying the same one-element batch, never a
    // multi-id batch split across per-id requests. Two idempotent acks for
    // the identical id set are harmless (the route removes the same id
    // either way); this is what "largely dissolves" the widened race
    // window means in practice, not "eliminates the double call."
    expect(acknowledgeTransfers).toHaveBeenCalledTimes(2);
    for (const call of acknowledgeTransfers.mock.calls) {
      expect(call[0]).toEqual(['transfer-1']);
    }
  });

  it('does not record a transfer as applied when addInventoryItem throws (recoverable on the next pass)', () => {
    const store = makeStore();
    const addInventoryItem = vi.fn(() => {
      throw new Error('boom');
    });
    const addMagicItem = vi.fn();
    const acknowledgeTransfers = vi.fn().mockResolvedValue(true);
    const updateCurrency = vi.fn();
    const transfer = makeTransfer();

    expect(() =>
      renderHook(() =>
        useItemTransferAutoMerge({
          transfers: [transfer],
          appliedTransferIds: store.appliedTransferIds,
          recordAppliedTransfer: store.recordAppliedTransfer,
          clearAppliedTransfer: store.clearAppliedTransfer,
          addInventoryItem,
          addMagicItem,
          acknowledgeTransfers,
          currency: DEFAULT_CURRENCY,
          updateCurrency,
        })
      )
    ).toThrow('boom');

    // The throw happened before recordAppliedTransfer was reached — the
    // ledger must NOT claim this transfer was applied, or it would be lost
    // forever instead of retried on the next poll/reload.
    expect(store.recordAppliedTransfer).not.toHaveBeenCalled();
    expect(store.appliedTransferIds).not.toContain('transfer-1');
  });

  describe('coin debit', () => {
    it('a costCopper: 0 transfer debits nothing and does not reshape the purse', () => {
      const store = makeStore();
      const addInventoryItem = vi.fn();
      const addMagicItem = vi.fn();
      const acknowledgeTransfers = vi.fn().mockResolvedValue(true);
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
          clearAppliedTransfer: store.clearAppliedTransfer,
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
      const acknowledgeTransfers = vi.fn().mockResolvedValue(true);
      const updateCurrency = vi.fn();
      const transfer = makeTransfer();
      expect(transfer.costCopper).toBeUndefined();

      renderHook(() =>
        useItemTransferAutoMerge({
          transfers: [transfer],
          appliedTransferIds: store.appliedTransferIds,
          recordAppliedTransfer: store.recordAppliedTransfer,
          clearAppliedTransfer: store.clearAppliedTransfer,
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
      const acknowledgeTransfers = vi.fn().mockResolvedValue(true);
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
          clearAppliedTransfer: store.clearAppliedTransfer,
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
      const acknowledgeTransfers = vi.fn().mockResolvedValue(true);
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
          clearAppliedTransfer: store.clearAppliedTransfer,
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
      const acknowledgeTransfers = vi.fn().mockResolvedValue(true);
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
          clearAppliedTransfer: store.clearAppliedTransfer,
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
        const acknowledgeTransfers = vi.fn().mockResolvedValue(true);
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
            clearAppliedTransfer: store.clearAppliedTransfer,
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

    it('calls onInsufficientFunds with the shortfall so the caller can surface it to the player', () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      try {
        const store = makeStore();
        const addInventoryItem = vi.fn();
        const addMagicItem = vi.fn();
        const acknowledgeTransfers = vi.fn().mockResolvedValue(true);
        const updateCurrency = vi.fn();
        const onInsufficientFunds = vi.fn();
        // 40 cp on hand, 300 cp committed cost.
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
            clearAppliedTransfer: store.clearAppliedTransfer,
            addInventoryItem,
            addMagicItem,
            acknowledgeTransfers,
            currency,
            updateCurrency,
            onInsufficientFunds,
          })
        );

        // The console log alone reaches no one — this callback is the
        // caller's hook into telling the player why every coin they had is
        // now gone. It must fire with the exact numbers, not just "some
        // shortfall happened".
        expect(onInsufficientFunds).toHaveBeenCalledTimes(1);
        expect(onInsufficientFunds).toHaveBeenCalledWith({
          transferId: 'transfer-1',
          costCopper: 300,
          heldCopper: 40,
          shortfallCopper: 260,
        });
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });

    it('omitting onInsufficientFunds does not throw on the insufficient-purse path', () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      try {
        const store = makeStore();
        const addInventoryItem = vi.fn();
        const addMagicItem = vi.fn();
        const acknowledgeTransfers = vi.fn().mockResolvedValue(true);
        const updateCurrency = vi.fn();
        const currency: Currency = {
          copper: 0,
          silver: 4,
          electrum: 0,
          gold: 0,
          platinum: 0,
        };
        const transfer = makeTransfer({ costCopper: 300 });

        expect(() =>
          renderHook(() =>
            useItemTransferAutoMerge({
              transfers: [transfer],
              appliedTransferIds: store.appliedTransferIds,
              recordAppliedTransfer: store.recordAppliedTransfer,
              clearAppliedTransfer: store.clearAppliedTransfer,
              addInventoryItem,
              addMagicItem,
              acknowledgeTransfers,
              currency,
              updateCurrency,
              // onInsufficientFunds intentionally omitted (optional).
            })
          )
        ).not.toThrow();

        expect(updateCurrency).toHaveBeenCalledWith({
          copper: 0,
          silver: 0,
          electrum: 0,
          gold: 0,
          platinum: 0,
        });
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });

    it('a non-integer costCopper is treated as a no-op rather than draining the purse', () => {
      const store = makeStore();
      const addInventoryItem = vi.fn();
      const addMagicItem = vi.fn();
      const acknowledgeTransfers = vi.fn().mockResolvedValue(true);
      const updateCurrency = vi.fn();
      const onInsufficientFunds = vi.fn();
      // A well-behaved purse that could never actually produce this value —
      // simulating a malformed/forged costCopper reaching the client. If the
      // hook naively passed this straight to spendCopper, the break loop
      // could never converge on a fractional remainder, spendCopper would
      // return null, and the purse would be wiped for a value that was
      // never a legitimate charge.
      const currency: Currency = {
        copper: 4,
        silver: 3,
        electrum: 0,
        gold: 2,
        platinum: 0,
      };
      const transfer = makeTransfer({ costCopper: 50.5 });

      renderHook(() =>
        useItemTransferAutoMerge({
          transfers: [transfer],
          appliedTransferIds: store.appliedTransferIds,
          recordAppliedTransfer: store.recordAppliedTransfer,
          clearAppliedTransfer: store.clearAppliedTransfer,
          addInventoryItem,
          addMagicItem,
          acknowledgeTransfers,
          currency,
          updateCurrency,
          onInsufficientFunds,
        })
      );

      expect(addInventoryItem).toHaveBeenCalledTimes(1);
      expect(updateCurrency).not.toHaveBeenCalled();
      expect(onInsufficientFunds).not.toHaveBeenCalled();
    });
  });

  describe('cjson empty-array normalization (final review follow-up)', () => {
    // Redis Lua's `cjson` encodes an empty table as an empty OBJECT, not an
    // array, unless the encoding script writes the array literal explicitly
    // — both PURCHASE_SCRIPT's item clone and the item_transfer enqueue
    // round-trip through it, so `InventoryItem.tags: []` / `MagicItem.
    // properties: []` can arrive here as `{}`. `|| []` would NOT catch this
    // (an empty object is truthy), so these pin the `Array.isArray` guard
    // added at this merge site.
    it('normalizes an inventory transfer whose tags arrived as {} (not []) into an empty array', () => {
      const store = makeStore();
      const addInventoryItem = vi.fn();
      const addMagicItem = vi.fn();
      const acknowledgeTransfers = vi.fn().mockResolvedValue(true);
      const updateCurrency = vi.fn();
      const transfer = makeTransfer({
        item: {
          id: 'item-1',
          name: 'Potion of Healing',
          category: 'consumable',
          quantity: 1,
          // Simulates the cjson round-trip corruption directly, since this
          // hook only ever sees already-deserialized JSON by the time it
          // runs (the corruption happens server-side, not in this hook).
          tags: {} as unknown as string[],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      });

      renderHook(() =>
        useItemTransferAutoMerge({
          transfers: [transfer],
          appliedTransferIds: store.appliedTransferIds,
          recordAppliedTransfer: store.recordAppliedTransfer,
          clearAppliedTransfer: store.clearAppliedTransfer,
          addInventoryItem,
          addMagicItem,
          acknowledgeTransfers,
          currency: DEFAULT_CURRENCY,
          updateCurrency,
        })
      );

      expect(addInventoryItem).toHaveBeenCalledWith(
        expect.objectContaining({ tags: [] })
      );
    });

    it('normalizes a magic-item transfer whose properties arrived as {} (not []) into an empty array', () => {
      const store = makeStore();
      const addInventoryItem = vi.fn();
      const addMagicItem = vi.fn();
      const acknowledgeTransfers = vi.fn().mockResolvedValue(true);
      const updateCurrency = vi.fn();
      const magicItem: MagicItem = {
        id: 'wand-1',
        name: 'Wand of Magic Missiles',
        category: 'wand',
        rarity: 'uncommon',
        description: 'Fires magic missiles.',
        properties: {} as unknown as string[],
        requiresAttunement: false,
        isAttuned: false,
        isEquipped: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      const transfer = makeTransfer({ itemKind: 'magic', item: magicItem });

      renderHook(() =>
        useItemTransferAutoMerge({
          transfers: [transfer],
          appliedTransferIds: store.appliedTransferIds,
          recordAppliedTransfer: store.recordAppliedTransfer,
          clearAppliedTransfer: store.clearAppliedTransfer,
          addInventoryItem,
          addMagicItem,
          acknowledgeTransfers,
          currency: DEFAULT_CURRENCY,
          updateCurrency,
        })
      );

      expect(addMagicItem).toHaveBeenCalledWith(
        expect.objectContaining({ properties: [] })
      );
    });
  });
});
