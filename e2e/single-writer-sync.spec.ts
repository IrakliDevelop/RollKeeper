import { test, expect, Page, BrowserContext } from '@playwright/test';

import {
  createCharacter,
  waitForStoresReady,
  waitForCharacterLoaded,
  characterIdFromUrl,
  storeHp,
  damageCharacter,
  envelopeHp,
} from './helpers';

/** Regression matrix for single-writer cross-tab sync (spec
 * docs/superpowers/specs/2026-08-01-crosstab-op-sync-design.md §Testing).
 * Replaces hp-reset-repro.spec.ts: the divergence it pinned is now
 * structurally impossible — these specs assert CONVERGENCE. */

const toggleShield = (page: Page) =>
  page.evaluate(() => {
    window.__rkStores!.character.getState().toggleShield();
  });

const shieldOn = (page: Page) =>
  page.evaluate(
    () => window.__rkStores!.character.getState().character.isWearingShield
  );

async function openSecondTab(
  context: BrowserContext,
  url: string,
  characterId: string
) {
  const tab = await context.newPage();
  await tab.goto(url, { waitUntil: 'networkidle' });
  await waitForStoresReady(tab);
  await waitForCharacterLoaded(tab, characterId);
  return tab;
}

test('1: concurrent damage (follower) + shield (leader) — both survive, reload keeps them', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const tab1 = await context.newPage();
  const url = await createCharacter(tab1, 'ConvergeHero');
  const characterId = characterIdFromUrl(url);
  const tab2 = await openSecondTab(context, url, characterId);

  const { max } = await storeHp(tab1);

  await Promise.all([damageCharacter(tab2, 3), toggleShield(tab1)]);

  // BOTH tabs converge to damage applied AND shield on.
  for (const tab of [tab1, tab2]) {
    await expect
      .poll(async () => (await storeHp(tab)).current, { timeout: 10_000 })
      .toBe(max - 3);
    await expect.poll(() => shieldOn(tab), { timeout: 10_000 }).toBe(true);
  }

  // Reload the battlemap-role tab — the reported bug was HP reset here.
  await tab2.reload({ waitUntil: 'networkidle' });
  await waitForStoresReady(tab2);
  await waitForCharacterLoaded(tab2, characterId);
  expect((await storeHp(tab2)).current).toBe(max - 3);
  expect(await shieldOn(tab2)).toBe(true);
});

test('2: concurrent spell-slot spends from two tabs both land', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const tab1 = await context.newPage();
  const url = await createCharacter(tab1, 'SlotHero');
  const characterId = characterIdFromUrl(url);

  // Seed a level-3 slot pool via the leader tab. `loadCharacterState`
  // (run on every fresh mount / cross-tab adoption) recomputes spellSlots
  // from class+level, so the default new-character class (a non-caster at
  // level 1) must be bumped to a real level-6 full caster first — that
  // recompute naturally yields the same `max: 3` for a level-3 slot
  // (FULL_CASTER_SPELL_SLOTS[6][3] === 3), so both tabs agree post-load.
  await tab1.evaluate(() => {
    const store = window.__rkStores!.character.getState();
    store.updateCharacter({
      level: 6,
      classes: (store.character.classes ?? []).map(c => ({
        ...c,
        spellcaster: 'full' as const,
        level: 6,
      })),
      spellSlots: {
        ...store.character.spellSlots,
        3: { max: 3, used: 0 },
      },
    });
  });

  const tab2 = await openSecondTab(context, url, characterId);

  await Promise.all([
    tab1.evaluate(() =>
      window.__rkStores!.character.getState().spendSpellSlot(3, 1)
    ),
    tab2.evaluate(() =>
      window.__rkStores!.character.getState().spendSpellSlot(3, 1)
    ),
  ]);

  for (const tab of [tab1, tab2]) {
    await expect
      .poll(
        () =>
          tab.evaluate(
            () =>
              window.__rkStores!.character.getState().character.spellSlots[3]
                .used
          ),
        { timeout: 10_000 }
      )
      .toBe(2);
  }
});

