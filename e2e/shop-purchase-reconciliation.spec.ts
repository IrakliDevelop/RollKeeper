import { expect, test } from '@playwright/test';

import type { Page } from '@playwright/test';

import {
  createCharacter,
  characterIdFromUrl,
  waitForStoresReady,
  waitForCharacterLoaded,
} from './helpers';
import { CURRENCY_VALUES, purseToCopper } from '../src/utils/currency';

import type { Currency } from '../src/types/character';

/**
 * End-to-end coverage for the whole merchant shop loop (VTT merchants
 * Slice 3, Task 14): a DM prices an item and opens a merchant's shop, a
 * real player client — connected through the live battle-map relay, not a
 * same-tab preview — taps the merchant's token and buys, the coin debit and
 * the item land on that player's own character sheet, the DM's copy
 * reconciles the sale into the NPC's purse and stock, and a second player
 * hitting the now-empty shop gets refused server-side.
 *
 * Harness: follows `e2e/marker-loot-locked-claim.spec.ts` for the
 * cross-party relay pattern (`playwright.shop.config.ts` mirrors
 * `playwright.loot.config.ts`'s webServer wiring exactly — this is the only
 * other flow in the repo where a canvas element authored by the DM has to
 * reach a second client over the live relay before anything else can
 * happen) and `e2e/token-decoration-overlay.spec.ts` for seeding a
 * DM-authored combatant token straight into `rollkeeper-battlemap-data` /
 * `rollkeeper-encounter-data` localStorage (a proven-working raw Fieldnotes
 * v2 payload) rather than driving the "place a token" UI, which has nothing
 * to do with the shop feature under test. The merchant NPC itself
 * (`rollkeeper-npc-data`) is seeded the same way — only the *shop* authoring
 * (pricing, the for-sale toggle, "Open for business") is a real UI action
 * against `NPCShopTab`, because that publish is the feature this task
 * exists to prove end to end.
 *
 * Two DM pages share one browser context (and therefore one origin's
 * localStorage): `dmMapPage` stays parked on the battle map for the whole
 * test so the live relay connection that carries the token to players is
 * never torn down, while `dmAdminPage` drives the NPC dashboard
 * (`/dm/campaign/[code]`) for pricing/publishing and, later, for reading
 * back the reconciled purse/stock — a route the battle map's DM VTT screen
 * doesn't render at all.
 */

const CAMPAIGN_NAME = 'Shop E2E Campaign';
const DM_ID = 'dm-shop-e2e';
const MAP_ID = 'shop-map-e2e';
const ENCOUNTER_ID = 'enc-shop-e2e';
const ENTITY_ID = 'entity-shop-e2e';
const TOKEN_ID = 'token-shop-e2e';
const NPC_ID = 'npc-shop-e2e';
const ITEM_ID = 'item-shop-e2e';
const MERCHANT_NAME = 'Old Maren';
const ITEM_NAME = 'Healing Draught';
const PRICE_GP = 30;
const PRICE_COPPER = PRICE_GP * CURRENCY_VALUES.gold; // 3000
const STOCK = 1;
const BUYER_STARTING_GOLD = 100;
const BUYER_STARTING_COPPER = BUYER_STARTING_GOLD * CURRENCY_VALUES.gold; // 10000

const mapUrl = (code: string) => `/dm/campaign/${code}/battlemaps/${MAP_ID}`;
const dashboardUrl = (code: string) => `/dm/campaign/${code}`;

/** Seeds a fixed dmId into a fresh origin, before any page reads the store.
 *  Copied verbatim from `marker-loot-locked-claim.spec.ts`. */
async function seedDm(page: Page): Promise<void> {
  await page.goto('/player', { waitUntil: 'domcontentloaded' });
  await page.evaluate(dmId => {
    window.localStorage.setItem(
      'rollkeeper-dm-data',
      JSON.stringify({ state: { dmId, campaigns: [] }, version: 1 })
    );
  }, DM_ID);
}

