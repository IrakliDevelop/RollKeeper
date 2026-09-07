import { useCallback, useRef, useState } from 'react';

/**
 * Tracks copper a player has committed to shop purchases this VTT visit but
 * that has not yet been debited from `character.currency` — the debit only
 * lands later, client-side, when `useItemTransferAutoMerge` runs on the
 * character-sheet route (never co-mounted with the VTT canvas). Without
 * this, the shop dialog would show a purse that ignores purchases already
 * "spent," letting a player commit more than they can pay for.
 *
 * Two independent sources feed this total, unioned by transfer id so
 * neither can double-count the same purchase:
 *
 * 1. **The pending item-transfer queue** (`pendingTransfers`, i.e.
 *    `sharedState.transfers`) — authoritative and reload-durable, since it
 *    lives server-side. But `useSharedCampaignState` only polls every
 *    5-15 s, so a fast close-and-retap on the same merchant can read a
 *    stale queue that hasn't caught up to a purchase made seconds ago.
 * 2. **A `sessionStorage` receipt** written the instant `recordCommit` is
 *    called (right after a purchase succeeds) — immediate, but local to
 *    this tab, so it does NOT survive the debit landing unless it is
 *    reconciled against (1) and swept away once no longer needed.
 *
 * The reconciliation rule that matters: a receipt's absence from the queue
 * means "already merged and acknowledged" ONLY once that id has actually
 * been observed in the queue at least once (`CommitReceipt.seen`). Before
 * it has been seen there, absence just means the poll hasn't caught up —
 * treating that as "done" would let the total evaporate before the debit
 * really landed. A receipt neither seen nor applied expires after
 * `STALE_RECEIPT_MS` as a backstop against a transfer this tab enqueued
 * but the server, for whatever reason, never queued.
 *
 * This deliberately fails open, matching the pre-existing behaviour: if
 * both sources somehow miss a purchase (e.g. a receipt expires before the
 * queue ever shows it), the committed total simply undercounts it — the
 * item is still kept, the purse still drains to zero on debit, and the
 * player still sees the existing toast. This hook only narrows the window
 * in which that can happen; it does not (and cannot) close it entirely.
 */

export interface CommittedShopSpend {
  /** Copper committed by purchases whose debit has not landed yet. */
  committedCopper: number;
  /** Pass a successful purchase's payload straight through. */
  recordCommit: (commit: { costCopper: number; transferIds: string[] }) => void;
}

interface CommitReceipt {
  /** Copper this transfer will debit; 0 for the non-first transfer of a
   *  multi-unit magic-item purchase (the server stamps the whole cost on
   *  index 0 — see PURCHASE_SCRIPT). */
  costCopper: number;
  /** Epoch ms the receipt was written, for the staleness sweep. */
  at: number;
  /** True once this id has actually been observed in the pending queue.
   *  Absence from the queue only means "already merged and acked" AFTER it
   *  has been seen there at least once; before that it means the poll has
   *  simply not caught up. */
  seen: boolean;
}

type Receipts = Record<string, CommitReceipt>;

const STALE_RECEIPT_MS = 30 * 60 * 1000;

function storageKey(characterId: string): string {
  return `rollkeeper-vtt-committed-spend:${characterId}`;
}

// Fallback used ONLY when `sessionStorage` access itself throws (e.g. an
// iframe sandboxed without `allow-same-origin`, or a privacy extension that
// blocks the Storage API outright) — never as a general cache. It must not
// shadow a genuinely empty or explicitly cleared store, and it cannot
// survive an actual page reload anyway (it's plain JS module state, wiped
// with everything else) — its only job is to keep this hook from throwing
// mid-session when the browser refuses storage access at all.
const memoryFallback = new Map<string, Receipts>();

function readReceipts(key: string): Receipts {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw == null) return {};
    try {
      const parsed: unknown = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as Receipts) : {};
    } catch {
      return {}; // Corrupt entry — treat as absent rather than throwing.
    }
  } catch {
    return memoryFallback.get(key) ?? {};
  }
}

function writeReceipts(key: string, receipts: Receipts): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(receipts));
  } catch {
    memoryFallback.set(key, receipts);
  }
}

/** Applies the four sweep rules to `receipts` against the current queue
 *  snapshot. Returns the same object reference (via unchanged per-id
 *  entries) when nothing moved, so callers can cheaply detect "no-op". */
