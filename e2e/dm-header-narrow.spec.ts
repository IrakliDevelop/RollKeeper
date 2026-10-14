import { expect, test } from '@playwright/test';

import type { Page } from '@playwright/test';

/**
 * PR08 C3 / Z1: DM campaign page headers fit a phone (360 to 390 px) in
 * every theme: no page overflow, and every header control inside the
 * viewport (a clipped control does not show in `scrollWidth`). Synthetic
 * seed: one DM campaign and one battle map, both with long names.
 */

const CODE = 'NARROW-E2E';
const MAP_ID = 'bm-narrow-e2e';
const NOW = '2000-01-01T00:00:00.000Z';
const CAMPAIGN = {
  code: CODE,
  name: 'Synthetic Acceptance Campaign With A Long Name',
  createdAt: NOW,
};
const MAP_NAME = 'A Very Long Synthetic Battle Map Name For Narrow Screens';

/** Seeds before the app's first script runs, so the storage import sees it. */
async function seed(page: Page, theme: string): Promise<void> {
  await page.addInitScript(
    ({ campaign, theme, mapId, mapName, now }) => {
      if (window.localStorage.getItem('rollkeeper-dm-data')) return;
      window.localStorage.setItem(
        'rollkeeper-dm-data',
        JSON.stringify({
          state: { dmId: 'dm-narrow-e2e', campaigns: [campaign] },
          version: 1,
        })
      );
      window.localStorage.setItem(
        'rollkeeper-battlemap-data',
        JSON.stringify({
          state: {
            battleMaps: {
              [campaign.code]: {
                [mapId]: {
                  id: mapId,
                  campaignCode: campaign.code,
                  name: mapName,
                  mapImageUrl: '',
                  mapImageSize: { w: 1200, h: 900 },
                  canvasState: JSON.stringify({
                    version: 2,
                    camera: { position: { x: 0, y: 0 }, zoom: 1 },
                    elements: [],
                  }),
                  dmOnlyElements: {},
                  gridEnabled: false,
                  linkedEncounterIds: [],
                  markers: [],
                  createdAt: now,
                  updatedAt: now,
                },
              },
            },
          },
          version: 0,
        })
      );
      window.localStorage.setItem('rollkeeper-theme', theme);
    },
    { campaign: CAMPAIGN, theme, mapId: MAP_ID, mapName: MAP_NAME, now: NOW }
  );
}

/** Page overflow and the right-most header control's right edge. */
async function measure(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const controls = document.querySelectorAll(
      'header a, header button, header [role="button"], header input'
    );
    let rightMost = 0;
    for (const control of controls) {
      const box = control.getBoundingClientRect();
      if (box.width > 0) rightMost = Math.max(rightMost, box.right);
    }
    return {
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      innerWidth: window.innerWidth,
      rightMost,
      controls: controls.length,
    };
  });
}

const heading = (name: string) => (page: Page) =>
  expect(page.getByRole('heading', { level: 1, name })).toBeVisible();

const ROUTES = [
  { path: `/dm/campaign/${CODE}/battlemaps`, ready: heading('Battle Maps') },
  {
    path: `/dm/campaign/${CODE}/battlemaps/${MAP_ID}`,
    ready: heading(MAP_NAME),
  },
  { path: `/dm/campaign/${CODE}/locations`, ready: heading('Locations') },
  { path: `/dm/campaign/${CODE}/encounters`, ready: heading('Encounters') },
  {
    path: `/dm/campaign/${CODE}/table`,
    ready: async (page: Page) => {
      await expect(page.getByRole('main')).toBeVisible();
      await expect(page.getByText(/Loading (Table|scenes)…/u)).toHaveCount(0);
    },
    tableRoute: true,
  },
];

for (const theme of ['parchment', 'dark', 'light'])
  for (const width of [390, 360])
    for (const route of ROUTES)
      test(`${route.path} fits ${width} px (${theme})`, async ({ page }) => {
        // A dark system preference proves the stored light theme wins.
        await page.emulateMedia({ colorScheme: 'dark' });
        await page.setViewportSize({ width, height: 720 });
        await seed(page, theme);
        await page.goto(route.path, { waitUntil: 'domcontentloaded' });
        await route.ready(page);
        if (theme === 'light')
          await expect(page.locator('html')).not.toHaveAttribute(
            'data-theme',
            /.+/u
          );
        else
          await expect(page.locator('html')).toHaveAttribute(
            'data-theme',
            theme
          );
        const box = await measure(page);
        expect(box.clientWidth).toBe(width);
        expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth);
        if (!route.tableRoute) expect(box.controls).toBeGreaterThan(0);
        expect(box.rightMost).toBeLessThanOrEqual(box.innerWidth);
      });

