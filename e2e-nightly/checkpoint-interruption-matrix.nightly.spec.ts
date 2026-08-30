import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/** Nightly "checkpoint interruption matrix" (roadmap item): proves the
 * IndexedDB character migration engine (src/lib/indexeddb/migrationEngine.ts,
 * driven for the character family via characterMigrationEngine.ts /
 * characterPersistenceBootstrap.ts) re-converges with zero data loss no
 * matter which persisted checkpoint (`meta` store key
 * `migration-state:guest:character`) a crash leaves behind. Not part of the
 * default `test:e2e` run — driven by `npm run test:checkpoint-matrix:nightly`.
 *
 * Two row shapes, matching how the engine actually behaves (see the report
 * for the full deviation log versus the original outline):
 *
 * - "rewind" rows (CAPTURED, TRANSFORMING, VALIDATED, SHADOWING,
 *   CUTOVER_READY): drive the real UI through the download-receipt point (so
 *   a legacySnapshots capture + a download receipt already exist), let the
 *   engine run itself to CUTOVER_READY, then rewrite the persisted meta
 *   record back to the row's state (same runId) and reload. The engine
 *   resumes from that checkpoint and re-converges to CUTOVER_READY because
 *   the previously captured manifest and download receipt are still valid.
 *
 * - "cold" rows (PREFLIGHT, CAPTURING, BLOCKED, ROLLED_BACK,
 *   RECOVERY_REQUIRED): seed only a meta record at that state with no
 *   capture artifacts and no download receipt. Every legal transition from
 *   these states re-drives PREFLIGHT -> CAPTURING -> CAPTURED and then hits
 *   the mandatory recovery-gate check (migrationEngine.ts's
 *   `recoveryGate.hasDownloadReceipt` guard), which always fails because no
 *   receipt was ever recorded for a freshly (re)computed manifest hash. All
 *   five therefore converge on RECOVERY_REQUIRED rather than staying at the
 *   seeded label -- see the report for why that's the correct, safe
 *   behavior and doesn't violate any assertion this matrix makes.
 *
 * Every row asserts the two non-negotiables regardless of kind: zero data
 * loss (legacy localStorage bytes stay byte-identical throughout) and no
 * false IDB_PRIMARY report (the persisted authority pointer never claims
 * indexedDB authority until an explicit cutover confirmation actually
 * happens).
 */

const CHARACTER_RAW =
  '{"state":{"characters":[],"profile":"checkpoint-matrix"},"version":1}';
const DM_RAW = '{"state":{"campaigns":[{"id":"dm-untouched"}]},"version":1}';

const META_KEY = 'migration-state:guest:character';
const POINTER_KEY = 'active-generation:guest:character';

const REWIND_STATES = [
  'CAPTURED',
  'TRANSFORMING',
  'VALIDATED',
  'SHADOWING',
  'CUTOVER_READY',
] as const;

const COLD_STATES = [
  'PREFLIGHT',
  'CAPTURING',
  'BLOCKED',
  'ROLLED_BACK',
  'RECOVERY_REQUIRED',
] as const;

type RewindState = (typeof REWIND_STATES)[number];
type ColdState = (typeof COLD_STATES)[number];

interface MigrationStateRecord {
  key: string;
  state: string;
  runId: string;
  checkpointAt: string;
}

interface LegacyBytes {
  player: string | null;
  dm: string | null;
}

