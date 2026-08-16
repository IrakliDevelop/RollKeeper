import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';

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
        const match = serialized.match(
          /RollKeeper sign-in code[^0-9]*(\d{6})/u
        );
        if (match) return match[1];
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
    const match = serialized.match(/RollKeeper sign-in code[^0-9]*(\d{6})/u);
    if (match) return match[1];
  }
  throw new Error('Mailpit OTP was not available');
}

async function signIn(page: Page, request: APIRequestContext, email: string) {
  await page.goto('/account');
  await page.getByLabel(/^Email address/).fill(email);
  await page.getByRole('button', { name: 'Email me a code' }).click();
  const code = await waitForOtp(request, email);
  await page.getByLabel(/^Six-digit code/).fill(code);
  await page.getByRole('button', { name: 'Verify code' }).click();
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

test('manual backup restores empty profiles, preserves collisions, and uses soft archive', async ({
  page,
  request,
}) => {
  const suffix = Date.now().toString(36);
  const email = `slice6-browser-${suffix}@example.test`;
  const legacyId = `slice6-${suffix}`;
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

  await signIn(page, request, email);
  await page.goto('/player');
  const originalRoster = roster(character);
  await page.evaluate(
    ({ value }) => {
      localStorage.setItem('rollkeeper-player-data', value);
      localStorage.setItem('rollkeeper-character', '{"immutable":true}');
      localStorage.setItem('rollkeeper-device-recovery-v1', 'keep-recovery');
    },
    { value: originalRoster }
  );
  await page.reload();

  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Back up Aria now' }).click();
  await expect(
    page.getByText(/refetched and fingerprint-verified/i)
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem('rollkeeper-player-data'))
  ).toBe(originalRoster);

  await page.getByRole('button', { name: 'Archive Aria cloud copy' }).click();
  await expect(page.getByText(/archived without deletion/i)).toBeVisible();
  await expect(
    page.getByText('Archived', { exact: true }).first()
  ).toBeVisible();

  await page.evaluate(
    value => localStorage.setItem('rollkeeper-player-data', value),
    roster(null)
  );
  await page.reload();
  await page.getByRole('button', { name: 'Load cloud backups' }).click();
  await page.getByRole('button', { name: 'Restore Aria', exact: true }).click();
  await expect(page.getByText(/restored with its original ID/i)).toBeVisible();
  expect(
    await page.evaluate(id => {
      const parsed = JSON.parse(
        localStorage.getItem('rollkeeper-player-data') ?? '{}'
      );
      return parsed.state.characters.some(
        (value: { id: string }) => value.id === id
      );
    }, legacyId)
  ).toBe(true);

  const collision = {
    ...character,
    name: 'Local Diverged',
    characterData: { ...character.characterData, name: 'Local Diverged' },
  };
  await page.evaluate(
    value => localStorage.setItem('rollkeeper-player-data', value),
    roster(collision)
  );
  await page.reload();
  await page.getByRole('button', { name: 'Load cloud backups' }).click();
  await page.getByRole('button', { name: 'Restore Aria', exact: true }).click();
  await expect(
    page.getByText(/restored as an unsynced local copy/i)
  ).toBeVisible();
  expect(
    await page.evaluate(id => {
      const parsed = JSON.parse(
        localStorage.getItem('rollkeeper-player-data') ?? '{}'
      );
      return {
        count: parsed.state.characters.length,
        localName: parsed.state.characters.find(
          (value: { id: string }) => value.id === id
        ).name,
      };
    }, legacyId)
  ).toEqual({ count: 2, localName: 'Local Diverged' });

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Aria recovery' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain(
    'rollkeeper-character-recovery'
  );
  expect(
    await page.evaluate(() => localStorage.getItem('rollkeeper-character'))
  ).toBe('{"immutable":true}');
  expect(
    await page.evaluate(() =>
      localStorage.getItem('rollkeeper-device-recovery-v1')
    )
  ).toBe('keep-recovery');
});
