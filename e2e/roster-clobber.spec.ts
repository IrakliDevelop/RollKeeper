import { test, expect } from '@playwright/test';

import {
  createCharacter,
  characterIdFromUrl,
  waitForStoresReady,
  readRosterEntry,
  storeHp,
  storeRevision,
  characterSlotId,
  damageCharacter,
} from './helpers';

// Reproduces the bug found by hand in scratchpad/repro/evidence.md,
// "EXPERIMENT 2 — DM + multiple players (two DIFFERENT characters) in one
// profile". Root cause: `updateCharacterData` in src/store/playerStore.ts
// re-persists the WHOLE in-memory roster on every local mutation, using
// each tab's own (possibly stale) copy of characters it isn't actively
// editing. tab1 holds character A, tab2 holds character B (same browser
// profile/localStorage). Every time tab1 writes back A, it also re-writes
// its stale in-memory copy of B — clobbering whatever tab2 most recently
// persisted for B.
//
// Expected verdict TODAY (pre-fix): RED — both assertions fail. Tasks 2-3
// make this pass. Do not weaken this spec to make it pass early.
test("a tab holding another character must not revert this character's roster entry", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const tab1 = await context.newPage();

  // tab1 creates both characters sequentially (matches evidence.md's Setup:
  // tab1 creates A, then B, so its in-memory roster starts as [A, B]).
  const urlA = await createCharacter(tab1, 'Roster Clobber A');
  const idA = characterIdFromUrl(urlA);
  const urlB = await createCharacter(tab1, 'Roster Clobber B');
  const idB = characterIdFromUrl(urlB);

  // Fresh navigation to A's sheet in tab1 (captures tab1's in-memory roster
  // snapshot at this point: [A, B]).
  await tab1.goto(urlA, { waitUntil: 'networkidle' });
  await waitForStoresReady(tab1);

  // tab2: fresh page, first-ever load of B's sheet (captures tab2's
  // in-memory roster snapshot: [A, B] too, both read from the same
  // localStorage at load time).
  const tab2 = await context.newPage();
  await tab2.goto(urlB, { waitUntil: 'networkidle' });
  await waitForStoresReady(tab2);

  const { max: hpMaxA } = await storeHp(tab1);
  const { max: hpMaxB } = await storeHp(tab2);

  // --- Interleave: tab1 dmg A (-3); tab2 dmg B (-4); tab1 dmg A (-2) ---
  // Revisions are captured from the live characterStore handle right after
  // each damage call (the bump is synchronous with the mutation) rather than
  // from the roster blob, which only reflects a write-back once the debounced
  // sync effect fires.
  await damageCharacter(tab1, 3);
  await expect
    .poll(async () => (await readRosterEntry(tab1, idA))?.hpCurrent, {
      message: "tab1's write-back of A(-3) should land in the roster blob",
      timeout: 10_000,
    })
    .toBe(hpMaxA - 3);

  await damageCharacter(tab2, 4);
  const revB = await storeRevision(tab2);
  await expect
    .poll(async () => (await readRosterEntry(tab2, idB))?.hpCurrent, {
      message: "tab2's write-back of B(-4) should land in the roster blob",
      timeout: 10_000,
    })
    .toBe(hpMaxB - 4);

  await damageCharacter(tab1, 2);
  const revA = await storeRevision(tab1);
  await expect
    .poll(async () => (await readRosterEntry(tab1, idA))?.hpCurrent, {
      message: "tab1's write-back of A(-2) should land in the roster blob",
      timeout: 10_000,
    })
    .toBe(hpMaxA - 5);

  // --- Assert 1 (roster integrity): both entries must carry their LATEST
  // hp AND revision. Pre-fix: tab1's last write-back (A) re-persists tab1's
  // stale in-memory copy of B (captured at creation, hp = hpMaxB, revision =
  // its creation-time revision), reverting B's roster entry back to full hp
  // and a stale revision — this assertion fails.
  const finalA = await readRosterEntry(tab1, idA);
  const finalB = await readRosterEntry(tab1, idB);
  expect
    .soft(finalA?.hpCurrent, "A's roster entry must reflect its latest damage")
    .toBe(hpMaxA - 5);
  expect
    .soft(finalA?.revision, "A's roster entry must carry its latest revision")
    .toBe(revA);
  expect
    .soft(finalB?.hpCurrent, "B's roster entry must reflect its latest damage")
    .toBe(hpMaxB - 4);
  expect
    .soft(finalB?.revision, "B's roster entry must carry its latest revision")
    .toBe(revB);

  // Mirrors evidence.md's Evidence Set 2: tab1 reloads (control case — A
  // comes back correct because tab1 was the last writer of A throughout),
  // then does a no-op /player round-trip nav. Both are tab1-only actions on
  // A, but each is itself a fresh write-back of tab1's (still-stale-for-B)
  // roster snapshot, which is what makes tab1 the definitive last writer of
  // the single `rollkeeper-character` slot by the time tab2 reloads next.
  await tab1.reload({ waitUntil: 'networkidle' });
  await waitForStoresReady(tab1);
  await tab1.goto('/player', { waitUntil: 'networkidle' });
  await tab1.goto(urlA, { waitUntil: 'networkidle' });
  await waitForStoresReady(tab1);

  // Force the ordering explicitly rather than relying on navigation overhead
  // outlasting useCharacterRosterSync's 50ms initial-load timer: confirm
  // tab1's final write-back (the single `rollkeeper-character` slot holding
  // A, and A's roster entry reflecting tab1's last write) has actually landed
  // before tab2 reloads next. (Revision is not asserted here: remounting the
  // sheet after `reload`/navigation legitimately re-runs mount-time effects
  // that can bump revision again with no change in hp — that's unrelated to
  // the clobber bug this spec targets, so only hp/id are checked.)
  await expect
    .poll(async () => characterSlotId(tab1), {
      message:
        "tab1's reload round-trip must finish writing A into the rollkeeper-character slot before tab2 reloads",
      timeout: 10_000,
    })
    .toBe(idA);
  await expect
    .poll(async () => (await readRosterEntry(tab1, idA))?.hpCurrent, {
      message:
        "tab1's reload round-trip must finish writing A's roster entry before tab2 reloads",
      timeout: 10_000,
    })
    .toBe(hpMaxA - 5);

  // --- Assert 2 (user-visible data loss): reloading tab2 (B's sheet) must
  // NOT undo B's damage. Pre-fix: characterStore rehydrates from the single
  // `rollkeeper-character` slot (now holding A, since tab1 wrote it last);
  // the id mismatch bypasses useCharacterRosterSync's staleness guard, so it
  // unconditionally loads B from the (already-clobbered) roster blob —
  // reverting B's live hp back to full.
  await tab2.reload({ waitUntil: 'networkidle' });
  await waitForStoresReady(tab2);
  const hpAfterReload = await storeHp(tab2);
  expect
    .soft(
      hpAfterReload.current,
      "B's hp must still reflect its damage after reload"
    )
    .toBe(hpMaxB - 4);
});
