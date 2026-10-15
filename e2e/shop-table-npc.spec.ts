import { expect, test } from '@playwright/test';

import type { Browser, Page } from '@playwright/test';

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
  openTableSceneLive,
} from './helpers/battlemapRelay';
import { CURRENCY_VALUES, purseToCopper } from '../src/utils/currency';

import type { Currency } from '../src/types/character';

/**
 * Repair 09 (D2): a campaign NPC added to a scene through the Table (Add to
 * scene → Campaign NPC, then placed from the roster) is a working merchant.
 * Its DM token is keyed by the scene member id and the NPC link lives on the
 * Table actor, so the shop publish has to read the Table.
 *
 * 1. Shop opened after the NPC is on the scene: a player taps the token,
 *    buys, the coins move and the DM copy reconciles stock and purse.
 * 2. Shop already open before the NPC is added: the Table updates the
 *    published shop by itself, and a player tap opens it.
 *
 * Harness and seeding follow `shop-purchase-reconciliation.spec.ts`
 * (`config/playwright/shop.config.ts`: relay + dev server, local Redis).
 */

const DM_ID = 'dm-shop-table-e2e';
const MAP_ID = 'shop-table-map-e2e';
const MAP_NAME = 'Shop Table Map';
const NPC_ID = 'npc-shop-table-e2e';
const ITEM_ID = 'item-shop-table-e2e';
const MERCHANT_NAME = 'Maren';
const ITEM_NAME = 'Lantern Oil';
const PRICE_GP = 30;
const PRICE_COPPER = PRICE_GP * CURRENCY_VALUES.gold;
const STOCK = 2;
const BUYER_STARTING_GOLD = 100;

const dashboardUrl = (code: string) => `/dm/campaign/${code}`;

async function seedScenario(
  page: Page,
  code: string,
  campaignName: string,
  shopOpen: boolean
): Promise<void> {
  const now = new Date().toISOString();
  await page.evaluate(
    ({
      code,
      mapId,
      mapName,
      npcId,
      itemId,
      now,
      name,
      item,
      stock,
      dmId,
      campaignName,
      shopOpen,
      priceCopper,
    }) => {
      window.localStorage.setItem(
        'rollkeeper-npc-data',
        JSON.stringify({
          state: {
            npcsByCampaign: {
              [code]: [
                {
                  id: npcId,
                  campaignCode: code,
                  name,
                  kind: 'npc',
                  armorClass: '10',
                  maxHp: 10,
                  speed: '30 ft.',
                  inventory: [
                    {
                      id: itemId,
                      name: item,
                      quantity: stock,
                      category: 'consumable',
                      forSale: shopOpen,
                      ...(shopOpen ? { priceCopper } : {}),
                    },
                  ],
                  ...(shopOpen ? { shop: { open: true, updatedAt: now } } : {}),
                  createdAt: now,
                  updatedAt: now,
                },
              ],
            },
            appliedShopSaleIds: {},
            shopSalesLogByNpc: {},
          },
          version: 4,
        })
      );
      window.localStorage.setItem(
        'rollkeeper-dm-data',
        JSON.stringify({
          state: {
            dmId,
            campaigns: [{ code, name: campaignName, createdAt: now }],
          },
          version: 1,
        })
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
                  name: mapName,
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
    },
    {
      code,
      mapId: MAP_ID,
      mapName: MAP_NAME,
      npcId: NPC_ID,
      itemId: ITEM_ID,
      now,
      name: MERCHANT_NAME,
      item: ITEM_NAME,
      stock: STOCK,
      dmId: DM_ID,
      campaignName,
      shopOpen,
      priceCopper: PRICE_COPPER,
    }
  );
}

/** Real Table UI: Add to scene → Campaign NPC → the merchant, then place
 *  the new roster entry on the map. Returns the placed token id. */
async function addMerchantThroughTable(
  page: Page
): Promise<{ tokenId: string; memberId: string }> {
  await page.getByRole('button', { name: 'Add to scene' }).click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Add to scene' });
  await dialog.getByRole('tab', { name: 'Campaign NPC' }).click();
  await dialog.getByRole('button', { name: new RegExp(MERCHANT_NAME) }).click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });

  await page
    .getByRole('button', { name: new RegExp(`${MERCHANT_NAME}.*Not on map`) })
    .click();
  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('DM canvas has no bounding box');
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);

  const handle = await page.waitForFunction(
    () => {
      const all = window.__rkStores?.viewport?.store.getAll() ?? [];
      const token = all.find(
        element =>
          (element as unknown as { tokenKind?: string; sceneMemberId?: string })
            .tokenKind === 'combatant' &&
          !!(element as unknown as { sceneMemberId?: string }).sceneMemberId
      );
      const memberId = (token as unknown as { sceneMemberId?: string })
        ?.sceneMemberId;
      return token && memberId ? { tokenId: token.id, memberId } : null;
    },
    undefined,
    { timeout: 15_000 }
  );
  return (await handle.jsonValue()) as { tokenId: string; memberId: string };
}

