import { expect, test } from '@playwright/test';

import type { BrowserContext, Page } from '@playwright/test';

import {
  createCharacter,
  characterIdFromUrl,
  waitForStoresReady,
  waitForCharacterLoaded,
} from './helpers';
import {
  seedDm,
  createCampaign,
  joinCampaign,
  coordsForElement,
  waitForElementSynced,
} from './helpers/battlemapRelay';

/**
 * End-to-end coverage for the player battle-map sheet drawer (battlemap
 * sheet drawer PR1, Task 11): a real player on the live-relay battle map
 * places their own token, double-clicks it to open the non-modal
 * character-sheet drawer (without dragging the token), applies damage from
 * the drawer that survives a reload, closes it with Escape (restoring the
 * dock), and a single click on the token does NOT open it.
 *
 * Harness: `e2e/shop-purchase-reconciliation.spec.ts`'s relay pattern
 * (`config/playwright/sheet-drawer.config.ts` mirrors `shop.config.ts`'s
 * webServer wiring). The DM tab stays parked on the battle map for the whole
 * run so the live relay room — which is how the player's own placed token
 * comes back after a reload — is never torn down.
 *
 * The four scenarios share one DM/player setup and run serially, in order:
 * each builds on the state the previous one left behind (drawer open →
 * damaged + reopened → closed → token single-clicked).
 */

const CAMPAIGN_NAME = 'Sheet Drawer E2E Campaign';
const DM_ID = 'dm-sheet-drawer-e2e';
const MAP_ID = 'sheet-drawer-map-e2e';
const CHARACTER_NAME = 'Drawer Hero';
const DAMAGE = 3;

const mapUrl = (code: string) => `/dm/campaign/${code}/battlemaps/${MAP_ID}`;

/** Blank battle map seeded straight into the DM's localStorage — same shape
 *  as `marker-loot-locked-claim.spec.ts`'s `seedBattleMap`. */
async function seedBattleMap(page: Page, code: string): Promise<void> {
  const now = new Date().toISOString();
  await page.evaluate(
    ({ code, mapId, now, dmId, campaignName }) => {
      const dmRaw = window.localStorage.getItem('rollkeeper-dm-data');
      const dmParsed = dmRaw
        ? JSON.parse(dmRaw)
        : { state: { dmId, campaigns: [] }, version: 1 };
      dmParsed.state.campaigns = [{ code, name: campaignName, createdAt: now }];
      window.localStorage.setItem(
        'rollkeeper-dm-data',
        JSON.stringify(dmParsed)
      );
      window.localStorage.setItem(
        'rollkeeper-battlemap-data',
        JSON.stringify({
          state: {
            battleMaps: {
              [code]: {
                [mapId]: {
                  id: mapId,
                  campaignCode: code,
                  name: 'Sheet Drawer E2E Map',
                  mapImageUrl: '',
                  mapImageSize: { w: 1200, h: 900 },
                  canvasState: JSON.stringify({
                    version: 2,
                    camera: { position: { x: 0, y: 0 }, zoom: 1 },
                    elements: [],
                    layers: [
                      {
                        id: 'layer-map',
                        name: 'Map',
                        visible: true,
                        locked: true,
                        order: 0,
                        opacity: 1,
                      },
                      {
                        id: 'layer-annotations',
                        name: 'Annotations',
                        visible: true,
                        locked: false,
                        order: 100,
                        opacity: 1,
                      },
                    ],
                    activeLayerId: 'layer-annotations',
                  }),
                  dmOnlyElements: {},
                  gridEnabled: false,
                  linkedEncounterIds: [],
                  markers: [],
                  createdAt: now,
                  updatedAt: now,
                },
              },
            },
          },
          version: 0,
        })
      );
      window.localStorage.setItem(`rollkeeper-battlemap-mode:${mapId}`, 'play');
    },
    { code, mapId: MAP_ID, now, dmId: DM_ID, campaignName: CAMPAIGN_NAME }
  );
}

/** Opens the player battle map and waits for the character, the canvas
 *  viewport, and the live relay connection. */
async function openPlayerMap(
  page: Page,
  code: string,
  characterId: string
): Promise<void> {
  await page.goto(
    `/player/campaign/${code}/battlemap/${MAP_ID}?character=${characterId}`,
    { waitUntil: 'networkidle' }
  );
  await waitForStoresReady(page);
  await waitForCharacterLoaded(page, characterId);
  await page.waitForFunction(() => !!window.__rkStores?.viewport, undefined, {
    timeout: 15_000,
  });
  await expect(page.getByText('Live', { exact: true })).toBeVisible({
    timeout: 20_000,
  });
}

