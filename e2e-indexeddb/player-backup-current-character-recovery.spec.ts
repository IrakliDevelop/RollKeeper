import { expect, test, type Page } from '@playwright/test';

const PLAYER_RAW =
  '{"state":{"characters":[{"id":"hero-1","name":"Hero One","race":"Human","class":"Fighter","level":1,"createdAt":"2020-01-01T00:00:00.000Z","updatedAt":"2020-01-01T00:00:00.000Z","lastPlayed":"2020-01-01T00:00:00.000Z","characterData":{"id":"hero-1","name":"Hero One"},"tags":[],"isArchived":false}]},"version":1}';
const ENVELOPE_RAW =
  '{"state":{"character":{"id":"hero-1","name":"Hero One"}},"version":0}';
const STALE_MIRROR =
  '{"state":{"characters":[{"id":"hero-1","name":"Stale Mirror","race":"Human","class":"Fighter","level":1,"createdAt":"2020-01-01T00:00:00.000Z","updatedAt":"2020-01-01T00:00:00.000Z","lastPlayed":"2020-01-01T00:00:00.000Z","characterData":{"id":"hero-1","name":"Stale Mirror"},"tags":[],"isArchived":false}]},"version":1}';

async function seedActiveProfile(page: Page) {
  await page.goto('/player/backup?intent=recovery');
  await page.evaluate(
    async ({ playerRaw, envelopeRaw, staleMirror }) => {
      localStorage.setItem('rollkeeper-player-data', staleMirror);
      localStorage.setItem('rollkeeper-character:hero-1', envelopeRaw);
      localStorage.setItem(
        'rollkeeper:indexeddb-selection:guest:character',
        JSON.stringify({
          version: 1,
          namespace: 'guest',
          family: 'character',
          selectedAt: 'seeded',
          activatedEpoch: 1,
          activatedGeneration: 'active',
        })
      );
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('rollkeeper-local', 1);
        open.onerror = () => reject(open.error);
        open.onupgradeneeded = () => {
          const database = open.result;
          const stores: Array<[string, IDBObjectStoreParameters]> = [
            ['meta', { keyPath: 'key' }],
            ['legacySnapshots', { keyPath: ['runId', 'key', 'captureNumber'] }],
            ['kvGenerations', { keyPath: ['namespace', 'generation', 'key'] }],
            ['documents', { keyPath: ['namespace', 'family', 'legacyId'] }],
            ['intents', { keyPath: 'intentId' }],
            ['outbox', { keyPath: 'mutationId' }],
            ['tombstones', { keyPath: ['namespace', 'family', 'legacyId'] }],
            ['conflicts', { keyPath: 'conflictId' }],
            ['quarantine', { keyPath: 'quarantineId' }],
            ['journal', { keyPath: 'journalId' }],
          ];
          for (const [name, parameters] of stores) {
            if (!database.objectStoreNames.contains(name)) {
              database.createObjectStore(name, parameters);
            }
          }
        };
        open.onsuccess = () => {
          const database = open.result;
          const transaction = database.transaction(
            ['meta', 'kvGenerations'],
            'readwrite'
          );
          transaction.onerror = () => reject(transaction.error);
          transaction.objectStore('meta').put({
            key: 'active-generation:guest:character',
            authority: 'indexedDB',
            namespace: 'guest',
            family: 'character',
            generation: 'active',
            epoch: 1,
            committedAt: 'seeded',
          });
          transaction.objectStore('meta').put({
            key: 'cutover-epoch:guest:character',
            value: 1,
          });
          transaction.objectStore('meta').put({
            key: 'migration-state:guest:character',
            state: 'IDB_PRIMARY',
            runId: 'active',
            checkpointAt: 'seeded',
          });
          transaction.objectStore('kvGenerations').put({
            namespace: 'guest',
            generation: 'active',
            key: 'rollkeeper-player-data',
            presence: true,
            rawValue: playerRaw,
          });
          transaction.objectStore('kvGenerations').put({
            namespace: 'guest',
            generation: 'active',
            key: 'rollkeeper-character:hero-1',
            presence: true,
            rawValue: envelopeRaw,
          });
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
        };
      });
    },
    {
      playerRaw: PLAYER_RAW,
      envelopeRaw: ENVELOPE_RAW,
      staleMirror: STALE_MIRROR,
    }
  );
  await page.reload();
}

async function databaseNames(page: Page): Promise<string[]> {
  return page.evaluate(async () =>
    (await indexedDB.databases()).flatMap(item =>
      item.name ? [item.name] : []
    )
  );
}

async function sha256Hex(bytes: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(bytes)
  );
  return [...new Uint8Array(digest)]
    .map(value => value.toString(16).padStart(2, '0'))
    .join('');
}

test('opening recovery without a file leaves a fresh profile database absent', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/player/backup?intent=recovery');
  await expect(
    page.getByRole('heading', { name: 'Restore characters' })
  ).toBeVisible();
  expect(await databaseNames(page)).not.toContain('rollkeeper-local');
  await page.getByLabel('Restore from a safety file').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{broken'),
  });
  await expect(
    page.getByRole('alert').filter({
      hasText: 'RollKeeper could not check this recovery file',
    })
  ).toBeVisible();
  expect(await databaseNames(page)).not.toContain('rollkeeper-local');
  await context.close();
});