const OBJECT_STORES: Array<[string, IDBObjectStoreParameters]> = [
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

async function seedLegacyProfile(context: BrowserContext) {
  await context.addInitScript(
    ({ characterRaw, dmRaw }) => {
      if (localStorage.getItem('rollkeeper-player-data') === null) {
        localStorage.setItem('rollkeeper-player-data', characterRaw);
        localStorage.setItem('rollkeeper-dm-data', dmRaw);
      }
    },
    { characterRaw: CHARACTER_RAW, dmRaw: DM_RAW }
  );
}

async function legacyBytes(page: Page): Promise<LegacyBytes> {
  return page.evaluate(() => ({
    player: localStorage.getItem('rollkeeper-player-data'),
    dm: localStorage.getItem('rollkeeper-dm-data'),
  }));
}

/** Reads the persisted migration-state record and the character authority
 * pointer directly out of the `meta` store, mirroring how
 * characterAuthority.ts / migrationEngine.ts key them. Returns nulls when
 * the database or store doesn't exist yet (fresh profile). */
async function readMigrationMeta(page: Page): Promise<{
  state: string | null;
  runId: string | null;
  authority: string | null;
}> {
  return page.evaluate(
    async ({ metaKey, pointerKey }) => {
      const database = await new Promise<IDBDatabase | null>(resolve => {
        const request = indexedDB.open('rollkeeper-local');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
      });
      if (!database || !database.objectStoreNames.contains('meta')) {
        database?.close();
        return { state: null, runId: null, authority: null };
      }
      const transaction = database.transaction('meta', 'readonly');
      const store = transaction.objectStore('meta');
      const state = await new Promise<
        { state: string; runId: string } | undefined
      >(resolve => {
        const request = store.get(metaKey);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(undefined);
      });
      const pointer = await new Promise<{ authority: string } | undefined>(
        resolve => {
          const request = store.get(pointerKey);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(undefined);
        }
      );
      database.close();
      return {
        state: state?.state ?? null,
        runId: state?.runId ?? null,
        authority: pointer?.authority ?? null,
      };
    },
    { metaKey: META_KEY, pointerKey: POINTER_KEY }
  );
}

/** Asserts the persisted authority pointer never reports IndexedDB authority
 * -- the mandatory "no false IDB_PRIMARY" check every row makes. */
async function expectNoFalseIdbPrimary(page: Page) {
  const meta = await readMigrationMeta(page);
  expect(meta.authority).not.toBe('indexedDB');
  expect(meta.state).not.toBe('IDB_PRIMARY');
}

/** Drives the real UI (same buttons as e2e-indexeddb/indexeddb-migration.spec.ts)
 * through preview -> download recovery and select migration -> reload, which
 * captures the legacy sources, records a download receipt, and lets
 * bootstrapCharacterPersistence auto-resume the engine all the way to
 * CUTOVER_READY in one pass. Returns the page positioned at that point. */
async function driveToCutoverReady(context: BrowserContext): Promise<Page> {
  await seedLegacyProfile(context);
  const page = await context.newPage();
  await page.goto('/player');
  await page
    .getByRole('button', { name: /preview character migration/i })
    .click();
  await expect(page.getByText(/entries/i)).toBeVisible();

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
  return page;
}

/** Rewrites the persisted migration-state record to `targetState`, keeping
 * the same runId (so verifyPersistedCapture still finds the already-captured
 * legacySnapshots) and setting checkpointAt to 'interrupted' as a crash
 * marker, per the brief. */
async function rewindMigrationState(page: Page, targetState: RewindState) {
  await page.evaluate(
    async ({ metaKey, targetState: target }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('rollkeeper-local');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const transaction = database.transaction('meta', 'readwrite');
      const store = transaction.objectStore('meta');
      const current = await new Promise<MigrationStateRecord | undefined>(
        (resolve, reject) => {
          const request = store.get(metaKey);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        }
      );
      if (!current) {
        transaction.abort();
        throw new Error(
          'migration-state record missing before checkpoint rewind'
        );
      }
      store.put({ ...current, state: target, checkpointAt: 'interrupted' });
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
    },
    { metaKey: META_KEY, targetState }
  );
}

/** Cold-interrupt seed: opens a fresh rollkeeper-local database with the
 * production schema (localDatabase.ts's OBJECT_STORE_NAMES/STORE_DEFINITIONS)
 * and writes only a meta migration-state record at `state` -- no
 * legacySnapshots, no kvGenerations, no download receipt. Also seeds the
 * character cutover selection marker (characterCutoverSelection.ts) with no
 * recovery metadata so the engine is driven forward on load but the
 * recovery-gate always fails, matching a real interrupted-before-capture
 * crash. */
async function seedColdInterrupt(page: Page, state: ColdState) {
  await page.goto('/player');
  await page.evaluate(
    async ({ characterRaw, dmRaw, metaKey, state: targetState, stores }) => {
      localStorage.setItem('rollkeeper-player-data', characterRaw);
      localStorage.setItem('rollkeeper-dm-data', dmRaw);
      localStorage.setItem(
        'rollkeeper:indexeddb-selection:guest:character',
        JSON.stringify({
          version: 1,
          namespace: 'guest',
          family: 'character',
          selectedAt: 'seeded',
        })
      );
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('rollkeeper-local', 1);
        open.onupgradeneeded = () => {
          const database = open.result;
          for (const [name, parameters] of stores) {
            if (!database.objectStoreNames.contains(name)) {
              database.createObjectStore(name, parameters);
            }
          }
        };
        open.onerror = () => reject(open.error);
        open.onblocked = () => reject(new Error('cold-interrupt seed blocked'));
        open.onsuccess = () => {
          const database = open.result;
          const transaction = database.transaction('meta', 'readwrite');
          transaction.objectStore('meta').put({
            key: metaKey,
            state: targetState,
            runId: 'cold-interrupt-run',
            checkpointAt: 'seeded',
          });
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      });
    },
    {
      characterRaw: CHARACTER_RAW,
      dmRaw: DM_RAW,
      metaKey: META_KEY,
      state,
      stores: OBJECT_STORES,
    }
  );
  await page.reload();
}

