import { expect, test } from '@playwright/test';

import type { Page } from '@playwright/test';

import {
  createCharacter,
  characterIdFromUrl,
  waitForStoresReady,
  waitForCharacterLoaded,
} from './helpers';

/**
 * End-to-end coverage for the whole locked-then-claim loot flow (slice
 * "vtt-loot-completion", Task 9): a DM authors a loot container, locks it,
 * publishes; a real player client — connected through the live battle-map
 * relay, not a same-tab preview — sees the locked card with the contents
 * fully withheld; the DM unlocks; the player's stepper defaults to every
 * remaining unit, takes a partial claim, and the granted item lands on the
 * character sheet's inventory.
 *
 * Harness: follows `e2e/map-portals.spec.ts` for marker interaction
 * (`doubleClickMarker`-style live-camera coordinate lookup via
 * `window.__rkStores.viewport`, the `markerDialog` locator) and
 * `e2e/fog-of-war.spec.ts` for seeding a DM battle map directly into
 * localStorage (`rollkeeper-dm-data` / `rollkeeper-battlemap-data` /
 * `rollkeeper-battlemap-mode:<id>`) rather than clicking through map
 * creation UI that has nothing to do with loot. `e2e/helpers.ts`'s
 * `createCharacter` builds the player's real character through the real
 * `/player/characters/new` flow.
 *
 * Unlike those two specs, this flow is genuinely cross-party: the marker
 * PIN (its canvas element, carrying position) only ever reaches a second
 * client through the live Fieldnotes relay — `PlayerBattleMapCanvas` never
 * falls back to a REST snapshot for canvas elements (see
 * `src/lib/battlemapSync.ts` / `NEXT_PUBLIC_BATTLEMAP_RELAY_URL` gate). So,
 * unlike every other spec in this directory, this one requires the relay
 * dev server (`relay/`) running alongside `docker-compose up -d`. See
 * task-9-report.md for exact commands and why campaign/player membership is
 * seeded via real fetches to the app's own API routes (still real Redis,
 * still the real security boundary) rather than the Create/Join Campaign
 * dialogs, which are orthogonal to loot.
 */

const DM_ID = 'dm-loot-e2e';
const MAP_ID = 'loot-map-1';
const CAMPAIGN_NAME = 'Loot E2E Campaign';
const ITEM_NAME = 'Potion of Healing';

/** The marker detail dialog — scoped to exclude the Next.js error overlay.
 *  Same locator as `e2e/map-portals.spec.ts`; works for both the DM edit
 *  form and the player read-only view (`DialogDescription` text is the
 *  same in both modes). */
function markerDialog(page: Page) {
  return page.getByRole('dialog').filter({ hasText: 'Map marker details' });
}

/** Seeds a fixed dmId into a fresh origin, before any page reads the store. */
async function seedDm(page: Page): Promise<void> {
  await page.goto('/player', { waitUntil: 'domcontentloaded' });
  await page.evaluate(dmId => {
    window.localStorage.setItem(
      'rollkeeper-dm-data',
      JSON.stringify({ state: { dmId, campaigns: [] }, version: 1 })
    );
  }, DM_ID);
}

/** Real POST to the app's own campaign-creation route — real Redis record,
 *  real generated code. Bypasses `CreateCampaignDialog` because clicking
 *  through campaign creation exercises nothing this task is testing. */
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

/** Seeds a blank battle map for the now-real campaign code directly into
 *  localStorage — same technique `fog-of-war.spec.ts` and
 *  `map-portals.spec.ts` use, minus the map image (a marker test needs no
 *  background) and minus a pre-seeded marker (this spec authors one live
 *  through the UI, which is the point of the test). */
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
                  name: 'Loot E2E Map',
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

/** Real POST to the app's own join route (real Redis membership record),
 *  then mirrors `handleJoinCampaign` (`src/app/player/page.tsx`) by writing
 *  `campaignCode` onto the roster entry through the live store — the exact
 *  side effect `JoinCampaignDialog`'s `onJoin` callback performs. */
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

