import { expect, test } from '@playwright/test';

import type { Page } from '@playwright/test';

/**
 * PR08 C3: DM campaign page headers fit a phone (360 to 390 px) in every
 * theme. Synthetic seed: one DM campaign with a long name, no other data.
 */

const CODE = 'NARROW-E2E';
const CAMPAIGN = {
  code: CODE,
  name: 'Synthetic Acceptance Campaign With A Long Name',
  createdAt: '2000-01-01T00:00:00.000Z',
};

/** Seeds before the app's first script runs, so the storage import sees it. */
async function seed(page: Page, theme: string): Promise<void> {
  await page.addInitScript(
    ({ campaign, theme }) => {
      if (window.localStorage.getItem('rollkeeper-dm-data')) return;
      window.localStorage.setItem(
        'rollkeeper-dm-data',
        JSON.stringify({
          state: { dmId: 'dm-narrow-e2e', campaigns: [campaign] },
          version: 1,
        })
      );
      window.localStorage.setItem('rollkeeper-theme', theme);
    },
    { campaign: CAMPAIGN, theme }
  );
}

async function overflow(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth };
  });
}

const ROUTES = [
  {
    path: `/dm/campaign/${CODE}/battlemaps`,
    ready: (page: Page) =>
      page.getByRole('heading', { level: 1, name: 'Battle Maps' }).waitFor(),
  },
  {
    path: `/dm/campaign/${CODE}/locations`,
    ready: (page: Page) =>
      page.getByRole('heading', { level: 1, name: 'Locations' }).waitFor(),
  },
  {
    path: `/dm/campaign/${CODE}/encounters`,
    ready: (page: Page) =>
      page.getByRole('heading', { level: 1, name: 'Encounters' }).waitFor(),
  },
  {
    path: `/dm/campaign/${CODE}/table`,
    ready: (page: Page) =>
      page
        .getByText('Loading Table…')
        .waitFor({ state: 'detached', timeout: 30_000 }),
  },
];

for (const theme of ['parchment', 'dark', 'light'])
  for (const width of [390, 360])
    for (const route of ROUTES)
      test(`${route.path} fits ${width} px (${theme})`, async ({ page }) => {
        await page.setViewportSize({ width, height: 720 });
        await seed(page, theme);
        await page.goto(route.path, { waitUntil: 'domcontentloaded' });
        await route.ready(page);
        await page.waitForTimeout(500);
        if (theme !== 'light')
          await expect(page.locator('html')).toHaveAttribute(
            'data-theme',
            theme
          );
        const { scrollWidth, clientWidth } = await overflow(page);
        expect(clientWidth).toBe(width);
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
      });

test('the Battle Maps header keeps accessible names at 360 px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 720 });
  await seed(page, 'parchment');
  await page.goto(`/dm/campaign/${CODE}/battlemaps`);
  await expect(
    page.getByRole('button', { name: 'New Battle Map' })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: `Back to ${CAMPAIGN.name}` })
  ).toBeVisible();
});