async function setStartingGold(
  page: Page,
  characterId: string,
  gold: number
): Promise<void> {
  await page.evaluate(gold => {
    const store = window.__rkStores!.character;
    store.getState().updateCurrency({ gold });
    store.getState().saveCharacter();
  }, gold);
  await page.waitForFunction(
    ({ id, expectedGold }) => {
      const raw = window.localStorage.getItem(`rollkeeper-character:${id}`);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as {
        state?: { character?: { currency?: { gold?: number } } };
      };
      return parsed.state?.character?.currency?.gold === expectedGold;
    },
    { id: characterId, expectedGold: gold },
    { timeout: 10_000 }
  );
}

function merchantDialog(page: Page) {
  return page.getByRole('dialog').filter({ hasText: MERCHANT_NAME });
}

async function publishedEntityIds(page: Page, code: string): Promise<string[]> {
  return page.evaluate(
    async ({ code, npcId }) => {
      const res = await fetch(`/api/campaign/${code}/shops`);
      const data = (await res.json()) as {
        shops?: Array<{ npcId: string; entityIds: string[] }>;
      };
      return data.shops?.find(shop => shop.npcId === npcId)?.entityIds ?? [];
    },
    { code, npcId: NPC_ID }
  );
}

async function warm(dmPage: Page, playerPage: Page): Promise<void> {
  for (const path of [
    '/player',
    '/dm',
    '/dm/campaign/warm',
    '/dm/campaign/warm/battlemaps',
    '/dm/campaign/warm/table',
  ]) {
    await dmPage
      .goto(path, { waitUntil: 'load', timeout: 60_000 })
      .catch(() => {});
  }
  for (const path of [
    '/player',
    '/player/characters/new',
    '/player/campaign/warm/battlemap/warm',
  ]) {
    await playerPage
      .goto(path, { waitUntil: 'load', timeout: 60_000 })
      .catch(() => {});
  }
}

/** A joined player on the source map URL (resolved to the shown scene). */
async function playerOnMap(
  page: Page,
  code: string,
  campaignName: string,
  tokenId: string
): Promise<string> {
  const characterId = characterIdFromUrl(
    await createCharacter(page, 'Table Shopper')
  );
  await joinCampaign(page, code, characterId, campaignName);
  await setStartingGold(page, characterId, BUYER_STARTING_GOLD);
  await page.goto(
    `/player/campaign/${code}/battlemap/${MAP_ID}?character=${characterId}`,
    { waitUntil: 'networkidle' }
  );
  await waitForStoresReady(page);
  await waitForCharacterLoaded(page, characterId);
  await waitForElementSynced(page, tokenId);
  return characterId;
}

async function tap(page: Page, elementId: string): Promise<void> {
  const coords = await coordsForElement(page, elementId);
  await page.mouse.click(coords.x, coords.y);
}

async function contexts(browser: Browser) {
  const dm = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const player = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  return { dm, player };
}

