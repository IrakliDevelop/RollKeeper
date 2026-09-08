import { useEffect, useState } from 'react';

import {
  ShopSalesDrainLock,
  shopSalesDrainLock,
} from '@/lib/shopSalesDrainLock';

const NOOP_CALLBACKS = { onPromoted: () => {} };

/**
 * True only in the ONE tab that currently holds this campaign's shop-sales
 * drain lock. Releases on unmount, which promotes whichever other tab is
 * queued — so closing the leader tab does not stop reconciliation.
 */
export function useShopSalesDrainLeader(
  campaignCode: string | null | undefined,
  lock: ShopSalesDrainLock = shopSalesDrainLock
): boolean {
  const [isLeader, setIsLeader] = useState(false);

  useEffect(() => {
    if (!campaignCode) {
      lock.switchTo('', NOOP_CALLBACKS);
      setIsLeader(false);
      return;
    }
    lock.switchTo(campaignCode, {
      onPromoted: () => setIsLeader(true),
    });
    // Without Web Locks `switchTo` is a no-op and `onPromoted` never fires;
    // `isLeader` still reports true there (documented reduced guarantee), so
    // read it directly rather than waiting for a promotion that won't come.
    setIsLeader(lock.isLeader(campaignCode));
    return () => {
      lock.switchTo('', NOOP_CALLBACKS);
      setIsLeader(false);
    };
  }, [campaignCode, lock]);

  return isLeader;
}
