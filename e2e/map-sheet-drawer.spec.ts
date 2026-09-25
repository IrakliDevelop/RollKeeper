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
 * sheet drawer PR1, Task 11; PR2 Task 7 added the Effects-tab persistence
 * scenario): a real player on the live-relay battle map places their own
 * token, double-clicks it to open the non-modal character-sheet drawer
 * (without dragging the token), applies damage from the drawer that
 * survives a reload, closes it with Escape (restoring the dock), a single
 * click on the token does NOT open it, and toggling a condition in the
 * Effects tab survives a reload too.
 *
 * Harness: `e2e/shop-purchase-reconciliation.spec.ts`'s relay pattern
 * (`config/playwright/sheet-drawer.config.ts` mirrors `shop.config.ts`'s
 * webServer wiring). The DM tab stays parked on the battle map for the whole
 * run so the live relay room — which is how the player's own placed token
 * comes back after a reload — is never torn down.
 *
 * The six scenarios share one DM/player setup and run serially, in order:
 * each builds on the state the previous one left behind (drawer open →
 * damaged + reopened → closed → token single-clicked, reopening the drawer
 * → Prone toggled and reloaded → an inventory item increased and pinned,
 * surfacing under Overview favorites after a reload).
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

  test('toggling a condition in the Effects tab persists across a reload', async () => {
    // Left open by the previous test's control double click.
    const dialog = sheetDialog(playerPage);
    await expect(dialog).toBeVisible();

    await dialog.getByRole('tab', { name: /effects/i }).click();
    const prone = dialog.getByRole('button', { name: 'Prone' });
    await prone.click();
    await expect(prone).toHaveAttribute('aria-pressed', 'true');

    // A real character mutation: it must be on disk (the canonical
    // per-character envelope) before the reload.
    await playerPage.waitForFunction(
      id => {
        const raw = window.localStorage.getItem(`rollkeeper-character:${id}`);
        if (!raw) return false;
        const parsed = JSON.parse(raw) as {
          state?: {
            character?: {
              conditionsAndDiseases?: {
                activeConditions?: { name: string }[];
              };
            };
          };
        };
        return !!parsed.state?.character?.conditionsAndDiseases?.activeConditions?.some(
          c => c.name === 'Prone'
        );
      },
      characterId,
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
    await reopened.getByRole('tab', { name: /effects/i }).click();
    const reopenedProne = reopened.getByRole('button', { name: 'Prone' });
    await expect(reopenedProne).toHaveAttribute('aria-pressed', 'true');

    // Leave no residual state behind.
    await reopenedProne.click();
    await expect(reopenedProne).toHaveAttribute('aria-pressed', 'false');
  });

  test('pinning an inventory item surfaces it under Overview favorites', async () => {
    const INVENTORY_ITEM_NAME = 'Trail Rations';

    // Left open on the Effects tab by the previous test.
    const dialog = sheetDialog(playerPage);
    await expect(dialog).toBeVisible();

    // There's no UI path to add inventory items from the sheet drawer, so
    // seed one plain (non-consumable) item through the store handle, same
    // as other specs seed setup-only state.
    await playerPage.evaluate(name => {
      window.__rkStores!.character.getState().addInventoryItem({
        name,
        category: 'gear',
        quantity: 1,
        tags: [],
      });
    }, INVENTORY_ITEM_NAME);

    await dialog.getByRole('tab', { name: /inventory/i }).click();
    await dialog
      .getByRole('button', { name: `Increase ${INVENTORY_ITEM_NAME}` })
      .click();
    await dialog
      .getByRole('button', { name: `Pin ${INVENTORY_ITEM_NAME}` })
      .click();
    await expect(
      dialog.getByRole('button', { name: `Unpin ${INVENTORY_ITEM_NAME}` })
    ).toBeVisible();

    // A real character mutation: it must be on disk (the canonical
    // per-character envelope) before the reload.
    await playerPage.waitForFunction(
      ({ id, name }) => {
        const raw = window.localStorage.getItem(`rollkeeper-character:${id}`);
        if (!raw) return false;
        const parsed = JSON.parse(raw) as {
          state?: {
            character?: {
              inventoryItems?: { name: string; quantity: number }[];
              sheetFavorites?: { kind: string; id: string }[];
            };
          };
        };
        const item = parsed.state?.character?.inventoryItems?.find(
          i => i.name === name
        );
        const pinned = parsed.state?.character?.sheetFavorites?.some(
          f => f.kind === 'item'
        );
        return item?.quantity === 2 && !!pinned;
      },
      { id: characterId, name: INVENTORY_ITEM_NAME },
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

    // The stored tab preference is 'inventory' from the click above —
    // explicitly return to Overview, where pinned items surface.
    await reopened.getByRole('tab', { name: /overview/i }).click();
    await expect(
      reopened.getByText(INVENTORY_ITEM_NAME, { exact: true })
    ).toBeVisible();

    // Leave no residual state behind.
    const unpin = reopened.getByRole('button', {
      name: `Unpin ${INVENTORY_ITEM_NAME}`,
    });
    await unpin.click();
    await expect(
      reopened.getByText(INVENTORY_ITEM_NAME, { exact: true })
    ).toBeHidden();
  });
});