test('a merchant added through the Table sells to a player and the DM copy reconciles', async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const campaignName = 'Shop Table E2E';
  const { dm, player } = await contexts(browser);
  try {
    const dmMapPage = await dm.newPage();
    const dmAdminPage = await dm.newPage();
    const playerPage = await player.newPage();
    await warm(dmMapPage, playerPage);

    await seedDm(dmMapPage, DM_ID);
    const code = await createCampaign(dmMapPage, DM_ID, campaignName);
    await seedScenario(dmMapPage, code, campaignName, false);
    await openTableSceneLive(dmMapPage, code, MAP_NAME);
    const { tokenId, memberId } = await addMerchantThroughTable(dmMapPage);

    // DM prices the item and opens the shop from the campaign page.
    await dmAdminPage.goto(dashboardUrl(code), { waitUntil: 'networkidle' });
    await dmAdminPage.getByRole('heading', { name: MERCHANT_NAME }).click();
    const dmDialog = merchantDialog(dmAdminPage);
    await expect(dmDialog).toBeVisible({ timeout: 10_000 });
    await dmDialog.getByRole('button', { name: 'Shop' }).click();
    await dmDialog
      .getByRole('textbox', { name: `${ITEM_NAME} price (gp)` })
      .fill(String(PRICE_GP));
    const forSale = dmDialog.getByRole('switch', {
      name: `List ${ITEM_NAME} for sale`,
    });
    await expect(forSale).toBeEnabled({ timeout: 5_000 });
    await forSale.click();
    await dmDialog.getByRole('switch', { name: 'Open for business' }).click();

    // The published shop lists exactly the Table token's member id.
    await expect
      .poll(() => publishedEntityIds(dmAdminPage, code), { timeout: 15_000 })
      .toEqual([memberId]);
    await dmAdminPage.keyboard.press('Escape');

    // Player taps the Table merchant and buys one.
    const characterId = await playerOnMap(
      playerPage,
      code,
      campaignName,
      tokenId
    );
    await tap(playerPage, tokenId);
    const shop = merchantDialog(playerPage);
    await expect(shop).toBeVisible({ timeout: 10_000 });
    await shop.getByRole('button', { name: `Buy · ${PRICE_GP} gp` }).click();
    await expect(shop.getByText('Bought.', { exact: false })).toBeVisible({
      timeout: 15_000,
    });

    // Coin debit on the player's own sheet.
    await playerPage.goto(`/player/characters/${characterId}`, {
      waitUntil: 'networkidle',
    });
    await waitForCharacterLoaded(playerPage, characterId);
    await expect
      .poll(
        async () =>
          purseToCopper(
            (await playerPage.evaluate(
              () => window.__rkStores!.character.getState().character.currency
            )) as Currency
          ),
        { timeout: 15_000 }
      )
      .toBe(BUYER_STARTING_GOLD * CURRENCY_VALUES.gold - PRICE_COPPER);

    // DM copy reconciles: stock 2 → 1, purse credited by the price.
    await dmAdminPage.goto(dashboardUrl(code), { waitUntil: 'networkidle' });
    await dmAdminPage.getByRole('heading', { name: MERCHANT_NAME }).click();
    const reconciled = merchantDialog(dmAdminPage);
    await reconciled.getByRole('button', { name: 'Shop' }).click();
    await expect(
      reconciled.getByRole('textbox', { name: `${ITEM_NAME} stock quantity` })
    ).toHaveValue(String(STOCK - 1), { timeout: 15_000 });
    await expect
      .poll(
        async () => {
          const values = await Promise.all(
            (['PP', 'GP', 'EP', 'SP', 'CP'] as const).map(label =>
              reconciled
                .getByRole('textbox', { name: `${label} balance` })
                .inputValue()
            )
          );
          const [pp, gp, ep, sp, cp] = values.map(Number);
          return (
            pp! * CURRENCY_VALUES.platinum +
            gp! * CURRENCY_VALUES.gold +
            ep! * CURRENCY_VALUES.electrum +
            sp! * CURRENCY_VALUES.silver +
            cp! * CURRENCY_VALUES.copper
          );
        },
        { timeout: 15_000 }
      )
      .toBe(PRICE_COPPER);
  } finally {
    await dm.close();
    await player.close();
  }
});

test('an open shop picks up a merchant placed on the Table afterwards', async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const campaignName = 'Shop Table Republish E2E';
  const { dm, player } = await contexts(browser);
  try {
    const dmMapPage = await dm.newPage();
    const playerPage = await player.newPage();
    await warm(dmMapPage, playerPage);

    await seedDm(dmMapPage, DM_ID);
    const code = await createCampaign(dmMapPage, DM_ID, campaignName);
    await seedScenario(dmMapPage, code, campaignName, true);
    // The shop is published before the merchant is on any scene.
    await dmMapPage.goto(dashboardUrl(code), { waitUntil: 'networkidle' });
    await dmMapPage.getByRole('heading', { name: MERCHANT_NAME }).click();
    const dmDialog = merchantDialog(dmMapPage);
    await dmDialog.getByRole('button', { name: 'Shop' }).click();
    const open = dmDialog.getByRole('switch', { name: 'Open for business' });
    // Seeded open locally; toggle off and on to publish it.
    await open.click();
    await open.click();
    await expect
      .poll(
        () =>
          dmMapPage.evaluate(async code => {
            const res = await fetch(`/api/campaign/${code}/shops`);
            return ((await res.json()) as { shops?: unknown[] }).shops?.length;
          }, code),
        { timeout: 15_000 }
      )
      .toBe(1);
    expect(await publishedEntityIds(dmMapPage, code)).toEqual([]);
    await dmMapPage.keyboard.press('Escape');

    await openTableSceneLive(dmMapPage, code, MAP_NAME);
    // OO5: wait for the Table's own token update (the ids-only PATCH) rather
    // than for time to pass.
    const tokensUpdated = dmMapPage.waitForResponse(
      response =>
        response.request().method() === 'PATCH' &&
        new URL(response.url()).pathname ===
          `/api/campaign/${code}/shops/${NPC_ID}`,
      { timeout: 30_000 }
    );
    const { tokenId, memberId } = await addMerchantThroughTable(dmMapPage);
    expect((await tokensUpdated).status()).toBe(200);
    expect(await publishedEntityIds(dmMapPage, code)).toEqual([memberId]);

    await playerOnMap(playerPage, code, campaignName, tokenId);
    await tap(playerPage, tokenId);
    await expect(merchantDialog(playerPage)).toBeVisible({ timeout: 10_000 });
    await expect(
      merchantDialog(playerPage).getByText(ITEM_NAME, { exact: true })
    ).toBeVisible();
  } finally {
    await dm.close();
    await player.close();
  }
});
