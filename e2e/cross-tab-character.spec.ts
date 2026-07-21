import { test, expect } from '@playwright/test';

import {
  createCharacter,
  waitForStoresReady,
  storeHp,
  damageCharacter,
} from './helpers';

// Mechanism pin (PR #170): two tabs holding the SAME character converge via
// `initCrossTabCharacterSync` — a real `storage` event + revision-guarded
// apply. Proven working end-to-end in real Chromium (see
// scratchpad/repro/evidence.md, Experiment A). This spec must stay GREEN;
// if it ever fails, the bug is in the spec, not in this mechanism.
test('damage applied in one tab reaches another tab of the same character', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const tab1 = await context.newPage();

  const characterUrl = await createCharacter(tab1, 'SoloHero');

  const tab2 = await context.newPage();
  await tab2.goto(characterUrl, { waitUntil: 'networkidle' });
  await waitForStoresReady(tab2);

  const { max: hpMax } = await storeHp(tab1);

  await damageCharacter(tab1, 5);

  await expect
    .poll(async () => (await storeHp(tab2)).current, {
      message:
        'tab2 should observe the damage applied in tab1 via the storage event',
      timeout: 10_000,
    })
    .toBeLessThan(hpMax);

  // Both tabs must agree on the same, correct value — not just "less than max".
  const [tab1Current, tab2Current] = await Promise.all([
    storeHp(tab1).then(hp => hp.current),
    storeHp(tab2).then(hp => hp.current),
  ]);
  expect(tab1Current).toBe(hpMax - 5);
  expect(tab2Current).toBe(hpMax - 5);
});