/**
 * PR4 — party limited view: player A double-clicks player B's token and gets
 * a read-only "limited view" of B (never B's full sheet), which honours B's
 * `shareHpWithParty` / `sharePartyView` opt-outs once B's next campaign sync
 * reaches the party-hp route; a DM combatant token never opens a sheet.
 *
 * Own DM + two-player setup (same relay harness as the describe above, and
 * `shop-purchase-reconciliation.spec.ts`'s multi-player pattern). B's roster
 * entry gets `syncEnabled`/`autoSync` — what the real join UI
 * (`/player` `handleJoinCampaign`) sets and the `joinCampaign` helper skips —
 * so B's store edits are pushed to the campaign by the normal auto-save →
 * sync path rather than a hand-rolled POST.
 */
const PARTY_CAMPAIGN_NAME = 'Party View E2E Campaign';
const PARTY_DM_ID = 'dm-party-view-e2e';
const PARTY_A_NAME = 'Party Viewer';
const PARTY_B_NAME = 'Party Shared';
const COMBATANT_TOKEN_ID = 'token-party-view-combatant';
const COMBATANT_ENTITY_ID = 'entity-party-view-combatant';
const COMBATANT_ENCOUNTER_ID = 'enc-party-view-e2e';

/** Adds a DM combatant token (`tokenKind: 'combatant'`) plus its encounter
 *  entity on top of `seedBattleMap`'s blank map — the raw shape
 *  `token-decoration-overlay.spec.ts` proves the DM VTT hydrates. */