test('3: concurrent condition adds from two tabs both present', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const tab1 = await context.newPage();
  const url = await createCharacter(tab1, 'CondHero');
  const characterId = characterIdFromUrl(url);
  const tab2 = await openSecondTab(context, url, characterId);

  const addCondition = (page: Page, name: string) =>
    page.evaluate(
      n =>
        window
          .__rkStores!.character.getState()
          .addCondition(n, 'e2e', `desc ${n}`),
      name
    );

  await Promise.all([
    addCondition(tab1, 'Poisoned'),
    addCondition(tab2, 'Prone'),
  ]);

  for (const tab of [tab1, tab2]) {
    await expect
      .poll(
        () =>
          tab.evaluate(() =>
            window
              .__rkStores!.character.getState()
              .character.conditionsAndDiseases.activeConditions.map(c => c.name)
              .sort()
          ),
        { timeout: 10_000 }
      )
      .toEqual(['Poisoned', 'Prone']);
  }
});

test('4+9: leader killed around a follower intent — applied exactly once after promotion', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const tab1 = await context.newPage(); // leader
  const url = await createCharacter(tab1, 'FailoverHero');
  const characterId = characterIdFromUrl(url);
  const tab2 = await openSecondTab(context, url, characterId);

  const { max } = await storeHp(tab2);

  // Fire the follower intent and kill the leader in the same beat.
  await Promise.all([damageCharacter(tab2, 3), tab1.close()]);

  // tab2 promotes (Web Locks releases on close), reconciles its own
  // pending intent, and lands on exactly one application.
  await expect
    .poll(async () => (await storeHp(tab2)).current, { timeout: 15_000 })
    .toBe(max - 3);

  // Never max - 6 (double apply) — hold the value briefly to prove stability.
  await tab2.waitForTimeout(3000); // > retry interval
  expect((await storeHp(tab2)).current).toBe(max - 3);
  await expect
    .poll(() => envelopeHp(tab2, characterId), { timeout: 10_000 })
    .toBe(max - 3);
});

test('5: character switch hands leadership over', async ({ browser }) => {
  const context = await browser.newContext();
  const tab1 = await context.newPage();
  const urlA = await createCharacter(tab1, 'HeroA');
  const idA = characterIdFromUrl(urlA);
  const tab2 = await openSecondTab(context, urlA, idA);

  // tab1 switches to a different character — releases A's writer lock.
  const urlB = await createCharacter(tab1, 'HeroB');
  const idB = characterIdFromUrl(urlB);
  expect(idB).not.toBe(idA);

  // tab2 (now A's leader) mutates; the change must persist to A's envelope.
  const { max } = await storeHp(tab2);
  await damageCharacter(tab2, 4);
  await expect
    .poll(() => envelopeHp(tab2, idA), { timeout: 10_000 })
    .toBe(max - 4);
});

test('7: different characters in different tabs stay isolated', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const tab1 = await context.newPage();
  const urlA = await createCharacter(tab1, 'IsoA');
  const idA = characterIdFromUrl(urlA);

  const tab2 = await context.newPage();
  const urlB = await createCharacter(tab2, 'IsoB');
  const idB = characterIdFromUrl(urlB);

  const hpA = await storeHp(tab1);
  const hpB = await storeHp(tab2);
  await Promise.all([damageCharacter(tab1, 2), damageCharacter(tab2, 5)]);

  await expect
    .poll(() => envelopeHp(tab1, idA), { timeout: 10_000 })
    .toBe(hpA.max - 2);
  await expect
    .poll(() => envelopeHp(tab2, idB), { timeout: 10_000 })
    .toBe(hpB.max - 5);

  await tab1.reload({ waitUntil: 'networkidle' });
  await waitForStoresReady(tab1);
  await waitForCharacterLoaded(tab1, idA);
  expect((await storeHp(tab1)).current).toBe(hpA.max - 2);

  await tab2.reload({ waitUntil: 'networkidle' });
  await waitForStoresReady(tab2);
  await waitForCharacterLoaded(tab2, idB);
  expect((await storeHp(tab2)).current).toBe(hpB.max - 5);
});
