import { expect, test, type Page, type Route } from '@playwright/test';

import { guardTableContext } from './tableContext';

/**
 * PR06 unified Table workspace on the real canvas (dev server, IndexedDB,
 * scripted control API — no relay in this config): the old per-scene URL
 * redirects; scenes are created/added and browsed privately; ≥10 switches
 * use ONE control session (one acquire, one register per scene) with a
 * single display-status poll; the map image is placed exactly once;
 * back/forward/reload restore the selection; 390 px fits; image uploads are
 * route-fulfilled (R3-F2/C6-3) and every refusal creates no scene.
 */

const CAMPAIGN = {
  code: 'E2EWORK',
  name: 'Workspace E2E',
  createdAt: '2026-10-08T00:00:00.000Z',
};
const MAP = {
  id: 'map-tavern',
  campaignCode: CAMPAIGN.code,
  name: 'Tavern',
  mapImageUrl: '/e2e-fixture/tavern.png',
  mapImageSize: { w: 1200, h: 800 },
  // Never opened in the legacy editor (W9).
  canvasState: '',
  dmOnlyElements: {},
  gridEnabled: false,
  linkedEncounterIds: [],
  markers: [],
  createdAt: '2026-10-08T00:00:00.000Z',
  updatedAt: '2026-10-08T00:00:00.000Z',
};
const EPOCH = '10000000-0000-4000-8000-000000000001';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

type Command = Record<string, unknown> & { type: string };

function controlServer() {
  const state = {
    revision: 0,
    writerFence: 0,
    holderSessionId: null as string | null,
    leaseUntil: 0,
    initialized: false,
  };
  const registry: Array<Record<string, unknown>> = [];
  const commands: Command[] = [];
  const reads: number[] = [];
  const displayReads: number[] = [];
  const descriptor = () => ({
    epoch: EPOCH,
    revision: state.revision,
    writerFence: state.writerFence,
    leaseUntil: state.leaseUntil,
    holderSessionId: state.holderSessionId,
    presentation: { sceneId: null, revision: 0, blanked: false },
    publicRunId: null,
  });
  const json = (route: Route, status: number, body: unknown) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  const control = async (route: Route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      reads.push(Date.now());
      return json(route, 200, {
        current: state.initialized ? descriptor() : null,
        registry,
      });
    }
    const command = (request.postDataJSON() as { command: Command }).command;
    commands.push(command);
    switch (command.type) {
      case 'initialize':
        state.initialized = true;
        break;
      case 'acquire':
        state.writerFence += 1;
        state.holderSessionId = String(command.holderSessionId);
        state.leaseUntil = Date.now() + 30_000;
        break;
      case 'renew':
        state.leaseUntil = Date.now() + 30_000;
        break;
      case 'registerScene':
        registry.push({
          v: 1,
          sceneId: command.sceneId,
          workspaceInstanceId: command.workspaceInstanceId,
          sourceMapId: command.sourceMapId,
          safeLabel: command.safeLabel,
          registryRevision: 1,
          deleted: false,
        });
        break;
      default:
        break;
    }
    state.revision += 1;
    return json(route, 200, {
      status: 'committed',
      reason: 'current',
      current: descriptor(),
    });
  };
  const display = (route: Route) => {
    displayReads.push(Date.now());
    return json(route, 200, { state: 'none', sceneId: null, ageMs: null });
  };
  const of = (type: string) => commands.filter(item => item.type === type);
  return { commands, reads, displayReads, control, display, of };
}

async function seed(page: Page, server: ReturnType<typeof controlServer>) {
  const code = CAMPAIGN.code;
  await page.route(`**/api/campaign/${code}/players`, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ campaign: { code }, players: [] }),
    })
  );
  await page.route(`**/api/campaign/${code}/table/control*`, server.control);
  await page.route(
    `**/api/campaign/${code}/table/display/status*`,
    server.display
  );
  await page.route(
    `**/api/campaign/${code}/table/authority/initialize-if-empty`,
    route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{"status":"provisioned"}',
      })
  );
  await page.route('**/e2e-fixture/**', route =>
    route.fulfill({ status: 200, contentType: 'image/png', body: PNG })
  );
}

