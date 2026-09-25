import { expect, test } from '@playwright/test';

import type { BrowserContext, Page } from '@playwright/test';

import {
  seedDm,
  createCampaign,
  coordsForElement,
  waitForElementSynced,
} from './helpers/battlemapRelay';

/**
 * End-to-end coverage for the DM battle-map creature drawer (DM creature
 * drawer PR1, Task 8): the DM double-clicks a combatant token with the
 * select tool, the Tidy-style side drawer opens on that creature, damage
 * applied from the drawer updates both the drawer's HP text and the token's
 * in-canvas HP decoration, switching the drawer's lock to Editing exposes
 * the AC field and a new AC commits immediately, and closing the drawer then
 * single-clicking the same token re-selects it into the existing Studio
 * panel's "Selected" tab (`CombatantDetail`, unchanged by this PR) showing
 * the same, now-persisted AC — proving the drawer and the Studio panel share
 * one source of truth.
 *
 * Harness: `e2e/map-sheet-drawer.spec.ts`'s DM-side setup and
 * `config/playwright/sheet-drawer.config.ts`'s webServer wiring (relay +
 * dev server). This spec is DM-only (no player context, no relay
 * round-trip needed for the seeded token), but shares the config so the
 * nightly `sheet-drawer-e2e` job covers both in one run.
 */

const CAMPAIGN_NAME = 'Creature Drawer E2E Campaign';
const DM_ID = 'dm-creature-drawer-e2e';
const MAP_ID = 'creature-drawer-map-e2e';
const ENCOUNTER_ID = 'enc-creature-drawer-e2e';
const ENTITY_ID = 'entity-creature-drawer-e2e';
const TOKEN_ID = 'token-creature-drawer-e2e';
const ENTITY_NAME = 'Goblin';
const DAMAGE = 3;
// A goblin's real average HP (2d6) and AC (leather armor + shield).
const STARTING_HP = 7;
const STARTING_AC = 15;
const NEW_AC = 18;

const mapUrl = (code: string) => `/dm/campaign/${code}/battlemaps/${MAP_ID}`;

/** Blank battle map seeded straight into the DM's localStorage — same shape
 *  as `map-sheet-drawer.spec.ts`'s `seedBattleMap` (not exported there). */
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
                  name: 'Creature Drawer E2E Map',
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

/** Adds a combatant token (`tokenKind: 'combatant'`) on top of the blank map
 *  plus its linked encounter entity — a Goblin, standing in for the
 *  bestiary monster the real roster flow would place — same raw shape as
 *  `map-sheet-drawer.spec.ts`'s `seedCombatantToken`. */
