import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Shared cross-party battle-map relay helpers, moved out of
 * `e2e/shop-purchase-reconciliation.spec.ts` (originally copied from
 * `e2e/marker-loot-locked-claim.spec.ts`). Bodies are unchanged; the only
 * difference is that the spec-level `DM_ID` / `CAMPAIGN_NAME` constants the
 * originals closed over are now explicit parameters.
 */

/** Seeds a fixed dmId into a fresh origin, before any page reads the store. */
export async function seedDm(page: Page, dmId: string): Promise<void> {
  await page.goto('/player', { waitUntil: 'domcontentloaded' });
  await page.evaluate(dmId => {
    window.localStorage.setItem(
      'rollkeeper-dm-data',
      JSON.stringify({ state: { dmId, campaigns: [] }, version: 1 })
    );
  }, dmId);
}

/** Real POST to the app's own campaign-creation route — real Redis record,
 *  real generated code. */
export async function createCampaign(
  page: Page,
  dmId: string,
  name: string
): Promise<string> {
  return page.evaluate(
    async ({ dmId, name }) => {
      const res = await fetch('/api/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dmId, campaignName: name }),
      });
      if (!res.ok) {
        throw new Error(`create campaign failed: ${res.status}`);
      }
      const data = (await res.json()) as { code: string };
      return data.code;
    },
    { dmId, name }
  );
}

/** Real POST to the app's own join route, then mirrors `handleJoinCampaign`
 *  by writing `campaignCode` onto the roster entry. */
