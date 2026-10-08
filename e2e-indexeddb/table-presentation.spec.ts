import { expect, test, type Page, type Route } from '@playwright/test';

import { guardTableContext } from './tableContext';

/**
 * PR04 presentation UI on the real Table page (dev server, IndexedDB scene
 * workspace) against a scripted control API: private preparation never
 * shows, Show/Blank/Reveal/Stop showing report Published only after the
 * server commits, a 409 and a lost response are explained truthfully (Retry
 * re-sends the identical command), and the controls fit a 390 px viewport.
 */

const CAMPAIGN = {
  code: 'E2EPRESENT',
  name: 'Presentation E2E',
  createdAt: '2026-10-07T00:00:00.000Z',
};
const MAP = {
  id: 'map-present',
  campaignCode: CAMPAIGN.code,
  name: 'Tavern Map',
  mapImageUrl: '/synthetic-map.webp',
  mapImageSize: { w: 1200, h: 800 },
  canvasState:
    '{"version":4,"camera":{"position":{"x":0,"y":0},"zoom":1},"elements":[],"layers":[],"extensions":{"fog":{"version":1,"data":null}}}',
  dmOnlyElements: {},
  gridEnabled: false,
  linkedEncounterIds: [],
  markers: [],
  createdAt: '2026-10-07T00:00:00.000Z',
  updatedAt: '2026-10-07T00:00:00.000Z',
};
const EPOCH = '10000000-0000-4000-8000-000000000001';

type Command = Record<string, unknown> & { type: string };

/** A minimal stateful control service with scriptable one-shot faults. */
function controlServer() {
  const state = {
    revision: 0,
    writerFence: 0,
    holderSessionId: null as string | null,
    leaseUntil: 0,
    presentation: {
      sceneId: null as string | null,
      revision: 0,
      blanked: false,
    },
    initialized: false,
  };
  const registry: Array<Record<string, unknown>> = [];
  const ledger = new Map<string, string>();
  const commands: Command[] = [];
  const faults: Array<'conflict' | 'drop'> = [];
  const descriptor = () => ({
    epoch: EPOCH,
    revision: state.revision,
    writerFence: state.writerFence,
    leaseUntil: state.leaseUntil,
    holderSessionId: state.holderSessionId,
    presentation: { ...state.presentation },
    publicRunId: null,
  });
  const json = (route: Route, status: number, body: unknown) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  const handle = async (route: Route) => {
    const request = route.request();
    if (request.method() === 'GET')
      return json(route, 200, {
        current: state.initialized ? descriptor() : null,
        registry,
      });
    const command = (request.postDataJSON() as { command: Command }).command;
    commands.push(command);
    const digest = JSON.stringify(command);
    const previous = ledger.get(String(command.operationId));
    if (previous !== undefined)
      return previous === digest
        ? json(route, 200, {
            status: 'committed',
            reason: 'duplicate',
            historical: true,
            current: descriptor(),
          })
        : json(route, 409, {
            status: 'conflict',
            reason: 'operation-id-reused',
            current: descriptor(),
          });
    const fault = ['show', 'blank', 'unpresent'].includes(command.type)
      ? faults.shift()
      : undefined;
    if (fault === 'conflict')
      return json(route, 409, {
        status: 'conflict',
        reason: 'presentation-changed',
        current: descriptor(),
      });
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
      case 'show':
        state.presentation = {
          sceneId: String(command.sceneId),
          revision: state.presentation.revision + 1,
          blanked: false,
        };
        break;
      case 'blank':
        state.presentation = {
          ...state.presentation,
          revision: state.presentation.revision + 1,
          blanked: true,
        };
        break;
      case 'unpresent':
        state.presentation = {
          sceneId: null,
          revision: state.presentation.revision + 1,
          blanked: false,
        };
        break;
      default:
        break;
    }
    state.revision += 1;
    ledger.set(String(command.operationId), digest);
    if (fault === 'drop') return route.abort('connectionreset');
    return json(route, 200, {
      status: 'committed',
      reason: 'current',
      current: descriptor(),
    });
  };
  return { state, commands, faults, handle };
}

async function seed(page: Page, server: ReturnType<typeof controlServer>) {
  await page.route(`**/api/campaign/${CAMPAIGN.code}/players`, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        campaign: { code: CAMPAIGN.code, name: CAMPAIGN.name },
        players: [],
      }),
    })
  );
  await page.route(
    `**/api/campaign/${CAMPAIGN.code}/table/control*`,
    server.handle
  );
  await page.route(
    `**/api/campaign/${CAMPAIGN.code}/table/authority/initialize-if-empty`,
    route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{"status":"provisioned"}',
      })
  );
}

test('Table presentation: explicit Show/Blank/Reveal/Stop, truthful failures, 390 px', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const context = await browser.newContext();
  const contextErrors = await guardTableContext(context);
  await context.addInitScript(
    ({ campaign, map }) => {
      if (localStorage.getItem('rollkeeper-dm-data')) return;
      localStorage.setItem(
        'rollkeeper-dm-data',
        JSON.stringify({
          state: { dmId: 'dm-present', campaigns: [campaign] },
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
  const server = controlServer();
  await seed(page, server);
  await page.goto(`/dm/campaign/${CAMPAIGN.code}/battlemaps`);
  await page.getByRole('button', { name: 'Adopt Tavern Map' }).click();
  await page.getByRole('button', { name: 'Open scene' }).click();
  await expect(page.getByText('Live control held.')).toBeVisible();

  const status = page.getByRole('status', { name: 'Audience status' });
  await expect(status).toContainText('Audience: nothing shown');
  await expect(status).toContainText('Preparing: Tavern Map (private)');
  // Private preparation sent no presentation command.
  expect(
    server.commands.filter(command =>
      ['show', 'blank', 'unpresent', 'deletePresented'].includes(command.type)
    )
  ).toEqual([]);

  await page.getByRole('button', { name: 'Show this scene' }).click();
  await expect(page.getByText('Published', { exact: true })).toBeVisible();
  await expect(status).toContainText('Audience: Tavern Map · Published');
  await expect(status).toContainText(
    'Editing the shown scene — changes are live'
  );

  await page.getByRole('button', { name: 'Blank audience' }).click();
  await expect(status).toContainText('Audience: blank (covered) · Published');
  await page.getByRole('button', { name: 'Reveal Tavern Map' }).click();
  await expect(status).toContainText('Audience: Tavern Map · Published');

  // An interleaved change: 409 is explained, never Published.
  server.faults.push('conflict');
  await page.getByRole('button', { name: 'Blank audience' }).click();
  await expect(
    page.getByText(
      'Not changed: the audience changed in the meantime — controls refreshed'
    )
  ).toBeVisible();
  await expect(page.getByText('Published', { exact: true })).toHaveCount(0);

  // A committed request whose response is lost: Retry re-sends it exactly.
  server.faults.push('drop');
  await page.getByRole('button', { name: 'Stop showing' }).click();
  await expect(page.getByText('Not confirmed — Retry')).toBeVisible();
  const lost = server.commands.at(-1)!;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByText('Published (confirmed)')).toBeVisible();
  expect(server.commands.at(-1)).toEqual(lost);
  await expect(status).toContainText('Audience: nothing shown');

  // 390 px: presentation and combat controls fit without horizontal scroll.
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth
    )
  ).toBe(true);
  for (const control of [
    page.getByRole('button', { name: 'Show this scene' }),
    status,
    page.getByRole('button', { name: 'New run' }),
  ]) {
    await control.scrollIntoViewIfNeeded();
    const box = (await control.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
  }
  expect(contextErrors).toEqual([]);
  await context.close();
});