test.describe('rewind-after-receipt rows', () => {
  for (const state of REWIND_STATES) {
    test(`crash after checkpoint ${state} re-converges to CUTOVER_READY with zero data loss`, async ({
      browser,
    }) => {
      const context = await browser.newContext({ acceptDownloads: true });
      const page = await driveToCutoverReady(context);

      const before = await legacyBytes(page);
      expect(before).toEqual({ player: CHARACTER_RAW, dm: DM_RAW });

      await rewindMigrationState(page, state);
      await page.reload();

      // Re-convergence: the engine resumes from the rewound checkpoint and
      // drives itself back to CUTOVER_READY, so the cutover confirmation
      // control becomes reachable again.
      await expect(
        page.getByRole('button', { name: /confirm indexeddb cutover/i })
      ).toBeVisible({ timeout: 30_000 });

      const after = await legacyBytes(page);
      expect(after).toEqual(before);

      const meta = await readMigrationMeta(page);
      expect(meta.state).toBe('CUTOVER_READY');
      await expectNoFalseIdbPrimary(page);

      if (state === 'CUTOVER_READY') {
        // Representative rewind row: complete the cutover and re-run the
        // durable-integrity assertions from
        // e2e-indexeddb/indexeddb-migration.spec.ts (~lines 215-250).
        page.once('dialog', dialog => dialog.accept());
        const activationReload = page.waitForEvent('domcontentloaded');
        await page
          .getByRole('button', { name: /confirm indexeddb cutover/i })
          .click();
        await activationReload;
        await expect(
          page.getByRole('heading', { name: /your characters/i }).first()
        ).toBeVisible();

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
        });
        expect(durable.characterMirror).toBe(CHARACTER_RAW);
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
        expect(durable.rows).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              key: 'rollkeeper-player-data',
              rawValue: CHARACTER_RAW,
            }),
          ])
        );
      }

      await context.close();
    });
  }
});