/** Real POST to the app's own campaign-creation route. Copied verbatim from
 *  `marker-loot-locked-claim.spec.ts`. */
async function createCampaign(page: Page, name: string): Promise<string> {
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
    { dmId: DM_ID, name }
  );
}

/** Real POST to the app's own join route, then mirrors `handleJoinCampaign`
 *  by writing `campaignCode` onto the roster entry — copied verbatim from
 *  `marker-loot-locked-claim.spec.ts`. */
async function joinCampaign(
  page: Page,
  code: string,
  characterId: string
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
    { code, characterId, campaignName: CAMPAIGN_NAME }
  );
}

/**
 * Seeds the merchant NPC, the encounter entity linking to it
 * (`npcSourceId`), and a battle map carrying a combatant token wired to
 * that entity (`tokenKind: 'combatant'`, `entityId`) — the exact shape
 * `token-decoration-overlay.spec.ts` proves the app hydrates correctly.
 * `rollkeeper-dm-data`'s campaign list is updated too, same dance
 * `marker-loot-locked-claim.spec.ts`'s `seedBattleMap` does, since the DM
 * VTT screen resolves the campaign name from it.
 *
 * The item is seeded NOT for sale and with no price: the DM's own Shop-tab
 * pricing + for-sale toggle is the real UI action this test drives (see the
 * file's doc comment), not something to seed away.
 */
