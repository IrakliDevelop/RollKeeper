import { Page } from '@playwright/test';

import { extractEmailOtp } from '../src/lib/supabase/extractEmailOtp';

export { extractEmailOtp };

/** Types or pastes a six-digit code into the redesigned OTP boxes. */
export async function enterEmailOtp(page: Page, code: string): Promise<void> {
  await page.getByLabel('Digit 1 of 6').fill(code);
}

/** Waits until the dev-only `__rkStores.character` handle exists and the
 * character store has finished rehydrating from localStorage. */
export async function waitForStoresReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      !!window.__rkStores?.character &&
      window.__rkStores.character.getState().hasHydrated,
    undefined,
    { timeout: 15_000 }
  );
}

/**
 * Drives the working `/player/characters/new` creation flow (selectors
 * verified against the real app in scratchpad/repro/repro.js + repro3.js)
 * and waits for the resulting sheet to hydrate.
 * Returns the full sheet URL (e.g. http://localhost:3000/player/characters/abc123).
 */
export async function createCharacter(
  page: Page,
  name: string
): Promise<string> {
  await page.goto('/player/characters/new', { waitUntil: 'networkidle' });
  await page.fill('#characterName', name);
  await page.click('button[type="submit"]');
  await page.waitForURL(
    url =>
      /\/player\/characters\/[^/]+$/.test(url.pathname) &&
      !url.pathname.endsWith('/new'),
    { timeout: 15_000 }
  );
  await waitForStoresReady(page);
  const url = page.url();
  await waitForCharacterLoaded(page, characterIdFromUrl(url));
  return url;
}

/** Extracts the character id from a sheet URL produced by createCharacter(). */
export function characterIdFromUrl(url: string): string {
  const id = new URL(url).pathname.split('/').pop();
  if (!id) throw new Error(`Could not extract character id from URL: ${url}`);
  return id;
}

export interface RosterEntrySnapshot {
  id: string;
  name: string;
  revision: number | undefined;
  hpCurrent: number | undefined;
  hpMax: number | undefined;
}

/** Reads one character's entry out of the whole-roster `rollkeeper-player-data`
 * localStorage blob (playerStore) — the artifact at the center of the clobber bug. */
export async function readRosterEntry(
  page: Page,
  characterId: string
): Promise<RosterEntrySnapshot | null> {
  return page.evaluate(id => {
    const raw = window.localStorage.getItem('rollkeeper-player-data');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      state?: {
        characters?: Array<{
          id: string;
          name: string;
          characterData?: {
            revision?: number;
            hitPoints?: { current?: number; max?: number };
          };
        }>;
      };
    };
    const entry = parsed.state?.characters?.find(c => c.id === id);
    if (!entry) return null;
    return {
      id: entry.id,
      name: entry.name,
      revision: entry.characterData?.revision,
      hpCurrent: entry.characterData?.hitPoints?.current,
      hpMax: entry.characterData?.hitPoints?.max,
    };
  }, characterId);
}

/** Live in-memory hit points for whichever character is currently loaded in
 * this tab's characterStore. */
export async function storeHp(
  page: Page
): Promise<{ current: number; max: number }> {
  return page.evaluate(() => {
    const hp = window.__rkStores!.character.getState().character.hitPoints;
    return { current: hp.current, max: hp.max };
  });
}

/** Live in-memory revision for whichever character is currently loaded in
 * this tab's characterStore. The revision bump happens synchronously inside
 * the same `set` call as the mutation, so this can be read immediately after
 * a damage call with no polling — unlike the roster blob (`readRosterEntry`),
 * which only reflects the write-back once the debounced sync effect fires. */
export async function storeRevision(page: Page): Promise<number | undefined> {
  return page.evaluate(
    () => window.__rkStores!.character.getState().character.revision
  );
}

/** HP stored in the per-character canonical envelope — the value a
 * reloading tab will rehydrate. */
export async function envelopeHp(
  page: Page,
  characterId: string
): Promise<number | null> {
  return page.evaluate(id => {
    const raw = window.localStorage.getItem(`rollkeeper-character:${id}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      state?: { character?: { hitPoints?: { current?: number } } };
    };
    return parsed.state?.character?.hitPoints?.current ?? null;
  }, characterId);
}

/** Waits until the characterStore holds the requested character. */
export async function waitForCharacterLoaded(
  page: Page,
  characterId: string
): Promise<void> {
  await page.waitForFunction(
    id => window.__rkStores?.character?.getState().character.id === id,
    characterId,
    { timeout: 15_000 }
  );
}

/** Applies damage via the live characterStore handle (same mechanism as the
 * app's damage controls, bypassing the UI for speed/determinism). */
export async function damageCharacter(
  page: Page,
  amount: number
): Promise<void> {
  await page.evaluate(dmg => {
    window.__rkStores!.character.getState().applyDamageToCharacter(dmg);
  }, amount);
}

/** Waits until the dev-only `__rkStores.encounter` handle exists and the
 * encounter store has finished rehydrating from localStorage. The encounter
 * store has no `hasHydrated` state flag (unlike characterStore), so this
 * reads zustand's own persist API instead. */
export async function waitForEncounterStore(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      !!window.__rkStores?.encounter &&
      window.__rkStores.encounter.persist.hasHydrated(),
    undefined,
    { timeout: 15_000 }
  );
}
