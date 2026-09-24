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
