import { expect, test } from '@playwright/test';

import type { Page } from '@playwright/test';
import { FogManager } from '@fieldnotes/vtt';

import {
  characterIdFromUrl,
  createCharacter,
  waitForCharacterLoaded,
  waitForStoresReady,
} from './helpers';
import {
  createCampaign,
  joinCampaign,
  openTableSceneLive,
  seedDm,
} from './helpers/battlemapRelay';

/**
 * PR08 repair 11 (QA1): the relay read fog tiles back in the string order
 * of their `x,y` keys, so once a revealed tile reached column or row 10
 * ("11,1" sorts before "2,1") every new connection to the live room closed
 * with 1013 "resync required" and checkpoints never saved. This takes a
 * 2048x1536 map fogged with reveals in tile columns 1, 2 and 11 (and row
 * 10) live, lets a new player join, saves and restores a checkpoint, and
 * lets the player reconnect. Shares the `sheet-drawer` config (relay + dev
 * server).
 */

const CAMPAIGN_NAME = 'Fog Order E2E Campaign';
const DM_ID = 'dm-fog-order-e2e';
const MAP_ID = 'fog-order-map-e2e';
const MAP_NAME = 'Fog Order E2E Map';
const CHARACTER_NAME = 'Fog Order Player';

type EditorFog = {
  definition: unknown;
  tiles: Array<{ x: number; y: number; data: string }>;
};

/** Covered 2048x1536 map at cell 1 (16x12 tiles) with four small reveals. */
function wideFog(): EditorFog {
  const manager = new FogManager();
  manager.initialize({
    bounds: { x: 0, y: 0, w: 2048, h: 1536 },
    base: 'covered',
    cellSize: 1,
  });
  for (const [x, y] of [
    [150, 150],
    [280, 150],
    [1430, 150],
    [150, 1300],
  ] as const) {
    manager.applyRegion(
      { kind: 'rectangle', from: { x, y }, to: { x: x + 20, y: y + 20 } },
      'reveal'
    );
  }
  return JSON.parse(JSON.stringify(manager.getState())) as EditorFog;
}

async function seedFoggedMap(
  page: Page,
  code: string,
  fog: EditorFog
): Promise<void> {
  const now = new Date().toISOString();
  await page.evaluate(
    ({ code, mapId, mapName, now, dmId, campaignName, fog }) => {
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
                  mapImageSize: { w: 2048, h: 1536 },
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
                    extensions: { fog: { version: 1, data: fog } },
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
      now,
      dmId: DM_ID,
      campaignName: CAMPAIGN_NAME,
      fog,
    }
  );
}

/** The canvas fog tiles as `x,y`, sorted numerically, or null without fog. */
async function fogTiles(page: Page): Promise<string[] | null> {
  return page.evaluate(() => {
    const json = (
      window.__rkStores?.viewport as unknown as
        | { exportJSON?: () => string }
        | undefined
    )?.exportJSON?.();
    if (!json) return null;
    const fog = (
      JSON.parse(json) as {
        extensions?: {
          fog?: {
            data?: {
              definition?: unknown;
              tiles?: Array<{ x: number; y: number }>;
            } | null;
          };
        };
      }
    ).extensions?.fog?.data;
    if (!fog?.definition) return null;
    return [...(fog.tiles ?? [])]
      .sort((a, b) => (a.x !== b.x ? a.x - b.x : a.y - b.y))
      .map(tile => `${tile.x},${tile.y}`);
  });
}

function details(page: Page) {
  return page.getByRole('button', { name: /^Details/u });
}

/** The player map is live and stays live (no 1013 reconnect loop). */
async function expectPlayerLive(page: Page): Promise<void> {
  const live = page.getByText('Live', { exact: true });
  await expect(live).toBeVisible({ timeout: 30_000 });
  for (let check = 0; check < 6; check += 1) {
    await page.waitForTimeout(500);
    await expect(live).toBeVisible();
  }
}

test('a map fogged past tile column 10 lets a new player join, checkpoints and restores (QA1)', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const dmContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const playerContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  try {
    const dmPage = await dmContext.newPage();
    const playerPage = await playerContext.newPage();
    for (const path of ['/player', '/dm', '/dm/campaign/warm/table']) {
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

    await seedDm(dmPage, DM_ID);
    const code = await createCampaign(dmPage, DM_ID, CAMPAIGN_NAME);
    const fog = wideFog();
    const expected = fog.tiles
      .map(tile => ({ x: tile.x, y: tile.y }))
      .sort((a, b) => (a.x !== b.x ? a.x - b.x : a.y - b.y))
      .map(tile => `${tile.x},${tile.y}`);
    // String order differs from numeric order: this is the failing case.
    expect(expected).toEqual(['1,1', '1,10', '2,1', '11,1']);
    await seedFoggedMap(dmPage, code, fog);
    await openTableSceneLive(dmPage, code, MAP_NAME);
    await expect
      .poll(() => fogTiles(dmPage), { timeout: 15_000 })
      .toEqual(expected);

    // 1. A new player joins the live, fogged scene and stays live.
    const characterId = characterIdFromUrl(
      await createCharacter(playerPage, CHARACTER_NAME)
    );
    await joinCampaign(playerPage, code, characterId, CAMPAIGN_NAME);
    await playerPage.goto(
      `/player/campaign/${code}/battlemap/${MAP_ID}?character=${characterId}`,
      { waitUntil: 'networkidle' }
    );
    await waitForStoresReady(playerPage);
    await waitForCharacterLoaded(playerPage, characterId);
    await expectPlayerLive(playerPage);

    // 2. Save checkpoint completes on this room.
    await details(dmPage).click();
    const panel = dmPage.getByTestId('table-header-details');
    await panel.getByRole('button', { name: 'Save checkpoint' }).click();
    await expect(dmPage.getByText(/^Checkpoint saved\./u).first()).toBeVisible({
      timeout: 45_000,
    });

    // 3. Restore it: the DM keeps the fog, and the player reconnects to the
    // restored room and stays live.
    if (!(await panel.isVisible())) await details(dmPage).click();
    await panel.getByRole('button', { name: 'Restore checkpoint' }).click();
    await expect(dmPage.getByText('Checkpoint restored.')).toBeVisible({
      timeout: 30_000,
    });
    await expect
      .poll(() => fogTiles(dmPage), { timeout: 15_000 })
      .toEqual(expected);
    await playerPage.reload({ waitUntil: 'networkidle' });
    await expectPlayerLive(playerPage);

    // 4. A reloaded DM tab connects to the restored room too.
    await dmPage.reload({ waitUntil: 'domcontentloaded' });
    await expect
      .poll(() => fogTiles(dmPage), { timeout: 30_000 })
      .toEqual(expected);
    await details(dmPage).click();
    await expect(
      dmPage.getByTestId('table-header-details').locator('dd').first()
    ).toHaveText('Connected', { timeout: 30_000 });
  } finally {
    await dmContext.close();
    await playerContext.close();
  }
});
