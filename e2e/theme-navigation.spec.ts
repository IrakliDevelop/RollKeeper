import { test, expect } from '@playwright/test';

test('character appearance finishes loading and restores the app theme across navigation', async ({
  page,
}) => {
  await page.goto('/player/characters/new', { waitUntil: 'networkidle' });
  await page.locator('#characterName').fill('Synthetic Theme Navigation');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(
    url =>
      /\/player\/characters\/[^/]+$/.test(url.pathname) &&
      !url.pathname.endsWith('/new')
  );
  const characterUrl = page.url();

  // Repeated client navigation mounts settings with the character already
  // loaded. This previously left the initial-load guard stuck in StrictMode.
  for (let visit = 0; visit < 2; visit++) {
    await page.getByRole('link', { name: 'Appearance', exact: true }).click();
    await expect(page).toHaveURL(`${characterUrl}/appearance`);
    await expect(
      page.getByRole('radio', { name: 'Use app theme', exact: true })
    ).toBeVisible();
    await expect(page.getByText('Loading character appearance…')).toHaveCount(
      0
    );
    await page.getByRole('radio', { name: 'Light', exact: true }).click();
    await expect(page.locator('body')).toHaveCSS(
      'background-color',
      'rgb(233, 235, 228)'
    );
    await page
      .getByRole('link', { name: 'Character sheet', exact: true })
      .click();
    await expect(page).toHaveURL(characterUrl);
  }

  await page.getByRole('link', { name: 'Characters', exact: true }).click();
  await expect(page).toHaveURL(/\/player$/);
  await expect(
    page.getByRole('link', { name: 'Appearance', exact: true })
  ).toHaveAttribute('href', '/player/appearance');
  await page.getByRole('link', { name: 'Appearance', exact: true }).click();
  await expect(page).toHaveURL(/\/player\/appearance$/);
  await page.getByRole('radio', { name: 'Blue dark', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'blue');
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(15, 23, 42)'
  );

  await page.goBack();
  await expect(page).toHaveURL(/\/player$/);
  await page.goBack();
  await expect(page).toHaveURL(characterUrl);
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(233, 235, 228)'
  );
  await page.goForward();
  await page.goForward();
  await expect(page).toHaveURL(/\/player\/appearance$/);
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(15, 23, 42)'
  );
  await page.reload();
  await expect(
    page.getByRole('radio', { name: 'Blue dark', exact: true })
  ).toBeChecked();
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(15, 23, 42)'
  );
});
