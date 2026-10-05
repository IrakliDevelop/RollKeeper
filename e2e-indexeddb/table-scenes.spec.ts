import { expect, test } from '@playwright/test';

const CAMPAIGN = {
  code: 'E2ETABLE',
  name: 'Table E2E',
  createdAt: '2026-10-05T00:00:00.000Z',
};
const MAP = {
  id: 'map-e2e',
  campaignCode: CAMPAIGN.code,
  name: 'Synthetic Map',
  mapImageUrl: '/synthetic-map.webp',
  mapImageSize: { w: 1200, h: 800 },
  canvasState:
    '{"elements":[{"id":"token-e2e","type":"token","layerId":"tokens-e2e"}],"layers":[{"id":"tokens-e2e"}]}',
  dmOnlyElements: { 'token-e2e': true },
  gridEnabled: false,
  linkedEncounterIds: [],
  markers: [],
  createdAt: '2026-10-05T00:00:00.000Z',
  updatedAt: '2026-10-05T00:00:00.000Z',
};

const CAMPAIGN_RAW =
  '{ "name" : "Table \\u00c9E2E", "code" : "E2ETABLE", "createdAt" : "2026-10-05T00:00:00.000Z" }';
const MAP_RAW =
  '{ "name" : "Synthetic \\u004dap", "id" : "map-e2e", "campaignCode" : "E2ETABLE", "mapImageUrl" : "/synthetic-map.webp", "mapImageSize" : {"h":800,"w":1200}, "canvasState" : "{\\"version\\":4,\\"camera\\":{\\"position\\":{\\"x\\":0,\\"y\\":0},\\"zoom\\":1},\\"elements\\":[{\\"id\\":\\"token-e2e\\",\\"type\\":\\"token\\",\\"layerId\\":\\"tokens-e2e\\"}],\\"layers\\":[{\\"id\\":\\"tokens-e2e\\",\\"name\\":\\"Tokens\\",\\"visible\\":true,\\"locked\\":false,\\"order\\":0,\\"opacity\\":1}],\\"activeLayerId\\":\\"tokens-e2e\\",\\"extensions\\":{\\"fog\\":{\\"version\\":1,\\"data\\":null}}}", "dmOnlyElements" : {"token-e2e":true}, "gridEnabled" : false, "linkedEncounterIds" : [], "markers" : [], "createdAt" : "2026-10-05T00:00:00.000Z", "updatedAt" : "2026-10-05T00:00:00.000Z" }';

test('visible Table adoption is isolated, reloadable and bundle-imports as a fork', async ({
  browser,
}) => {
  const context = await browser.newContext({ acceptDownloads: true });
  await context.addInitScript(
    ({ campaignRaw, mapRaw }) => {
      localStorage.setItem(
        'rollkeeper-dm-data',
        `{ "state" : { "campaigns" : [ ${campaignRaw} ], "dmId" : "dm-table-e2e" }, "version" : 1 }`
      );
      localStorage.setItem(
        'rollkeeper-battlemap-data',
        `{ "version" : 0, "state" : { "battleMaps" : { "E2ETABLE" : { "map-e2e" : ${mapRaw} } } } }`
      );
      localStorage.setItem(
        'rollkeeper-encounter-data',
        JSON.stringify({
          state: {
            encounters: [],
            encounterTombstones: {},
            activeEncounterId: null,
          },
          version: 2,
        })
      );
    },
    { campaignRaw: CAMPAIGN_RAW, mapRaw: MAP_RAW }
  );
  const page = await context.newPage();
  await page.goto(`/dm/campaign/${CAMPAIGN.code}/battlemaps`);
  await expect(
    page.getByRole('heading', { name: 'Table scenes' })
  ).toBeVisible();

  const sourceBefore = await page.evaluate(() =>
    localStorage.getItem('rollkeeper-battlemap-data')
  );
  await page.getByRole('button', { name: 'Adopt Synthetic Map' }).click();
  await expect(page.getByText(/scene adopted/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open scene' })).toBeVisible();

  const stored = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('rollkeeper-table', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(
      ['campaigns', 'scenes', 'sources'],
      'readonly'
    );
    const getAll = (store: string) =>
      new Promise<unknown[]>((resolve, reject) => {
        const request = transaction.objectStore(store).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    const [campaigns, scenes, sources] = await Promise.all([
      getAll('campaigns'),
      getAll('scenes'),
      getAll('sources'),
    ]);
    database.close();
    return { campaigns, scenes, sources };
  });
  expect(stored.campaigns).toHaveLength(1);
  expect(stored.scenes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        originalMapId: MAP.id,
        canvasCheckpoint: expect.objectContaining({
          state: expect.objectContaining({
            elements: [expect.objectContaining({ id: 'token-e2e' })],
            layers: [expect.objectContaining({ id: 'tokens-e2e' })],
          }),
        }),
      }),
    ])
  );
  expect(stored.sources).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ rawJson: MAP_RAW }),
      expect.objectContaining({ rawJson: CAMPAIGN_RAW }),
    ])
  );
  expect(
    await page.evaluate(() => localStorage.getItem('rollkeeper-battlemap-data'))
  ).toBe(sourceBefore);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Table' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  await page.locator('input[type=file][accept*="json"]').setInputFiles(path!);
  await expect(
    page.getByText(/imported into a new local workspace/i)
  ).toBeVisible();
  await page.getByRole('link', { name: 'Open imported workspace' }).click();
  await expect(
    page.getByText(/Imported Table workspace selected/i)
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open scene' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Open scene' })).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem('rollkeeper-battlemap-data'))
  ).toBe(sourceBefore);
  await context.close();
});

