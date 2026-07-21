import { Page } from '@playwright/test';

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
  return page.url();
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