/** Waits for this player's own stamped token (`tokenKind: 'player'`,
 *  `characterId` — see `PlayerTokenTool`) in the viewport store; returns its
 *  element id. */
async function waitForOwnTokenId(
  page: Page,
  characterId: string
): Promise<string> {
  const handle = await page.waitForFunction(
    id => {
      const all = window.__rkStores?.viewport?.store.getAll() ?? [];
      const own = all.find(el => {
        const stamped = el as { tokenKind?: string; characterId?: string };
        return stamped.tokenKind === 'player' && stamped.characterId === id;
      });
      return own?.id ?? null;
    },
    characterId,
    { timeout: 20_000 }
  );
  return (await handle.jsonValue()) as string;
}

async function elementWorldPosition(
  page: Page,
  elementId: string
): Promise<{ x: number; y: number }> {
  return page.evaluate(id => {
    const el = window.__rkStores!.viewport!.store.getById(id);
    if (!el) throw new Error(`Element ${id} not in store`);
    return { x: el.position.x, y: el.position.y };
  }, elementId);
}

async function readHp(page: Page): Promise<{ current: number; max: number }> {
  return page.evaluate(() => {
    const hp = window.__rkStores!.character.getState().character.hitPoints;
    return { current: hp.current, max: hp.max };
  });
}

/** Player map toolbar buttons — scoped, since e.g. "Pan" also substring-
 *  matches the minimap's "Expand minimap" button. */
function toolbarButton(page: Page, name: string | RegExp) {
  return page
    .getByTestId('player-toolbar')
    .getByRole('button', { name, exact: typeof name === 'string' });
}

function sheetDialog(page: Page) {
  return page.getByRole('dialog', { name: /character sheet/i });
}

test.describe.configure({ mode: 'serial', timeout: 300_000 });

