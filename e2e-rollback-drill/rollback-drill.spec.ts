import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { chromium, expect, test, type Page } from '@playwright/test';

import { enterEmailOtp, extractEmailOtp } from '../e2e/helpers';

/**
 * Nightly "feature rollback drill" (roadmap item): proves that flipping the
 * player-backup NEXT_PUBLIC_* flags off after real data went through the
 * ongoing-backup wizard degrades cleanly to the legacy player dashboard with
 * zero data loss.
 *
 * NEXT_PUBLIC_* flags are baked into the Next.js process at boot, and
 * IndexedDB/localStorage are origin-scoped (same origin for both phases:
 * http://localhost:3111). So the driver (scripts/run-rollback-drill.mjs)
 * runs ONE port across TWO sequential `next dev` processes with the flags
 * flipped between them, and both phases here reuse the SAME persistent
 * Chromium profile (chromium.launchPersistentContext(ROLLBACK_PROFILE_DIR))
 * so storage survives the server restart. Not part of the default
 * `test:e2e` run — driven by `npm run test:rollback:drill`.
 */

const BASE_URL = 'http://localhost:3111';
const MAILPIT_URL = 'http://127.0.0.1:54324';
const EMAIL = 'rollback-drill@example.test';
const CHARACTER_NAME = 'Rollback Hero';
const PERSISTENCE_MARKER = 'rollback-drill-complete-payload-marker';

function requireProfileDir(): string {
  const dir = process.env.ROLLBACK_PROFILE_DIR;
  if (!dir) {
    throw new Error(
      'ROLLBACK_PROFILE_DIR is not set — run this via `npm run test:rollback:drill`, not `playwright test` directly.'
    );
  }
  return dir;
}

/** Phase A and phase B run as separate `playwright test` processes (spawned
 * fresh per phase by scripts/run-rollback-drill.mjs), so phase A's complete
 * persistence snapshot has to be handed to phase B through a file rather
 * than in-memory state. ROLLBACK_PROFILE_DIR survives across both phases
 * (only removed by the driver after phase B finishes), so it doubles as that
 * scratch location. */
function persistenceSnapshotPath(): string {
  return join(requireProfileDir(), 'phase-a-character-persistence.json');
}

/** Mailpit keeps mail across drill runs, so a stale message from an earlier
 * run for the same fixture address can already satisfy a naive "find any
 * message to this address" search. Only consider messages created at or
 * after `sentAfter` (captured just before the "Email me a code" click) so a
 * leftover inbox never produces an already-expired code. */
async function findOtp(
  email: string,
  sentAfter: number
): Promise<string | null> {
  const list = await (await fetch(`${MAILPIT_URL}/api/v1/messages`)).json();
  for (const summary of list.messages ?? []) {
    if (new Date(summary.Created).getTime() < sentAfter) continue;
    const detail = await (
      await fetch(`${MAILPIT_URL}/api/v1/message/${summary.ID}`)
    ).json();
    const serialized = JSON.stringify(detail);
    if (!serialized.includes(email)) continue;
    const code = extractEmailOtp(serialized);
    if (code) return code;
  }
  return null;
}

async function waitForOtp(email: string, sentAfter: number): Promise<string> {
  await expect
    .poll(() => findOtp(email, sentAfter), {
      timeout: 30_000,
      message: 'waiting for Mailpit OTP',
    })
    .not.toBeNull();
  const code = await findOtp(email, sentAfter);
  if (!code) throw new Error('Mailpit OTP was not available');
  return code;
}

async function signIn(page: Page, email: string) {
  await page.goto(`${BASE_URL}/account`);
  await page.getByLabel(/^Email address/).fill(email);
  const sentAfter = Date.now() - 2_000;
  await page.getByRole('button', { name: 'Email me a code' }).click();
  const code = await waitForOtp(email, sentAfter);
  await enterEmailOtp(page, code);
  await expect(
    page.getByRole('main').getByText(email, { exact: true })
  ).toBeVisible({ timeout: 15_000 });
}

async function createCharacterViaStore(page: Page, name: string) {
  await page.goto(`${BASE_URL}/player`);
  await expect(
    page.getByRole('heading', { name: 'Your Characters' })
  ).toBeVisible();
  await page.waitForFunction(() =>
    Boolean(
      (window as unknown as { __rkStores?: Record<string, unknown> }).__rkStores
        ?.player
    )
  );
  await page.evaluate(
    ({ characterName, persistenceMarker }) => {
      const stores = (
        window as unknown as {
          __rkStores?: {
            player: {
              getState: () => {
                createCharacter: (
                  name: string,
                  characterData: Record<string, unknown>
                ) => string;
              };
            };
          };
        }
      ).__rkStores;
      stores?.player.getState().createCharacter(characterName, {
        hitPoints: {
          current: 37,
          max: 42,
          temporary: 5,
          calculationMode: 'manual',
          manualMaxOverride: 42,
        },
        notes: [
          {
            id: 'rollback-drill-note',
            title: 'Rollback persistence marker',
            content: `<p>${persistenceMarker}</p>`,
            category: 'note',
            order: 0,
            createdAt: '2026-08-30T00:00:00.000Z',
            updatedAt: '2026-08-30T00:00:00.000Z',
          },
        ],
      });
    },
    { characterName: name, persistenceMarker: PERSISTENCE_MARKER }
  );
  await page.reload();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible({
    timeout: 15_000,
  });
}