/** Live-camera coordinate lookup for a canvas element — copied from
 *  `map-portals.spec.ts`'s `doubleClickMarker`, generalized to single or
 *  double click and shared by both the DM and player pages. */
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

async function clickMarker(
  page: Page,
  elementId: string,
  options: { double?: boolean } = {}
): Promise<void> {
  const coords = await coordsForElement(page, elementId);
  if (options.double) {
    await page.mouse.dblclick(coords.x, coords.y);
  } else {
    await page.mouse.click(coords.x, coords.y);
  }
}

/** Waits for the loot-kind marker element to exist in this page's own
 *  viewport store (placed locally on the DM, or replicated over the relay
 *  on the player) and returns its element id. */
/** Polls the real published-marker projection (the same endpoint
 *  `PlayerBattleMapCanvas.refreshMarkers` calls) until it satisfies
 *  `predicate` — deterministic replacement for a fixed sleep across the
 *  DM's 200ms debounced publish and the player's next activation-triggered
 *  refetch, both of which are real network round trips. */
async function waitForMarkerProjection(
  page: Page,
  code: string,
  mapId: string,
  predicate: (markers: Array<Record<string, unknown>>) => boolean
): Promise<void> {
  await expect
    .poll(
      async () => {
        const markers = await page.evaluate(
          async ({ code, mapId }) => {
            const res = await fetch(
              `/api/campaign/${code}/battlemaps/${mapId}/markers`
            );
            if (!res.ok) return [];
            const data = (await res.json()) as {
              markers?: Array<Record<string, unknown>>;
            };
            return data.markers ?? [];
          },
          { code, mapId }
        );
        return predicate(markers);
      },
      { timeout: 10_000 }
    )
    .toBe(true);
}

async function waitForLootMarkerElementId(page: Page): Promise<string> {
  const handle = await page.waitForFunction(
    () => {
      const vp = window.__rkStores?.viewport;
      if (!vp) return null;
      const el = vp.store
        .getAll()
        .find(
          candidate =>
            (candidate.data as { kind?: string } | undefined)?.kind === 'loot'
        );
      return el ? el.id : null;
    },
    undefined,
    { timeout: 20_000 }
  );
  const id = await handle.jsonValue();
  if (typeof id !== 'string') throw new Error('Loot marker element not found');
  return id;
}

