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
 * repeated leader churn (tab close + reopen) and concurrent full-page
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

  // Setup: create a character in tab1, open tab2 on the same sheet URL.
  let tab1 = await context.newPage();
  const url = await createCharacter(tab1, 'ReconnectStressHero');
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
  await tab1.evaluate(() => {
    const store = window.__rkStores!.character.getState();
    store.updateCharacter({
      level: 10,
      abilities: { ...store.character.abilities, constitution: 20 },
    });
    window.__rkStores!.character.getState().recalculateMaxHP();
    window.__rkStores!.character.getState().updateHitPoints({ current: 100 });
  });

  const tab2 = await openTabOnUrl(context, url, characterId);

  // Baseline is the `current` HP set above (100), not `max` (which the
  // formula in the setup evaluate() above pads well past it) — damage is
  // tracked against how much HP the character actually started with.
  const { current: startingHp } = await storeHp(tab1);
  let totalDamage = 0;

  // Leader-churn loop x5: close the current leader tab, apply a mutation in
  // the surviving tab, open a fresh tab on the same URL, apply a second
  // distinct mutation there, then assert both tabs converge on the
  // cumulative state.
  for (let i = 0; i < 5; i++) {
    // tab1 is the current leader (it was either the original creator or the
    // freshly-opened tab from the previous iteration).
    await tab1.close();

    // Survivor applies a mutation while it promotes to leader.
    await damageCharacter(tab2, 1);
    totalDamage += 1;

    // Open a fresh tab on the same URL and apply a second, distinct
    // mutation there.
    const freshTab = await openTabOnUrl(context, url, characterId);
    await damageCharacter(freshTab, 2);
    totalDamage += 2;

    for (const tab of [tab2, freshTab]) {
      await expect
        .poll(async () => (await storeHp(tab)).current, { timeout: 15_000 })
        .toBe(startingHp - totalDamage);
    }

    // Rotate: freshTab becomes tab1 for the next iteration's close, tab2
    // remains the long-lived survivor.
    tab1 = freshTab;
  }

  // Reload storm x3: reload both tabs in parallel, wait for stores ready,
  // mutate concurrently in both tabs, assert convergence.
  for (let i = 0; i < 3; i++) {
    await Promise.all([
      tab1.reload({ waitUntil: 'networkidle' }),
      tab2.reload({ waitUntil: 'networkidle' }),
    ]);
    await Promise.all([waitForStoresReady(tab1), waitForStoresReady(tab2)]);
    await Promise.all([
      waitForCharacterLoaded(tab1, characterId),
      waitForCharacterLoaded(tab2, characterId),
    ]);

    await Promise.all([damageCharacter(tab1, 1), damageCharacter(tab2, 1)]);
    totalDamage += 2;

    for (const tab of [tab1, tab2]) {
      await expect
        .poll(async () => (await storeHp(tab)).current, { timeout: 15_000 })
        .toBe(startingHp - totalDamage);
    }
  }

  // Final: assert the localStorage envelope state equals in-store state in
  // both tabs and that total applied damage equals the sum (no lost
  // writes).
  for (const tab of [tab1, tab2]) {
    const inStore = (await storeHp(tab)).current;
    expect(inStore).toBe(startingHp - totalDamage);
    await expect
      .poll(() => envelopeHp(tab, characterId), { timeout: 10_000 })
      .toBe(inStore);
  }
});