test('quota abort leaves adoption unpublished and the legacy source unchanged', async ({
  browser,
}) => {
  const context = await browser.newContext();
  await context.addInitScript(
    ({ campaign, map }) => {
      localStorage.setItem(
        'rollkeeper-dm-data',
        JSON.stringify({
          state: { dmId: 'dm-quota', campaigns: [campaign] },
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
  const page = await context.newPage();
  await page.goto(`/dm/campaign/${CAMPAIGN.code}/battlemaps`);
  await expect(
    page.getByRole('button', { name: 'Adopt Synthetic Map' })
  ).toBeEnabled();
  const sourceBefore = await page.evaluate(() =>
    localStorage.getItem('rollkeeper-battlemap-data')
  );
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (
        args[0] &&
        typeof args[0] === 'object' &&
        'workspaceKey' in (args[0] as object)
      ) {
        throw new DOMException('Injected quota', 'QuotaExceededError');
      }
      return original.apply(this, args as Parameters<IDBObjectStore['put']>);
    };
  });
  await page.getByRole('button', { name: 'Adopt Synthetic Map' }).click();
  await expect(page.getByText(/Adoption did not complete/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open scene' })).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem('rollkeeper-battlemap-data'))
  ).toBe(sourceBefore);
  const sceneCount = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('rollkeeper-table', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Promise<number>((resolve, reject) => {
      const request = database
        .transaction('scenes')
        .objectStore('scenes')
        .count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
  expect(sceneCount).toBe(0);
  await context.close();
});

test('unavailable IndexedDB disables Table while the original map remains usable', async ({
  browser,
}) => {
  const context = await browser.newContext();
  await context.addInitScript(
    ({ campaign, map }) => {
      localStorage.setItem(
        'rollkeeper-dm-data',
        JSON.stringify({
          state: { dmId: 'dm-unavailable', campaigns: [campaign] },
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
      Object.defineProperty(window, 'indexedDB', {
        configurable: true,
        value: undefined,
      });
    },
    { campaign: CAMPAIGN, map: MAP }
  );
  const page = await context.newPage();
  await page.goto(`/dm/campaign/${CAMPAIGN.code}/battlemaps`);
  await expect(page.getByText('IndexedDB is unavailable')).toBeVisible();
  await expect(page.getByText('Synthetic Map').first()).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Adopt Synthetic Map' })
  ).toBeDisabled();
  await context.close();
});

test('Table namespaces are isolated between browser profiles', async ({
  browser,
}) => {
  const seed = ({
    campaign,
    map,
  }: {
    campaign: typeof CAMPAIGN;
    map: typeof MAP;
  }) => {
    localStorage.setItem(
      'rollkeeper-dm-data',
      JSON.stringify({
        state: { dmId: 'dm-profile', campaigns: [campaign] },
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
  };
  const firstProfile = await browser.newContext();
  await firstProfile.addInitScript(seed, { campaign: CAMPAIGN, map: MAP });
  const firstPage = await firstProfile.newPage();
  await firstPage.goto(`/dm/campaign/${CAMPAIGN.code}/battlemaps`);
  await firstPage.getByRole('button', { name: 'Adopt Synthetic Map' }).click();
  await expect(
    firstPage.getByRole('button', { name: 'Open scene' })
  ).toBeVisible();

  const secondProfile = await browser.newContext();
  await secondProfile.addInitScript(seed, { campaign: CAMPAIGN, map: MAP });
  const secondPage = await secondProfile.newPage();
  await secondPage.goto(`/dm/campaign/${CAMPAIGN.code}/battlemaps`);
  await expect(
    secondPage.getByRole('button', { name: 'Open scene' })
  ).toHaveCount(0);
  await expect(
    secondPage.getByRole('button', { name: 'Adopt Synthetic Map' })
  ).toBeEnabled();

  await firstProfile.close();
  await secondProfile.close();
});

test('guarded recovery UI retains the offline draft and only one simultaneous API restore wins', async ({
  browser,
}) => {
  const context = await browser.newContext();
  await context.addInitScript(
    ({ campaign, map }) => {
      localStorage.setItem(
        'rollkeeper-dm-data',
        JSON.stringify({
          state: { dmId: 'dm-recovery', campaigns: [campaign] },
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
  const left = await context.newPage();
  await left.goto(`/dm/campaign/${CAMPAIGN.code}/battlemaps`);
  await left.getByRole('button', { name: 'Adopt Synthetic Map' }).click();
  await expect(left.getByRole('button', { name: 'Open scene' })).toBeVisible();

  const recoverySeed = await left.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('rollkeeper-table', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(
      ['campaigns', 'scenes'],
      'readwrite'
    );
    const campaign = await new Promise<Record<string, unknown>>(
      (resolve, reject) => {
        const request = transaction.objectStore('campaigns').getAll();
        request.onsuccess = () => resolve(request.result[0]);
        request.onerror = () => reject(request.error);
      }
    );
    const scene = await new Promise<Record<string, unknown>>(
      (resolve, reject) => {
        const request = transaction.objectStore('scenes').getAll();
        request.onsuccess = () => resolve(request.result[0]);
        request.onerror = () => reject(request.error);
      }
    );
    const revision = Number(campaign.revision);
    const localDraft = {
      protocolVersion: 1,
      generation: 'offline-fork',
      revision: 1,
      capturedAt: '2026-10-05T06:00:00.000Z',
      state: {
        version: 4,
        camera: { position: { x: 0, y: 0 }, zoom: 1 },
        elements: [
          {
            id: 'offline-retained',
            type: 'shape',
            position: { x: 10, y: 10 },
            zIndex: 1,
            locked: false,
            layerId: 'default-layer',
            shape: 'rectangle',
            size: { w: 20, h: 20 },
            fillColor: '#ff0000',
            strokeColor: '#000000',
            strokeWidth: 1,
          },
        ],
        layers: [
          {
            id: 'default-layer',
            name: 'Annotations',
            visible: true,
            locked: false,
            order: 0,
            opacity: 1,
          },
        ],
        activeLayerId: 'default-layer',
        extensions: { fog: { version: 1, data: null } },
      },
    };
    transaction.objectStore('scenes').put({ ...scene, localDraft });
    transaction
      .objectStore('campaigns')
      .put({ ...campaign, revision: revision + 1 });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
    return {
      workspaceKey: String(campaign.workspaceKey),
      sceneId: String(scene.sceneId),
      expectedRevision: revision + 1,
    };
  });
  let controlRevision = 10;
  let restoreWon = false;
  const control = () => ({
    epoch: '10000000-0000-4000-8000-000000000001',
    revision: controlRevision,
    writerFence: 1,
    leaseUntil: Date.now() + 30_000,
    holderSessionId: null,
    presentation: {
      sceneId: recoverySeed.sceneId,
      revision: 1,
      blanked: false,
    },
    publicRunId: null,
  });
  const installAuthorityApi = async (page: typeof left) => {
    await page.route('**/api/campaign/E2ETABLE/table/control*', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            current: control(),
            registry: [
              {
                v: 1,
                sceneId: recoverySeed.sceneId,
                workspaceInstanceId:
                  recoverySeed.workspaceKey.split('workspace:')[1],
                sourceMapId: MAP.id,
                registryRevision: 1,
                deleted: false,
              },
            ],
          }),
        });
        return;
      }
      controlRevision += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'committed', current: control() }),
      });
    });
    await page.route(
      '**/api/campaign/E2ETABLE/table/authority/checkpoint',
      route =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            generation: 'current-generation',
            casToken: 'current-cas',
          }),
        })
    );
    await page.route(
      '**/api/campaign/E2ETABLE/table/authority/initialize-if-empty',
      async route => {
        const body = route.request().postDataJSON() as {
          expectedGeneration: string | null;
        };
        if (body.expectedGeneration === null) {
          await route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Authority already initialized' }),
          });
          return;
        }
        if (restoreWon) {
          await route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Authority state changed' }),
          });
          return;
        }
        restoreWon = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'provisioned' }),
        });
      }
    );
  };

  const right = await context.newPage();
  await Promise.all([installAuthorityApi(left), installAuthorityApi(right)]);
  const sceneUrl = `/dm/campaign/${CAMPAIGN.code}/table/${recoverySeed.sceneId}`;
  await Promise.all([left.goto(sceneUrl), right.goto(sceneUrl)]);
  const leftRestore = left.getByRole('button', { name: 'Reapply local draft' });
  const rightRestore = right.getByRole('button', {
    name: 'Reapply local draft',
  });
  await expect(leftRestore).toBeVisible();
  await expect(rightRestore).toBeVisible();
  await Promise.all([leftRestore.click(), rightRestore.click()]);
  await expect
    .poll(async () => {
      const messages = [
        await left.locator('body').innerText(),
        await right.locator('body').innerText(),
      ];
      return {
        restored: messages.filter(value =>
          value.includes('Local draft restored to live authority.')
        ).length,
        conflict: messages.filter(value =>
          value.includes('was not restored because live authority changed')
        ).length,
      };
    })
    .toEqual({ restored: 1, conflict: 1 });

  const retained = await left.evaluate(async input => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('rollkeeper-table', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const request = database
        .transaction('scenes')
        .objectStore('scenes')
        .get([input.workspaceKey, input.sceneId]);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }, recoverySeed);
  expect(retained).toMatchObject({
    localDraft: { state: { elements: [{ id: 'offline-retained' }] } },
  });
  await context.close();
});