async function newContext(browser: import('@playwright/test').Browser) {
  const context = await browser.newContext();
  await context.addInitScript(
    ({ campaign, map }) => {
      if (localStorage.getItem('rollkeeper-dm-data')) return;
      localStorage.setItem(
        'rollkeeper-dm-data',
        JSON.stringify({
          state: { dmId: 'dm-workspace', campaigns: [campaign] },
          version: 1,
        })
      );
      localStorage.setItem(
        'rollkeeper-battlemap-data',
        JSON.stringify({
          state: { battleMaps: { [campaign.code]: { [map.id]: map } } },
          version: 0,
        })
      );
    },
    { campaign: CAMPAIGN, map: MAP }
  );
  return context;
}

const sceneList = (page: Page) =>
  page.getByRole('list', { name: 'Scenes in this workspace' });

async function selected(page: Page, name: string) {
  await expect(
    sceneList(page).getByRole('button', { name: new RegExp(name, 'u') })
  ).toHaveAttribute('aria-current', 'true');
  await expect(page.getByText('Switching scene…')).toHaveCount(0);
  await expect(page.getByTestId('dm-vtt-command-dock')).toBeVisible();
}

const sceneParam = (page: Page) =>
  new URL(page.url()).searchParams.get('scene');

/** Map-layer images and token ids on the live canvas (dev-only handle). */
function canvasCensus(page: Page) {
  return page.evaluate(() => {
    const viewport = (
      window as unknown as {
        __rkStores?: {
          viewport?: {
            store: {
              getAll(): Array<{
                id: string;
                type: string;
                layerId?: string;
                src?: string;
              }>;
            };
          };
        };
      }
    ).__rkStores?.viewport;
    const all = viewport?.store.getAll() ?? [];
    return {
      mapImages: all
        .filter(item => item.type === 'image' && item.layerId === 'layer-map')
        .map(item => item.src ?? ''),
      ids: all.map(item => item.id),
    };
  });
}

async function createScene(
  page: Page,
  name: string,
  file?: { name: string; mimeType: string; buffer: Buffer }
) {
  await page.getByRole('button', { name: 'New scene' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Scene name').fill(name);
  if (file) {
    await dialog.getByRole('button', { name: 'Image', exact: true }).click();
    await dialog.getByLabel('Map image file').setInputFiles(file);
  }
  await dialog.getByRole('button', { name: 'Create scene' }).click();
  return dialog;
}

test('workspace: one session across 10+ private switches, redirect, history and 390 px', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const context = await newContext(browser);
  const contextErrors = await guardTableContext(context);
  const page = await context.newPage();
  const server = controlServer();
  await seed(page, server);

  await page.goto(`/dm/campaign/${CAMPAIGN.code}/table?panel=scenes`);
  await expect(page.getByRole('region', { name: 'Scenes' })).toBeVisible();
  await expect(page.getByText('Live control held.')).toBeVisible();

  // Add a never-opened battle map locally, then create a blank scene.
  await page.getByRole('button', { name: 'Add Tavern' }).click();
  await selected(page, 'Tavern');
  const tavernId = sceneParam(page)!;
  await expect
    .poll(async () => (await canvasCensus(page)).mapImages.length)
    .toBe(1);
  await createScene(page, 'Forest');
  await selected(page, 'Forest');
  const forestId = sceneParam(page)!;
  expect(forestId).not.toBe(tavernId);
  await expect.poll(() => server.of('registerScene').length).toBe(2);

  // ≥10 private switches through the browser.
  const switchStart = Date.now();
  for (let index = 0; index < 12; index += 1) {
    const name = index % 2 === 0 ? 'Tavern' : 'Forest';
    await sceneList(page)
      .getByRole('button', { name: new RegExp(name, 'u') })
      .click();
    await selected(page, name);
  }
  const switchEnd = Date.now();
  const census = await canvasCensus(page);
  expect(census.mapImages).toHaveLength(0); // Forest is blank
  expect(new Set(census.ids).size).toBe(census.ids.length);

  expect(server.of('acquire')).toHaveLength(1);
  expect(server.of('registerScene').map(command => command.sceneId)).toEqual([
    tavernId,
    forestId,
  ]);
  expect(
    server.commands.filter(command =>
      ['show', 'blank', 'unpresent', 'deletePresented'].includes(command.type)
    )
  ).toEqual([]);
  // One display-status poll per page: ≤ 1 read per 5 s window (+1 for a
  // refresh racing a tick).
  const during = server.displayReads.filter(
    time => time >= switchStart && time <= switchEnd
  );
  for (const start of during) {
    expect(
      during.filter(time => time >= start && time < start + 5_000).length
    ).toBeLessThanOrEqual(2);
  }

  // Back/Forward restore the selection; reload keeps it.
  await sceneList(page)
    .getByRole('button', { name: /Tavern/u })
    .click();
  await selected(page, 'Tavern');
  await page.goBack();
  await selected(page, 'Forest');
  await page.goForward();
  await selected(page, 'Tavern');
  await page.reload();
  await page.getByRole('button', { name: 'Scenes', exact: true }).click();
  await selected(page, 'Tavern');
  await expect
    .poll(async () => (await canvasCensus(page)).mapImages.length)
    .toBe(1);

  // The PR01–PR05 per-scene URL redirects into the workspace.
  await page.goto(
    `/dm/campaign/${CAMPAIGN.code}/table/${forestId}?run=missing-run`
  );
  await expect
    .poll(() => new URL(page.url()).pathname)
    .toBe(`/dm/campaign/${CAMPAIGN.code}/table`);
  expect(sceneParam(page)).toBe(forestId);
  await expect
    .poll(() => new URL(page.url()).searchParams.get('run'))
    .toBe(null);
  await page.getByRole('button', { name: 'Scenes', exact: true }).click();
  await selected(page, 'Forest');

  // An unknown scene shows the neutral notice and no other data.
  await page.goto(`/dm/campaign/${CAMPAIGN.code}/table?scene=nowhere`);
  await expect(
    page.getByText('That scene is not available in this workspace')
  ).toBeVisible();

  // 390 px: the Scenes panel and its controls fit without overflow.
  await page.goto(`/dm/campaign/${CAMPAIGN.code}/table?scene=${tavernId}`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Scenes', exact: true }).click();
  await selected(page, 'Tavern');
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth
    )
  ).toBe(true);
  for (const control of [
    page.getByRole('region', { name: 'Scenes' }),
    page.getByRole('button', { name: 'New scene' }),
    sceneList(page).getByRole('button', { name: /Tavern/u }),
    page.getByRole('button', { name: 'Scenes', exact: true }),
  ]) {
    const box = (await control.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
  }
  // Escape closes the panel; the canvas and selection stay.
  await sceneList(page)
    .getByRole('button', { name: /Tavern/u })
    .focus();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'Scenes' })).toHaveCount(0);
  expect(sceneParam(page)).toBe(tavernId);
  expect(contextErrors).toEqual([]);
  await context.close();
});