async function seedGoblinToken(page: Page, code: string): Promise<void> {
  const now = new Date().toISOString();
  await page.evaluate(
    ({ code, mapId, tokenId, entityId, encounterId, now, name, hp, ac }) => {
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
        fillColor: '#2f6fd0',
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
                name: 'Creature Drawer E2E Encounter',
                campaignCode: code,
                entities: [
                  {
                    id: entityId,
                    type: 'monster',
                    name,
                    initiative: null,
                    initiativeModifier: 0,
                    currentHp: hp,
                    maxHp: hp,
                    tempHp: 0,
                    armorClass: ac,
                    conditions: [],
                    color: '#2f6fd0',
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
      tokenId: TOKEN_ID,
      entityId: ENTITY_ID,
      encounterId: ENCOUNTER_ID,
      now,
      name: ENTITY_NAME,
      hp: STARTING_HP,
      ac: STARTING_AC,
    }
  );
}

function creatureDialog(page: Page) {
  return page.getByRole('dialog', { name: `${ENTITY_NAME} sheet` });
}

function studioPanel(page: Page) {
  return page.getByTestId('dm-vtt-studio-panel');
}

test.describe.configure({ mode: 'serial', timeout: 300_000 });

test.describe('DM creature drawer', () => {
  let dmContext: BrowserContext;
  let dmPage: Page;
  let code: string;

  test.beforeAll(async ({ browser }) => {
    dmContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    dmPage = await dmContext.newPage();

    // Prewarm before the timed flow — see `map-sheet-drawer.spec.ts`'s
    // identical loop (cold compiles; a first hit mid-navigation can trip an
    // HMR full reload).
    for (const path of [
      '/player',
      '/dm',
      '/dm/campaign/warm/battlemaps/warm',
    ]) {
      await dmPage.goto(path, { waitUntil: 'networkidle' }).catch(() => {});
    }

    await seedDm(dmPage, DM_ID);
    code = await createCampaign(dmPage, DM_ID, CAMPAIGN_NAME);
    await seedBattleMap(dmPage, code);
    await seedGoblinToken(dmPage, code);
    await dmPage.goto(mapUrl(code), { waitUntil: 'networkidle' });
    await dmPage.waitForFunction(
      () => !!window.__rkStores?.viewport,
      undefined,
      { timeout: 15_000 }
    );
    await expect(dmPage.getByText('Live', { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await waitForElementSynced(dmPage, TOKEN_ID);
  });

  test.afterAll(async () => {
    await dmContext?.close();
  });

  test('double-clicking the goblin token with the select tool opens its sheet', async () => {
    await dmPage.getByRole('button', { name: 'Select', exact: true }).click();

    const coords = await coordsForElement(dmPage, TOKEN_ID);
    // Playwright's mouse.dblclick sends no pointermove — matches the
    // pattern already proven in map-sheet-drawer.spec.ts's token
    // activation (single-move double click, no hover in between).
    await dmPage.mouse.dblclick(coords.x, coords.y);

    await expect(creatureDialog(dmPage)).toBeVisible({ timeout: 10_000 });
  });

  test('damage applied from the drawer updates the HP text and the token decoration', async () => {
    const dialog = creatureDialog(dmPage);
    const decoration = dmPage
      .getByTestId(`token-decoration-${ENTITY_ID}`)
      .locator('[role="progressbar"]');

    await expect(
      dialog.getByText(`${STARTING_HP}/${STARTING_HP}`, { exact: true })
    ).toBeVisible();
    await expect(decoration).toHaveAttribute('aria-valuenow', '100');

    await dialog.getByRole('textbox', { name: 'Amount' }).fill(String(DAMAGE));
    await dialog.getByRole('button', { name: 'Damage' }).click();

    const expectedHp = STARTING_HP - DAMAGE;
    await expect(
      dialog.getByText(`${expectedHp}/${STARTING_HP}`, { exact: true })
    ).toBeVisible({ timeout: 5_000 });
    const expectedPercent = Math.round((expectedHp / STARTING_HP) * 100);
    await expect(decoration).toHaveAttribute(
      'aria-valuenow',
      String(expectedPercent)
    );
  });

  test('the lock switches to Editing and a new AC commits on the tile', async () => {
    const dialog = creatureDialog(dmPage);

    await dialog.getByRole('button', { name: 'Play', exact: true }).click();
    const lock = dialog.getByRole('button', { name: 'Editing', exact: true });
    await expect(lock).toHaveAttribute('aria-pressed', 'true');

    const acField = dialog.getByRole('textbox', { name: 'Armor class' });
    await expect(acField).toHaveValue(String(STARTING_AC));
    await acField.fill(String(NEW_AC));
    await expect(acField).toHaveValue(String(NEW_AC));
  });

  test('closing the drawer and selecting the token shows the same AC in the Studio panel', async () => {
    const dialog = creatureDialog(dmPage);
    await dialog.getByRole('button', { name: 'Close sheet' }).click();
    await expect(dialog).toBeHidden({ timeout: 5_000 });

    const coords = await coordsForElement(dmPage, TOKEN_ID);
    await dmPage.mouse.click(coords.x, coords.y);

    const panel = studioPanel(dmPage);
    await expect(panel).toHaveAttribute('data-active-tab', 'selected');
    await expect(
      panel.getByRole('textbox', { name: 'Armor class' })
    ).toHaveValue(String(NEW_AC));
  });
});
