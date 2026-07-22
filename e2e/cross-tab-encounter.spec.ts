import { test, expect } from '@playwright/test';

import { waitForEncounterStore } from './helpers';

// Mechanism pin: two DM tabs converge via `initCrossTabEncounterSync` — a
// real `storage` event + per-encounter updatedAt merge. Pins the fix for
// "the battlemap tab needs a reload to see encounter changes".
test('encounter created and combat started in one DM tab reach another tab', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const tab1 = await context.newPage();
  await tab1.goto('/dm/campaign/E2E01/encounters', {
    waitUntil: 'networkidle',
  });
  await waitForEncounterStore(tab1);

  const tab2 = await context.newPage();
  await tab2.goto('/dm/campaign/E2E01/encounters', {
    waitUntil: 'networkidle',
  });
  await waitForEncounterStore(tab2);

  // Created AFTER tab2 loaded — only the storage event can deliver it.
  const encounterId = await tab1.evaluate(() =>
    window
      .__rkStores!.encounter.getState()
      .createEncounter('E2E Sync Pin', 'E2E01')
  );

  // Adoption path: unknown id appears in tab2.
  await expect
    .poll(
      async () =>
        tab2.evaluate(
          id =>
            window
              .__rkStores!.encounter.getState()
              .encounters.some(e => e.id === id),
          encounterId
        ),
      { timeout: 10_000 }
    )
    .toBe(true);

  // Newer-updatedAt path: start combat in tab1, tab2 observes isActive.
  await tab1.evaluate(
    id => window.__rkStores!.encounter.getState().startCombat(id),
    encounterId
  );
  await expect
    .poll(
      async () =>
        tab2.evaluate(
          id =>
            window
              .__rkStores!.encounter.getState()
              .encounters.find(e => e.id === id)?.isActive,
          encounterId
        ),
      { timeout: 10_000 }
    )
    .toBe(true);
});
