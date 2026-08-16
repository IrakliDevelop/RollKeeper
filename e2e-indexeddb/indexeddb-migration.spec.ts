import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const CHARACTER_RAW =
  '{"state":{"characters":[],"profile":"same-start"},"version":1}';
const DM_RAW = '{"state":{"campaigns":[{"id":"dm-untouched"}]},"version":1}';

async function seedProfile(context: BrowserContext, withoutLocks = false) {
  await context.addInitScript(
    ({ characterRaw, dmRaw, removeLocks }) => {
      if (removeLocks) {
        Object.defineProperty(navigator, 'locks', { value: undefined });
      }
      if (localStorage.getItem('rollkeeper-player-data') === null) {
        localStorage.setItem('rollkeeper-player-data', characterRaw);
        localStorage.setItem('rollkeeper-dm-data', dmRaw);
      }
    },
    { characterRaw: CHARACTER_RAW, dmRaw: DM_RAW, removeLocks: withoutLocks }
  );
}

async function databaseNames(page: Page): Promise<string[]> {
  return page.evaluate(async () =>
    (await indexedDB.databases()).flatMap(item =>
      item.name ? [item.name] : []
    )
  );
}

test('untouched profile keeps byte-compatible localStorage behavior and makes zero IndexedDB calls', async ({
  browser,
}) => {
  const context = await browser.newContext();
  await seedProfile(context);
  const page = await context.newPage();
  await page.goto('/player');
  await expect(
    page.getByRole('heading', { name: /your characters/i })
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem('rollkeeper-player-data'))
  ).toBe(CHARACTER_RAW);
  expect(
    await page.evaluate(() => localStorage.getItem('rollkeeper-dm-data'))
  ).toBe(DM_RAW);
  expect(await databaseNames(page)).not.toContain('rollkeeper-local');

  await page.evaluate(() => {
    const raw = localStorage.getItem('rollkeeper-player-data')!;
    localStorage.setItem('rollkeeper-player-data', raw);
  });
  await page.reload();
  await expect(
    page.getByRole('heading', { name: /your characters/i })
  ).toBeVisible();
  expect(await databaseNames(page)).not.toContain('rollkeeper-local');
  expect(
    await page.evaluate(() => localStorage.getItem('rollkeeper-player-data'))
  ).toBe(CHARACTER_RAW);
  await context.close();
});

