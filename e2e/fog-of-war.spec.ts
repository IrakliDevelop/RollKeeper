import { expect, test, type Page } from '@playwright/test';

const CAMPAIGN_CODE = 'FOG-E2E';
const BATTLE_MAP_ID = 'fog-map';
const MAP_URL = `/dm/campaign/${CAMPAIGN_CODE}/battlemaps/${BATTLE_MAP_ID}`;
const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Xf6nAAAAAElFTkSuQmCC';

async function openSeededMap(page: Page): Promise<void> {
  await page.goto('/player', { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ campaignCode, mapId, pixel }) => {
      const now = '2026-09-04T00:00:00.000Z';
      window.localStorage.setItem(
        'rollkeeper-dm-data',
        JSON.stringify({
          state: {
            dmId: 'dm-fog-e2e',
            campaigns: [
              { code: campaignCode, name: 'Fog E2E', createdAt: now },
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
                [mapId]: {
                  id: mapId,
                  campaignCode,
                  name: 'Fog acceptance map',
                  mapImageUrl: pixel,
                  mapImageSize: { w: 800, h: 600 },
                  canvasState: JSON.stringify({
                    version: 2,
                    camera: { position: { x: 0, y: 0 }, zoom: 1 },
                    elements: [
                      {
                        id: 'map-image',
                        type: 'image',
                        position: { x: 0, y: 0 },
                        size: { w: 800, h: 600 },
                        zIndex: 0,
                        locked: true,
                        layerId: 'layer-map',
                        src: pixel,
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
    { campaignCode: CAMPAIGN_CODE, mapId: BATTLE_MAP_ID, pixel: PIXEL }
  );
  await page.goto(MAP_URL, { waitUntil: 'networkidle' });
  await expect(page.getByRole('button', { name: 'Fog of war' })).toBeVisible();
}

test('DM opts in, authors fog, previews players, and reloads persisted fog', async ({
  page,
}) => {
  await openSeededMap(page);
  await page.getByRole('button', { name: 'Fog of war' }).click();
  const confirmation = page.getByRole('alertdialog', {
    name: 'Enable fog of war',
  });
  await expect(confirmation).toContainText('Cover the entire map');
  await confirmation
    .getByRole('button', { name: 'Enable covered fog' })
    .click();

  const options = page.getByRole('group', { name: 'Fog of war options' });
  await expect(options).toContainText('visually covers the map');
  await expect(options).toContainText('does not remove the map image');
  await options.getByRole('button', { name: 'Rectangle' }).click();
  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  await page.mouse.move(box.x + 240, box.y + 240);
  await page.mouse.down();
  await page.mouse.move(box.x + 420, box.y + 360);
  await page.mouse.up();
  await options.getByRole('switch', { name: 'Preview as player' }).click();
  await expect(
    options.getByRole('switch', { name: 'Preview as player' })
  ).toHaveAttribute('aria-checked', 'true');

  await expect
    .poll(async () =>
      page.evaluate(
        ({ campaignCode, mapId }) => {
          const raw = window.localStorage.getItem('rollkeeper-battlemap-data');
          const parsed = raw ? JSON.parse(raw) : null;
          const canvasState =
            parsed?.state?.battleMaps?.[campaignCode]?.[mapId]?.canvasState;
          return (
            typeof canvasState === 'string' && canvasState.includes('"fog"')
          );
        },
        { campaignCode: CAMPAIGN_CODE, mapId: BATTLE_MAP_ID }
      )
    )
    .toBe(true);

  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Fog of war' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(
    page.getByRole('switch', { name: 'Preview as player' })
  ).toHaveAttribute('aria-checked', 'false');
});

test('fog controls meet the touch target and a touch brush gesture persists', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'ipad', 'iPad-specific touch acceptance');
  await openSeededMap(page);
  const fogButton = page.getByRole('button', { name: 'Fog of war' });
  const target = await fogButton.boundingBox();
  expect(target?.width).toBeGreaterThanOrEqual(44);
  expect(target?.height).toBeGreaterThanOrEqual(44);
  await fogButton.click();
  await page
    .getByRole('alertdialog', { name: 'Enable fog of war' })
    .getByRole('button', { name: 'Enable covered fog' })
    .click();
  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  await page.touchscreen.tap(box.x + 300, box.y + 300);
  await expect
    .poll(async () =>
      page.evaluate(
        ({ campaignCode, mapId }) => {
          const raw = window.localStorage.getItem('rollkeeper-battlemap-data');
          const parsed = raw ? JSON.parse(raw) : null;
          const canvasState =
            parsed?.state?.battleMaps?.[campaignCode]?.[mapId]?.canvasState;
          return (
            typeof canvasState === 'string' && canvasState.includes('"fog"')
          );
        },
        { campaignCode: CAMPAIGN_CODE, mapId: BATTLE_MAP_ID }
      )
    )
    .toBe(true);
});