test.describe('player map sheet drawer', () => {
  let dmContext: BrowserContext;
  let playerContext: BrowserContext;
  let dmPage: Page;
  let playerPage: Page;
  let code: string;
  let characterId: string;
  let tokenId: string;
  let hpBeforeDamage: { current: number; max: number };

  test.beforeAll(async ({ browser }) => {
    dmContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    playerContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    dmPage = await dmContext.newPage();
    playerPage = await playerContext.newPage();

    // Prewarm every route sequentially before the timed flow — see the shop
    // spec's identical loop (cold compiles; concurrent first hits can trip
    // an HMR full reload mid-navigation).
    for (const path of [
      '/player',
      '/dm',
      '/dm/campaign/warm/battlemaps/warm',
      '/player/characters/new',
    ]) {
      await dmPage.goto(path, { waitUntil: 'networkidle' }).catch(() => {});
    }
    for (const path of [
      '/player',
      '/player/characters/new',
      '/player/campaign/warm/battlemap/warm',
    ]) {
      await playerPage.goto(path, { waitUntil: 'networkidle' }).catch(() => {});
    }

    // ---- DM: real campaign + blank battle map, parked on the live relay ----
    await seedDm(dmPage, DM_ID);
    code = await createCampaign(dmPage, DM_ID, CAMPAIGN_NAME);
    await seedBattleMap(dmPage, code);
    await dmPage.goto(mapUrl(code), { waitUntil: 'networkidle' });
    await dmPage.waitForFunction(
      () => !!window.__rkStores?.viewport,
      undefined,
      { timeout: 15_000 }
    );
    await expect(dmPage.getByText('Live', { exact: true })).toBeVisible({
      timeout: 20_000,
    });

    // ---- Player: real character, real join, open the map ----
    const characterUrl = await createCharacter(playerPage, CHARACTER_NAME);
    characterId = characterIdFromUrl(characterUrl);
    await joinCampaign(playerPage, code, characterId, CAMPAIGN_NAME);
    await openPlayerMap(playerPage, code, characterId);

    // ---- Player: place own token via the real Place token tool ----
    // Labelled "Place your token on the map" (hint state) until the
    // player has a token on the map, "Place token" afterwards.
    await toolbarButton(
      playerPage,
      /^Place (token|your token on the map)$/
    ).click();
    const canvas = playerPage.locator('canvas').first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Player canvas has no bounding box');
    // Left of centre: clear of the right-hand character dock.
    await playerPage.mouse.click(
      box.x + box.width * 0.45,
      box.y + box.height * 0.5
    );
    tokenId = await waitForOwnTokenId(playerPage, characterId);
    // DM sees it too → it lives in the relay room and survives a reload.
    await waitForElementSynced(dmPage, tokenId);
  });

  test.afterAll(async () => {
    await dmContext?.close();
    await playerContext?.close();
  });

  test('double-clicking the own token opens the drawer without moving it', async () => {
    await toolbarButton(playerPage, 'Pan').click();
    // Dock starts expanded at this viewport width.
    await expect(
      playerPage.getByRole('button', { name: 'Collapse character dock' })
    ).toBeVisible();

    const worldBefore = await elementWorldPosition(playerPage, tokenId);
    const screenBefore = await coordsForElement(playerPage, tokenId);
    await playerPage.mouse.dblclick(screenBefore.x, screenBefore.y);

    const dialog = sheetDialog(playerPage);
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog).toHaveAccessibleName(
      `${CHARACTER_NAME} character sheet`
    );
    // Opening collapses the dock to its CHAR pill.
    await expect(
      playerPage.getByRole('button', { name: /CHAR/ })
    ).toBeVisible();

    expect(await elementWorldPosition(playerPage, tokenId)).toEqual(
      worldBefore
    );
    expect(await coordsForElement(playerPage, tokenId)).toEqual(screenBefore);
  });

  test('damage applied from the drawer persists across a reload', async () => {
    const dialog = sheetDialog(playerPage);
    await expect(dialog).toBeVisible();
    hpBeforeDamage = await readHp(playerPage);
    expect(hpBeforeDamage.current).toBeGreaterThan(DAMAGE);
    const expectedHp = `${hpBeforeDamage.current - DAMAGE}/${hpBeforeDamage.max}`;

    await dialog
      .getByRole('textbox', { name: 'HP amount' })
      .fill(String(DAMAGE));
    await dialog.getByRole('button', { name: 'Damage' }).click();
    await expect(dialog.getByText(expectedHp, { exact: true })).toBeVisible({
      timeout: 5_000,
    });

    // The drawer's damage is a real character mutation: it must be on disk
    // (the canonical per-character envelope) before the reload.
    await playerPage.waitForFunction(
      ({ id, expected }) => {
        const raw = window.localStorage.getItem(`rollkeeper-character:${id}`);
        if (!raw) return false;
        const parsed = JSON.parse(raw) as {
          state?: { character?: { hitPoints?: { current?: number } } };
        };
        return parsed.state?.character?.hitPoints?.current === expected;
      },
      { id: characterId, expected: hpBeforeDamage.current - DAMAGE },
      { timeout: 10_000 }
    );

    await playerPage.reload({ waitUntil: 'networkidle' });
    await waitForStoresReady(playerPage);
    await waitForCharacterLoaded(playerPage, characterId);
    await expect(sheetDialog(playerPage)).toBeHidden();

    await playerPage
      .getByRole('button', { name: 'Open character sheet' })
      .click();
    const reopened = sheetDialog(playerPage);
    await expect(reopened).toBeVisible({ timeout: 10_000 });
    await expect(reopened.getByText(expectedHp, { exact: true })).toBeVisible();
  });

  test('Escape closes the drawer and restores the expanded dock', async () => {
    const dialog = sheetDialog(playerPage);
    await expect(dialog).toBeVisible();
    // Reopened from the dock's Sheet button, so the dock was expanded.
    await expect(
      playerPage.getByRole('button', { name: 'Collapse character dock' })
    ).toBeHidden();

    await playerPage.keyboard.press('Escape');
    await expect(dialog).toBeHidden({ timeout: 5_000 });
    await expect(
      playerPage.getByRole('button', { name: 'Collapse character dock' })
    ).toBeVisible();
    await expect(
      playerPage.getByRole('button', { name: 'Open character sheet' })
    ).toBeVisible();
  });

  test('a single click on the own token does not open the drawer', async () => {
    // The token came back over the relay after the reload.
    await waitForElementSynced(playerPage, tokenId);
    await toolbarButton(playerPage, 'Pan').click();

    const coords = await coordsForElement(playerPage, tokenId);
    await playerPage.mouse.click(coords.x, coords.y);
    await playerPage.waitForTimeout(400);
    await expect(sheetDialog(playerPage)).toHaveCount(0);

    // Control: the same coordinates DO hit the token — a double click there
    // opens the drawer, so the single click above was not a miss.
    await playerPage.mouse.dblclick(coords.x, coords.y);
    await expect(sheetDialog(playerPage)).toBeVisible({ timeout: 10_000 });
  });
});