async function seedShopScenario(page: Page, code: string): Promise<void> {
  const now = new Date().toISOString();
  await page.evaluate(
    ({
      code,
      mapId,
      encounterId,
      entityId,
      tokenId,
      npcId,
      itemId,
      now,
      merchantName,
      itemName,
      stock,
      dmId,
      campaignName,
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
                  name: merchantName,
                  armorClass: '10',
                  maxHp: 10,
                  speed: '30 ft.',
                  inventory: [
                    {
                      id: itemId,
                      name: itemName,
                      quantity: stock,
                      category: 'consumable',
                      forSale: false,
                    },
                  ],
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
        'rollkeeper-encounter-data',
        JSON.stringify({
          state: {
            encounters: [
              {
                id: encounterId,
                name: 'Shop E2E Encounter',
                campaignCode: code,
                entities: [
                  {
                    id: entityId,
                    type: 'npc',
                    name: merchantName,
                    initiative: null,
                    initiativeModifier: 0,
                    currentHp: 10,
                    maxHp: 10,
                    tempHp: 0,
                    armorClass: 10,
                    conditions: [],
                    npcSourceId: npcId,
                    campaignCode: code,
                  },
                ],
                currentTurn: 0,
                round: 0,
                isActive: false,
                sortOrder: 'initiative',
                createdAt: now,
                updatedAt: now,
              },
            ],
            activeEncounterId: encounterId,
          },
          version: 2,
        })
      );

      const canvasState = JSON.stringify({
        version: 2,
        camera: { position: { x: 0, y: 0 }, zoom: 1 },
        elements: [
          {
            id: tokenId,
            type: 'shape',
            position: { x: 320, y: 260 },
            size: { w: 80, h: 80 },
            zIndex: 1000,
            locked: false,
            layerId: 'layer-annotations',
            shape: 'ellipse',
            strokeColor: '#1e293b',
            strokeWidth: 2,
            fillColor: '#8B5E3C',
            tokenKind: 'combatant',
            entityId,
          },
        ],
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
      });

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
                  name: 'Shop E2E Map',
                  mapImageUrl: '',
                  mapImageSize: { w: 1200, h: 900 },
                  canvasState,
                  dmOnlyElements: {},
                  gridEnabled: false,
                  linkedEncounterIds: [encounterId],
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
    {
      code,
      mapId: MAP_ID,
      encounterId: ENCOUNTER_ID,
      entityId: ENTITY_ID,
      tokenId: TOKEN_ID,
      npcId: NPC_ID,
      itemId: ITEM_ID,
      now,
      merchantName: MERCHANT_NAME,
      itemName: ITEM_NAME,
      stock: STOCK,
      dmId: DM_ID,
      campaignName: CAMPAIGN_NAME,
    }
  );
}

/** Sets a character's starting purse directly on the live store and saves
 *  it, then waits for the per-character canonical envelope
 *  (`rollkeeper-character:<id>`, the same key `envelopeHp` in helpers.ts
 *  reads) to actually carry it — a fresh navigation rehydrates from this
 *  key, not from whatever the in-memory store happened to hold. */
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

/** Live-camera coordinate lookup for a canvas element — copied from
 *  `marker-loot-locked-claim.spec.ts`'s `coordsForElement`. */
async function coordsForElement(
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

async function tapElement(page: Page, elementId: string): Promise<void> {
  const coords = await coordsForElement(page, elementId);
  await page.mouse.click(coords.x, coords.y);
}

/** Waits until `elementId` exists in this page's own viewport store —
 *  placed locally on the DM (straight from the seeded canvasState), or
 *  replicated over the relay on a player. */
async function waitForElementSynced(
  page: Page,
  elementId: string
): Promise<void> {
  await page.waitForFunction(
    id => !!window.__rkStores?.viewport?.store.getById(id),
    elementId,
    { timeout: 20_000 }
  );
}

/** The player shop dialog and the (editable) NPC detail dialog both use the
 *  merchant's name as their `DialogTitle` — scoped separately per page, so
 *  this is safe to reuse for both. Filters out the Next.js error overlay,
 *  same technique as `marker-loot-locked-claim.spec.ts`'s `markerDialog`. */
function merchantDialog(page: Page) {
  return page.getByRole('dialog').filter({ hasText: MERCHANT_NAME });
}

/** Real fetch of the player-readable shop index — the same endpoint
 *  `useMerchantShopActivation` calls on a token tap. */
async function fetchShopsIndex(
  page: Page,
  code: string
): Promise<Array<{ npcId: string }>> {
  return page.evaluate(async code => {
    const res = await fetch(`/api/campaign/${code}/shops`);
    const data = (await res.json()) as { shops?: Array<{ npcId: string }> };
    return data.shops ?? [];
  }, code);
}

test('DM opens a shop, a player buys, coins move, and the DM copy reconciles', async ({
  browser,
}) => {
  test.setTimeout(300_000);

  const dmContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const player1Context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const player2Context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });

  // dmMapPage stays connected to the battle map's live relay room for the
  // whole test; dmAdminPage drives the NPC dashboard (pricing/publishing,
  // then reading back the reconciled purse/stock) — a route the DM VTT
  // screen doesn't render, so this can't be the same page.
  const dmMapPage = await dmContext.newPage();
  const dmAdminPage = await dmContext.newPage();
  const player1Page = await player1Context.newPage();
  const player2Page = await player2Context.newPage();

  try {
    // Prewarm every route this test hits, sequentially, before the timed
    // interactive flow — see marker-loot-locked-claim.spec.ts's identical
    // loop for why: under `--webpack` (the only dev server this worktree's
    // symlinked node_modules can start — see playwright.shop.config.ts),
    // each route compiles on first request, and concurrent first-hits from
    // multiple contexts have been observed to trip the dev server's HMR
    // client into a full-page reload mid-navigation.
    for (const path of [
      '/player',
      '/dm',
      '/dm/campaign/warm',
      '/dm/campaign/warm/battlemaps/warm',
      '/player/characters/new',
    ]) {
      await dmMapPage.goto(path, { waitUntil: 'networkidle' }).catch(() => {});
    }
    for (const p of [player1Page, player2Page]) {
      for (const path of [
        '/player',
        '/player/characters/new',
        '/player/campaign/warm/battlemap/warm',
      ]) {
        await p.goto(path, { waitUntil: 'networkidle' }).catch(() => {});
      }
    }

    // ---- DM: create the real campaign + seed the shop scenario ----
    await seedDm(dmMapPage);
    const code = await createCampaign(dmMapPage, CAMPAIGN_NAME);
    await seedShopScenario(dmMapPage, code);

    // ---- DM: connect to the battle map (pushes the seeded token onto the
    //          live relay room) and leave this tab parked here ----
    await dmMapPage.goto(mapUrl(code), { waitUntil: 'networkidle' });
    await dmMapPage.waitForFunction(
      () => !!window.__rkStores?.viewport,
      undefined,
      { timeout: 15_000 }
    );
    await expect(dmMapPage.getByText('Live', { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await waitForElementSynced(dmMapPage, TOKEN_ID);

    // ---- DM (admin tab): price the item, list it for sale, open the shop —
    //      the real UI action this task exists to prove ----
    await dmAdminPage.goto(dashboardUrl(code), { waitUntil: 'networkidle' });
    await dmAdminPage.getByRole('heading', { name: MERCHANT_NAME }).click();
    const dmDialog1 = merchantDialog(dmAdminPage);
    await expect(dmDialog1).toBeVisible({ timeout: 10_000 });
    await dmDialog1.getByRole('button', { name: 'Shop' }).click();

    const priceGpField = dmDialog1.getByRole('textbox', {
      name: `${ITEM_NAME} price (gp)`,
    });
    await expect(priceGpField).toBeVisible({ timeout: 10_000 });
    await priceGpField.fill(String(PRICE_GP));

    const forSaleSwitch = dmDialog1.getByRole('switch', {
      name: `List ${ITEM_NAME} for sale`,
    });
    // Disabled until a price resolves (ShopStockRow's priceRequired gate) —
    // filling the price field above must have already unblocked it.
    await expect(forSaleSwitch).toBeEnabled({ timeout: 5_000 });
    await forSaleSwitch.click();

    await dmDialog1.getByRole('switch', { name: 'Open for business' }).click();

    // Publish confirmed the way a player would confirm it: the real,
    // player-readable shop index actually lists this NPC.
    await expect
      .poll(
        async () =>
          (await fetchShopsIndex(dmAdminPage, code)).map(s => s.npcId),
        {
          timeout: 10_000,
        }
      )
      .toContain(NPC_ID);

    await dmAdminPage.keyboard.press('Escape');
    await expect(dmDialog1).toBeHidden({ timeout: 5_000 });

    // ---- Player 1: real character, real join, starting purse, opens the
    //      map, taps the merchant token ----
    const char1Url = await createCharacter(player1Page, 'Shop Buyer');
    const char1Id = characterIdFromUrl(char1Url);
    await joinCampaign(player1Page, code, char1Id);
    await setStartingGold(player1Page, char1Id, BUYER_STARTING_GOLD);

    await player1Page.goto(
      `/player/campaign/${code}/battlemap/${MAP_ID}?character=${char1Id}`,
      { waitUntil: 'networkidle' }
    );
    await waitForStoresReady(player1Page);
    await waitForCharacterLoaded(player1Page, char1Id);
    await player1Page.waitForFunction(
      () => !!window.__rkStores?.viewport,
      undefined,
      { timeout: 15_000 }
    );
    await expect(player1Page.getByText('Live', { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await waitForElementSynced(player1Page, TOKEN_ID);

    await tapElement(player1Page, TOKEN_ID);
    const shopDialog1 = merchantDialog(player1Page);
    await expect(shopDialog1).toBeVisible({ timeout: 10_000 });
    await expect(shopDialog1.getByText(ITEM_NAME, { exact: true })).toBeVisible(
      {
        timeout: 10_000,
      }
    );

    // The public projection carries exactly what the DM priced/published —
    // and, per `PublicShopItem.item: never`, no DM-only fields (the full
    // `InventoryItem`/`MagicItem` definition never rides along).
    const shopViaApi = await player1Page.evaluate(
      async ({ code, npcId }) => {
        const res = await fetch(`/api/campaign/${code}/shops/${npcId}`);
        return (await res.json()) as {
          shop: {
            merchantName: string;
            items: Array<Record<string, unknown>>;
          } | null;
        };
      },
      { code, npcId: NPC_ID }
    );
    expect(shopViaApi.shop?.merchantName).toBe(MERCHANT_NAME);
    expect(shopViaApi.shop?.items).toHaveLength(1);
    const publicItem = shopViaApi.shop!.items[0];
    expect(publicItem.name).toBe(ITEM_NAME);
    expect(publicItem.priceCopper).toBe(PRICE_COPPER);
    expect(publicItem.remainingQuantity).toBe(STOCK);
    expect(publicItem.item).toBeUndefined();

    // Buy the only unit — default stepper quantity is already 1 (clamped
    // to remainingQuantity).
    const buyButton = shopDialog1.getByRole('button', {
      name: `Buy · ${PRICE_GP} gp`,
    });
    await expect(buyButton).toBeEnabled({ timeout: 5_000 });
    await buyButton.click();
    await expect(
      shopDialog1.getByText('Bought.', { exact: false })
    ).toBeVisible({
      timeout: 15_000,
    });
    // Last unit gone — the dialog's own optimistic patch already reflects
    // the server's returned remainingQuantity (0).
    await expect(
      shopDialog1.getByRole('button', { name: 'Sold out' })
    ).toBeVisible({ timeout: 10_000 });

    await player1Page.keyboard.press('Escape');
    await expect(shopDialog1).toBeHidden({ timeout: 5_000 });

    // ---- Player 1: the transfer merges into inventory + currency on the
    //      character sheet (the only route wired to
    //      useItemTransferAutoMerge) — a fresh navigation triggers this
    //      hook's mount-time fetch immediately, no polling wait needed ----
    await player1Page.goto(`/player/characters/${char1Id}`, {
      waitUntil: 'networkidle',
    });
    await waitForCharacterLoaded(player1Page, char1Id);

    await player1Page.getByRole('tab', { name: 'Inventory' }).click();
    await player1Page
      .getByRole('button', { name: 'Items', exact: true })
      .click();

    const itemCard = player1Page
      .getByRole('heading', { name: ITEM_NAME, level: 5 })
      .locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]');
    await expect(itemCard).toBeVisible({ timeout: 15_000 });
    const quantityValue = itemCard
      .getByText('Quantity:', { exact: true })
      .locator('xpath=following-sibling::*[1]');
    // Exact match (Slice 3 final review, Minor finding): `toContainText`
    // does a substring match and would also pass on "11", contradicting the
    // exact-integer discipline the currency assertion right below already
    // follows. `toHaveText` checks the element's whole (whitespace-
    // normalized) text content instead.
    await expect(quantityValue).toHaveText('1');

    // Exact-integer currency assertion (never a formatted "70 gp" string
    // that could pass on a wrong denomination split): the purse's total
    // copper value must have dropped by precisely the price.
    await expect
      .poll(
        async () =>
          player1Page.evaluate(
            () => window.__rkStores!.character.getState().character.currency
          ),
        { timeout: 15_000 }
      )
      .not.toBeNull();
    const postPurchaseCurrency = (await player1Page.evaluate(
      () => window.__rkStores!.character.getState().character.currency
    )) as Currency;
    expect(purseToCopper(postPurchaseCurrency)).toBe(
      BUYER_STARTING_COPPER - PRICE_COPPER
    );

    // ---- DM (admin tab): reconciliation. A fresh navigation remounts
    //      ShopSalesSyncProvider (mounted in the campaign route-group
    //      layout), which drains this NPC's un-applied sales immediately on
    //      mount — no fixed wait for the 10s poll interval needed. ----
    await dmAdminPage.goto(dashboardUrl(code), { waitUntil: 'networkidle' });
    await dmAdminPage.getByRole('heading', { name: MERCHANT_NAME }).click();
    const dmDialog2 = merchantDialog(dmAdminPage);
    await expect(dmDialog2).toBeVisible({ timeout: 10_000 });
    await dmDialog2.getByRole('button', { name: 'Shop' }).click();

    // Stock decremented by the reconciled sale (1 -> 0) — Playwright's
    // `toHaveValue` retries until the drain's store update lands.
    const stockField = dmDialog2.getByRole('textbox', {
      name: `${ITEM_NAME} stock quantity`,
    });
    await expect(stockField).toHaveValue('0', { timeout: 15_000 });

    // Purse credited by exactly the sale price, read from the real
    // currency-strip inputs (integers, never a formatted string) and
    // summed the same way `purseToCopper` does.
    await expect
      .poll(
        async () => {
          const [pp, gp, ep, sp, cp] = await Promise.all(
            (['PP', 'GP', 'EP', 'SP', 'CP'] as const).map(label =>
              dmDialog2
                .getByRole('textbox', { name: `${label} balance` })
                .inputValue()
            )
          );
          return (
            Number(pp) * CURRENCY_VALUES.platinum +
            Number(gp) * CURRENCY_VALUES.gold +
            Number(ep) * CURRENCY_VALUES.electrum +
            Number(sp) * CURRENCY_VALUES.silver +
            Number(cp) * CURRENCY_VALUES.copper
          );
        },
        { timeout: 15_000 }
      )
      .toBe(PRICE_COPPER);

    await dmAdminPage.keyboard.press('Escape');
    await expect(dmDialog2).toBeHidden({ timeout: 5_000 });

    // ---- Player 2: a second real character joins, taps the same token,
    //      and hits the sold-out / insufficient-stock path both in the UI
    //      and (the headline server-side guarantee) directly against the
    //      purchases route ----
    const char2Url = await createCharacter(player2Page, 'Second Buyer');
    const char2Id = characterIdFromUrl(char2Url);
    await joinCampaign(player2Page, code, char2Id);

    await player2Page.goto(
      `/player/campaign/${code}/battlemap/${MAP_ID}?character=${char2Id}`,
      { waitUntil: 'networkidle' }
    );
    await waitForStoresReady(player2Page);
    await waitForCharacterLoaded(player2Page, char2Id);
    await player2Page.waitForFunction(
      () => !!window.__rkStores?.viewport,
      undefined,
      { timeout: 15_000 }
    );
    await expect(player2Page.getByText('Live', { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await waitForElementSynced(player2Page, TOKEN_ID);

    await tapElement(player2Page, TOKEN_ID);
    const shopDialog2 = merchantDialog(player2Page);
    await expect(shopDialog2).toBeVisible({ timeout: 10_000 });
    await expect(shopDialog2.getByText('Sold out').first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      shopDialog2.getByRole('button', { name: 'Sold out' })
    ).toBeDisabled();

    const secondAttempt = await player2Page.evaluate(
      async ({ code, npcId, playerId, entryId }) => {
        const res = await fetch(
          `/api/campaign/${code}/shops/${npcId}/purchases`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-rollkeeper-csrf': '1',
            },
            body: JSON.stringify({
              playerId,
              entryId,
              quantity: 1,
              requestId: crypto.randomUUID(),
            }),
          }
        );
        const body = await res.json().catch(() => null);
        return { status: res.status, body };
      },
      { code, npcId: NPC_ID, playerId: char2Id, entryId: ITEM_ID }
    );
    expect(secondAttempt.status).toBe(409);
    expect(secondAttempt.body).toEqual({ error: 'insufficient-stock' });
  } finally {
    await dmContext.close();
    await player1Context.close();
    await player2Context.close();
  }
});