function sweepReceipts(
  receipts: Receipts,
  pendingTransfers: { id: string; costCopper?: number }[],
  appliedTransferIds: string[],
  nowMs: number
): { receipts: Receipts; changed: boolean } {
  const pendingIds = new Set(pendingTransfers.map(t => t.id));
  const appliedIds = new Set(appliedTransferIds);
  let changed = false;
  const next: Receipts = {};

  for (const [id, receipt] of Object.entries(receipts)) {
    if (appliedIds.has(id)) {
      changed = true; // debit landed — drop
      continue;
    }
    if (receipt.seen && !pendingIds.has(id)) {
      changed = true; // was seen in the queue, now gone — merged and acked
      continue;
    }
    if (!receipt.seen && pendingIds.has(id)) {
      next[id] = { ...receipt, seen: true }; // poll caught up to it
      changed = true;
      continue;
    }
    if (!receipt.seen && nowMs - receipt.at > STALE_RECEIPT_MS) {
      changed = true; // never showed up in the queue — give up on it
      continue;
    }
    next[id] = receipt; // unchanged
  }

  return { receipts: next, changed };
}

function sumCommitted(
  receipts: Receipts,
  pendingTransfers: { id: string; costCopper?: number }[],
  appliedTransferIds: string[]
): number {
  const appliedIds = new Set(appliedTransferIds);
  let total = 0;
  for (const receipt of Object.values(receipts)) {
    total += receipt.costCopper;
  }
  for (const transfer of pendingTransfers) {
    if (transfer.id in receipts) continue; // already counted via receipts
    if (appliedIds.has(transfer.id)) continue; // already debited
    if (
      Number.isInteger(transfer.costCopper) &&
      (transfer.costCopper as number) > 0
    ) {
      total += transfer.costCopper as number;
    }
  }
  return total;
}

export function useCommittedShopSpend(options: {
  characterId: string;
  /** `sharedState.transfers` — already scoped to this character server-side. */
  pendingTransfers: { id: string; costCopper?: number }[] | undefined;
  /** `characterStore`'s `appliedTransferIds`. */
  appliedTransferIds: string[];
  /** Injectable clock for tests. */
  now?: () => number;
}): CommittedShopSpend {
  const {
    characterId,
    pendingTransfers,
    appliedTransferIds,
    now = Date.now,
  } = options;
  const key = storageKey(characterId);
  const pending = pendingTransfers ?? [];

  const [receipts, setReceipts] = useState<Receipts>(() => readReceipts(key));

  // Roster-switch guard, mirroring `PlayerBattleMapCanvas`'s own
  // `characterId`-identity refs: this component instance may be reused for
  // a different character without an intervening unmount, and a different
  // `characterId` means a different storage key — reload from THAT key
  // rather than carrying this tab's in-memory receipts across the switch.
  const keyRef = useRef(key);
  if (keyRef.current !== key) {
    keyRef.current = key;
    setReceipts(readReceipts(key));
  }

  // Sweep on every render (adjusting state during render, same pattern as
  // the identity guard above — React discards this render and re-runs with
  // the swept receipts applied). Persist only when something actually
  // moved, never unconditionally.
  const nowMs = now();
  const { receipts: swept, changed } = sweepReceipts(
    receipts,
    pending,
    appliedTransferIds,
    nowMs
  );
  if (changed) {
    setReceipts(swept);
    writeReceipts(key, swept);
  }

  const committedCopper = sumCommitted(
    changed ? swept : receipts,
    pending,
    appliedTransferIds
  );

  const recordCommit = useCallback(
    (commit: { costCopper: number; transferIds: string[] }) => {
      if (!Number.isInteger(commit.costCopper) || commit.costCopper <= 0) {
        return;
      }
      if (commit.transferIds.length === 0) return;
      const at = now();
      setReceipts(prev => {
        const next: Receipts = { ...prev };
        commit.transferIds.forEach((id, index) => {
          // The server stamps the whole cost on the first transfer of a
          // multi-unit purchase and 0 on the rest (PURCHASE_SCRIPT) — mirror
          // that here so the union with the queue can never double-count.
          next[id] = {
            costCopper: index === 0 ? commit.costCopper : 0,
            at,
            seen: false,
          };
        });
        writeReceipts(key, next);
        return next;
      });
    },
    [key, now]
  );

  return { committedCopper, recordCommit };
}
