import { devices, expect, test } from '@playwright/test';

import type {
  Browser,
  BrowserContext,
  BrowserContextOptions,
  Page,
} from '@playwright/test';

const CAMPAIGN_CODE = 'MOVE-E2E';
const BATTLE_MAP_ID = 'bm-movement-e2e';
const ENCOUNTER_ID = 'enc-movement-e2e';
const ENTITY_ID = 'entity-movement-e2e';
const TOKEN_ID = 'token-movement-e2e';
const GRID_ID = 'grid-movement-e2e';

const MAP_URL = `/dm/campaign/${CAMPAIGN_CODE}/battlemaps/${BATTLE_MAP_ID}`;

/**
 * Seeds the same persisted stores the real DM map route hydrates, following
 * `openSeededMap` in token-decoration-overlay.spec.ts: a v2 canvas payload
 * with a combatant token on the annotations layer, plus (new here) a `grid`
 * element on the locked map layer so the Move tool's square-grid snapping is
 * active — same element shape `useDmVttGrid.ts`/`GridController` produce
 * (type 'grid', gridType 'square', cellSize 40). The seeded entity carries no
 * `monsterStatBlock`, so movement speed resolves to the 30 ft default.
 */
async function openSeededMap(
  browser: Browser,
  options: BrowserContextOptions
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext(options);
  const page = await context.newPage();

  await page.goto('/player', { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ campaignCode, battleMapId, encounterId, entityId, tokenId, gridId }) => {
      const now = '2026-08-15T00:00:00.000Z';
      const canvasState = JSON.stringify({
        version: 2,
        camera: { position: { x: 0, y: 0 }, zoom: 1 },
        elements: [
          {
            id: gridId,
            type: 'grid',
            position: { x: 0, y: 0 },
            zIndex: 0,
            locked: true,
            layerId: 'layer-map',
            gridType: 'square',
            hexOrientation: 'pointy',
            cellSize: 40,
            strokeColor: '#94a3b8',
            strokeWidth: 1,
            opacity: 0.5,
          },
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
            fillColor: '#c0392b',
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

      window.localStorage.setItem(
        'rollkeeper-battlemap-data',
        JSON.stringify({
          state: {
            battleMaps: {
              [campaignCode]: {
                [battleMapId]: {
                  id: battleMapId,
                  campaignCode,
                  name: 'Movement path E2E map',
                  mapImageUrl: '',
                  mapImageSize: { w: 1200, h: 900 },
                  canvasState,
                  dmOnlyElements: {},
                  gridEnabled: true,
                  gridSettings: {
                    gridType: 'square',
                    cellSize: 40,
                    strokeColor: '#94a3b8',
                    strokeWidth: 1,
                    opacity: 0.5,
                  },
                  linkedEncounterIds: [encounterId],
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
        'rollkeeper-encounter-data',
        JSON.stringify({
          state: {
            encounters: [
              {
                id: encounterId,
                name: 'Movement path E2E encounter',
                campaignCode,
                entities: [
                  {
                    id: entityId,
                    type: 'monster',
                    name: 'E2E Owlbear',
                    initiative: null,
                    initiativeModifier: 0,
                    currentHp: 21,
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

      window.localStorage.setItem(
        `rollkeeper-battlemap-mode:${battleMapId}`,
        'play'
      );
      window.localStorage.setItem('rollkeeper-vtt-token-info-dm', 'full');
    },
    {
      campaignCode: CAMPAIGN_CODE,
      battleMapId: BATTLE_MAP_ID,
      encounterId: ENCOUNTER_ID,
      entityId: ENTITY_ID,
      tokenId: TOKEN_ID,
      gridId: GRID_ID,
    }
  );

  await page.goto(MAP_URL, { waitUntil: 'networkidle' });
  await expect(page.locator('[role="progressbar"]')).toBeVisible({
    timeout: 15_000,
  });
  return { context, page };
}

// Token seeded at world (320,260) size 80x80 -> centre (360,300). Camera at
// origin, zoom 1, so screen-local == world + canvas offset. The grid's
// cellSize (40) evenly divides the token's 80px footprint (2x2 cells, an
// even footprint), so both waypoint clicks below land on the SAME snapped
// grid-line intersection: the tap-on-last-waypoint commit needs no radius
// tolerance on a snapping grid (see PathTool.withinCommitRadius).
const ANCHOR = { x: 360, y: 300 };
const DEST = { x: 600, y: 460 };

test('desktop: move tool drags a token along a path and commits on tap-last', async ({
  browser,
}) => {
  const { context, page } = await openSeededMap(browser, {
    viewport: { width: 1440, height: 1000 },
  });
  try {
    await page.getByRole('button', { name: 'Move' }).click();
    const canvas = page.locator('canvas').first();
    const box = (await canvas.boundingBox())!;
    const sx = (wx: number) => box.x + wx;
    const sy = (wy: number) => box.y + wy;

    const hpBar = page.locator('[role="progressbar"]');
    const before = await hpBar.boundingBox();
    expect(before).not.toBeNull();
    if (!before) return;

    await page.mouse.click(sx(ANCHOR.x), sy(ANCHOR.y)); // anchor on token
    await page.mouse.click(sx(DEST.x), sy(DEST.y)); // waypoint
    await page.mouse.click(sx(DEST.x), sy(DEST.y)); // tap-last -> commit

    // DEST (600,460) snaps to the grid's even-footprint cell centre before
    // commit: x = round(600/40)*40 = 600, y = round(460/40)*40 = 480
    // (snapToCellCenter/snapAxisToCell, cellSize 40, 2x2 footprint). The
    // committed waypoint is used as an ABSOLUTE destination for the token's
    // centre (movementCommit.ts: `position = dest - size/2`), so the token
    // centre moves from (360,300) to exactly (600,480) -> a delta of
    // (+240, +180). A ±2px tolerance absorbs DPR/subpixel rounding of the
    // decoration's boundingBox.
    await expect
      .poll(async () => {
        const box = await hpBar.boundingBox();
        if (!box) return false;
        const dx = box.x - before.x;
        const dy = box.y - before.y;
        return Math.abs(dx - 240) <= 2 && Math.abs(dy - 180) <= 2;
      })
      .toBe(true);
  } finally {
    await context.close();
  }
});

test('iPad: touch move drags a token along a path and commits on tap-last', async ({
  browser,
}) => {
  const { context, page } = await openSeededMap(
    browser,
    devices['iPad Pro 11']
  );
  try {
    await page.getByRole('button', { name: 'Move' }).click();
    const canvas = page.locator('canvas').first();
    const box = (await canvas.boundingBox())!;
    const sx = (wx: number) => box.x + wx;
    const sy = (wy: number) => box.y + wy;

    const hpBar = page.locator('[role="progressbar"]');
    const before = await hpBar.boundingBox();
    expect(before).not.toBeNull();
    if (!before) return;

    await page.touchscreen.tap(sx(ANCHOR.x), sy(ANCHOR.y)); // anchor on token
    await page.touchscreen.tap(sx(DEST.x), sy(DEST.y)); // waypoint
    await page.touchscreen.tap(sx(DEST.x), sy(DEST.y)); // tap-last -> commit

    await expect
      .poll(async () => (await hpBar.boundingBox())?.x ?? null)
      .toBeGreaterThan(before.x + 140);
    await expect
      .poll(async () => (await hpBar.boundingBox())?.y ?? null)
      .toBeGreaterThan(before.y + 90);
  } finally {
    await context.close();
  }
});

test('desktop: Escape cancels an open path and the token does not move', async ({
  browser,
}) => {
  const { context, page } = await openSeededMap(browser, {
    viewport: { width: 1440, height: 1000 },
  });
  try {
    await page.getByRole('button', { name: 'Move' }).click();
    const canvas = page.locator('canvas').first();
    const box = (await canvas.boundingBox())!;
    const sx = (wx: number) => box.x + wx;
    const sy = (wy: number) => box.y + wy;

    const hpBar = page.locator('[role="progressbar"]');
    const before = await hpBar.boundingBox();
    expect(before).not.toBeNull();
    if (!before) return;

    await page.mouse.click(sx(ANCHOR.x), sy(ANCHOR.y)); // anchor on token
    await page.mouse.click(sx(DEST.x), sy(DEST.y)); // open waypoint, no commit yet
    await page.keyboard.press('Escape');

    // Discriminating check: tap the SAME destination point again. If Escape
    // actually cancelled the path (PathTool.cancel), it is closed and this
    // click lands on empty space -> resolveStart finds no token there, so
    // it's a no-op. If Escape were broken (key swallowed without cancelling
    // the path), the path would still be open with DEST as its last
    // waypoint, and this click would be a tap-on-last-waypoint commit that
    // MOVES the token -- exactly what a disabled-Escape mutant produces.
    await page.mouse.click(sx(DEST.x), sy(DEST.y));

    // No commit should ever fire, so nothing to await: assert immediately
    // and again after a beat to also catch a late/erroneous commit.
    expect(await hpBar.boundingBox()).toEqual(before);
    await expect.poll(async () => hpBar.boundingBox()).toEqual(before);
  } finally {
    await context.close();
  }
});
