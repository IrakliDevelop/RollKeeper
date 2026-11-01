import { expect, test } from '@playwright/test';

import type { Browser, Page } from '@playwright/test';
import { FogManager } from '@fieldnotes/vtt';

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

/**
 * Repair 10: fog the editor exports for a covered map with one revealed
 * area (the shape a battle map keeps before it is added to the Table).
 */
type EditorFog = {
  definition: unknown;
  tiles: Array<{ x: number; y: number; data: string }>;
};

function editorFog(): EditorFog {
  const manager = new FogManager();
  manager.initialize({
    bounds: { x: 0, y: 0, w: 1200, h: 900 },
    base: 'covered',
    cellSize: 10,
  });
  manager.applyRegion(
    { kind: 'rectangle', from: { x: 60, y: 60 }, to: { x: 700, y: 500 } },
    'reveal'
  );
  return JSON.parse(JSON.stringify(manager.getState())) as EditorFog;
}

async function seedBattleMap(
  page: Page,
  code: string,
  fog: unknown = null
): Promise<void> {
  const now = new Date().toISOString();
  await page.evaluate(
    ({ code, mapId, mapName, boxId, x, now, dmId, campaignName, fog }) => {
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
                    ...(fog
                      ? { extensions: { fog: { version: 1, data: fog } } }
                      : {}),
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
      fog,
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

/**
 * The relay WebSocket is the live connection. "Offline" closes it and sends
 * every reconnect to a closed port until we come back; HTTP stays up
 * (browser offline emulation does not drop an open WebSocket).
 */
async function installRelaySwitch(page: Page): Promise<void> {
  await page.addInitScript(relayPort => {
    const Native = window.WebSocket;
    const state = {
      offline: window.sessionStorage.getItem('__gg3RelayOffline') === '1',
      sockets: [] as WebSocket[],
    };
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
}

async function setRelayOffline(page: Page, offline: boolean): Promise<void> {
  await page.evaluate(offline => {
    const state = (
      window as unknown as {
        __gg3Relay: { offline: boolean; sockets: WebSocket[] };
      }
    ).__gg3Relay;
    state.offline = offline;
    // FR4-3: survives a reload, so the page can load with the relay down.
    window.sessionStorage.setItem('__gg3RelayOffline', offline ? '1' : '0');
    if (offline) for (const socket of state.sockets.splice(0)) socket.close();
  }, offline);
}

function connectionLabel(page: Page) {
  return page.getByTestId('table-header-details').locator('dd').first();
}

/** OO2: the DM canvas fog, tiles sorted, or null when it has no fog. */
async function dmFog(page: Page): Promise<EditorFog | null> {
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
              tiles?: Array<{ x: number; y: number; data: string }>;
            } | null;
          };
        };
      }
    ).extensions?.fog?.data;
    if (!fog?.definition) return null;
    return {
      definition: fog.definition,
      tiles: [...(fog.tiles ?? [])].sort((a, b) =>
        a.x !== b.x ? a.x - b.x : a.y - b.y
      ),
    };
  });
}

const sortedFog = (fog: EditorFog): EditorFog => ({
  definition: fog.definition,
  tiles: [...fog.tiles].sort((a, b) => (a.x !== b.x ? a.x - b.x : a.y - b.y)),
});

/** The DM canvas has fog (a fog definition) loaded. */
async function dmFogEnabled(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const json = (
      window.__rkStores?.viewport as unknown as
        | { exportJSON?: () => string }
        | undefined
    )?.exportJSON?.();
    if (!json) return false;
    const parsed = JSON.parse(json) as {
      extensions?: { fog?: { data?: { definition?: unknown } | null } };
    };
    return Boolean(parsed.extensions?.fog?.data?.definition);
  });
}

function details(page: Page) {
  return page.getByRole('button', { name: /^Details/u });
}

/**
 * One click must open Details: no retry, so a header remount that drops the
 * open state (the FR4-3 regression) fails here instead of being re-clicked.
 */
async function openDetails(page: Page) {
  const panel = page.getByTestId('table-header-details');
  // A click on an already-open trigger would close it: start from closed.
  await expect(details(page)).toHaveAttribute('aria-expanded', 'false');
  await details(page).click();
  await expect(panel).toBeVisible();
  return panel;
}