async function seedCombatantToken(page: Page, code: string): Promise<void> {
  const now = new Date().toISOString();
  await page.evaluate(
    ({ code, mapId, tokenId, entityId, encounterId, now }) => {
      const raw = window.localStorage.getItem('rollkeeper-battlemap-data');
      if (!raw) throw new Error('battle map not seeded');
      const parsed = JSON.parse(raw);
      const map = parsed.state.battleMaps[code][mapId];
      const canvas = JSON.parse(map.canvasState);
      canvas.elements.push({
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
        fillColor: '#c0392b',
        tokenKind: 'combatant',
        entityId,
      });
      map.canvasState = JSON.stringify(canvas);
      map.linkedEncounterIds = [encounterId];
      window.localStorage.setItem(
        'rollkeeper-battlemap-data',
        JSON.stringify(parsed)
      );
      window.localStorage.setItem(
        'rollkeeper-encounter-data',
        JSON.stringify({
          state: {
            encounters: [
              {
                id: encounterId,
                name: 'Party View E2E Encounter',
                campaignCode: code,
                entities: [
                  {
                    id: entityId,
                    type: 'monster',
                    name: 'E2E Ogre',
                    initiative: null,
                    initiativeModifier: 0,
                    currentHp: 30,
                    maxHp: 30,
                    tempHp: 0,
                    armorClass: 11,
                    conditions: [],
                    color: '#c0392b',
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
    },
    {
      code,
      mapId: MAP_ID,
      tokenId: COMBATANT_TOKEN_ID,
      entityId: COMBATANT_ENTITY_ID,
      encounterId: COMBATANT_ENCOUNTER_ID,
      now,
    }
  );
}

interface PartyMemberSnapshot {
  characterId: string;
  hitPoints: { current: number; max: number } | null;
  publicSheet?: { hpState: string } | null;
}

/** The real party roster endpoint `usePartySync` polls. */
async function fetchPartyMember(
  page: Page,
  code: string,
  characterId: string
): Promise<PartyMemberSnapshot | null> {
  return page.evaluate(
    async ({ code, characterId }) => {
      const res = await fetch(`/api/campaign/${code}/party-hp`);
      if (!res.ok) return null;
      const data = (await res.json()) as { members?: PartyMemberSnapshot[] };
      return data.members?.find(m => m.characterId === characterId) ?? null;
    },
    { code, characterId }
  );
}

/** A screen point inside `targetId`'s ellipse but outside `avoidId`'s bounds
 *  — the combatant and B's token can overlap after the player camera fits
 *  the map, and B's token must not absorb the double click. */
async function coordsInsideElementAvoiding(
  page: Page,
  targetId: string,
  avoidId: string
): Promise<{ x: number; y: number }> {
  return page.evaluate(
    ({ targetId, avoidId }) => {
      const vp = window.__rkStores!.viewport!;
      const target = vp.store.getById(targetId);
      const avoid = vp.store.getById(avoidId);
      if (!target || !avoid) throw new Error('Element not in store');
      const wrapper = document.querySelector('canvas')?.parentElement;
      const rect = wrapper?.getBoundingClientRect();
      if (!rect) throw new Error('Canvas wrapper not found');
      const cx = target.position.x + target.size.w / 2;
      const cy = target.position.y + target.size.h / 2;
      // Candidates at 35% of the radius-span out from the centre (well
      // inside the ellipse), centre first.
      const offsets = [
        [0, 0],
        [0.35, 0],
        [-0.35, 0],
        [0, 0.35],
        [0, -0.35],
        [0.25, 0.25],
        [-0.25, 0.25],
        [0.25, -0.25],
        [-0.25, -0.25],
      ];
      for (const [dx, dy] of offsets) {
        const wx = cx + dx * target.size.w;
        const wy = cy + dy * target.size.h;
        const insideAvoid =
          wx >= avoid.position.x &&
          wx <= avoid.position.x + avoid.size.w &&
          wy >= avoid.position.y &&
          wy <= avoid.position.y + avoid.size.h;
        if (insideAvoid) continue;
        const x = rect.left + wx * vp.camera.z + vp.camera.x;
        const y = rect.top + wy * vp.camera.z + vp.camera.y;
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom)
          continue;
        // Not under the dock / toolbar / minimap overlays.
        if (!wrapper!.contains(document.elementFromPoint(x, y))) continue;
        return { x, y };
      }
      throw new Error(`No clear point on ${targetId} outside ${avoidId}`);
    },
    { targetId, avoidId }
  );
}

function limitedViewDialog(page: Page, name: string) {
  return page.getByRole('dialog', { name: `${name} limited view` });
}

test.describe('player map party limited view', () => {
  let dmContext: BrowserContext;
  let contextA: BrowserContext;
  let contextB: BrowserContext;
  let dmPage: Page;
  let pageA: Page;
  let pageB: Page;
  let code: string;
  let characterIdB: string;
  let tokenIdB: string;
  let hpB: { current: number; max: number };

  test.beforeAll(async ({ browser }) => {
    const viewport = { width: 1440, height: 1000 };
    dmContext = await browser.newContext({ viewport });
    contextA = await browser.newContext({ viewport });
    contextB = await browser.newContext({ viewport });
    dmPage = await dmContext.newPage();
    pageA = await contextA.newPage();
    pageB = await contextB.newPage();

    // Sequential prewarm — see the describe above.
    for (const path of [
      '/player',
      '/dm',
      '/dm/campaign/warm/battlemaps/warm',
      '/player/characters/new',
    ]) {
      await dmPage.goto(path, { waitUntil: 'networkidle' }).catch(() => {});
    }
    for (const p of [pageA, pageB]) {
      for (const path of [
        '/player',
        '/player/characters/new',
        '/player/campaign/warm/battlemap/warm',
      ]) {
        await p.goto(path, { waitUntil: 'networkidle' }).catch(() => {});
      }
    }

    // ---- DM: campaign + map with one combatant token, parked on the relay ----
    await seedDm(dmPage, PARTY_DM_ID);
    code = await createCampaign(dmPage, PARTY_DM_ID, PARTY_CAMPAIGN_NAME);
    await seedBattleMap(dmPage, code);
    await seedCombatantToken(dmPage, code);
    await dmPage.goto(mapUrl(code), { waitUntil: 'networkidle' });
    await dmPage.waitForFunction(
      () => !!window.__rkStores?.viewport,
      undefined,
      { timeout: 15_000 }
    );
    await expect(dmPage.getByText('Live', { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await waitForElementSynced(dmPage, COMBATANT_TOKEN_ID);

    // ---- Player A: character + join ----
    const characterIdA = characterIdFromUrl(
      await createCharacter(pageA, PARTY_A_NAME)
    );
    await joinCampaign(pageA, code, characterIdA, PARTY_CAMPAIGN_NAME);

    // ---- Player B: character + join, with campaign auto-sync on ----
    characterIdB = characterIdFromUrl(
      await createCharacter(pageB, PARTY_B_NAME)
    );
    await joinCampaign(pageB, code, characterIdB, PARTY_CAMPAIGN_NAME);
    await pageB.evaluate(id => {
      window
        .__rkStores!.player.getState()
        .updateCharacter(id, { syncEnabled: true, autoSync: true });
    }, characterIdB);
    hpB = await readHp(pageB);
    expect(hpB.max).toBeGreaterThan(0);

    // ---- Player B: open the map and place their token ----
    await openPlayerMap(pageB, code, characterIdB);
    await toolbarButton(pageB, /^Place (token|your token on the map)$/).click();
    const canvasB = pageB.locator('canvas').first();
    const boxB = await canvasB.boundingBox();
    if (!boxB) throw new Error('Player B canvas has no bounding box');
    await pageB.mouse.click(
      boxB.x + boxB.width * 0.45,
      boxB.y + boxB.height * 0.5
    );
    tokenIdB = await waitForOwnTokenId(pageB, characterIdB);
    await waitForElementSynced(dmPage, tokenIdB);

    // ---- Player A: open the map; B's token and the combatant arrive ----
    await openPlayerMap(pageA, code, characterIdA);
    await waitForElementSynced(pageA, tokenIdB);
    await waitForElementSynced(pageA, COMBATANT_TOKEN_ID);
  });

  test.afterAll(async () => {
    await dmContext?.close();
    await contextA?.close();
    await contextB?.close();
  });

  test("double-clicking another player's token opens their limited view", async () => {
    await toolbarButton(pageA, 'Pan').click();
    const coords = await coordsForElement(pageA, tokenIdB);
    await pageA.mouse.dblclick(coords.x, coords.y);

    const dialog = limitedViewDialog(pageA, PARTY_B_NAME);
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(
      dialog.getByRole('heading', { name: PARTY_B_NAME, exact: true })
    ).toBeVisible();
    await expect(dialog.getByText(/Limited view · played by /)).toBeVisible();
    // Full HP → the top band's word.
    await expect(dialog.getByText('Unharmed', { exact: true })).toBeVisible();
    // HP sharing defaults on, so the exact numbers ride along too.
    await expect(
      dialog.getByText(`${hpB.current}/${hpB.max}`, { exact: true })
    ).toBeVisible();
    // Never B's full, editable sheet.
    await expect(sheetDialog(pageA)).toHaveCount(0);
    await expect(
      dialog.getByRole('textbox', { name: 'HP amount' })
    ).toHaveCount(0);
  });

  test('turning off HP sharing hides the exact HP in the limited view', async () => {
    await pageB.evaluate(() => {
      window.__rkStores!.character.getState().toggleShareHpWithParty();
    });
    // B's auto-save → campaign sync lands on the party-hp route.
    await expect
      .poll(
        async () => {
          const member = await fetchPartyMember(pageA, code, characterIdB);
          return member ? member.hitPoints : 'missing';
        },
        { timeout: 20_000 }
      )
      .toBeNull();

    // A's open limited view refreshes (relay 'players' poke or the 20s
    // party poll) — the HP word stays, the numbers go.
    const dialog = limitedViewDialog(pageA, PARTY_B_NAME);
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(`${hpB.current}/${hpB.max}`, { exact: true })
    ).toHaveCount(0, { timeout: 30_000 });
    await expect(dialog.getByText('Unharmed', { exact: true })).toBeVisible();
  });

  test("turning off sheet sharing shows that B hasn't shared their sheet", async () => {
    await pageB.evaluate(() => {
      window.__rkStores!.character.getState().setSharePartyView(false);
    });
    await expect
      .poll(
        async () => {
          const member = await fetchPartyMember(pageA, code, characterIdB);
          return member ? member.publicSheet : 'missing';
        },
        { timeout: 20_000 }
      )
      .toBeNull();

    const dialog = limitedViewDialog(pageA, PARTY_B_NAME);
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(`${PARTY_B_NAME} hasn't shared their sheet.`)
    ).toBeVisible({ timeout: 30_000 });
    await expect(dialog.getByText('Unharmed', { exact: true })).toHaveCount(0);
  });

  test('double-clicking a DM combatant token opens no sheet', async () => {
    const open = limitedViewDialog(pageA, PARTY_B_NAME);
    await open.getByRole('button', { name: 'Close sheet' }).click();
    await expect(open).toBeHidden({ timeout: 5_000 });

    await toolbarButton(pageA, 'Pan').click();
    const coords = await coordsInsideElementAvoiding(
      pageA,
      COMBATANT_TOKEN_ID,
      tokenIdB
    );
    await pageA.mouse.dblclick(coords.x, coords.y);
    // Give a (wrongly) opening drawer time to animate in before asserting
    // absence — the same settle the single-click scenario above uses.
    await pageA.waitForTimeout(400);
    await expect(
      pageA.getByRole('dialog', { name: /limited view|character sheet/i })
    ).toHaveCount(0);

    // Control: the same gesture (Pan tool, double click on a synced token)
    // still opens B's limited view, so the absence above is not a dead
    // gesture path.
    const coordsB = await coordsForElement(pageA, tokenIdB);
    await pageA.mouse.dblclick(coordsB.x, coordsB.y);
    await expect(limitedViewDialog(pageA, PARTY_B_NAME)).toBeVisible({
      timeout: 10_000,
    });
  });
});