test('downloads the current-character safety file, restores those exact bytes, and verifies IDs after reopen', async ({
  browser,
}) => {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  await seedActiveProfile(page);
  await expect(
    page.getByRole('heading', { name: 'Restore characters' })
  ).toBeVisible();
  await expect(page.getByText('Stale Mirror')).toHaveCount(0);

  await page.getByRole('button', { name: 'Recovery options' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Save current character recovery file' })
    .click();
  const download = await downloadPromise;
  const retainedPath = await download.path();
  expect(retainedPath).toBeTruthy();
  const { readFile } = await import('node:fs/promises');
  const retained = await readFile(retainedPath!);
  expect(retained.byteLength).toBeGreaterThan(0);
  const retainedBundle = JSON.parse(retained.toString()) as {
    entries: Array<{ key: string; rawValue: string; sha256: string }>;
  };
  expect(retainedBundle.entries).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        key: 'rollkeeper-player-data',
        rawValue: PLAYER_RAW,
      }),
      expect.objectContaining({
        key: 'rollkeeper-character:hero-1',
        rawValue: ENVELOPE_RAW,
      }),
    ])
  );
  expect(
    retainedBundle.entries.every(entry => !entry.key.includes('Stale'))
  ).toBe(true);

  await page
    .getByLabel('Restore from a safety file')
    .setInputFiles(retainedPath!);
  await expect(
    page.getByRole('heading', { name: 'Review safety file' })
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Restore current characters' })
    .click();
  await expect(
    page.getByText(
      'Restore these characters in this browser? RollKeeper will keep any different local data for review.'
    )
  ).toBeVisible();
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(
    page.getByText(
      'Your current characters are ready to restore. The characters already in this browser have not changed.'
    )
  ).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(
    page.getByRole('alert').filter({
      hasText:
        'Your characters were restored and checked after loading them again.',
    })
  ).toBeVisible({ timeout: 20_000 });

  await page.reload();
  const restored = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('rollkeeper-local');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const pointer = await new Promise<{ generation: string } | undefined>(
      (resolve, reject) => {
        const transaction = database.transaction('meta', 'readonly');
        const request = transaction
          .objectStore('meta')
          .get('active-generation:guest:character');
        request.onsuccess = () =>
          resolve(request.result as { generation: string } | undefined);
        request.onerror = () => reject(request.error);
      }
    );
    const rows = await new Promise<
      Array<{ key: string; rawValue: string; generation: string }>
    >((resolve, reject) => {
      const transaction = database.transaction('kvGenerations', 'readonly');
      const request = transaction.objectStore('kvGenerations').getAll();
      request.onsuccess = () =>
        resolve(
          (
            request.result as Array<{
              key: string;
              rawValue: string;
              generation: string;
            }>
          ).filter(row => row.generation === pointer?.generation)
        );
      request.onerror = () => reject(request.error);
    });
    database.close();
    const hashes: Record<string, string> = {};
    for (const row of rows) {
      const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(row.rawValue)
      );
      hashes[row.key] = [...new Uint8Array(digest)]
        .map(value => value.toString(16).padStart(2, '0'))
        .join('');
    }
    return {
      generation: pointer?.generation ?? null,
      player: rows.find(row => row.key === 'rollkeeper-player-data')?.rawValue,
      envelope: rows.find(row => row.key === 'rollkeeper-character:hero-1')
        ?.rawValue,
      hashes,
      marker: localStorage.getItem(
        'rollkeeper:indexeddb-selection:guest:character'
      ),
    };
  });
  const expectedPlayerHash = await sha256Hex(PLAYER_RAW);
  const expectedEnvelopeHash = await sha256Hex(ENVELOPE_RAW);
  expect(restored.player).toBe(PLAYER_RAW);
  expect(restored.envelope).toBe(ENVELOPE_RAW);
  expect(restored.hashes['rollkeeper-player-data']).toBe(expectedPlayerHash);
  expect(restored.hashes['rollkeeper-character:hero-1']).toBe(
    expectedEnvelopeHash
  );
  expect(restored.generation).toMatch(/^recovery:/);
  expect(restored.marker).toContain('"activatedGeneration"');
  expect(JSON.parse(restored.marker!).activatedGeneration).toBe(
    restored.generation
  );
  await context.close();
});

test('empty profile without local authority mutation restores missing data without creating IndexedDB', async ({
  browser,
}) => {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  await seedActiveProfile(page);
  await page.getByRole('button', { name: 'Recovery options' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Save current character recovery file' })
    .click();
  const download = await downloadPromise;
  const retainedPath = await download.path();
  expect(retainedPath).toBeTruthy();

  await page.evaluate(async () => {
    const names = await indexedDB.databases();
    await Promise.all(
      names.flatMap(item =>
        item.name
          ? [
              new Promise<void>((resolve, reject) => {
                const request = indexedDB.deleteDatabase(item.name!);
                request.onsuccess = () => resolve();
                request.onblocked = () => resolve();
                request.onerror = () => reject(request.error);
              }),
            ]
          : []
      )
    );
    localStorage.removeItem('rollkeeper-player-data');
    localStorage.removeItem('rollkeeper-character:hero-1');
    localStorage.removeItem('rollkeeper:indexeddb-selection:guest:character');
  });
  await page.reload();
  await page
    .getByLabel('Restore from a safety file')
    .setInputFiles(retainedPath!);
  await page
    .getByRole('button', { name: 'Restore current characters' })
    .click();
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(
    page.getByRole('alert').filter({
      hasText:
        'Your characters were restored and checked after loading them again.',
    })
  ).toBeVisible();
  expect(await databaseNames(page)).not.toContain('rollkeeper-local');
  expect(
    await page.evaluate(() => localStorage.getItem('rollkeeper-player-data'))
  ).toBe(PLAYER_RAW);
  expect(
    await page.evaluate(() =>
      window.__rkStores?.player
        .getState()
        .characters.map(character => character.id)
    )
  ).toEqual(['hero-1']);
  await context.close();
});
