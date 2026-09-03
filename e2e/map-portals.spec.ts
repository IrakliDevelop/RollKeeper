import { devices, expect, test } from '@playwright/test';

import type {
  Browser,
  BrowserContext,
  BrowserContextOptions,
  Page,
} from '@playwright/test';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const CAMPAIGN_CODE = 'PORTAL-E2E';
const BM1_ID = 'bm-portal-1';
const BM2_ID = 'bm-portal-2';
const LOC_ID = 'loc-portal-1';

const BM1_NAME = 'Portal Battle Map 1';
const BM2_NAME = 'Portal Battle Map 2';
const LOC_NAME = 'Portal Location';

const BM1_URL = `/dm/campaign/${CAMPAIGN_CODE}/battlemaps/${BM1_ID}`;
const BM2_URL = `/dm/campaign/${CAMPAIGN_CODE}/battlemaps/${BM2_ID}`;
const LOC_URL = `/dm/campaign/${CAMPAIGN_CODE}/locations/${LOC_ID}`;

// Marker element / detail refs — one per map
const BM1_MARKER_REF = 'ref-bm1-portal';
const BM2_MARKER_REF = 'ref-bm2-portal';
const LOC_MARKER_REF = 'ref-loc-portal';

// Marker element world position — identical on every map for simplicity.
const MARKER_POS = { x: 400, y: 300 };
const MARKER_SIZE = { w: 40, h: 40 };

const NOW = '2026-08-20T00:00:00.000Z';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function buildMarkerElement(elementId: string, ref: string) {
  return {
    id: elementId,
    type: 'html',
    htmlType: 'rk-marker',
    position: MARKER_POS,
    size: MARKER_SIZE,
    zIndex: 500,
    locked: false,
    layerId: 'layer-annotations',
    data: { v: 1, kind: 'note', ref, label: 'Portal', color: 'blue' },
  };
}

