import { expect, test } from '@playwright/test';
import { waitForEncounterStore } from './helpers';

test('bestiary search finds a goblin in the add-combatant dialog', async ({
  page,
}) => {
  await page.goto('/dm/campaign/E2E01/encounters');
  await waitForEncounterStore(page);
  const encounterId = await page.evaluate(() =>
    window
      .__rkStores!.encounter.getState()
      .createEncounter('Search test', 'E2E01')
  );

  await page.goto(`/dm/campaign/E2E01/encounters/${encounterId}`);
  await page.getByRole('button', { name: 'Add combatant' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add combatant' });
  await dialog
    .getByRole('textbox', { name: 'Search the bestiary' })
    .fill('goblin');

  await expect(dialog.getByText('Goblin', { exact: true })).toBeVisible();
  await dialog.getByText('Goblin', { exact: true }).click();
  await expect(
    dialog.getByRole('button', { name: 'Add Goblin' })
  ).toBeVisible();
});
