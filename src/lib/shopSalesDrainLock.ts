export interface DrainLockCallbacks {
  onPromoted: (campaignCode: string) => void;
}

const LOCK_PREFIX = 'rk-shop-sales-drain-';

/** Unlike `characterWriterLock`'s equivalent this does NOT require
 *  `BroadcastChannel`: nothing is forwarded between tabs here. A follower
 *  simply does not drain, so an exclusive lock is the whole mechanism. */
const locksSupported = (): boolean =>
  typeof navigator !== 'undefined' &&
  'locks' in navigator &&
  typeof navigator.locks?.request === 'function';

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException
    ? error.name === 'AbortError'
    : typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      (error as { name: unknown }).name === 'AbortError';

/**
 * Elects ONE tab per campaign to run the DM shop-sales drain
 * (`useDmShopSalesSync`). `ShopSalesSyncProvider` mounts in the campaign
 * route-group layout, so a DM with the dashboard in one tab and a battlemap
 * in another otherwise runs two independent drains against the same Redis
 * log; `npcStore.appliedShopSaleIds` is per-tab in-memory state, so a tab
 * that fetches inside the window between the other tab's fetch and its
 * acknowledgement re-applies the same sale — crediting `npc.currency` and
 * decrementing stock twice, silently.
 *
 * Deliberately a long-held leadership lock rather than a short lock taken
 * around each drain pass: serialising the passes alone would not help,
 * because the ledger that decides "already applied" lives in each tab's own
 * memory and there is no cross-tab handoff of it that is guaranteed to land
 * before the next pass starts.
 *
 * Reduced guarantee without Web Locks (matching `CharacterWriterLock`): every
 * tab reports leader and the pre-existing double-drain behaviour returns.
 * Every browser this app targets ships Web Locks; the fallback exists so a
 * missing API degrades to today's behaviour instead of no reconciliation.
 */
export class ShopSalesDrainLock {
  private heldFor: string | null = null;
  private targetCode: string | null = null;
  private releaseHeld: (() => void) | null = null;
  private abortQueued: AbortController | null = null;

  isLeader(campaignCode: string): boolean {
    if (!locksSupported()) return true;
    return this.heldFor === campaignCode;
  }

  /** Pass `''` to release without acquiring anything (unmount). */
  switchTo(campaignCode: string, callbacks: DrainLockCallbacks): void {
    if (this.targetCode === campaignCode) return;
    this.targetCode = campaignCode;

    this.abortQueued?.abort();
    this.abortQueued = null;
    this.releaseHeld?.();
    this.releaseHeld = null;
    this.heldFor = null;

    if (!campaignCode || !locksSupported()) return;

    const abort = new AbortController();
    this.abortQueued = abort;
    void navigator.locks
      .request(
        LOCK_PREFIX + campaignCode,
        { mode: 'exclusive', signal: abort.signal },
        () =>
          new Promise<void>(resolve => {
            if (this.targetCode !== campaignCode) {
              resolve(); // switched away while queued — hand the lock on
              return;
            }
            this.heldFor = campaignCode;
            this.releaseHeld = () => {
              if (this.heldFor === campaignCode) this.heldFor = null;
              resolve();
            };
            try {
              callbacks.onPromoted(campaignCode);
            } catch (error) {
              // A throwing onPromoted must not leave this instance believing
              // it leads after the browser has handed the real lock on.
              console.error('ShopSalesDrainLock: onPromoted threw', error);
              if (this.heldFor === campaignCode) this.heldFor = null;
              this.releaseHeld = null;
              resolve();
            }
          })
      )
      .catch((error: unknown) => {
        if (isAbortError(error)) return; // expected on switch/cancel
        console.error('ShopSalesDrainLock: lock request failed', error);
      });
  }
}

export const shopSalesDrainLock = new ShopSalesDrainLock();
