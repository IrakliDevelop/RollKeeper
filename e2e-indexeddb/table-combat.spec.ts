import { readFile } from 'node:fs/promises';

import { expect, test, type Page } from '@playwright/test';

const CAMPAIGN = {
  code: 'E2ECOMBAT',
  name: 'Combat E2E',
  createdAt: '2026-10-07T00:00:00.000Z',
};
const MAP = {
  id: 'map-combat',
  campaignCode: CAMPAIGN.code,
  name: 'Bridge Map',
  mapImageUrl: '/synthetic-map.webp',
  mapImageSize: { w: 1200, h: 800 },
  canvasState:
    '{"version":4,"camera":{"position":{"x":0,"y":0},"zoom":1},"elements":[],"layers":[],"extensions":{"fog":{"version":1,"data":null}}}',
  dmOnlyElements: {},
  gridEnabled: false,
  linkedEncounterIds: [],
  markers: [],
  createdAt: '2026-10-07T00:00:00.000Z',
  updatedAt: '2026-10-07T00:00:00.000Z',
};
const PLAYERS = {
  campaign: { code: CAMPAIGN.code, name: CAMPAIGN.name },
  players: [
    {
      playerId: 'legacy-aria',
      playerName: 'Sam',
      characterId: 'legacy-aria',
      characterName: 'Aria',
      characterData: {
        class: { name: 'Rogue' },
        level: 3,
        armorClass: 14,
        hitPoints: { current: 20, max: 20 },
        abilities: { dexterity: 16 },
      },
      lastSynced: '2026-10-07T00:00:00.000Z',
    },
  ],
};

async function routeOffline(page: Page) {
  await page.route(`**/api/campaign/${CAMPAIGN.code}/players`, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(PLAYERS),
    })
  );
  // No relay or Table control service: combat must stay fully usable locally.
  await page.route(`**/api/campaign/${CAMPAIGN.code}/table/**`, route =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: '{"error":"offline"}',
    })
  );
}

async function readTable(page: Page) {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('rollkeeper-table', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction([
      'campaigns',
      'scenes',
      'encounters',
      'logs',
    ]);
    const read = (store: string) =>
      new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
        const request = transaction.objectStore(store).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    const [campaigns, scenes, encounters, logs] = await Promise.all([
      read('campaigns'),
      read('scenes'),
      read('encounters'),
      read('logs'),
    ]);
    database.close();
    return { campaigns, scenes, encounters, logs };
  });
}

async function setInitiative(page: Page, name: string, value: string) {
  const input = page.getByLabel(`Initiative for ${name}`);
  await input.fill(value);
  await input.press('Enter');
  await expect(page.getByText('Saving…')).toHaveCount(0);
}