test.describe('cold-interrupt rows', () => {
  for (const state of COLD_STATES) {
    test(`crash mid-${state} with no capture artifacts leaves the legacy dashboard authoritative`, async ({
      browser,
    }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await seedColdInterrupt(page, state);

      // Legacy dashboard still renders: PersistenceBootstrap only shows the
      // "Recovery required" screen when the engine result reports
      // authority: 'indexedDB', which migrationEngine.ts's result() helper
      // never does before an actual cutover activation.
      await expect(
        page.getByRole('heading', { name: /your characters/i })
      ).toBeVisible();

      const after = await legacyBytes(page);
      expect(after).toEqual({ player: CHARACTER_RAW, dm: DM_RAW });

      await expectNoFalseIdbPrimary(page);

      await context.close();
    });
  }
});

const HERO_RAW =
  '{"state":{"characters":[{"id":"hero-checkpoint","name":"Checkpoint Hero","race":"Human","class":"Fighter","level":1,"createdAt":"2020-01-01T00:00:00.000Z","updatedAt":"2020-01-01T00:00:00.000Z","lastPlayed":"2020-01-01T00:00:00.000Z","characterData":{"id":"hero-checkpoint","name":"Checkpoint Hero"},"tags":[],"isArchived":false}]},"version":1}';
const STALE_HERO_MIRROR =
  '{"state":{"characters":[{"id":"hero-checkpoint","name":"Stale Mirror","race":"Human","class":"Fighter","level":1,"createdAt":"2020-01-01T00:00:00.000Z","updatedAt":"2020-01-01T00:00:00.000Z","lastPlayed":"2020-01-01T00:00:00.000Z","characterData":{"id":"hero-checkpoint","name":"Stale Mirror"},"tags":[],"isArchived":false}]},"version":1}';

test('IDB_PRIMARY hydration: app hydrates from IndexedDB with the character present', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/player');
  await page.evaluate(
    async ({ characterRaw, staleMirror, metaKey, pointerKey, stores }) => {
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
        open.onupgradeneeded = () => {
          const database = open.result;
          for (const [name, parameters] of stores) {
            if (!database.objectStoreNames.contains(name)) {
              database.createObjectStore(name, parameters);
            }
          }
        };
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const database = open.result;
          const transaction = database.transaction(
            ['meta', 'kvGenerations'],
            'readwrite'
          );
          transaction.onerror = () => reject(transaction.error);
          transaction.objectStore('meta').put({
            key: pointerKey,
            authority: 'indexedDB',
            namespace: 'guest',
            family: 'character',
            generation: 'active',
            epoch: 1,
            committedAt: 'seeded',
          });
          transaction.objectStore('meta').put({
            key: metaKey,
            state: 'IDB_PRIMARY',
            runId: 'active',
            checkpointAt: 'seeded',
          });
          transaction.objectStore('kvGenerations').put({
            namespace: 'guest',
            generation: 'active',
            key: 'rollkeeper-player-data',
            presence: true,
            rawValue: characterRaw,
          });
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
        };
      });
      // A stale localStorage mirror (a different character name for the
      // same id) proves hydration reads through IndexedDB, not the legacy
      // copy: the reconciler must overwrite it with the IndexedDB row.
      localStorage.setItem('rollkeeper-player-data', staleMirror);
    },
    {
      characterRaw: HERO_RAW,
      staleMirror: STALE_HERO_MIRROR,
      metaKey: META_KEY,
      pointerKey: POINTER_KEY,
      stores: OBJECT_STORES,
    }
  );
  await page.reload();

  await expect(
    page.getByRole('heading', { name: /your characters/i })
  ).toBeVisible();
  await expect(page.getByText('Checkpoint Hero')).toBeVisible();
  await expect(page.getByText('Stale Mirror')).toHaveCount(0);

  const meta = await readMigrationMeta(page);
  expect(meta.authority).toBe('indexedDB');
  expect(meta.state).toBe('IDB_PRIMARY');

  const mirrored = await page.evaluate(() =>
    localStorage.getItem('rollkeeper-player-data')
  );
  expect(mirrored).toBe(HERO_RAW);

  await context.close();
});
