import { expect, test } from '@playwright/test';

import type { Page } from '@playwright/test';

import { E2E_RELAY_PORT } from '../config/playwright/e2eRelay';
import {
  createCampaign,
  openTableSceneLive,
  seedDm,
  waitForElementSynced,
} from './helpers/battlemapRelay';

/**
 * GG3: the DM's map edits made while the live connection was down are
 * dropped by the live room on reconnect, but the scene keeps them in its
 * offline changes slot. Later edits and "Save checkpoint" leave that slot
 * alone, and "Reapply offline changes" in Details puts the offline version
 * back on the live map.
 *
 * The connection drop is the page's relay WebSocket closed from the page,
 * with every reconnect sent to a closed port while "offline"; HTTP stays up.
 * (Browser offline emulation keeps an open WebSocket, and a Playwright
 * WebSocket route stalls the authority checkpoint.) Shares the
 * `sheet-drawer` config (relay + dev server).
 */

const CAMPAIGN_NAME = 'Offline Changes E2E Campaign';
const DM_ID = 'dm-offline-changes-e2e';
const MAP_ID = 'offline-changes-map-e2e';
const MAP_NAME = 'Offline Changes E2E Map';
const BOX_ID = 'offline-changes-box-e2e';
const START_X = 100;
const OFFLINE_X = 400;
const LATER_X = 250;

async function seedBattleMap(page: Page, code: string): Promise<void> {
  const now = new Date().toISOString();
  await page.evaluate(
    ({ code, mapId, mapName, boxId, x, now, dmId, campaignName }) => {
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
                    elements: [
                      {
                        id: boxId,
                        type: 'shape',
                        position: { x, y: 100 },
                        size: { w: 80, h: 80 },
                        zIndex: 10,
                        locked: false,
                        layerId: 'layer-annotations',
                        shape: 'rectangle',
                        strokeColor: '#1e293b',
                        strokeWidth: 2,
                        fillColor: '#2f6fd0',
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
      boxId: BOX_ID,
      x: START_X,
      now,
      dmId: DM_ID,
      campaignName: CAMPAIGN_NAME,
    }
  );
}

/** Moves the box as a local DM edit (the same store path a drag takes). */
async function moveBox(page: Page, x: number): Promise<void> {
  await page.evaluate(
    ({ id, x }) => {
      const store = window.__rkStores!.viewport!.store;
      const element = store.getById(id);
      if (!element) throw new Error(`${id} not in store`);
      store.update(id, { position: { x, y: element.position.y } });
    },
    { id: BOX_ID, x }
  );
}

async function boxX(page: Page): Promise<number | null> {
  return page.evaluate(
    id => window.__rkStores?.viewport?.store.getById(id)?.position.x ?? null,
    BOX_ID
  );
}

async function setRelayOffline(page: Page, offline: boolean): Promise<void> {
  await page.evaluate(offline => {
    const state = (
      window as unknown as {
        __gg3Relay: { offline: boolean; sockets: WebSocket[] };
      }
    ).__gg3Relay;
    state.offline = offline;
    if (offline) for (const socket of state.sockets.splice(0)) socket.close();
  }, offline);
}

function connectionLabel(page: Page) {
  return page.getByTestId('table-header-details').locator('dd').first();
}

function details(page: Page) {
  return page.getByRole('button', { name: /^Details/u });
}

test('offline edits kept through a later edit and a checkpoint, then reapplied', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  try {
    const page = await context.newPage();
    // The relay WebSocket is the live connection. "Offline" closes it and
    // sends every reconnect to a closed port until we come back; HTTP stays
    // up (browser offline emulation does not drop an open WebSocket).
    await page.addInitScript(relayPort => {
      const Native = window.WebSocket;
      const state = { offline: false, sockets: [] as WebSocket[] };
      (window as unknown as { __gg3Relay: typeof state }).__gg3Relay = state;
      class RelaySocket extends Native {
        constructor(url: string | URL, protocols?: string | string[]) {
          const relay = new RegExp(`:${relayPort}(?:[/?]|$)`, 'u').test(
            String(url)
          );
          super(relay && state.offline ? 'ws://127.0.0.1:9/' : url, protocols);
          if (relay) state.sockets.push(this);
        }
      }
      window.WebSocket = RelaySocket;
    }, E2E_RELAY_PORT);
    for (const path of ['/player', '/dm', '/dm/campaign/warm/table']) {
      await page
        .goto(path, { waitUntil: 'load', timeout: 60_000 })
        .catch(() => {});
    }

    await seedDm(page, DM_ID);
    const code = await createCampaign(page, DM_ID, CAMPAIGN_NAME);
    await seedBattleMap(page, code);
    await openTableSceneLive(page, code, MAP_NAME);
    await waitForElementSynced(page, BOX_ID);
    expect(await boxX(page)).toBe(START_X);

    // 1. Drop the live connection and edit while it is down.
    await setRelayOffline(page, true);
    await details(page).click();
    await expect(connectionLabel(page)).not.toHaveText('Connected', {
      timeout: 30_000,
    });
    await page.keyboard.press('Escape');
    await moveBox(page, OFFLINE_X);
    expect(await boxX(page)).toBe(OFFLINE_X);

    // 2. Reconnect: the live room wins and the toast points at Details.
    await setRelayOffline(page, false);
    await expect(
      page.getByText(
        'Map edits made while offline were not sent. To send them, open Details and choose Reapply offline changes.'
      )
    ).toBeVisible({ timeout: 60_000 });
    await expect.poll(() => boxX(page), { timeout: 20_000 }).toBe(START_X);

    // 3. A later edit and a checkpoint leave the offline changes alone.
    await moveBox(page, LATER_X);
    await details(page).click();
    const panel = page.getByTestId('table-header-details');
    await expect(panel.getByText(/^Offline changes from /u)).toBeVisible();
    await panel.getByRole('button', { name: 'Save checkpoint' }).click();
    await expect(page.getByText(/^Checkpoint saved\./u).first()).toBeVisible({
      timeout: 30_000,
    });
    if (!(await panel.isVisible())) await details(page).click();
    await expect(panel.getByText(/^Offline changes from /u)).toBeVisible();

    // 4. Reapply: the live map shows the offline version again.
    await panel
      .getByRole('button', { name: 'Reapply offline changes' })
      .click();
    await expect(page.getByText('Offline changes restored.')).toBeVisible({
      timeout: 30_000,
    });
    await expect.poll(() => boxX(page), { timeout: 30_000 }).toBe(OFFLINE_X);
    if (!(await panel.isVisible())) await details(page).click();
    await expect(panel.getByText(/^Offline changes from /u)).toHaveCount(0);
  } finally {
    await context.close();
  }
});