test('DM locks a loot container, publishes, and the player claims a partial grant', async ({
  browser,
}) => {
  test.setTimeout(240_000);

  const dmContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const playerContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const dmPage = await dmContext.newPage();
  const playerPage = await playerContext.newPage();

  try {
    // Under `--webpack` (see playwright.loot.config.ts for why this spec
    // cannot use the default Turbopack dev server), each route compiles on
    // first request. Two contexts requesting different uncompiled routes at
    // once has been observed to trip the dev server's HMR client into a
    // full-page reload mid-navigation (surfaced as "Uncaught Error:
    // Internal Next.js error: Router action dispatched before
    // initialization" and a character-creation form that silently keeps its
    // empty initial value). Compiling every route once, sequentially,
    // before the timed interactive flow avoids that storm.
    for (const path of [
      '/player',
      '/dm',
      '/player/characters/new',
      '/dm/campaign/warm/battlemaps/warm',
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
    console.log('[test] routes prewarmed');

    // ---- DM: create the real campaign + a blank battle map ----
    await seedDm(dmPage);
    console.log('[test] dm seeded');
    const code = await createCampaign(dmPage, CAMPAIGN_NAME);
    console.log('[test] campaign created', code);
    await seedBattleMap(dmPage, code);
    console.log('[test] battle map seeded');

    await dmPage.goto(`/dm/campaign/${code}/battlemaps/${MAP_ID}`, {
      waitUntil: 'networkidle',
    });
    console.log('[test] dm navigated to battlemap');
    await expect(dmPage.getByRole('button', { name: 'Marker' })).toBeVisible({
      timeout: 15_000,
    });
    console.log('[test] dm toolbar visible');
    await dmPage.waitForFunction(
      () => !!window.__rkStores?.viewport,
      undefined,
      {
        timeout: 15_000,
      }
    );
    console.log('[test] dm viewport ready');
    await expect(dmPage.getByText('Live', { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    console.log('[test] dm relay live');

    // ---- Player: real character, real campaign join, open the map ----
    const characterUrl = await createCharacter(playerPage, 'Loot Hero');
    console.log('[test] player character created', characterUrl);
    const characterId = characterIdFromUrl(characterUrl);
    await joinCampaign(playerPage, code, characterId);
    console.log('[test] player joined campaign');

    await playerPage.goto(
      `/player/campaign/${code}/battlemap/${MAP_ID}?character=${characterId}`,
      { waitUntil: 'networkidle' }
    );
    console.log('[test] player navigated to battlemap');
    await waitForStoresReady(playerPage);
    await waitForCharacterLoaded(playerPage, characterId);
    console.log('[test] player stores ready');
    await playerPage.waitForFunction(
      () => !!window.__rkStores?.viewport,
      undefined,
      { timeout: 15_000 }
    );
    console.log('[test] player viewport ready');
    await expect(playerPage.getByText('Live', { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    console.log('[test] player relay live');

    // ---- DM: place a loot marker ----
    await dmPage.getByRole('button', { name: 'Marker' }).click();
    await dmPage.getByRole('button', { name: 'Marker kind: loot' }).click();
    const canvas = dmPage.locator('canvas').first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('DM canvas has no bounding box');
    await dmPage.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    const dmElementId = await waitForLootMarkerElementId(dmPage);
    console.log('[test] dm marker placed', dmElementId);

    // ---- DM: open it, add a quantity-3 entry, lock it ----
    await clickMarker(dmPage, dmElementId, { double: true });
    const dmDialog = markerDialog(dmPage);
    await expect(dmDialog).toBeVisible({ timeout: 10_000 });
    console.log('[test] dm dialog open');

    // The compendium's only "Potion of Healing" is the MAGIC-item entry
    // (delivered as N discrete instances, one claim unit each — see
    // `markerLootClaims.ts`'s magic-item transfer fan-out), not a stackable
    // `inventory` item. This flow needs a stackable entry (a quantity, a
    // single "quantity 2" line in the Items tab afterward), so it uses the
    // "Manual treasure" freeform path instead, which always creates an
    // `inventory`-kind entry. `Input`'s `label` prop renders with no
    // `htmlFor`/`id` pair (a pre-existing gap, not this spec's to fix), so
    // `getByLabel` cannot resolve either field — placeholder text anchors
    // both.
    const manualTreasureInput = dmDialog.getByPlaceholder(
      '250 gp, ruby, sealed letter…'
    );
    await expect(manualTreasureInput).toBeVisible({ timeout: 15_000 });
    await manualTreasureInput.fill(ITEM_NAME);
    await dmDialog.getByRole('button', { name: 'Add' }).click();

    const increaseQuantity = dmDialog.getByRole('button', {
      name: `Increase ${ITEM_NAME} quantity`,
    });
    await increaseQuantity.click();
    await increaseQuantity.click();
    await expect(dmDialog.getByText('3 of 3 available')).toBeVisible();

    await dmDialog.getByRole('button', { name: 'Locked' }).click();
    await expect(
      dmDialog.getByText(
        'Players see a locked chest and nothing inside. Claims are refused on the server too.'
      )
    ).toBeVisible();
    console.log('[test] dm entry added + locked');

    await dmPage.keyboard.press('Escape');
    await expect(dmDialog).toBeHidden({ timeout: 5_000 });

    // ---- DM: share the marker with players ----
    await clickMarker(dmPage, dmElementId);
    const shareToggle = dmPage.getByTestId('dm-vtt-dm-only-toggle');
    await expect(shareToggle).toBeVisible({ timeout: 5_000 });
    await shareToggle.click();
    console.log('[test] dm shared marker');

    // ---- Player: sees the pin arrive over the relay, opens it, LOCKED ----
    const playerElementId = await waitForLootMarkerElementId(playerPage);
    console.log('[test] player sees marker element', playerElementId);
    // The pin (relay) and the product-state projection (DM's debounced PUT,
    // over Redis) are two independent channels — wait for the projection
    // too, or the panel briefly renders "Not published yet".
    await waitForMarkerProjection(
      playerPage,
      code,
      MAP_ID,
      markers => markers.length > 0
    );
    console.log('[test] player projection published');
    await clickMarker(playerPage, playerElementId);
    const playerDialog = markerDialog(playerPage);
    await expect(playerDialog).toBeVisible({ timeout: 10_000 });
    await expect(playerDialog.getByText('Locked')).toBeVisible();
    await expect(
      playerDialog.getByText("You'd need to get it open first.")
    ).toBeVisible();

    // The container leaks no item identity anywhere in the DOM while locked.
    await expect(playerPage.locator('body')).not.toContainText(ITEM_NAME);

    await playerPage.keyboard.press('Escape');
    await expect(playerDialog).toBeHidden({ timeout: 5_000 });

    // ---- DM: unlock and republish ----
    await clickMarker(dmPage, dmElementId, { double: true });
    await expect(dmDialog).toBeVisible({ timeout: 10_000 });
    await dmDialog.getByRole('button', { name: 'Open' }).click();
    await expect(
      dmDialog.getByText(
        "Players can see the contents and claim up to what's left."
      )
    ).toBeVisible();
    await dmPage.keyboard.press('Escape');
    await expect(dmDialog).toBeHidden({ timeout: 5_000 });

    await waitForMarkerProjection(
      playerPage,
      code,
      MAP_ID,
      markers => markers[0]?.lootLocked !== true
    );

    // ---- Player: reopens — stepper defaults to every remaining unit ----
    await clickMarker(playerPage, playerElementId);
    await expect(playerDialog).toBeVisible({ timeout: 10_000 });
    await expect(playerDialog.getByText(ITEM_NAME)).toBeVisible({
      timeout: 10_000,
    });
    await expect(playerDialog.getByText('3 available')).toBeVisible();
    const claimButton = playerDialog.getByRole('button', {
      name: /^Claim \d+$/,
    });
    await expect(claimButton).toHaveText('Claim 3');

    // Step down once, then claim a partial (2 of 3).
    await playerDialog
      .getByRole('button', { name: `Take fewer ${ITEM_NAME}` })
      .click();
    await expect(claimButton).toHaveText('Claim 2');
    await claimButton.click();

    await expect(playerDialog.getByRole('status')).toContainText('Claimed.', {
      timeout: 15_000,
    });
    await expect(playerDialog.getByText('1 available')).toBeVisible({
      timeout: 10_000,
    });

    // ---- Player: the claimed item lands on the character sheet ----
    await playerPage.goto(`/player/characters/${characterId}`, {
      waitUntil: 'networkidle',
    });
    await waitForCharacterLoaded(playerPage, characterId);

    await playerPage.getByRole('tab', { name: 'Inventory' }).click();
    // The Inventory sub-tabs (Weapons/Magic Items/Armor/Items/Currency,
    // `tabbedSheetConfig.tsx`'s `InventoryTabContent`) are plain `<button>`s,
    // not `role="tab"`.
    await playerPage
      .getByRole('button', { name: 'Items', exact: true })
      .click();

    const itemCard = playerPage
      .getByRole('heading', { name: ITEM_NAME, level: 5 })
      .locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]');
    await expect(itemCard).toBeVisible({ timeout: 15_000 });
    const quantityValue = itemCard
      .getByText('Quantity:', { exact: true })
      .locator('xpath=following-sibling::*[1]');
    await expect(quantityValue).toContainText('2');
  } finally {
    await dmContext.close();
    await playerContext.close();
  }
});
