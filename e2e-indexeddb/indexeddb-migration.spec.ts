import { expect, test } from '@playwright/test';

const LEGACY_RAW =
  '{"state":{"characters":[],"browser":"chromium"},"version":1}';

interface BrowserMigrationState {
  state: string;
  runId: string;
}

interface BrowserManifest {
  runId: string;
  recoveryManifestHash: string;
}

interface BrowserSnapshot {
  rawValue: string | null;
}

test.beforeEach(async ({ context }) => {
  await context.addInitScript(raw => {
    if (localStorage.getItem('rollkeeper-player-data') === null) {
      localStorage.setItem('rollkeeper-player-data', raw);
    }
  }, LEGACY_RAW);
});

test('persists captures across close/reopen and reaches readiness without switching authority', async ({
  page,
  context,
}) => {
  await page.goto('/player');
  await expect(
    page.getByRole('heading', { name: /your characters/i })
  ).toBeVisible();

  const captured = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('rollkeeper-local', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(
      ['meta', 'legacySnapshots'],
      'readonly'
    );
    const state = await new Promise<BrowserMigrationState>(
      (resolve, reject) => {
        const request = transaction
          .objectStore('meta')
          .get('migration-state:guest');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }
    );
    const manifest = await new Promise<BrowserManifest>((resolve, reject) => {
      const request = transaction
        .objectStore('meta')
        .get(`source-manifest:${state.runId}`);
      request.onsuccess = () => resolve(request.result.value);
      request.onerror = () => reject(request.error);
    });
    const snapshots = await new Promise<BrowserSnapshot[]>(
      (resolve, reject) => {
        const request = transaction.objectStore('legacySnapshots').getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }
    );
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
    return { state, manifest, snapshots };
  });
  expect(captured.state.state).toBe('RECOVERY_REQUIRED');
  expect(captured.snapshots.some(entry => entry.rawValue === LEGACY_RAW)).toBe(
    true
  );

  await page.evaluate(async manifest => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('rollkeeper-recovery', 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('downloadReceipts')) {
          request.result.createObjectStore('downloadReceipts', {
            keyPath: 'manifestHash',
          });
        }
        if (!request.result.objectStoreNames.contains('generations')) {
          request.result.createObjectStore('generations', { keyPath: 'runId' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction('downloadReceipts', 'readwrite');
    transaction.objectStore('downloadReceipts').put({
      runId: manifest.runId,
      manifestHash: manifest.recoveryManifestHash,
      initiatedAt: new Date().toISOString(),
    });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  }, captured.manifest);

  await page.reload();
  await expect(
    page.getByRole('heading', { name: /your characters/i })
  ).toBeVisible();
  const durable = await page.evaluate(async raw => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('rollkeeper-local', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(
      ['meta', 'kvGenerations', 'journal'],
      'readonly'
    );
    const get = <T>(store: string, key: IDBValidKey) =>
      new Promise<T>((resolve, reject) => {
        const request = transaction.objectStore(store).get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    const state = await get<BrowserMigrationState>(
      'meta',
      'migration-state:guest'
    );
    const active = await get<unknown>('meta', 'active-generation');
    const shadow = await get<{ rawValue: string }>('kvGenerations', [
      'guest',
      state.runId,
      'rollkeeper-player-data',
    ]);
    const journalCount = await new Promise<number>((resolve, reject) => {
      const request = transaction.objectStore('journal').count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    const stores = [...database.objectStoreNames];
    database.close();
    return {
      state: state.state,
      active,
      shadowRaw: shadow.rawValue,
      journalCount,
      stores,
      legacyRaw: localStorage.getItem('rollkeeper-player-data'),
      expectedRaw: raw,
    };
  }, LEGACY_RAW);

  expect(durable).toMatchObject({
    state: 'CUTOVER_READY',
    active: undefined,
    shadowRaw: LEGACY_RAW,
    journalCount: 0,
    legacyRaw: LEGACY_RAW,
    expectedRaw: LEGACY_RAW,
  });
  expect(durable.stores).toEqual([
    'conflicts',
    'documents',
    'intents',
    'journal',
    'kvGenerations',
    'legacySnapshots',
    'meta',
    'outbox',
    'quarantine',
    'tombstones',
  ]);

  const secondTab = await context.newPage();
  await secondTab.goto('/player');
  await expect(
    secondTab.getByRole('heading', { name: /your characters/i })
  ).toBeVisible();
  expect(
    await secondTab.evaluate(() =>
      localStorage.getItem('rollkeeper-player-data')
    )
  ).toBe(LEGACY_RAW);
});

test('uses and releases the durable lease when Web Locks are unavailable', async ({
  browser,
}) => {
  const context = await browser.newContext();
  await context.addInitScript(raw => {
    Object.defineProperty(navigator, 'locks', { value: undefined });
    localStorage.setItem('rollkeeper-player-data', raw);
  }, LEGACY_RAW);
  const page = await context.newPage();
  await page.goto('/player');
  await expect(
    page.getByRole('heading', { name: /your characters/i })
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('rollkeeper-local', 1);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        const transaction = database.transaction('meta', 'readonly');
        const value = await new Promise((resolve, reject) => {
          const request = transaction
            .objectStore('meta')
            .get('migration-lease');
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        database.close();
        return value;
      })
    )
    .toBeUndefined();
  await context.close();
});