test.describe('explicitly selected profile', () => {
  test('downloads recovery, prepares, atomically cuts over, and retains mirrors/captures without touching DM data', async ({
    browser,
  }) => {
    const context = await browser.newContext({ acceptDownloads: true });
    await seedProfile(context);
    const page = await context.newPage();
    await page.goto('/player');
    await page
      .getByRole('button', { name: /preview character migration/i })
      .click();
    await expect(page.getByText(/2 entries/i)).toBeVisible();

    page.once('dialog', dialog => dialog.accept());
    const downloadPromise = page.waitForEvent('download');
    const selectionReload = page.waitForEvent('domcontentloaded');
    await page
      .getByRole('button', { name: /download recovery and select migration/i })
      .click();
    const download = await downloadPromise;
    await selectionReload;
    expect(download.suggestedFilename()).toMatch(/^rollkeeper-device-backup_/);

    await expect(
      page.getByRole('heading', { name: /your characters/i }).first()
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /confirm indexeddb cutover/i })
    ).toBeVisible({ timeout: 30_000 });
    page.once('dialog', dialog => dialog.accept());
    const activationReload = page.waitForEvent('domcontentloaded');
    await page
      .getByRole('button', { name: /confirm indexeddb cutover/i })
      .click();
    await activationReload;
    await expect(
      page.getByRole('heading', { name: /your characters/i }).first()
    ).toBeVisible();

    const createdId = await page.evaluate(() =>
      window.__rkStores!.player.getState().createCharacter('After Cutover')
    );
    await expect
      .poll(() =>
        page.evaluate(() =>
          localStorage
            .getItem('rollkeeper-player-data')
            ?.includes('After Cutover')
        )
      )
      .toBe(true);
    await page.waitForFunction(async id => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('rollkeeper-local', 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const pointer = await new Promise<{ generation: string }>(
        (resolve, reject) => {
          const request = database
            .transaction('meta', 'readonly')
            .objectStore('meta')
            .get('active-generation:guest:character');
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        }
      );
      const row = await new Promise<{ rawValue?: string } | undefined>(
        (resolve, reject) => {
          const request = database
            .transaction('kvGenerations', 'readonly')
            .objectStore('kvGenerations')
            .get(['guest', pointer.generation, 'rollkeeper-player-data']);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        }
      );
      database.close();
      return row?.rawValue?.includes(id) === true;
    }, createdId);
    await page.reload();
    await expect(
      page.getByRole('heading', { name: /your characters/i }).first()
    ).toBeVisible();
    const hydrationEvidence = await page.evaluate(async () => ({
      names: window
        .__rkStores!.player.getState()
        .characters.map(item => item.name),
      persisted: await window
        .__rkStores!.player.persist.getOptions()
        .storage?.getItem('rollkeeper-player-data'),
    }));
    expect(hydrationEvidence).toMatchObject({
      names: expect.arrayContaining(['After Cutover']),
      persisted: {
        state: {
          characters: expect.arrayContaining([
            expect.objectContaining({ name: 'After Cutover' }),
          ]),
        },
      },
    });

    const durable = await page.evaluate(async () => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('rollkeeper-local', 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const transaction = database.transaction(
        ['meta', 'legacySnapshots', 'kvGenerations', 'journal'],
        'readonly'
      );
      const request = <T>(
        store: string,
        method: (objectStore: IDBObjectStore) => IDBRequest<T>
      ) =>
        new Promise<T>((resolve, reject) => {
          const result = method(transaction.objectStore(store));
          result.onsuccess = () => resolve(result.result);
          result.onerror = () => reject(result.error);
        });
      const pointer = await request('meta', store =>
        store.get('active-generation:guest:character')
      );
      const globalPointer = await request('meta', store =>
        store.get('active-generation')
      );
      const snapshots = await request<unknown[]>('legacySnapshots', store =>
        store.getAll()
      );
      const rows = await request<unknown[]>('kvGenerations', store =>
        store.getAll()
      );
      const journalCount = await request<number>('journal', store =>
        store.count()
      );
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
      return {
        pointer,
        globalPointer,
        snapshots,
        rows,
        journalCount,
        characterMirror: localStorage.getItem('rollkeeper-player-data'),
        dmRaw: localStorage.getItem('rollkeeper-dm-data'),
      };
    });
    expect(durable.pointer).toMatchObject({
      authority: 'indexedDB',
      namespace: 'guest',
      family: 'character',
      epoch: 1,
    });
    expect(durable.globalPointer).toBeUndefined();
    expect(durable.characterMirror).toContain('After Cutover');
    expect(durable.dmRaw).toBe(DM_RAW);
    expect(durable.journalCount).toBe(0);
    expect(durable.snapshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'rollkeeper-player-data',
          rawValue: CHARACTER_RAW,
        }),
      ])
    );
    expect(durable.snapshots).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'rollkeeper-dm-data' }),
      ])
    );
    expect(durable.rows).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'rollkeeper-dm-data' }),
      ])
    );
    expect(durable.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'rollkeeper-player-data',
          rawValue: durable.characterMirror,
        }),
      ])
    );
    await context.close();
  });

  test('works without Web Locks by using and releasing the durable lease', async ({
    browser,
  }) => {
    const context = await browser.newContext({ acceptDownloads: true });
    await seedProfile(context, true);
    const page = await context.newPage();
    await page.goto('/player');
    await page
      .getByRole('button', { name: /preview character migration/i })
      .click();
    page.once('dialog', dialog => dialog.accept());
    const downloadPromise = page.waitForEvent('download');
    const selectionReload = page.waitForEvent('domcontentloaded');
    await page
      .getByRole('button', { name: /download recovery and select migration/i })
      .click();
    await downloadPromise;
    await selectionReload;
    await expect(
      page.getByRole('button', { name: /confirm indexeddb cutover/i })
    ).toBeVisible({ timeout: 30_000 });
    const lease = await page.evaluate(async () => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('rollkeeper-local', 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const transaction = database.transaction('meta', 'readonly');
      const result = await new Promise((resolve, reject) => {
        const request = transaction.objectStore('meta').get('migration-lease');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      database.close();
      return result;
    });
    expect(lease).toBeUndefined();
    await context.close();
  });
});