async function offlineChangesFlow(
  browser: Browser,
  fog: 'none' | 'after-live' | 'seeded'
): Promise<void> {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  try {
    const page = await context.newPage();
    await installRelaySwitch(page);
    for (const path of ['/player', '/dm', '/dm/campaign/warm/table']) {
      await page
        .goto(path, { waitUntil: 'load', timeout: 60_000 })
        .catch(() => {});
    }

    await seedDm(page, DM_ID);
    const code = await createCampaign(page, DM_ID, CAMPAIGN_NAME);
    const seededFog = fog === 'seeded' ? editorFog() : null;
    expect(seededFog?.tiles.length ?? 1).toBeGreaterThan(0);
    await seedBattleMap(page, code, seededFog);
    // Repair 10: a pre-fogged map used to stay "not ready" here forever
    // (its fog was sent to the room in the editor shape and refused).
    await openTableSceneLive(page, code, MAP_NAME);
    await waitForElementSynced(page, BOX_ID);
    expect(await boxX(page)).toBe(START_X);
    // OO2: the revealed area came through going live intact.
    if (seededFog)
      await expect
        .poll(() => dmFog(page), { timeout: 10_000 })
        .toEqual(sortedFog(seededFog));
    if (fog === 'after-live') {
      // Repair 10 (G1): with fog on, Reapply used to fail with "the saved
      // copy can't be used".
      await page.getByRole('button', { name: 'Fog of war' }).click();
      await page.getByRole('button', { name: 'Enable covered fog' }).click();
      await expect
        .poll(() => dmFogEnabled(page), { timeout: 10_000 })
        .toBe(true);
    }
    // OO2: the fog the reapplied version must bring back.
    const fogBeforeOffline = fog === 'none' ? null : await dmFog(page);
    if (fog !== 'none') expect(fogBeforeOffline).not.toBeNull();

    // 1. Drop the live connection and edit while it is down.
    await setRelayOffline(page, true);
    await openDetails(page);
    await expect(connectionLabel(page)).not.toHaveText('Connected', {
      timeout: 30_000,
    });
    await page.keyboard.press('Escape');
    await moveBox(page, OFFLINE_X);
    expect(await boxX(page)).toBe(OFFLINE_X);

    // 2. Reconnect: the live room wins and the toast points at Details.
    await setRelayOffline(page, false);
    await expect(
      page
        .locator('[data-toast-type]')
        .getByText(
          'Map edits made while offline were not sent. To send them, open Details and choose Reapply offline changes.'
        )
    ).toBeVisible({ timeout: 60_000 });
    await expect.poll(() => boxX(page), { timeout: 20_000 }).toBe(START_X);

    // 3. A later edit and a checkpoint leave the offline changes alone.
    await moveBox(page, LATER_X);
    const panel = await openDetails(page);
    await expect(panel.getByText(/^Offline changes from /u)).toBeVisible();
    await panel.getByRole('button', { name: 'Save checkpoint' }).click();
    await expect(page.getByText(/^Checkpoint saved\./u).first()).toBeVisible({
      timeout: 30_000,
    });
    // Saving from the panel leaves it open.
    await expect(panel).toBeVisible();
    await expect(panel.getByText(/^Offline changes from /u)).toBeVisible();

    // 4. Reapply: the live map shows the offline version again.
    await panel
      .getByRole('button', { name: 'Reapply offline changes' })
      .click();
    await expect(page.getByText('Offline changes restored.')).toBeVisible({
      timeout: 30_000,
    });
    await expect.poll(() => boxX(page), { timeout: 30_000 }).toBe(OFFLINE_X);
    // Reapplying from the panel leaves it open.
    await expect(panel).toBeVisible();
    await expect(panel.getByText(/^Offline changes from /u)).toHaveCount(0);
    // OO2: the fog came back exactly with the reapplied version.
    if (fog !== 'none')
      await expect
        .poll(() => dmFog(page), { timeout: 10_000 })
        .toEqual(fogBeforeOffline);
  } finally {
    await context.close();
  }
}

test('offline edits kept through a later edit and a checkpoint, then reapplied', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  await offlineChangesFlow(browser, 'none');
});

test('with fog turned on after going live, offline edits are reapplied (repair 10)', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  await offlineChangesFlow(browser, 'after-live');
});

test('a battle map fogged before it joined the Table goes live, shows and reapplies (repair 10)', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  await offlineChangesFlow(browser, 'seeded');
});

/**
 * FR4-3 / QA2: the relay is unreachable when the DM (re)loads the Table, so
 * this tab never had the live room. Its edits stay on the device; once the
 * room is reachable the live version is shown, and the edits are kept in
 * the offline changes slot with the same notice, ready to reapply.
 */
test('edits made while the relay is down at page load are kept and reapplied once it is back (FR4-3)', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  try {
    const page = await context.newPage();
    await installRelaySwitch(page);
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

    // 1. Reload the Table with the relay unreachable from this page. Live
    // control is HTTP, so this tab can still hold it (Go live if asked).
    await setRelayOffline(page, true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    const goLive = page.getByRole('button', { name: 'Go live' });
    const livePill = page
      .getByTestId('table-live-pill')
      .filter({ hasText: /^You're live$/u });
    await expect(async () => {
      if (await goLive.isVisible()) await goLive.click();
      await expect(livePill).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 60_000 });
    await page.waitForFunction(
      id => !!window.__rkStores?.viewport?.store.getById(id),
      BOX_ID,
      { timeout: 30_000 }
    );
    await openDetails(page);
    await expect(connectionLabel(page)).not.toHaveText('Connected', {
      timeout: 30_000,
    });
    await page.keyboard.press('Escape');
    await moveBox(page, OFFLINE_X);
    expect(await boxX(page)).toBe(OFFLINE_X);

    // 2. The relay is reachable again: the live room wins, and the toast
    // points at Details (it used to revert silently).
    await setRelayOffline(page, false);
    await expect(
      page
        .locator('[data-toast-type]')
        .getByText(
          'Map edits made while offline were not sent. To send them, open Details and choose Reapply offline changes.'
        )
    ).toBeVisible({ timeout: 60_000 });
    await expect.poll(() => boxX(page), { timeout: 20_000 }).toBe(START_X);

    // 3. Reapply: the live map shows the edit made while the relay was down.
    const panel = await openDetails(page);
    await expect(panel.getByText(/^Offline changes from /u)).toBeVisible();
    await panel
      .getByRole('button', { name: 'Reapply offline changes' })
      .click();
    await expect(page.getByText('Offline changes restored.')).toBeVisible({
      timeout: 30_000,
    });
    await expect.poll(() => boxX(page), { timeout: 30_000 }).toBe(OFFLINE_X);
    // Reapplying from the panel leaves it open.
    await expect(panel).toBeVisible();
    await expect(panel.getByText(/^Offline changes from /u)).toHaveCount(0);
  } finally {
    await context.close();
  }
});
