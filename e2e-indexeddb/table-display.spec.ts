import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Route,
} from '@playwright/test';

import { guardTableContext } from './tableContext';

/**
 * PR05 persistent campaign table display in a real browser (dev server)
 * against scripted control/display APIs: Open display opens a same-origin
 * tab, hands the capability over only in the URL fragment, and the display
 * tab moves it into its own sessionStorage before any request; reload keeps
 * the session nonce; credential denials clear it; the DM sees the
 * server-computed display line; everything fits 390 px.
 */

const CAMPAIGN = {
  code: 'E2EDISPLAY',
  name: 'Display E2E',
  createdAt: '2026-10-07T00:00:00.000Z',
};
const MAP = {
  id: 'map-display',
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

const CAPABILITY = 'Cap5Synthetic_display-capability_0123456789';
const DISPLAY_EPOCH = '20000000-0000-4000-8000-000000000002';

/** Scripted display descriptor/ACK/status endpoints (E6/E7/E13). */
function displayServer() {
  const descriptors: Array<Record<string, unknown>> = [];
  const acks: Array<Record<string, unknown>> = [];
  const urlsAtRequest: string[] = [];
  let reply: { status: number; body: unknown } | null = null;
  let presentation = {
    sceneId: null as string | null,
    revision: 1,
    blanked: false,
  };
  let status: Record<string, unknown> = {
    state: 'none',
    sceneId: null,
    ageMs: null,
  };
  const json = (route: Route, code: number, body: unknown) =>
    route.fulfill({
      status: code,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  return {
    descriptors,
    acks,
    urlsAtRequest,
    setPresentation(next: typeof presentation) {
      presentation = next;
    },
    setStatus(next: Record<string, unknown>) {
      status = next;
    },
    failWith(next: { status: number; body: unknown } | null) {
      reply = next;
    },
    async install(target: BrowserContext, code: string) {
      await target.route(
        `**/api/campaign/${code}/table/display/descriptor`,
        route => {
          urlsAtRequest.push(route.request().frame().url());
          descriptors.push(
            route.request().postDataJSON() as Record<string, unknown>
          );
          if (reply) return json(route, reply.status, reply.body);
          return json(route, 200, {
            displayGeneration: 9,
            epoch: DISPLAY_EPOCH,
            presentation,
            scene: null,
          });
        }
      );
      await target.route(`**/api/campaign/${code}/table/display/ack`, route => {
        acks.push(route.request().postDataJSON() as Record<string, unknown>);
        return json(route, 200, { receivedAt: Date.now() });
      });
      await target.route(
        `**/api/campaign/${code}/table/display/status*`,
        route => json(route, 200, status)
      );
    },
  };
}

test('Open display: same-origin tab, fragment-only handover, credential only in the display tab, DM status line, 390 px', async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const context = await browser.newContext();
  const contextErrors = await guardTableContext(context);
  await context.addInitScript(
    ({ campaign, map }) => {
      if (localStorage.getItem('rollkeeper-dm-data')) return;
      localStorage.setItem(
        'rollkeeper-dm-data',
        JSON.stringify({
          state: { dmId: 'dm-display', campaigns: [campaign] },
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
  const display = displayServer();
  await display.install(context, CAMPAIGN.code);
  const rotations: unknown[] = [];
  await context.route(
    `**/api/campaign/${CAMPAIGN.code}/table/display/capability`,
    route => {
      rotations.push(route.request().postDataJSON());
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ capability: CAPABILITY, displayGeneration: 9 }),
      });
    }
  );
  await page.goto(`/dm/campaign/${CAMPAIGN.code}/battlemaps`);
  await page.getByRole('button', { name: 'Adopt Tavern Map' }).click();
  await page.getByRole('button', { name: 'Open scene' }).click();
  await expect(page.getByText('Live control held.')).toBeVisible();
  const status = page.getByRole('status', { name: 'Audience status' });
  await expect(status).toContainText('Published · no display connected');

  const popupPromise = context.waitForEvent('page');
  await page.getByRole('button', { name: 'Open display' }).click();
  const tab = await popupPromise;
  await expect(tab.getByTestId('table-display-cover')).toHaveText(
    'Waiting for the table'
  );
  expect(rotations).toEqual([{ dmId: 'dm-display' }]);
  await expect
    .poll(() => tab.evaluate(() => location.href))
    .toBe(`http://localhost:3107/table-display/${CAMPAIGN.code}`);
  // Stays scrubbed after the router settles (no history restore).
  await tab.waitForTimeout(1_500);
  expect(await tab.evaluate(() => location.href)).not.toContain('#');
  await expect.poll(() => display.descriptors.length).toBeGreaterThan(0);
  for (const url of display.urlsAtRequest)
    expect(url).not.toContain(CAPABILITY);
  const stored = await tab.evaluate(
    code => sessionStorage.getItem(`rollkeeper:table-display:${code}`),
    CAMPAIGN.code
  );
  const credential = JSON.parse(stored!) as {
    capability: string;
    nonce: string;
  };
  expect(credential.capability).toBe(CAPABILITY);
  expect(display.descriptors[0]).toEqual(credential);
  expect(
    await tab.evaluate(() => JSON.stringify({ ...localStorage }))
  ).not.toContain(CAPABILITY);
  expect(
    await page.evaluate(() => JSON.stringify({ ...sessionStorage }))
  ).not.toContain(CAPABILITY);
  expect(await tab.evaluate(() => window.opener)).toBeNull();
  await expect.poll(() => display.acks.length).toBeGreaterThan(0);
  expect(display.acks.at(-1)!.ack).toEqual({
    displayGeneration: 9,
    epoch: DISPLAY_EPOCH,
    presentationRevision: 1,
    sceneId: null,
    blanked: false,
    phase: 'blank',
  });

  // Blank survives a reload of the display tab with the same session nonce.
  display.setPresentation({ sceneId: null, revision: 2, blanked: true });
  await tab.reload();
  await expect(tab.getByTestId('table-display-cover')).toHaveText(
    'Waiting for the table'
  );
  await expect
    .poll(() => display.acks.at(-1)?.ack)
    .toMatchObject({
      blanked: true,
      phase: 'blank',
      presentationRevision: 2,
    });
  expect(display.descriptors.at(-1)).toEqual(credential);

  // The DM line is the server's device report, never derived from Published.
  display.setStatus({ state: 'blank', sceneId: null, ageMs: 900 });
  await expect(status).toContainText('Table reports a blank (covered) screen', {
    timeout: 10_000,
  });
  display.setStatus({ state: 'stale', sceneId: null, ageMs: 21_000 });
  await expect(status).toContainText('Display last reported 21 s ago', {
    timeout: 10_000,
  });

  // A rotated link: the display clears its credential and asks to reopen.
  display.failWith({ status: 403, body: { error: 'Display link expired' } });
  await expect(tab.getByTestId('table-display-cover')).toHaveText(
    'Display link expired — open the display again from the DM screen',
    { timeout: 10_000 }
  );
  expect(
    await tab.evaluate(
      code => sessionStorage.getItem(`rollkeeper:table-display:${code}`),
      CAMPAIGN.code
    )
  ).toBeNull();

  // 390 px: the DM display line and launcher fit without horizontal scroll.
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth
    )
  ).toBe(true);
  for (const control of [
    page.getByRole('button', { name: 'Open display' }),
    status,
  ]) {
    await control.scrollIntoViewIfNeeded();
    const box = (await control.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
  }
  expect(contextErrors).toEqual([]);
  await context.close();
});

test('display tab bootstrap: no-referrer, malformed and missing links never request', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const contextErrors = await guardTableContext(context);
  const page = await context.newPage();
  const display = displayServer();
  await display.install(context, CAMPAIGN.code);
  const response = await page.goto(`/table-display/${CAMPAIGN.code}`);
  expect(response!.headers()['referrer-policy']).toBe('no-referrer');
  await expect(page.getByTestId('table-display-cover')).toHaveText(
    'Open the display from the DM screen (Open display)'
  );
  // A fresh tab (a same-document hash change does not reload the shell).
  const fresh = await context.newPage();
  await fresh.goto(
    `/table-display/${CAMPAIGN.code}#k=123e4567-e89b-42d3-a456-426614174000`
  );
  await expect(fresh.getByTestId('table-display-cover')).toHaveText(
    'Display link expired — open the display again from the DM screen'
  );
  await expect
    .poll(() => fresh.evaluate(() => location.href))
    .not.toContain('#');
  await fresh.waitForTimeout(2_500);
  expect(display.descriptors).toEqual([]);
  expect(contextErrors).toEqual([]);
  await context.close();
});