test('scene combat: three of six members, manual initiatives, reload, conflict, second run and history', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const context = await browser.newContext({ acceptDownloads: true });
  await context.addInitScript(
    ({ campaign, map }) => {
      if (localStorage.getItem('rollkeeper-dm-data')) return;
      localStorage.setItem(
        'rollkeeper-dm-data',
        JSON.stringify({
          state: { dmId: 'dm-combat', campaigns: [campaign] },
          version: 1,
        })
      );
      localStorage.setItem(
        'rollkeeper-battlemap-data',
        JSON.stringify({
          state: { battleMaps: { [campaign.code]: { [map.id]: map } } },
          version: 0,
        })
      );
    },
    { campaign: CAMPAIGN, map: MAP }
  );
  const page = await context.newPage();
  await routeOffline(page);
  await page.goto(`/dm/campaign/${CAMPAIGN.code}/battlemaps`);
  await page.getByRole('button', { name: 'Adopt Bridge Map' }).click();
  await expect(page.getByRole('button', { name: 'Open scene' })).toBeVisible();
  const legacyBefore = await page.evaluate(() => ({
    map: localStorage.getItem('rollkeeper-battlemap-data'),
    encounters: localStorage.getItem('rollkeeper-encounter-data'),
    combatLog: localStorage.getItem('rollkeeper-combat-log'),
  }));
  const sceneId = String((await readTable(page)).scenes[0]!.sceneId);
  const sceneUrl = `/dm/campaign/${CAMPAIGN.code}/table/${sceneId}`;
  await page.goto(sceneUrl);
  await expect(page.getByRole('button', { name: 'New run' })).toBeVisible();

  // Six scene members: the verified party member and five manual PCs.
  const dialog = page.getByRole('dialog');
  await page.getByRole('button', { name: 'Add to scene' }).click();
  await dialog.getByRole('tab', { name: 'Party' }).click();
  await dialog.getByRole('button', { name: /Aria/ }).click();
  await expect(page.getByText(/Player-controlled · Not on map/)).toBeVisible();
  for (const name of ['Nyx', 'Bram', 'Cora', 'Dax', 'Eli']) {
    await page.getByRole('button', { name: 'Add to scene' }).click();
    await dialog.getByRole('tab', { name: 'Manual PC' }).click();
    await dialog.getByLabel('Name').fill(name);
    await dialog.getByLabel('Max HP').fill('12');
    await dialog.getByLabel('Armor class').fill('13');
    await dialog.getByRole('button', { name: 'Add PC' }).click();
    await expect(dialog).toHaveCount(0);
  }

  // Run with three participants and physical rolls (0 valid, one missing).
  await page.getByRole('button', { name: 'New run' }).click();
  await page.getByLabel('Run label').fill('Bridge ambush');
  await page.getByRole('button', { name: 'Create run' }).click();
  await page.getByRole('button', { name: 'Choose participants' }).click();
  for (const name of ['Aria', 'Nyx', 'Bram'])
    await dialog.getByRole('checkbox', { name }).click();
  await dialog.getByRole('button', { name: 'Save participants' }).click();
  await expect(dialog).toHaveCount(0);
  for (const name of ['Cora', 'Dax', 'Eli'])
    await expect(
      page.getByText(`${name} · Bystander — not in initiative`)
    ).toBeVisible();
  await setInitiative(page, 'Aria', '15');
  await setInitiative(page, 'Nyx', '0');
  await page.getByRole('button', { name: 'Start combat' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Missing initiative: Bram' })
  ).toBeVisible();
  await setInitiative(page, 'Bram', '8');
  await page.getByRole('button', { name: 'Start combat' }).click();
  await expect(page.getByText('ROUND 1 · NOW')).toBeVisible();
  await expect(
    page.getByText(/Started locally · not broadcasting|Not broadcasting/)
  ).toBeVisible();
  // A2: at desktop width the status line takes the toolbar width instead of
  // wrapping word-by-word beside the buttons.
  const status = page.getByTestId('table-publication-status');
  const statusBox = (await status.boundingBox())!;
  const panelBox = (await page
    .getByTestId('dm-vtt-studio-panel')
    .boundingBox())!;
  expect(statusBox.width).toBeGreaterThan(panelBox.width * 0.75);

  // Reload mid-fight: run, turn and pending intent come back from IndexedDB.
  await page.reload();
  await expect(page.getByText('ROUND 1 · NOW')).toBeVisible();
  const turnPill = page.getByText('ROUND 1 · NOW').locator('..');
  await expect(turnPill).toContainText('Aria');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(turnPill).toContainText('Bram');

  // Duplicate tab: a change elsewhere is surfaced, never silently replanned.
  const other = await context.newPage();
  await routeOffline(other);
  await other.addInitScript(() => {
    // Keep this tab from invalidating the first one, so it acts on stale state.
    BroadcastChannel.prototype.postMessage = () => {};
  });
  await other.goto(sceneUrl);
  await expect(other.getByText('ROUND 1 · NOW')).toBeVisible();
  await other.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(other.getByText('ROUND 1 · NOW').locator('..')).toContainText(
    'Nyx'
  );
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(
    page.getByText('Changed elsewhere — review and retry')
  ).toBeVisible();
  await other.close();
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByText('ROUND 2 · NOW')).toBeVisible();
  await expect(page.getByText('ROUND 2 · NOW').locator('..')).toContainText(
    'Aria'
  );

  await page.getByRole('button', { name: 'End combat' }).click();
  await expect(page.getByText('ROUND 2 · NOW')).toHaveCount(0);

  // Second run in the same scene.
  await page.getByRole('button', { name: 'New run' }).click();
  await page.getByLabel('Run label').fill('Second wave');
  await page.getByRole('button', { name: 'Create run' }).click();
  await page.getByRole('button', { name: 'Choose participants' }).click();
  for (const name of ['Cora', 'Dax'])
    await dialog.getByRole('checkbox', { name }).click();
  await dialog.getByRole('button', { name: 'Save participants' }).click();
  await setInitiative(page, 'Cora', '11');
  await setInitiative(page, 'Dax', '11');
  await page.getByRole('button', { name: 'Start combat' }).click();
  await expect(page.getByText('ROUND 1 · NOW')).toBeVisible();
  await page.getByRole('button', { name: 'End combat' }).click();
  await expect(page.getByText('ROUND 1 · NOW')).toHaveCount(0);

  const stored = await readTable(page);
  const runs = stored.encounters.filter(run => run.label);
  expect(runs.map(run => run.label).sort()).toEqual([
    'Bridge ambush',
    'Second wave',
  ]);
  expect(runs.every(run => run.isActive === false)).toBe(true);
  expect(stored.logs).toHaveLength(2);
  expect(stored.campaigns[0]).toMatchObject({ activeRunId: null });

  // History: view and export JSON.
  await page.getByRole('button', { name: 'History' }).click();
  await dialog
    .getByRole('button', { name: /Bridge ambush · generation 1/ })
    .click();
  await expect(dialog.getByText(/COMBAT STARTED/)).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Export JSON' }).click();
  const download = await downloadPromise;
  const exported = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(exported).toMatchObject({
    format: 'rollkeeper-table-combat-history',
    version: 1,
    label: 'Bridge ambush',
    combatGeneration: 1,
    loggingPaused: false,
  });
  expect(exported.events[0]).toMatchObject({ type: 'combat_start' });

  // 390px: the combat panel and its dialogs cause no horizontal overflow.
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  const noHorizontalOverflow = () =>
    page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth
    );
  expect(await noHorizontalOverflow()).toBe(true);
  await page.getByRole('button', { name: 'Choose participants' }).click();
  await expect(dialog).toBeVisible();
  expect(await noHorizontalOverflow()).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  // A1: with the (tall, wrapped) live-control status header showing, the
  // panel's tabs, collapse control, an initiative input and Start combat are
  // inside the 390x844 viewport without scrolling any inner region.
  await expect(
    page.getByText(/Private authority preparation failed/)
  ).toBeVisible();
  const panel = page.getByTestId('dm-vtt-studio-panel');
  for (const control of [
    panel.getByRole('button', { name: 'Initiative' }),
    panel.getByRole('button', { name: 'Selected' }),
    panel.getByRole('button', { name: 'Collapse combat panel' }),
    panel.getByLabel('Initiative for Cora'),
    panel.getByRole('button', { name: 'Start combat' }),
  ]) {
    const box = (await control.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(box.y + box.height).toBeLessThanOrEqual(844);
    await control.click({ trial: true });
  }

  // Original map and legacy stores were never written by scene combat.
  expect(
    await page.evaluate(() => ({
      map: localStorage.getItem('rollkeeper-battlemap-data'),
      encounters: localStorage.getItem('rollkeeper-encounter-data'),
      combatLog: localStorage.getItem('rollkeeper-combat-log'),
    }))
  ).toEqual(legacyBefore);
  await context.close();
});
