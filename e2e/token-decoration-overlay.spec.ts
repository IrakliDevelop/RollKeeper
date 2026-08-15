import { devices, expect, test } from '@playwright/test';

import type {
  Browser,
  BrowserContext,
  BrowserContextOptions,
  Page,
} from '@playwright/test';

const CAMPAIGN_CODE = 'TOKEN-E2E';
const BATTLE_MAP_ID = 'bm-token-decoration-e2e';
const ENCOUNTER_ID = 'enc-token-decoration-e2e';
const ENTITY_ID = 'entity-token-decoration-e2e';
const TOKEN_ID = 'token-decoration-e2e';
const TOKEN_NAME = 'E2E Ogre';

const MAP_URL = `/dm/campaign/${CAMPAIGN_CODE}/battlemaps/${BATTLE_MAP_ID}`;

/**
 * Seeds the same persisted stores the real DM map route hydrates. The canvas
 * payload is an authentic Fieldnotes v2 state with a combatant token on the
 * canonical annotations layer; the linked encounter supplies its decoration.
 */
async function openSeededMap(
  browser: Browser,
  options: BrowserContextOptions
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext(options);
  const page = await context.newPage();

  // Establish the app origin before writing localStorage. The seeded stores
  // are then present before the battle-map route imports and hydrates them.
  await page.goto('/player', { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ campaignCode, battleMapId, encounterId, entityId, tokenId }) => {
      const now = '2026-08-15T00:00:00.000Z';
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
                  name: 'Token decoration E2E map',
                  mapImageUrl: '',
                  mapImageSize: { w: 1200, h: 900 },
                  canvasState,
                  dmOnlyElements: {},
                  gridEnabled: false,
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
                name: 'Token decoration E2E encounter',
                campaignCode,
                entities: [
                  {
                    id: entityId,
                    type: 'monster',
                    name: 'E2E Ogre',
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
    }
  );

  await page.goto(MAP_URL, { waitUntil: 'networkidle' });
  // DecorationItem's test-id wrapper is intentionally layoutless because its
  // children are absolutely positioned. The HP bar is the visible geometry.
  // The overlay is aria-hidden as a whole, so role queries correctly omit it;
  // use the literal role attribute to inspect its visual child.
  await expect(page.locator('[role="progressbar"]')).toBeVisible({
    timeout: 15_000,
  });
  return { context, page };
}

test('desktop drag moves the decoration and compact hover reveals its chip', async ({
  browser,
}) => {
  const { context, page } = await openSeededMap(browser, {
    viewport: { width: 1440, height: 1000 },
  });

  try {
    const hpBar = page.locator('[role="progressbar"]');
    const tokenDecoration = page.getByTestId(`token-decoration-${ENTITY_ID}`);
    const before = await hpBar.boundingBox();
    expect(before).not.toBeNull();
    if (!before) return;

    await page.getByRole('button', { name: 'Select', exact: true }).click();
    const start = {
      x: before.x + before.width / 2,
      y: before.y + before.height / 2,
    };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 120, start.y + 80, { steps: 8 });
    await page.mouse.up();

    await expect
      .poll(async () => (await hpBar.boundingBox())?.x ?? null)
      .toBeGreaterThan(before.x + 70);
    await expect
      .poll(async () => (await hpBar.boundingBox())?.y ?? null)
      .toBeGreaterThan(before.y + 40);

    // full -> compact; the chip disappears until the real pointer hover hits
    // the moved token through Viewport.getElementAt.
    await page.getByRole('button', { name: 'Token info: full' }).click();
    await expect(tokenDecoration.getByText(TOKEN_NAME)).toBeHidden();

    const moved = await hpBar.boundingBox();
    expect(moved).not.toBeNull();
    if (!moved) return;
    await page.mouse.move(
      moved.x + moved.width / 2,
      moved.y + moved.height / 2
    );
    await expect(tokenDecoration.getByText(TOKEN_NAME)).toBeVisible();
  } finally {
    await context.close();
  }
});

test('iPad touch tap reveals a compact token chip', async ({ browser }) => {
  const { context, page } = await openSeededMap(
    browser,
    devices['iPad Pro 11']
  );

  try {
    const tokenDecoration = page.getByTestId(`token-decoration-${ENTITY_ID}`);
    await page.getByRole('button', { name: 'Token info: full' }).click();
    await expect(tokenDecoration.getByText(TOKEN_NAME)).toBeHidden();

    const hpBar = page.locator('[role="progressbar"]');
    const token = await hpBar.boundingBox();
    expect(token).not.toBeNull();
    if (!token) return;

    await page.touchscreen.tap(
      token.x + token.width / 2,
      token.y + token.height / 2
    );
    await expect(tokenDecoration.getByText(TOKEN_NAME)).toBeVisible();
  } finally {
    await context.close();
  }
});