/** Waits for a safety-file "Save ..." button to trigger a download, then
 * re-selects the downloaded file through the matching file input — the
 * pattern used across the player-backup e2e suites (see
 * e2e-indexeddb/player-backup-current-character-recovery.spec.ts). */
async function saveAndReselect(
  page: Page,
  saveButtonName: string,
  fileInputLabel: string
) {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: saveButtonName }).click();
  const download = await downloadPromise;
  const downloadedPath = await download.path();
  if (!downloadedPath)
    throw new Error(`Download for "${saveButtonName}" produced no local path`);
  await page.getByLabel(fileInputLabel).setInputFiles(downloadedPath);
}

async function completeSafetyFileStep(page: Page) {
  await saveAndReselect(page, 'Save safety file', 'Choose safety file');
  const extraFileButton = page.getByRole('button', {
    name: 'Save current character file',
  });
  if (await extraFileButton.isVisible().catch(() => false)) {
    await saveAndReselect(
      page,
      'Save current character file',
      'Choose current character file'
    );
  }
  await expect(
    page
      .locator('[role="status"]:not(.sr-only)')
      .filter({ hasText: 'Safety file checked' })
  ).toBeVisible({
    timeout: 20_000,
  });
}

interface CharacterAuthorityPointerRecord {
  key: string;
  authority?: string;
  namespace?: string;
  family?: string;
  generation?: string;
  epoch?: number;
  committedAt?: string;
}

interface CharacterPersistenceSnapshot {
  hasDatabase: boolean;
  pointer: CharacterAuthorityPointerRecord | null;
  localStorageRaw: string | null;
  activeGenerationRow: Record<string, unknown> | null;
}

/** Durable rollback proof: payload bytes, pointer identity, and localStorage
 * mirror. `committedAt` is excluded because the live generation row can stamp
 * a new timestamp after cutover without changing character data. */
function durableCharacterPersistence(snapshot: CharacterPersistenceSnapshot) {
  const row = snapshot.activeGenerationRow;
  return {
    hasDatabase: snapshot.hasDatabase,
    pointer: snapshot.pointer
      ? {
          authority: snapshot.pointer.authority,
          namespace: snapshot.pointer.namespace,
          family: snapshot.pointer.family,
          generation: snapshot.pointer.generation,
          epoch: snapshot.pointer.epoch,
        }
      : null,
    localStorageRaw: snapshot.localStorageRaw,
    activeGenerationRow: row
      ? {
          namespace: row.namespace,
          generation: row.generation,
          key: row.key,
          presence: row.presence,
          rawValue: row.rawValue,
          cutoverEpoch: row.cutoverEpoch,
        }
      : null,
  };
}

/** Reads the complete durable character snapshot used by the rollback proof:
 * the localStorage mirror, the `meta` store's active-generation pointer, and
 * that pointer's exact `kvGenerations` row. The pointer is matched generically
 * rather than by hardcoding its namespace. */
async function readCharacterPersistenceSnapshot(
  page: Page
): Promise<CharacterPersistenceSnapshot> {
  return page.evaluate(async () => {
    const names = (await indexedDB.databases()).flatMap(item =>
      item.name ? [item.name] : []
    );
    if (!names.includes('rollkeeper-local')) {
      return {
        hasDatabase: false,
        pointer: null,
        localStorageRaw: localStorage.getItem('rollkeeper-player-data'),
        activeGenerationRow: null,
      };
    }
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('rollkeeper-local');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const rows = await new Promise<
      Array<{
        key: string;
        authority?: string;
        namespace?: string;
        family?: string;
        generation?: string;
        epoch?: number;
        committedAt?: string;
      }>
    >((resolve, reject) => {
      const transaction = database.transaction('meta', 'readonly');
      const request = transaction.objectStore('meta').getAll();
      request.onsuccess = () =>
        resolve(
          request.result as Array<{
            key: string;
            authority?: string;
            namespace?: string;
            family?: string;
            generation?: string;
            epoch?: number;
            committedAt?: string;
          }>
        );
      request.onerror = () => reject(request.error);
    });
    const pointer =
      rows.find(
        row =>
          row.key.startsWith('active-generation:') &&
          row.key.endsWith(':character')
      ) ?? null;
    const pointerNamespace = pointer?.namespace;
    const pointerGeneration = pointer?.generation;
    const activeGenerationRow =
      pointerNamespace && pointerGeneration
        ? await new Promise<Record<string, unknown> | null>(
            (resolve, reject) => {
              const transaction = database.transaction(
                'kvGenerations',
                'readonly'
              );
              const request = transaction
                .objectStore('kvGenerations')
                .get([
                  pointerNamespace,
                  pointerGeneration,
                  'rollkeeper-player-data',
                ]);
              request.onsuccess = () =>
                resolve(
                  (request.result as Record<string, unknown> | undefined) ??
                    null
                );
              request.onerror = () => reject(request.error);
            }
          )
        : null;
    database.close();
    return {
      hasDatabase: true,
      pointer,
      localStorageRaw: localStorage.getItem('rollkeeper-player-data'),
      activeGenerationRow,
    };
  });
}