test('narrow headers keep accessible names at 360 px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 720 });
  await seed(page, 'parchment');
  await page.goto(`/dm/campaign/${CODE}/battlemaps`);
  await expect(
    page.getByRole('button', { name: 'New Battle Map' })
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: `Back to ${CAMPAIGN.name}` })
  ).toBeVisible();
  await page.goto(`/dm/campaign/${CODE}/battlemaps/${MAP_ID}`);
  await expect(
    page.getByRole('link', { name: 'Back to Battle Maps' })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Setup', exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Play', exact: true })
  ).toBeVisible();
});

/**
 * PR08 D1: the editor top bar in Play mode (DmVttTopBar, scrolls sideways)
 * keeps the Table link and Setup/Play pinned on screen. The map is added
 * to the Table first, so the async link reads "Open in Table" as in the
 * manual run; the relay status chip shows ("Connecting…").
 */
async function adoptMapIntoTable(page: Page): Promise<void> {
  await page.goto(`/dm/campaign/${CODE}/battlemaps`);
  await page.getByRole('button', { name: `Add ${MAP_NAME} to Table` }).click();
  await expect(
    page.getByRole('button', { name: `${MAP_NAME} added` })
  ).toBeVisible();
}

/** The control is inside the viewport and is what a tap at its centre hits. */
async function reachable(page: Page, name: string, role: 'link' | 'button') {
  const control = page.getByRole(role, { name, exact: true });
  await expect(control).toBeVisible();
  return control.evaluate(element => {
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(
      box.left + box.width / 2,
      box.top + box.height / 2
    );
    return {
      right: box.right,
      left: box.left,
      innerWidth: window.innerWidth,
      hit: hit !== null && (hit === element || element.contains(hit)),
    };
  });
}

async function expectTheme(page: Page, theme: string): Promise<void> {
  if (theme === 'light')
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/u);
  else await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

async function editorTopBar(
  page: Page,
  options: { width: number; theme: string; adopted: boolean }
): Promise<void> {
  // A dark system preference proves the stored light theme wins.
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: options.width, height: 720 });
  await seed(page, options.theme);
  await page.addInitScript(
    ({ key }) => window.localStorage.setItem(key, 'play'),
    { key: `rollkeeper-battlemap-mode:${MAP_ID}` }
  );
  if (options.adopted) await adoptMapIntoTable(page);
  await page.goto(`/dm/campaign/${CODE}/battlemaps/${MAP_ID}`);
  await expectTheme(page, options.theme);
  await expect(page.getByText('Connecting…')).toBeAttached();
  const tableLink = options.adopted ? 'Open in Table' : 'Use in Table';
  for (const [name, role] of [
    [tableLink, 'link'],
    ['Setup', 'button'],
    ['Play', 'button'],
  ] as const) {
    const box = await reachable(page, name, role);
    expect(box.left, name).toBeGreaterThanOrEqual(0);
    expect(box.right, name).toBeLessThanOrEqual(box.innerWidth);
    expect(box.hit, name).toBe(true);
  }
  // The rest of the bar still scrolls, and its controls stay reachable.
  const off = page.getByRole('button', { name: 'Off', exact: true });
  const scroller = await off.evaluate(element => {
    const area = element.closest('.overflow-x-auto')!;
    return { clientWidth: area.clientWidth, scrollWidth: area.scrollWidth };
  });
  expect(scroller.clientWidth).toBeGreaterThan(0);
  if (options.width === 360)
    expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
  await off.scrollIntoViewIfNeeded();
  const offBox = await reachable(page, 'Off', 'button');
  expect(offBox.right).toBeLessThanOrEqual(offBox.innerWidth);
  expect(offBox.hit).toBe(true);
}

for (const theme of ['parchment', 'dark', 'light'])
  for (const width of [390, 360])
    test(`editor top bar pins Open in Table and Setup/Play at ${width} px (${theme})`, async ({
      page,
    }) => {
      await editorTopBar(page, { width, theme, adopted: true });
    });

test('editor top bar pins Use in Table and Setup/Play at 360 px (not on the Table)', async ({
  page,
}) => {
  await editorTopBar(page, { width: 360, theme: 'parchment', adopted: false });
});