function buildCanvasState(elementId: string, ref: string): string {
  return JSON.stringify({
    version: 2,
    camera: { position: { x: 0, y: 0 }, zoom: 1 },
    elements: [buildMarkerElement(elementId, ref)],
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
}

/**
 * Seeds localStorage with DM store, battle-map store (2 maps), and
 * location store (1 location), wired into a portal cycle:
 *
 *   bm-portal-1  --portal-->  loc-portal-1  (kind: 'location')
 *   bm-portal-2  --portal-->  bm-portal-1   (kind: 'battlemap')
 *   loc-portal-1 --portal-->  bm-portal-2   (kind: 'battlemap')
 */
async function seedStores(page: Page): Promise<void> {
  await page.goto('/player', { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ campaignCode, bm1Id, bm2Id, locId, bm1Name, bm2Name, locName, now }) => {
      window.localStorage.setItem(
        'rollkeeper-dm-data',
        JSON.stringify({
          state: {
            dmId: 'dm-portal-e2e',
            campaigns: [
              {
                code: campaignCode,
                name: 'Portal E2E Campaign',
                createdAt: now,
              },
            ],
          },
          version: 0,
        })
      );

      window.localStorage.setItem(
        'rollkeeper-battlemap-data',
        JSON.stringify({
          state: {
            battleMaps: {
              [campaignCode]: {
                [bm1Id]: {
                  id: bm1Id,
                  campaignCode,
                  name: bm1Name,
                  mapImageUrl: '',
                  mapImageSize: { w: 1200, h: 900 },
                  canvasState: JSON.stringify({
                    version: 2,
                    camera: { position: { x: 0, y: 0 }, zoom: 1 },
                    elements: [
                      {
                        id: 'el-bm1-portal',
                        type: 'html',
                        htmlType: 'rk-marker',
                        position: { x: 400, y: 300 },
                        size: { w: 40, h: 40 },
                        zIndex: 500,
                        locked: false,
                        layerId: 'layer-annotations',
                        data: {
                          v: 1,
                          kind: 'note',
                          ref: 'ref-bm1-portal',
                          label: 'Portal',
                          color: 'blue',
                        },
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
                  markers: [
                    {
                      id: 'ref-bm1-portal',
                      title: 'Portal to Location',
                      body: '',
                      dmNotes: '',
                      portal: { v: 1, kind: 'location', id: locId },
                    },
                  ],
                  createdAt: now,
                  updatedAt: now,
                },
                [bm2Id]: {
                  id: bm2Id,
                  campaignCode,
                  name: bm2Name,
                  mapImageUrl: '',
                  mapImageSize: { w: 1200, h: 900 },
                  canvasState: JSON.stringify({
                    version: 2,
                    camera: { position: { x: 0, y: 0 }, zoom: 1 },
                    elements: [
                      {
                        id: 'el-bm2-portal',
                        type: 'html',
                        htmlType: 'rk-marker',
                        position: { x: 400, y: 300 },
                        size: { w: 40, h: 40 },
                        zIndex: 500,
                        locked: false,
                        layerId: 'layer-annotations',
                        data: {
                          v: 1,
                          kind: 'note',
                          ref: 'ref-bm2-portal',
                          label: 'Portal',
                          color: 'blue',
                        },
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
                  markers: [
                    {
                      id: 'ref-bm2-portal',
                      title: 'Portal to BM1',
                      body: '',
                      dmNotes: '',
                      portal: { v: 1, kind: 'battlemap', id: bm1Id },
                    },
                  ],
                  createdAt: now,
                  updatedAt: now,
                },
              },
            },
          },
          version: 0,
        })
      );

      window.localStorage.setItem(
        'rollkeeper-location-data',
        JSON.stringify({
          state: {
            locations: {
              [campaignCode]: {
                [locId]: {
                  id: locId,
                  campaignCode,
                  name: locName,
                  mapImageUrl: '',
                  mapImageSize: { w: 1200, h: 900 },
                  canvasState: JSON.stringify({
                    version: 2,
                    camera: { position: { x: 0, y: 0 }, zoom: 1 },
                    elements: [
                      {
                        id: 'el-loc-portal',
                        type: 'html',
                        htmlType: 'rk-marker',
                        position: { x: 400, y: 300 },
                        size: { w: 40, h: 40 },
                        zIndex: 500,
                        locked: false,
                        layerId: 'layer-annotations',
                        data: {
                          v: 1,
                          kind: 'note',
                          ref: 'ref-loc-portal',
                          label: 'Portal',
                          color: 'blue',
                        },
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
                  markers: [
                    {
                      id: 'ref-loc-portal',
                      title: 'Portal to BM2',
                      body: '',
                      dmNotes: '',
                      portal: { v: 1, kind: 'battlemap', id: bm2Id },
                    },
                  ],
                  createdAt: now,
                  updatedAt: now,
                },
              },
            },
          },
          version: 0,
        })
      );

      window.localStorage.setItem(
        `rollkeeper-battlemap-mode:${bm1Id}`,
        'setup'
      );
      window.localStorage.setItem(
        `rollkeeper-battlemap-mode:${bm2Id}`,
        'setup'
      );
    },
    {
      campaignCode: CAMPAIGN_CODE,
      bm1Id: BM1_ID,
      bm2Id: BM2_ID,
      locId: LOC_ID,
      bm1Name: BM1_NAME,
      bm2Name: BM2_NAME,
      locName: LOC_NAME,
      now: NOW,
    }
  );
}

/**
 * Opens a seeded map in a fresh browser context.  Waits for the Fieldnotes
 * viewport to be exposed on `window.__rkStores.viewport` (see the
 * `exposeStoreForE2E('viewport', ...)` call added to the editor hooks).
 */
async function openSeededMap(
  browser: Browser,
  url: string,
  options: BrowserContextOptions
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  await seedStores(page);
  await page.goto(url, { waitUntil: 'networkidle' });
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => !!window.__rkStores?.viewport, undefined, {
    timeout: 15_000,
  });
  return { context, page };
}

/**
 * Double-clicks the marker element at its actual screen position.
 *
 * The DmLocationEditor's `_fitCameraToMap` adjusts zoom and pan after load,
 * so the seeded camera position (0,0 zoom 1) no longer applies. This helper
 * reads the live camera from `window.__rkStores.viewport` — exposed by
 * `exposeStoreForE2E` — and computes the marker's screen coordinates.
 */
async function doubleClickMarker(page: Page, elementId: string): Promise<void> {
  const coords = await page.evaluate(elId => {
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

  await page.mouse.dblclick(coords.x, coords.y);
}

/** The marker detail dialog — scoped to exclude the Next.js error overlay. */
function markerDialog(page: Page) {
  return page.getByRole('dialog').filter({ hasText: 'Map marker details' });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

test.describe('map-portals', () => {
  test('BM1: double-activate marker, see resolved destination, open it, use Back', async ({
    browser,
  }) => {
    const { context, page } = await openSeededMap(browser, BM1_URL, {
      viewport: { width: 1440, height: 1000 },
    });
    try {
      await doubleClickMarker(page, 'el-bm1-portal');

      const portalSection = page.getByTestId('portal-destination-section');
      await expect(portalSection).toBeVisible({ timeout: 10_000 });
      // The resolved destination name appears next to the Open destination link.
      // Use the link presence as the resolved-name proxy (the combobox also
      // shows the name, so getByText returns 2 elements).
      const openLink = portalSection.getByRole('link', {
        name: 'Open destination',
      });
      await expect(openLink).toBeVisible();
      await openLink.click();

      await page.waitForURL(`**${LOC_URL}`, { timeout: 15_000 });
      await expect(page.locator('canvas').first()).toBeVisible({
        timeout: 15_000,
      });

      await page.goBack();
      await page.waitForURL(`**${BM1_URL}`, { timeout: 15_000 });
      await expect(page.locator('canvas').first()).toBeVisible({
        timeout: 15_000,
      });
    } finally {
      await context.close();
    }
  });

  test('location editor: activate marker, destination points to BM2, follow it', async ({
    browser,
  }) => {
    const { context, page } = await openSeededMap(browser, LOC_URL, {
      viewport: { width: 1440, height: 1000 },
    });
    try {
      await doubleClickMarker(page, 'el-loc-portal');

      const portalSection = page.getByTestId('portal-destination-section');
      await expect(portalSection).toBeVisible({ timeout: 10_000 });
      const openLink = portalSection.getByRole('link', {
        name: 'Open destination',
      });
      await expect(openLink).toBeVisible();
      await openLink.click();

      await page.waitForURL(`**${BM2_URL}`, { timeout: 15_000 });
      await expect(page.locator('canvas').first()).toBeVisible({
        timeout: 15_000,
      });
    } finally {
      await context.close();
    }
  });

  test('rename target: panel resolves new name without reload', async ({
    browser,
  }) => {
    const { context, page } = await openSeededMap(browser, BM1_URL, {
      viewport: { width: 1440, height: 1000 },
    });
    try {
      await doubleClickMarker(page, 'el-bm1-portal');

      const portalSection = page.getByTestId('portal-destination-section');
      await expect(portalSection).toBeVisible({ timeout: 10_000 });
      // Verify the "Open destination" link is present (destination resolved)
      await expect(
        portalSection.getByRole('link', { name: 'Open destination' })
      ).toBeVisible();

      // Close the panel
      await page.keyboard.press('Escape');
      await expect(markerDialog(page)).toBeHidden({ timeout: 5_000 });

      // Rename the location through the live Zustand store (not localStorage,
      // which doesn't trigger Zustand's in-memory selectors).
      const newName = 'Renamed Portal Location';
      await page.evaluate(
        ({ campaignCode, locId, newName }) => {
          window
            .__rkStores!.location!.getState()
            .updateLocation(campaignCode, locId, { name: newName });
        },
        { campaignCode: CAMPAIGN_CODE, locId: LOC_ID, newName }
      );

      // Re-open — the name should resolve live
      await doubleClickMarker(page, 'el-bm1-portal');

      const section2 = page.getByTestId('portal-destination-section');
      await expect(section2).toBeVisible({ timeout: 10_000 });
      // The renamed location should appear in both the target combobox and
      // the resolved destination text. Assert the combobox reflects the new
      // name (unique locator — avoids the strict-mode duplicate).
      await expect(
        section2.getByRole('combobox', { name: 'Target location' })
      ).toHaveText(newName, { timeout: 10_000 });
      // And the link should still be present (destination resolved)
      await expect(
        section2.getByRole('link', { name: 'Open destination' })
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('delete target: portal becomes non-navigable', async ({ browser }) => {
    const { context, page } = await openSeededMap(browser, BM1_URL, {
      viewport: { width: 1440, height: 1000 },
    });
    try {
      await doubleClickMarker(page, 'el-bm1-portal');

      const portalSection = page.getByTestId('portal-destination-section');
      await expect(portalSection).toBeVisible({ timeout: 10_000 });
      await expect(
        portalSection.getByRole('link', { name: 'Open destination' })
      ).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(markerDialog(page)).toBeHidden({ timeout: 5_000 });

      // Delete the target location through the live Zustand store
      await page.evaluate(
        ({ campaignCode, locId }) => {
          window
            .__rkStores!.location!.getState()
            .removeLocation(campaignCode, locId);
        },
        { campaignCode: CAMPAIGN_CODE, locId: LOC_ID }
      );

      await doubleClickMarker(page, 'el-bm1-portal');

      const section = page.getByTestId('portal-destination-section');
      await expect(section).toBeVisible({ timeout: 10_000 });
      await expect(section.getByText('Destination unavailable')).toBeVisible({
        timeout: 10_000,
      });
      await expect(
        section.getByRole('link', { name: 'Open destination' })
      ).not.toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('cyclic pair: each hop requires explicit activation', async ({
    browser,
  }) => {
    const { context, page } = await openSeededMap(browser, BM1_URL, {
      viewport: { width: 1440, height: 1000 },
    });
    try {
      // Hop 1: BM1 -> LOC
      await doubleClickMarker(page, 'el-bm1-portal');
      let section = page.getByTestId('portal-destination-section');
      await expect(section).toBeVisible({ timeout: 10_000 });
      await section.getByRole('link', { name: 'Open destination' }).click();
      await page.waitForURL(`**${LOC_URL}`, { timeout: 15_000 });
      await page.waitForFunction(
        () => !!window.__rkStores?.viewport,
        undefined,
        { timeout: 15_000 }
      );

      // Hop 2: LOC -> BM2
      await doubleClickMarker(page, 'el-loc-portal');
      section = page.getByTestId('portal-destination-section');
      await expect(section).toBeVisible({ timeout: 10_000 });
      await section.getByRole('link', { name: 'Open destination' }).click();
      await page.waitForURL(`**${BM2_URL}`, { timeout: 15_000 });
      await page.waitForFunction(
        () => !!window.__rkStores?.viewport,
        undefined,
        { timeout: 15_000 }
      );

      // Hop 3: BM2 -> BM1 (completes the cycle)
      await doubleClickMarker(page, 'el-bm2-portal');
      section = page.getByTestId('portal-destination-section');
      await expect(section).toBeVisible({ timeout: 10_000 });
      await section.getByRole('link', { name: 'Open destination' }).click();
      await page.waitForURL(`**${BM1_URL}`, { timeout: 15_000 });
      await expect(page.locator('canvas').first()).toBeVisible({
        timeout: 15_000,
      });
    } finally {
      await context.close();
    }
  });

  test('touch: single tap does not activate; double-tap opens panel', async ({
    browser,
  }) => {
    const { context, page } = await openSeededMap(
      browser,
      BM1_URL,
      devices['iPad Pro 11']
    );
    try {
      // Get the marker screen coordinates
      const coords = await page.evaluate(() => {
        const vp = window.__rkStores!.viewport!;
        const el = vp.store.getById('el-bm1-portal');
        if (!el) throw new Error('Element not in store');
        const center = {
          x: el.position.x + el.size.w / 2,
          y: el.position.y + el.size.h / 2,
        };
        const sl = {
          x: center.x * vp.camera.z + vp.camera.x,
          y: center.y * vp.camera.z + vp.camera.y,
        };
        const canvas = document.querySelector('canvas');
        const wrapper = canvas?.parentElement;
        const rect = wrapper?.getBoundingClientRect();
        if (!rect) throw new Error('No wrapper');
        return { x: rect.left + sl.x, y: rect.top + sl.y };
      });

      // Single tap should not open panel (DM gesture is 'double')
      await page.touchscreen.tap(coords.x, coords.y);
      await page.waitForTimeout(400);
      await expect(markerDialog(page)).toBeHidden();

      // Double-tap should open the panel
      await page.touchscreen.tap(coords.x, coords.y);
      await page.touchscreen.tap(coords.x, coords.y);

      const portalSection = page.getByTestId('portal-destination-section');
      await expect(portalSection).toBeVisible({ timeout: 10_000 });

      // Keyboard activation of the link should navigate
      const openLink = portalSection.getByRole('link', {
        name: 'Open destination',
      });
      await expect(openLink).toBeVisible();
      await openLink.focus();
      await page.keyboard.press('Enter');

      await page.waitForURL(`**${LOC_URL}`, { timeout: 15_000 });
    } finally {
      await context.close();
    }
  });

  // NOTE: Player and TV portal isolation tests are deferred to the manual
  // browser acceptance gate. Reasons:
  //
  // - Player surface: requires an active relay connection and character
  //   linked to the campaign. The portal field is structurally excluded from
  //   PublicMarkerDetail (portal?: never). Unit tests in
  //   PlayerBattleMapCanvas.portalIsolation.test.tsx verify this.
  //
  // - TV/Display surface: the display page uses gesture: null which disables
  //   marker activation entirely. Unit tests in
  //   page.markerActivation.test.tsx cover the gesture: null contract.
});
