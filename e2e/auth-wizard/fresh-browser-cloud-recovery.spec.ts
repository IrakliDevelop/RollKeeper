import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';

import { enterEmailOtp, extractEmailOtp } from '../helpers';

const MAILPIT_URL = 'http://127.0.0.1:54324';

async function waitForOtp(request: APIRequestContext, email: string) {
  await expect
    .poll(async () => {
      const list = await (
        await request.get(`${MAILPIT_URL}/api/v1/messages`)
      ).json();
      for (const summary of list.messages ?? []) {
        const detail = await (
          await request.get(`${MAILPIT_URL}/api/v1/message/${summary.ID}`)
        ).json();
        const serialized = JSON.stringify(detail);
        if (!serialized.includes(email)) continue;
        const code = extractEmailOtp(serialized);
        if (code) return code;
      }
      return null;
    })
    .not.toBeNull();

  const list = await (
    await request.get(`${MAILPIT_URL}/api/v1/messages`)
  ).json();
  for (const summary of list.messages ?? []) {
    const detail = await (
      await request.get(`${MAILPIT_URL}/api/v1/message/${summary.ID}`)
    ).json();
    const serialized = JSON.stringify(detail);
    if (!serialized.includes(email)) continue;
    const code = extractEmailOtp(serialized);
    if (code) return code;
  }
  throw new Error('Mailpit OTP was not available');
}

async function signIn(page: Page, request: APIRequestContext, email: string) {
  await request.delete(`${MAILPIT_URL}/api/v1/messages`);
  await page.goto('/account');
  await page.getByLabel(/^Email address/).fill(email);
  await page.getByRole('button', { name: 'Email me a code' }).click();
  const code = await waitForOtp(request, email);
  await enterEmailOtp(page, code);
  await expect(
    page.getByRole('main').getByText(email, { exact: true })
  ).toBeVisible();
}

function roster(character: Record<string, unknown> | null) {
  return JSON.stringify({
    state: {
      characters: character ? [character] : [],
      characterTombstones: {},
      activeCharacterId: null,
      settings: {
        enableDeathAnimation: false,
        enableLevelUpAnimation: false,
        enableCombatStartBanner: true,
      },
      lastSelectedCharacterId: null,
    },
    version: 1,
  });
}

async function rosterIds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const parsed = JSON.parse(
      localStorage.getItem('rollkeeper-player-data') ?? '{}'
    ) as { state?: { characters?: Array<{ id: string }> } };
    return (parsed.state?.characters ?? []).map(character => character.id);
  });
}

test('fresh browser restores wizard online copies, including a same-ID collision', async ({
  browser,
  request,
}) => {
  const suffix = Date.now().toString(36);
  const email = `wizard-fresh-${suffix}@example.test`;
  const legacyId = `wizard-${suffix}`;
  const character = {
    id: legacyId,
    name: 'Aria',
    race: 'Elf',
    class: 'Wizard',
    level: 4,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
    lastPlayed: '2024-01-03T00:00:00.000Z',
    characterData: { id: legacyId, name: 'Aria', unknown: null },
    tags: [],
    isArchived: false,
    unknownTopLevel: null,
  };

  const contextA = await browser.newContext({ acceptDownloads: true });
  const pageA = await contextA.newPage();
  await signIn(pageA, request, email);
  await pageA.goto('/player');
  await pageA.evaluate(
    ({ value }) => {
      localStorage.setItem('rollkeeper-player-data', value);
    },
    { value: roster(character) }
  );
  await pageA.goto('/player/backup');
  await expect(pageA.getByRole('button', { name: 'Continue' })).toBeEnabled();
  await pageA.getByRole('button', { name: 'Continue' }).click();
  await expect(
    pageA.getByRole('heading', { name: 'Save a safety file' })
  ).toBeVisible();
  const downloadPromise = pageA.waitForEvent('download');
  await pageA.getByRole('button', { name: 'Save safety file' }).click();
  const safetyPath = await (await downloadPromise).path();
  expect(safetyPath).toBeTruthy();
  await pageA.getByLabel('Choose safety file').setInputFiles(safetyPath!);
  await expect(
    pageA.getByLabel('Save a safety file').getByText('Safety file checked')
  ).toBeVisible();
  await pageA.getByRole('button', { name: 'Continue' }).click();
  await expect(
    pageA.getByRole('heading', { name: 'Choose characters' })
  ).toBeVisible();
  await pageA.getByRole('button', { name: 'Save online copies' }).click();
  await expect(
    pageA.getByText('Online copies were checked for 1 character.')
  ).toBeVisible({ timeout: 45_000 });
  await expect(
    pageA.getByRole('button', { name: 'Load cloud backups' })
  ).toHaveCount(0);

  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await signIn(pageB, request, email);
  await pageB.goto('/player/backup?intent=recovery');
  await expect(
    pageB.getByRole('heading', { name: 'Restore characters' })
  ).toBeVisible();
  await expect(
    pageB.getByRole('heading', { name: 'Online copies' })
  ).toBeVisible();
  await expect(pageB.getByText('Aria')).toBeVisible();
  await pageB.getByRole('button', { name: 'Restore here' }).click();
  await expect.poll(async () => rosterIds(pageB)).toEqual([legacyId]);

  const collision = {
    ...character,
    name: 'Local Diverged',
    characterData: { ...character.characterData, name: 'Local Diverged' },
  };
  await pageB.evaluate(
    value => localStorage.setItem('rollkeeper-player-data', value),
    roster(collision)
  );
  await pageB.reload();
  await expect(
    pageB.getByRole('heading', { name: 'Online copies' })
  ).toBeVisible();
  await pageB
    .getByRole('button', { name: 'Restore as another character' })
    .click();
  await expect
    .poll(async () => {
      const parsed = JSON.parse(
        (await pageB.evaluate(() =>
          localStorage.getItem('rollkeeper-player-data')
        )) ?? '{}'
      ) as {
        state?: { characters?: Array<{ id: string; name: string }> };
      };
      const characters = parsed.state?.characters ?? [];
      return {
        count: characters.length,
        localName: characters.find(item => item.id === legacyId)?.name ?? null,
      };
    })
    .toEqual({ count: 2, localName: 'Local Diverged' });

  await expect(
    pageB.getByRole('button', { name: 'Load cloud backups' })
  ).toHaveCount(0);

  await contextA.close();
  await contextB.close();
});