test('FU-4: at most one /players read per scene switch (no active run)', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const context = await newContext(browser);
  const contextErrors = await guardTableContext(context);
  const page = await context.newPage();
  const server = controlServer();
  await seed(page, server);
  const playerReads: number[] = [];
  page.on('request', request => {
    if (
      request.method() === 'GET' &&
      new URL(request.url()).pathname ===
        `/api/campaign/${CAMPAIGN.code}/players`
    )
      playerReads.push(Date.now());
  });

  await page.goto(`/dm/campaign/${CAMPAIGN.code}/table?panel=scenes`);
  await expect(page.getByText('Live control held.')).toBeVisible();
  await page.getByRole('button', { name: 'Add Tavern' }).click();
  await selected(page, 'Tavern');
  await createScene(page, 'Forest');
  await selected(page, 'Forest');

  /** Reads until no new /players request for 1.5 s. */
  const settledReads = async () => {
    let last = -1;
    for (;;) {
      const count = playerReads.length;
      if (count === last) return count;
      last = count;
      await page.waitForTimeout(1_500);
    }
  };
  await settledReads();
  const perSwitch: number[] = [];
  // 12 switches; two of them after > 10 s idle (past the freshness window).
  for (let index = 0; index < 12; index += 1) {
    if (index === 4 || index === 9) await page.waitForTimeout(10_500);
    const name = index % 2 === 0 ? 'Tavern' : 'Forest';
    const before = playerReads.length;
    await sceneList(page)
      .getByRole('button', { name: new RegExp(name, 'u') })
      .click();
    await selected(page, name);
    perSwitch.push((await settledReads()) - before);
  }
  console.log(`FU-4 /players reads per switch: ${JSON.stringify(perSwitch)}`);
  expect(perSwitch.every(count => count <= 1)).toBe(true);
  expect(server.of('acquire')).toHaveLength(1);
  expect(contextErrors).toEqual([]);
  await context.close();
});

