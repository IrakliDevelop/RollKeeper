import { expect, test, type Page } from '@playwright/test';

const CAMPAIGN_CODE = 'FOG-PRESET-E2E';
const BATTLE_MAP_ID = 'preset-map';
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
            dmId: 'dm-fog-preset-e2e',
            campaigns: [
              { code: campaignCode, name: 'Fog Preset E2E', createdAt: now },
            ],
          },
          // dmStore's persist version is 1; a mismatched version here gets
          // silently discarded (no migrate fn), which would wipe the seeded
          // campaign before the fog preset writes it needs.
          version: 1,
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
                  name: 'Fog preset acceptance map',
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

async function enableFog(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Fog of war' }).click();
  await page
    .getByRole('alertdialog', { name: 'Enable fog of war' })
    .getByRole('button', { name: 'Enable covered fog' })
    .click();
}

function storedAppearance(page: Page) {
  return page.evaluate(
    ({ campaignCode, mapId }) => {
      const raw = window.localStorage.getItem('rollkeeper-battlemap-data');
      const parsed = raw ? JSON.parse(raw) : null;
      return (
        parsed?.state?.battleMaps?.[campaignCode]?.[mapId]?.fogAppearance ??
        null
      );
    },
    { campaignCode: CAMPAIGN_CODE, mapId: BATTLE_MAP_ID }
  );
}

function storedPresets(page: Page) {
  return page.evaluate(
    ({ campaignCode }) => {
      const raw = window.localStorage.getItem('rollkeeper-dm-data');
      const parsed = raw ? JSON.parse(raw) : null;
      const campaign = parsed?.state?.campaigns?.find(
        (c: { code: string }) => c.code === campaignCode
      );
      return campaign?.fogPresets ?? null;
    },
    { campaignCode: CAMPAIGN_CODE }
  );
}

test('DM creates, applies, edits, and deletes a preset; the map keeps its snapshot', async ({
  page,
}) => {
  await openSeededMap(page);
  await enableFog(page);
  const options = page.getByRole('group', { name: 'Fog of war options' });
  const select = options.getByRole('combobox', { name: 'Fog appearance' });
  await expect(select).toHaveValue('solid');

  // Create Poison Mist from the editor.
  await options.getByRole('button', { name: 'Customize fog' }).click();
  const editor = page.getByRole('dialog', { name: 'Fog material' });
  await editor.getByRole('switch', { name: 'Noise texture' }).click();
  await editor.getByRole('textbox', { name: 'Fog color' }).fill('#1f3d1f');
  await editor.getByRole('textbox', { name: 'Noise color' }).fill('#9be29b');
  await editor.getByRole('slider', { name: 'Noise amount' }).fill('0.7');
  // Draft preview must not persist.
  expect(await storedAppearance(page)).toBeNull();
  await editor
    .getByRole('textbox', { name: 'Preset name' })
    .fill('Poison Mist');
  await editor.getByRole('button', { name: 'Save as new preset' }).click();
  await expect.poll(() => storedPresets(page)).toHaveLength(1);
  await editor.getByRole('button', { name: 'Apply to map' }).click();
  await expect(editor).toHaveCount(0);

  const applied = await storedAppearance(page);
  expect(applied).toMatchObject({
    v: 2,
    kind: 'custom',
    material: { kind: 'procedural', baseColor: '#1f3d1f' },
  });
  await expect(select).toHaveValue((await storedPresets(page))[0].id);

  // Edit the preset in the library; the map must not change.
  await options.getByRole('button', { name: 'Manage fog presets' }).click();
  const manager = page.getByRole('dialog', { name: 'Fog presets' });
  await manager.getByRole('button', { name: 'Rename Poison Mist' }).click();
  await manager
    .getByRole('textbox', { name: 'New name for Poison Mist' })
    .fill('Toxic Mist');
  await manager.getByRole('button', { name: 'Save name' }).click();
  await expect(manager.getByText('Toxic Mist')).toBeVisible();
  expect(await storedAppearance(page)).toEqual(applied);

  // Delete it; the map keeps its snapshot and shows the orphan label.
  await manager.getByRole('button', { name: 'Delete Toxic Mist' }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Delete fog preset' });
  await expect(confirm).toContainText('keep their current appearance');
  await confirm.getByRole('button', { name: 'Delete preset' }).click();
  await expect.poll(() => storedPresets(page)).toBeNull();
  await page.keyboard.press('Escape');
  await expect(manager).toHaveCount(0);
  expect(await storedAppearance(page)).toEqual(applied);
  await expect(select).toHaveValue('custom');
  await expect(select.locator('option[value="custom"]')).toHaveText(
    'Custom (preset deleted)'
  );

  // Reload keeps the snapshot; legacy Solid still selectable.
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Fog of war' }).click();
  await expect(select).toHaveValue('custom');
  await select.selectOption('solid');
  await expect.poll(() => storedAppearance(page)).toBe('solid');
});

test('Cancel restores the applied appearance without writing', async ({
  page,
}) => {
  await openSeededMap(page);
  await enableFog(page);
  const options = page.getByRole('group', { name: 'Fog of war options' });
  await options
    .getByRole('combobox', { name: 'Fog appearance' })
    .selectOption('cloudy');
  await expect.poll(() => storedAppearance(page)).toBe('cloudy');
  await options.getByRole('button', { name: 'Customize fog' }).click();
  const editor = page.getByRole('dialog', { name: 'Fog material' });
  await editor.getByRole('slider', { name: 'Noise size' }).fill('900');
  await editor.getByRole('button', { name: 'Cancel' }).click();
  await expect(editor).toHaveCount(0);
  expect(await storedAppearance(page)).toBe('cloudy');
});

test('preset controls meet the 44px touch target', async ({ page }) => {
  await openSeededMap(page);
  await enableFog(page);
  const options = page.getByRole('group', { name: 'Fog of war options' });
  for (const name of ['Customize fog', 'Manage fog presets']) {
    const box = await options.getByRole('button', { name }).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  const selectBox = await options
    .getByRole('combobox', { name: 'Fog appearance' })
    .boundingBox();
  expect(selectBox?.height ?? 0).toBeGreaterThanOrEqual(44);
});