export async function joinCampaign(
  page: Page,
  code: string,
  characterId: string,
  campaignName: string
): Promise<void> {
  const result = await page.evaluate(
    async ({ code, characterId }) => {
      const character = window
        .__rkStores!.player.getState()
        .characters.find(c => c.id === characterId);
      if (!character) return { ok: false, status: 0, body: 'no character' };
      const res = await fetch(`/api/campaign/${code}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-rollkeeper-csrf': '1',
        },
        body: JSON.stringify({
          playerId: characterId,
          playerName: character.characterData.playerName || character.name,
          characterId,
          characterName: character.name,
          characterData: character.characterData,
        }),
      });
      const body = await res.json().catch(() => null);
      return { ok: res.ok, status: res.status, body };
    },
    { code, characterId }
  );
  if (!result.ok) {
    throw new Error(
      `join campaign failed: ${result.status} ${JSON.stringify(result.body)}`
    );
  }
  await page.evaluate(
    ({ code, characterId, campaignName }) => {
      window
        .__rkStores!.player.getState()
        .updateCharacter(characterId, { campaignCode: code, campaignName });
    },
    { code, characterId, campaignName }
  );
}

/** Live-camera coordinate lookup for a canvas element — copied from
 *  `marker-loot-locked-claim.spec.ts`'s `coordsForElement`. */
export async function coordsForElement(
  page: Page,
  elementId: string
): Promise<{ x: number; y: number }> {
  return page.evaluate(elId => {
    const vp = window.__rkStores!.viewport!;
    const el = vp.store.getById(elId);
    if (!el) throw new Error(`Element ${elId} not in store`);
    const center = {
      x: el.position.x + el.size.w / 2,
      y: el.position.y + el.size.h / 2,
    };
    const screenLocal = {
      x: center.x * vp.camera.z + vp.camera.x,
      y: center.y * vp.camera.z + vp.camera.y,
    };
    const canvas = document.querySelector('canvas');
    const wrapper = canvas?.parentElement;
    const rect = wrapper?.getBoundingClientRect();
    if (!rect) throw new Error('Canvas wrapper not found');
    return { x: rect.left + screenLocal.x, y: rect.top + screenLocal.y };
  }, elementId);
}

/** Waits until `elementId` exists in this page's own viewport store —
 *  placed locally on the DM (straight from the seeded canvasState), or
 *  replicated over the relay on a player. */
export async function waitForElementSynced(
  page: Page,
  elementId: string
): Promise<void> {
  await page.waitForFunction(
    id => !!window.__rkStores?.viewport?.store.getById(id),
    elementId,
    { timeout: 20_000 }
  );
}

/**
 * Next dev compiles API routes on first use. Under CI load a first POST to
 * a not yet compiled Table route has answered Next's HTML 404 page (CI run
 * 38678554011: `authority/initialize-if-empty`), which leaves the scene
 * local-only. Touch every Table route the flow uses first; the answers
 * (400/403/404 JSON) do not matter, only that each route is compiled.
 */
async function prewarmTableRoutes(page: Page, code: string): Promise<void> {
  const base = `/api/campaign/${code}`;
  for (const path of [
    '/table/control',
    '/table/scenes',
    '/table/authority/initialize-if-empty',
    '/table/authority/checkpoint',
    '/table/authority-challenge',
    '/table/display/status',
    '/battlemap-token',
  ]) {
    await page.request
      .post(`${base}${path}`, { data: {}, timeout: 60_000 })
      .catch(() => undefined);
  }
}

/** A live Table scene opened by {@link openTableSceneLive}. */
export interface LiveTableScene {
  /** The adopted scene id (its relay room and marker projection key). */
  sceneId: string;
  /** The loot ledger of the DM's latest marker publish (`PUT …/markers`). */
  lootLedger: () => Array<{ markerId: string; id: string }>;
}

/**
 * Table v1 flow (PR08 repair 07): the original editor has no live room, so
 * a cross-party map is a Table scene. Adds the battle map to the Table from
 * the Battle Maps page, opens the scene, waits until this tab is live,
 * Shows it, and waits for the DM's scene token. Players keep joining by the
 * source map URL; the server resolves it to the shown scene.
 */
export async function openTableSceneLive(
  dmPage: Page,
  code: string,
  mapName: string
): Promise<LiveTableScene> {
  let sceneId = '';
  let ledger: Array<{ markerId: string; id: string }> = [];
  dmPage.on('request', request => {
    if (
      request.method() !== 'PUT' ||
      !/\/markers$/u.test(new URL(request.url()).pathname)
    )
      return;
    const body = request.postDataJSON() as {
      loot?: Array<{ markerId: string; id: string }>;
    } | null;
    if (Array.isArray(body?.loot)) ledger = body.loot;
  });
  dmPage.on('response', response => {
    if (!/battlemap-token/u.test(response.url()) || response.status() !== 200)
      return;
    void response
      .json()
      .then((body: { sceneId?: string }) => {
        if (body.sceneId) sceneId = body.sceneId;
      })
      .catch(() => undefined);
  });
  await prewarmTableRoutes(dmPage, code);
  await dmPage.goto(`/dm/campaign/${code}/battlemaps`, {
    waitUntil: 'domcontentloaded',
  });
  await dmPage.getByRole('button', { name: `Add ${mapName} to Table` }).click();
  await dmPage.getByRole('button', { name: 'Open scene' }).click();
  await expect(
    dmPage.getByTestId('table-live-pill').filter({ hasText: /^You're live$/u })
  ).toBeVisible({ timeout: 30_000 });
  // Show is enabled once the scene room is ready. If its preparation hit a
  // transient failure ("Live play isn't available right now"), use the
  // page's own "Try again", as a DM would, until Show is enabled.
  const show = dmPage.getByRole('button', { name: 'Show this scene' });
  const retry = dmPage.getByRole('button', { name: 'Try again' }).first();
  await expect(async () => {
    if (await retry.isVisible()) await retry.click();
    await expect(show).toBeEnabled({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  await show.click();
  await expect(
    dmPage.getByText("Players' view updated", { exact: true })
  ).toBeVisible({ timeout: 20_000 });
  await expect(dmPage.getByRole('button', { name: 'Marker' })).toBeVisible({
    timeout: 15_000,
  });
  await dmPage.waitForFunction(() => !!window.__rkStores?.viewport, undefined, {
    timeout: 15_000,
  });
  // The Table stage shows no relay chip: wait for its scene token instead.
  await expect.poll(() => sceneId, { timeout: 20_000 }).not.toBe('');
  return { sceneId, lootLedger: () => ledger };
}