test('create scene: uploaded image placed once; refusals create no scene', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const context = await newContext(browser);
  const contextErrors = await guardTableContext(context);
  const page = await context.newPage();
  const server = controlServer();
  await seed(page, server);
  let uploadMode: 'ok' | 'unconfigured' = 'ok';
  const S3_URL =
    'https://e2e-bucket.s3.us-east-1.amazonaws.com/maps/cellar.png';
  await page.route('**/api/assets/upload', route =>
    uploadMode === 'ok'
      ? route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            uploadUrl: 'https://upload.e2e.test/put',
            url: S3_URL,
          }),
        })
      : route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Asset uploads are not configured' }),
        })
  );
  await page.route('https://upload.e2e.test/**', route =>
    route.fulfill({ status: 200, body: '' })
  );
  // C6-3: S3-shaped URLs are loaded through the same-origin proxy.
  await page.route('**/api/assets/proxy**', route =>
    route.fulfill({ status: 200, contentType: 'image/png', body: PNG })
  );

  await page.goto(`/dm/campaign/${CAMPAIGN.code}/table?panel=scenes`);
  await expect(page.getByText('Live control held.')).toBeVisible();
  const items = () => sceneList(page).getByRole('listitem');

  const refusals: Array<{
    file: { name: string; mimeType: string; buffer: Buffer };
    mode: 'ok' | 'unconfigured';
    message: string;
  }> = [
    {
      file: {
        name: 'clip.mp4',
        mimeType: 'video/mp4',
        buffer: Buffer.from('v'),
      },
      mode: 'ok',
      message: 'Choose a PNG, JPEG, WebP or GIF image',
    },
    {
      file: {
        name: 'map.svg',
        mimeType: 'image/svg+xml',
        buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
      },
      mode: 'ok',
      message: 'Choose a PNG, JPEG, WebP or GIF image',
    },
    {
      file: {
        name: 'broken.png',
        mimeType: 'image/png',
        buffer: Buffer.from('not an image'),
      },
      mode: 'ok',
      message: 'This image could not be read',
    },
    {
      file: { name: 'cellar.png', mimeType: 'image/png', buffer: PNG },
      mode: 'unconfigured',
      message: 'Upload failed: Asset uploads are not configured',
    },
  ];
  for (const refusal of refusals) {
    uploadMode = refusal.mode;
    const dialog = await createScene(page, 'Refused', refusal.file);
    await expect(dialog.getByRole('alert')).toHaveText(refusal.message);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(items()).toHaveCount(0);
  }

  uploadMode = 'ok';
  await createScene(page, 'Cellar', {
    name: 'cellar.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await selected(page, 'Cellar');
  await expect(items()).toHaveCount(1);
  await expect
    .poll(async () => (await canvasCensus(page)).mapImages)
    .toEqual([`/api/assets/proxy?url=${encodeURIComponent(S3_URL)}`]);
  // Creating and selecting never presented anything.
  expect(
    server.commands.filter(command =>
      ['show', 'blank', 'unpresent', 'deletePresented'].includes(command.type)
    )
  ).toEqual([]);
  expect(contextErrors).toEqual([]);
  await context.close();
});

/** Inside the viewport and not cut off by any scrolling/clipping ancestor. */
async function expectUnclipped(locator: import('@playwright/test').Locator) {
  await expect(locator).toBeVisible();
  const problem = await locator.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const slack = 1;
    if (
      rect.left < -slack ||
      rect.top < -slack ||
      rect.right > window.innerWidth + slack ||
      rect.bottom > window.innerHeight + slack
    )
      return `outside viewport ${JSON.stringify(rect)}`;
    for (
      let parent = element.parentElement;
      parent;
      parent = parent.parentElement
    ) {
      const style = getComputedStyle(parent);
      if (style.overflowX === 'visible' && style.overflowY === 'visible')
        continue;
      const box = parent.getBoundingClientRect();
      if (
        rect.left < box.left - slack ||
        rect.top < box.top - slack ||
        rect.right > box.right + slack ||
        rect.bottom > box.bottom + slack
      )
        return `clipped by ${parent.tagName}.${parent.className}`;
    }
    return null;
  });
  expect(problem).toBeNull();
}