test('phase A: activate ongoing backup', async () => {
  const context = await chromium.launchPersistentContext(requireProfileDir(), {
    acceptDownloads: true,
  });
  try {
    const page = context.pages()[0] ?? (await context.newPage());

    await signIn(page, EMAIL);
    await createCharacterViaStore(page, CHARACTER_NAME);

    await page.goto(`${BASE_URL}/player/backup`);
    await expect(
      page.getByRole('heading', { name: 'Protect your characters' })
    ).toBeVisible();

    // Step 1: Account — already signed in, just continue.
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 2: Safety file.
    await completeSafetyFileStep(page);
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 3: Choose characters — keep the default (all selected, ongoing
    // backup on) and confirm. This is the only action that copies anything.
    await page.getByRole('button', { name: 'Select all' }).click();
    await page.getByRole('button', { name: 'Turn on online backup' }).click();

    // Result.
    await expect(
      page.getByRole('heading', { name: 'Your characters are protected' })
    ).toBeVisible({ timeout: 30_000 });

    // Durable markers: IndexedDB 'rollkeeper-local' exists and the
    // active-generation meta pointer for the character family claims
    // indexedDB authority (key discovered at
    // src/lib/indexeddb/characterAuthority.ts:
    // `active-generation:${namespace}:character`, namespace 'guest' for the
    // local character IndexedDB cutover — see task-5-report.md).
    await expect
      .poll(() => readCharacterPersistenceSnapshot(page), {
        timeout: 30_000,
        message: 'waiting for live indexedDB generation payload',
      })
      .toMatchObject({
        hasDatabase: true,
        pointer: { authority: 'indexedDB' },
        localStorageRaw: expect.stringContaining(PERSISTENCE_MARKER),
        activeGenerationRow: {
          presence: true,
          rawValue: expect.stringContaining(PERSISTENCE_MARKER),
          committedAt: expect.any(String),
          cutoverEpoch: expect.any(Number),
        },
      });

    // Persist the live generation snapshot so phase B can prove that the
    // pointer, localStorage mirror, and active IndexedDB payload bytes are
    // unchanged, including distinctive non-name character data.
    const reading = await readCharacterPersistenceSnapshot(page);
    writeFileSync(persistenceSnapshotPath(), JSON.stringify(reading));
  } finally {
    await context.close();
  }
});

test('phase B: flags rolled back', async () => {
  const context = await chromium.launchPersistentContext(requireProfileDir(), {
    acceptDownloads: true,
  });
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(String(error)));

    const backupResponse = await page.goto(`${BASE_URL}/player/backup`);
    expect(backupResponse?.status()).toBe(404);

    await page.goto(`${BASE_URL}/player`);
    await expect(
      page.getByRole('heading', { name: 'Your Characters' })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: CHARACTER_NAME, exact: true })
    ).toBeVisible();

    const phaseASnapshot = JSON.parse(
      readFileSync(persistenceSnapshotPath(), 'utf8')
    ) as CharacterPersistenceSnapshot;
    expect(phaseASnapshot.pointer?.authority).toBe('indexedDB');
    expect(phaseASnapshot.localStorageRaw).toContain(PERSISTENCE_MARKER);
    expect(phaseASnapshot.activeGenerationRow?.rawValue).toContain(
      PERSISTENCE_MARKER
    );

    await expect
      .poll(
        async () =>
          durableCharacterPersistence(
            await readCharacterPersistenceSnapshot(page)
          ),
        {
          timeout: 30_000,
          message: 'waiting for phase B persistence to match phase A payload',
        }
      )
      .toEqual(durableCharacterPersistence(phaseASnapshot));

    expect(pageErrors).toEqual([]);
  } finally {
    await context.close();
  }
});
