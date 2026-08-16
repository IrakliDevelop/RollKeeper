import { expect, test } from '@playwright/test';

test('disabled auth makes zero Supabase calls and leaves local routes available', async ({
  page,
}) => {
  const supabaseRequests: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (
      url.port === '54321' ||
      url.hostname === 'supabase.co' ||
      url.hostname.endsWith('.supabase.co')
    ) {
      supabaseRequests.push(request.url());
    }
  });

  await page.goto('/account');
  await expect(
    page.getByText(/Account sign-in is currently disabled/)
  ).toBeVisible();
  await page.goto('/player');
  await expect(
    page.getByRole('heading', { name: 'Player Dashboard' })
  ).toBeVisible();

  expect(supabaseRequests).toEqual([]);
});