test('Edit map tools are reachable and unclipped at 1280, 2048 and 390 px', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const context = await newContext(browser);
  const contextErrors = await guardTableContext(context);
  const page = await context.newPage();
  const server = controlServer();
  await seed(page, server);
  await page.setViewportSize({ width: 2048, height: 1103 });
  await page.goto(`/dm/campaign/${CAMPAIGN.code}/table?panel=scenes`);
  await expect(page.getByText('Live control held.')).toBeVisible();
  await page.getByRole('button', { name: 'Add Tavern' }).click();
  await selected(page, 'Tavern');
  await page.getByRole('button', { name: 'Close scenes' }).click();

  for (const size of [
    { width: 2048, height: 1103 },
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    const toggle = page.getByRole('button', { name: 'Edit map' });
    await expectUnclipped(toggle);
    if ((await toggle.getAttribute('aria-expanded')) !== 'true')
      await toggle.click();
    const panel = page.getByRole('group', { name: 'Edit map' });
    await expectUnclipped(panel);
    await expectUnclipped(
      panel.getByRole('button', { name: /(Set|Replace) map image/u })
    );
    await expectUnclipped(panel.getByRole('button', { name: 'Fit to map' }));
    const grid = panel.getByRole('button', { name: /Grid:/u });
    await expectUnclipped(grid);
    if ((await grid.getAttribute('aria-expanded')) !== 'true')
      await grid.click();
    await expectUnclipped(page.getByTitle('Square grid'));
    await page.getByTitle('Square grid').click();
    for (const title of ['No grid', 'Hex grid', 'Square grid'])
      await expectUnclipped(page.getByTitle(title));
    for (const title of ['Grid cell size', 'Grid opacity', 'Grid color'])
      await expectUnclipped(page.getByTitle(title));
    // Close both popovers before the next size.
    await page.keyboard.press('Escape');
    await toggle.click();
    await expect(panel).toHaveCount(0);
  }
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth
    )
  ).toBe(true);
  expect(contextErrors).toEqual([]);
  await context.close();
});

test('FU-5: compact header leaves the canvas ≥ 50% of 390×844, nothing clipped (light and dark)', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const context = await newContext(browser);
  const contextErrors = await guardTableContext(context);
  const page = await context.newPage();
  const server = controlServer();
  await seed(page, server);
  await page.goto(`/dm/campaign/${CAMPAIGN.code}/table?panel=scenes`);
  await expect(page.getByText('Live control held.')).toBeVisible();
  await page.getByRole('button', { name: 'Add Tavern' }).click();
  await selected(page, 'Tavern');
  const tavernId = sceneParam(page)!;

  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate(value => {
      localStorage.setItem('rollkeeper-theme', value);
    }, theme);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/dm/campaign/${CAMPAIGN.code}/table?scene=${tavernId}`);
    if (theme === 'dark')
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    else
      await expect(page.locator('html')).not.toHaveAttribute(
        'data-theme',
        'dark'
      );
    const dock = page.getByTestId('dm-vtt-command-dock');
    await expect(dock).toBeVisible();
    await expect(page.getByText('Switching scene…')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Scenes' })).toHaveCount(0);
    // Measured state: live control held, scene selected, no notices.
    await expect(page.getByText('Live control held.')).toBeAttached();
    await expect(dock.locator('[role="alert"]')).toHaveCount(0);
    const dockBox = (await dock.boundingBox())!;
    const canvasBox = (await page.locator('canvas').first().boundingBox())!;
    const visible =
      Math.min(canvasBox.y + canvasBox.height, 844) -
      Math.max(canvasBox.y, dockBox.y + dockBox.height);
    console.log(
      `FU-5 ${theme}: dock ${Math.round(dockBox.height)}px, canvas visible ${Math.round(visible)}px`
    );
    expect(visible).toBeGreaterThanOrEqual(844 / 2);
    for (const name of ['Scenes', 'Edit map', 'Back to campaign', 'Details'])
      await expectUnclipped(
        page.getByRole('button', { name: new RegExp(`^${name}`, 'u') }).first()
      );
    // Every visible header control (the toolbar strip below scrolls by
    // design and is covered by the Edit map reachability test).
    const header = dock.locator(':scope > div').first();
    for (const control of await header.locator('button, a[href], select').all())
      if (await control.isVisible()) await expectUnclipped(control);
    const details = page.getByRole('button', { name: /^Details/u });
    await details.click();
    await expect(details).toHaveAttribute('aria-expanded', 'true');
    await expectUnclipped(
      page.getByRole('button', { name: 'Save checkpoint' })
    );
    await details.click();
  }
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth
    )
  ).toBe(true);
  expect(contextErrors).toEqual([]);
  await context.close();
});
