import { expect, test, type APIRequestContext } from '@playwright/test';

import { enterEmailOtp, extractEmailOtp } from '../helpers';

const MAILPIT_URL = 'http://127.0.0.1:54324';
const LEGACY_DATA = {
  'rollkeeper-character': '{"name":"Aster","unknown":null}',
  'rollkeeper-player-data': '{"state":{"characters":[{"id":"legacy"}]}}',
  'rollkeeper-device-recovery-v1': 'immutable recovery bytes',
  'location-canvas-legacy': '{"shapes":[1,2,3]}',
};

async function waitForOtp(request: APIRequestContext, email: string) {
  await expect
    .poll(
      async () => {
        const listResponse = await request.get(
          `${MAILPIT_URL}/api/v1/messages`
        );
        const list = await listResponse.json();
        for (const summary of list.messages ?? []) {
          const detailResponse = await request.get(
            `${MAILPIT_URL}/api/v1/message/${encodeURIComponent(summary.ID)}`
          );
          if (!detailResponse.ok()) continue;
          const serialized = JSON.stringify(await detailResponse.json());
          if (!serialized.includes(email)) continue;
          const code = extractEmailOtp(serialized);
          if (code) return code;
        }
        return null;
      },
      { timeout: 10_000 }
    )
    .not.toBeNull();

  const list = await (
    await request.get(`${MAILPIT_URL}/api/v1/messages`)
  ).json();
  for (const summary of list.messages ?? []) {
    const detail = await (
      await request.get(
        `${MAILPIT_URL}/api/v1/message/${encodeURIComponent(summary.ID)}`
      )
    ).json();
    const serialized = JSON.stringify(detail);
    if (!serialized.includes(email)) continue;
    const code = extractEmailOtp(serialized);
    if (code) return code;
  }
  throw new Error('Mailpit OTP was not available');
}

async function snapshotStorage(page: import('@playwright/test').Page) {
  return page.evaluate(
    keys => keys.map(key => [key, localStorage.getItem(key)]),
    Object.keys(LEGACY_DATA)
  );
}

async function signIn(
  page: import('@playwright/test').Page,
  request: APIRequestContext,
  email: string
) {
  await page.getByLabel(/^Email address/).fill(email);
  await page.getByRole('button', { name: 'Email me a code' }).click();
  const code = await waitForOtp(request, email);
  await enterEmailOtp(page, code);
  await expect(
    page.getByRole('main').getByText(email, { exact: true })
  ).toBeVisible();
}

test('OTP session, direct navigation, sign-out, and account switch preserve every local byte', async ({
  page,
  request,
}) => {
  const supabaseRequests: string[] = [];
  page.on('request', outgoing => {
    if (outgoing.url().startsWith('http://127.0.0.1:54321/')) {
      supabaseRequests.push(outgoing.url());
    }
  });

  await page.goto('/account');
  await page.evaluate(entries => {
    for (const [key, value] of Object.entries(entries)) {
      localStorage.setItem(key, value);
    }
  }, LEGACY_DATA);
  const before = await snapshotStorage(page);

  const firstEmail = `slice5-browser-a-${Date.now()}@example.test`;
  await signIn(page, request, firstEmail);
  expect(await snapshotStorage(page)).toEqual(before);

  await page.goto('/player');
  await expect(page.getByText(firstEmail, { exact: true })).toBeVisible();
  expect(await snapshotStorage(page)).toEqual(before);

  await page.goto('/account');
  await page.getByRole('button', { name: 'Switch account' }).click();
  await expect(
    page.getByRole('button', { name: 'Email me a code' })
  ).toBeVisible();
  expect(await snapshotStorage(page)).toEqual(before);

  const secondEmail = `slice5-browser-b-${Date.now()}@example.test`;
  await signIn(page, request, secondEmail);
  expect(await snapshotStorage(page)).toEqual(before);

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL('/');
  expect(await snapshotStorage(page)).toEqual(before);

  expect(supabaseRequests.length).toBeGreaterThan(0);
  expect(
    supabaseRequests.every(url => new URL(url).pathname.startsWith('/auth/v1/'))
  ).toBe(true);
});
