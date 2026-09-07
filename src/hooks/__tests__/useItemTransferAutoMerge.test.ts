import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useItemTransferAutoMerge } from '../useItemTransferAutoMerge';
import type { ItemTransfer } from '@/types/sharedState';
import type { InventoryItem } from '@/types/character';

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

    renderHook(() =>
      useItemTransferAutoMerge({
        transfers: [transfer],
        appliedTransferIds: store.appliedTransferIds,
        recordAppliedTransfer: store.recordAppliedTransfer,
        addInventoryItem,
        addMagicItem,
        acknowledgeTransfers,
      })
    );

    expect(addInventoryItem).toHaveBeenCalledTimes(1);
    expect(addMagicItem).not.toHaveBeenCalled();
    expect(store.recordAppliedTransfer).toHaveBeenCalledWith('transfer-1');
    expect(acknowledgeTransfers).toHaveBeenCalledTimes(1);
  });

  it('skips a transfer whose id is already in appliedTransferIds', () => {
    const store = makeStore(['transfer-1']);
    const addInventoryItem = vi.fn();
    const addMagicItem = vi.fn();
    const acknowledgeTransfers = vi.fn().mockResolvedValue(undefined);
    const transfer = makeTransfer();

    renderHook(() =>
      useItemTransferAutoMerge({
        transfers: [transfer],
        appliedTransferIds: store.appliedTransferIds,
        recordAppliedTransfer: store.recordAppliedTransfer,
        addInventoryItem,
        addMagicItem,
        acknowledgeTransfers,
      })
    );

    expect(addInventoryItem).not.toHaveBeenCalled();
    expect(addMagicItem).not.toHaveBeenCalled();
    expect(store.recordAppliedTransfer).not.toHaveBeenCalled();
    // Nothing was added, so there's nothing new to acknowledge.
    expect(acknowledgeTransfers).not.toHaveBeenCalled();
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

      // --- First mount: applies the transfer, acknowledge fails ---
      const first = renderHook(() =>
        useItemTransferAutoMerge({
          transfers: [transfer],
          appliedTransferIds: store.appliedTransferIds,
          recordAppliedTransfer: store.recordAppliedTransfer,
          addInventoryItem,
          addMagicItem,
          acknowledgeTransfers,
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
        })
      );

      // The item must be added exactly once across both mounts.
      expect(addInventoryItem).toHaveBeenCalledTimes(1);
    }
  );
});
