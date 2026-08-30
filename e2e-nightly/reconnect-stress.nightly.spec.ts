import { test, expect, Page, BrowserContext } from '@playwright/test';

import {
  createCharacter,
  waitForStoresReady,
  waitForCharacterLoaded,
  characterIdFromUrl,
  storeHp,
  damageCharacter,
  envelopeHp,
} from '../e2e/helpers';

/** Nightly reconnect/concurrency stress suite (roadmap "concurrency/reconnect
 * stress" nightly item). Not part of the default `test:e2e` run — driven by
 * `npm run test:reconnect:nightly`, which also repeats the core single-writer
 * regression matrix (e2e/single-writer-sync.spec.ts and friends) 3x before
 * running this file. This spec adds scenarios that matrix doesn't cover:
 * repeated real leader failover (closing the actual writer-lock holder, not
 * just any tab — see the leader-churn loop's comments for how the lock's
 * strict FIFO/no-preemption semantics are tracked) and concurrent full-page
 * reloads, both hammering the same character across many cycles and
 * asserting the surviving/reopened tabs always converge with no lost
 * writes. Reuses the same store/envelope helpers as
 * e2e/single-writer-sync.spec.ts rather than inventing new infrastructure. */

async function openTabOnUrl(
  context: BrowserContext,
  url: string,
  characterId: string
): Promise<Page> {
  const tab = await context.newPage();
  await tab.goto(url, { waitUntil: 'networkidle' });
  await waitForStoresReady(tab);
  await waitForCharacterLoaded(tab, characterId);
  return tab;
}

test('leader-churn x5 + reload-storm x3: cumulative damage converges with no lost writes', async ({
  browser,
}) => {
  test.slow();

  const context = await browser.newContext();

  // Setup: create a character in leaderTab (the first tab to request the
  // writer lock — it wins it immediately, see
  // src/lib/characterWriterLock.ts:37-56: `navigator.locks.request(...,
  // {mode: 'exclusive'})`, a strict FIFO queue with NO preemption). Open
  // followerTab on the same sheet URL — it requests the same lock second,
  // so it queues behind leaderTab and stays a follower (forwarding CANONICAL
  // actions as intents) until leaderTab actually releases the lock.
  let leaderTab = await context.newPage();
  const url = await createCharacter(leaderTab, 'ReconnectStressHero');
  const characterId = characterIdFromUrl(url);

  // The default new-character HP pool (max 8, from level 1 + d8 hit die) is
  // too small to survive the cumulative damage this stress loop applies
  // across 5 churn cycles + 3 reload cycles (up to 21). A max HP set
  // directly would get clobbered by the character page's mount-time
  // "auto-recalculate max HP from level/CON/class" effect on every tab open
  // and reload — so instead bump level + CON (which that recalculation is
  // actually derived from) and call the same recalculateMaxHP() action the
  // effect calls, then set a comfortably large `current`. This is
  // deterministic across remounts: the formula recomputes the same max each
  // time since level/CON don't change again.
  await leaderTab.evaluate(() => {
    const store = window.__rkStores!.character.getState();
    store.updateCharacter({
      level: 10,
      abilities: { ...store.character.abilities, constitution: 20 },
    });
    window.__rkStores!.character.getState().recalculateMaxHP();
    window.__rkStores!.character.getState().updateHitPoints({ current: 100 });
  });

  let followerTab = await openTabOnUrl(context, url, characterId);

  // Baseline is the `current` HP set above (100), not `max` (which the
  // formula in the setup evaluate() above pads well past it) — damage is
  // tracked against how much HP the character actually started with.
  const { current: startingHp } = await storeHp(leaderTab);
  let totalDamage = 0;

  // Leader-churn loop x5: each iteration closes `leaderTab` — the tab that
  // ACTUALLY holds the writer lock — never a follower, so every cycle is a
  // genuine failover (closing a follower tab triggers no promotion at all;
  // only closing the real lock-holder does, per the FIFO-no-preemption
  // model above). The invariant that makes this safe: `leaderTab` always
  // holds the lock and `followerTab` is the sole queued waiter, because the
  // only lock-affecting operations this loop performs are (a) closing
  // `leaderTab` — which promotes the queued `followerTab` — and (b) opening
  // one new tab per iteration, which queues behind whichever tab just got
  // promoted. Rotating `leaderTab = followerTab` (the just-promoted tab)
  // and `followerTab = freshTab` (the newly queued tab) at the end of each
  // iteration preserves that invariant into the next iteration, so the
  // *next* close also targets a real leader.
  for (let i = 0; i < 5; i++) {
    // Close the real leader — the only tab holding the Web Lock.
    await leaderTab.close();

    // The queued follower is promoted; mutate it as it takes over.
    await damageCharacter(followerTab, 1);
    totalDamage += 1;

    // Open a fresh tab on the same URL — it queues behind the newly
    // promoted leader as the next (and only) follower — and apply a
    // second, distinct mutation there (forwarded to the leader as an
    // intent, since this tab never holds the lock itself).
    const freshTab = await openTabOnUrl(context, url, characterId);
    await damageCharacter(freshTab, 2);
    totalDamage += 2;

    for (const tab of [followerTab, freshTab]) {
      await expect
        .poll(async () => (await storeHp(tab)).current, { timeout: 15_000 })
        .toBe(startingHp - totalDamage);
    }

    // Rotate: the just-promoted tab is the real leader for the next
    // iteration's close; the fresh tab is the new sole queued follower.
    leaderTab = followerTab;
    followerTab = freshTab;
  }

  // Reload storm x3: reload both tabs in parallel, wait for stores ready,
  // mutate concurrently in both tabs, assert convergence. (A reload doesn't
  // change which tab holds the lock — Web Locks releases are tied to page
  // lifetime, and both tabs survive the reload — so leaderTab/followerTab
  // stay accurate labels here too, though this section doesn't depend on
  // which one is which.)
  for (let i = 0; i < 3; i++) {
    await Promise.all([
      leaderTab.reload({ waitUntil: 'networkidle' }),
      followerTab.reload({ waitUntil: 'networkidle' }),
    ]);
    await Promise.all([
      waitForStoresReady(leaderTab),
      waitForStoresReady(followerTab),
    ]);
    await Promise.all([
      waitForCharacterLoaded(leaderTab, characterId),
      waitForCharacterLoaded(followerTab, characterId),
    ]);

    await Promise.all([
      damageCharacter(leaderTab, 1),
      damageCharacter(followerTab, 1),
    ]);
    totalDamage += 2;

    for (const tab of [leaderTab, followerTab]) {
      await expect
        .poll(async () => (await storeHp(tab)).current, { timeout: 15_000 })
        .toBe(startingHp - totalDamage);
    }
  }

  // Final: assert the localStorage envelope state equals in-store state in
  // both tabs and that total applied damage equals the sum (no lost
  // writes).
  for (const tab of [leaderTab, followerTab]) {
    const inStore = (await storeHp(tab)).current;
    expect(inStore).toBe(startingHp - totalDamage);
    await expect
      .poll(() => envelopeHp(tab, characterId), { timeout: 10_000 })
      .toBe(inStore);
  }
});
