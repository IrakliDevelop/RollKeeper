import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CODE,
  DM_ID,
  PLAYER_ID,
  ROOM_FOREST,
  clientRequest,
  createTableFakeRedis,
  params,
  registryEntry,
  type RouteHandler,
  seedTavernAndForest,
  setRegistryEntry,
} from './tableFakeRedis';

const fake = vi.hoisted(() => ({ current: null as unknown }));
const loot = vi.hoisted(() => ({
  seed: vi.fn(async () => []),
  claim: vi.fn(async () => ({
    ok: true,
    claim: { grantedQuantity: 1 },
  })),
}));
vi.mock('@/lib/redis', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/redis')>();
  const target = () =>
    fake.current as ReturnType<
      typeof import('./tableFakeRedis').createTableFakeRedis
    >;
  return {
    ...actual,
    getRedis: () => target().redis,
    getRawRedis: () => target().rawRedis,
    refreshCampaignTTL: async () => {},
  };
});
vi.mock('@/lib/supabase/campaignMembershipServer', () => ({
  authorizeCampaignMembershipRoute: vi.fn(async () => ({ mode: 'legacy' })),
}));
vi.mock('@/lib/supabase/campaignSettingsServer', () => ({
  campaignSettingsProjectionWriteAllowed: vi.fn(async () => true),
}));
vi.mock('@/lib/supabase/calendarServer', () => ({
  calendarProjectionWriteAllowed: vi.fn(async () => true),
}));
vi.mock('@/lib/xpAwardQueue', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/xpAwardQueue')>()),
  enqueueXpAward: vi.fn(async () => 'ok'),
  validateDmXpAward: vi.fn(() => null),
}));
vi.mock('@/lib/itemTransferQueue', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/itemTransferQueue')>()),
  enqueueItemTransfer: vi.fn(async () => undefined),
}));
vi.mock('@/lib/markerLootClaims', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/markerLootClaims')>()),
  seedMarkerLoot: loot.seed,
  claimMarkerLoot: loot.claim,
}));
vi.mock('@/lib/relayPoke', () => ({
  sendBattleMapPokeToRoom: vi.fn(),
  sendBattleMapPoke: vi.fn(),
  sendInitiativePoke: vi.fn(),
}));

import {
  DELETE as detailDELETE,
  POST as detailPOST,
} from '../battlemaps/[id]/route';
import {
  POST as markersPOST,
  PUT as markersPUT,
} from '../battlemaps/[id]/markers/route';
import { PUT as fogPUT } from '../battlemaps/[id]/fog-appearance/route';
import { POST as sharedPOST } from '../shared/route';
import {
  battleMapDeleteRequest,
  lootClaimRequest,
  markerPublishRequest,
} from '@/components/ui/campaign/table/sideChannelRequests';
import { writeFogAppearanceProjection } from '@/components/ui/campaign/location-map/fog/useFogAppearanceProjection';
import { TABLE_V1_SHARED_FEATURES } from '@/lib/tableServer/presentationAccess';
import { tableCompatibilityKey } from '@/lib/tableServer/keys';

let store: ReturnType<typeof createTableFakeRedis>;
const NOT_FOUND = { error: 'Not found' };

async function send(
  route: RouteHandler,
  built: { url: string; init: RequestInit },
  id?: string
) {
  const response = await route(
    clientRequest(built.url, built.init),
    params(id)
  );
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

/** Captures the exact fetch a client helper performs. */
async function capture(run: () => Promise<unknown>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const original = globalThis.fetch;
  globalThis.fetch = vi.fn(
    async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return Response.json({});
    }
  ) as typeof fetch;
  try {
    await run().catch(() => undefined);
  } finally {
    globalThis.fetch = original;
  }
  return calls;
}

const markerBody = {
  dmId: DM_ID,
  markers: [{ id: 'marker-1', title: 'Chest', body: '' }],
  loot: [],
};

beforeEach(() => {
  store = createTableFakeRedis();
  fake.current = store;
  seedTavernAndForest(store);
  process.env.TABLE_PROTOCOL_V1_REQUIRED = 'true';
  loot.seed.mockClear();
  loot.claim.mockClear();
});
afterEach(() => {
  delete process.env.TABLE_PROTOCOL_V1_REQUIRED;
});

describe('PR04 scene-id writes use mutation authorization (C4-2)', () => {
  it('the Table marker publish PUT built by the client commits for a registered scene', async () => {
    const built = markerPublishRequest(CODE, 'scene-forest', markerBody);
    expect(new Headers(built.init.headers).get('x-rollkeeper-csrf')).toBe('1');
    const response = await send(markersPUT, built, 'scene-forest');
    expect(response.status).toBe(200);
    expect(
      store.strings.get(
        `campaign:${CODE}:shared:battlemap-markers:scene-forest`
      )
    ).toContain('Chest');
  });

  it('rejects a scene marker PUT without CSRF, from a non-DM, or for a deleted scene', async () => {
    const built = markerPublishRequest(CODE, 'scene-forest', markerBody);
    const headers = new Headers(built.init.headers);
    headers.delete('x-rollkeeper-csrf');
    expect(
      (
        await send(
          markersPUT,
          { url: built.url, init: { ...built.init, headers } },
          'scene-forest'
        )
      ).status
    ).toBe(403);
    expect(
      (
        await send(
          markersPUT,
          markerPublishRequest(CODE, 'scene-forest', {
            ...markerBody,
            dmId: PLAYER_ID,
          }),
          'scene-forest'
        )
      ).status
    ).toBe(403);
    setRegistryEntry(
      store,
      registryEntry(
        'scene-forest',
        'map-forest',
        'Private Forest',
        ROOM_FOREST,
        {
          deleted: true,
        }
      )
    );
    const deleted = await send(markersPUT, built, 'scene-forest');
    expect(deleted).toEqual({ status: 404, body: NOT_FOUND });
  });

  it('the fog-appearance projection PUT for a scene id requires campaign DM mutation authority', async () => {
    const calls = await capture(() =>
      writeFogAppearanceProjection({
        campaignCode: CODE,
        battleMapId: 'scene-forest',
        dmId: DM_ID,
        appearance: 'cloudy',
      })
    );
    expect(calls).toHaveLength(1);
    const ok = await send(fogPUT, calls[0], 'scene-forest');
    expect(ok.status).toBe(200);
    const headers = new Headers(calls[0].init.headers);
    headers.delete('x-rollkeeper-csrf');
    const forged = await send(
      fogPUT,
      { url: calls[0].url, init: { ...calls[0].init, headers } },
      'scene-forest'
    );
    expect(forged.status).toBe(403);
  });

  it('a loot claim reaches the ledger only for the presented, unblanked scene', async () => {
    const claim = (id: string) =>
      lootClaimRequest(CODE, id, {
        playerId: PLAYER_ID,
        markerId: 'marker-1',
        entryId: 'entry-1',
        quantity: 1,
        requestId: 'request-1',
      });
    expect(
      await send(markersPOST, claim('scene-forest'), 'scene-forest')
    ).toEqual({ status: 404, body: NOT_FOUND });
    expect(
      (await send(markersPOST, claim('map-tavern'), 'map-tavern')).status
    ).toBe(404);
    expect(loot.claim).not.toHaveBeenCalled();
    expect(
      (await send(markersPOST, claim('scene-tavern'), 'scene-tavern')).status
    ).toBe(200);
    expect(loot.claim).toHaveBeenCalledOnce();
  });
});

describe('PR04 battle-map POST/DELETE (P6, Q9)', () => {
  const post = (id: string, battleMapId: string) => ({
    url: `/api/campaign/${CODE}/battlemaps/${id}`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-rollkeeper-csrf': '1' },
      body: JSON.stringify({
        dmId: DM_ID,
        battleMap: {
          id: battleMapId,
          name: 'Map',
          mapImageUrl: '',
          updatedAt: '',
        },
      }),
    },
  });

  it('legacy map publication is 426 under v1 and an id mismatch is 400 in both modes', async () => {
    expect(
      (await send(detailPOST, post('map-x', 'map-x'), 'map-x')).status
    ).toBe(426);
    delete process.env.TABLE_PROTOCOL_V1_REQUIRED;
    expect(
      (await send(detailPOST, post('map-x', 'map-y'), 'map-x')).status
    ).toBe(400);
    expect(
      (await send(detailPOST, post('map-x', 'map-x'), 'map-x')).status
    ).toBe(200);
  });

  it('DELETE answers 404 for any registered scene id, including tombstoned ones', async () => {
    setRegistryEntry(
      store,
      registryEntry('scene-gone', null, 'Gone', ROOM_FOREST, { deleted: true })
    );
    for (const id of ['scene-tavern', 'scene-gone']) {
      const response = await send(
        detailDELETE,
        battleMapDeleteRequest(CODE, id, DM_ID),
        id
      );
      expect(response).toEqual({ status: 404, body: NOT_FOUND });
    }
  });

  it('DELETE of a source map removes only its legacy records, never scene or projection keys', async () => {
    store.strings.set(
      `campaign:${CODE}:marker-loot:map-forest`,
      JSON.stringify([{ id: 'legacy-ledger' }])
    );
    const before = new Map(store.strings);
    const response = await send(
      detailDELETE,
      battleMapDeleteRequest(CODE, 'map-forest', DM_ID),
      'map-forest'
    );
    expect(response.status).toBe(200);
    for (const key of [
      `campaign:${CODE}:battlemap:map-forest`,
      `campaign:${CODE}:shared:battlemap-markers:map-forest`,
    ])
      expect(store.strings.has(key)).toBe(false);
    expect(
      [...store.strings.keys()].some(key =>
        key.endsWith('marker-loot:map-forest')
      )
    ).toBe(false);
    expect(store.strings.get(`campaign:${CODE}:battlemaps`)).not.toContain(
      'map-forest'
    );
    for (const key of [
      `campaign:${CODE}:shared:battlemap-markers:scene-forest`,
      `campaign:${CODE}:fog-appearance:scene-forest`,
      tableCompatibilityKey(CODE, 'battlemap'),
    ])
      expect(store.strings.get(key)).toBe(before.get(key));
    expect(store.writes).not.toContain(
      tableCompatibilityKey(CODE, 'battlemap')
    );
    expect(store.writes).not.toContain(`campaign:${CODE}:shared:battlemap`);
  });

  it('DELETE requires full DM mutation authorization under v1', async () => {
    const built = battleMapDeleteRequest(CODE, 'map-forest', DM_ID);
    const headers = new Headers(built.init.headers);
    headers.delete('x-rollkeeper-csrf');
    expect(
      (
        await send(
          detailDELETE,
          { url: built.url, init: { ...built.init, headers } },
          'map-forest'
        )
      ).status
    ).toBe(403);
    expect(store.strings.has(`campaign:${CODE}:battlemap:map-forest`)).toBe(
      true
    );
  });
});

describe('PR04 shared POST allowlist (P6)', () => {
  const shared = (feature: string, data: unknown) => ({
    url: `/api/campaign/${CODE}/shared`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-rollkeeper-csrf': '1' },
      body: JSON.stringify({ feature, data, dmId: DM_ID }),
    },
  });
  const payloads: Record<string, unknown> = {
    message: { message: { id: 'm1', text: 'hi' }, playerIds: [PLAYER_ID] },
    effects: { playerId: PLAYER_ID, effects: [] },
    xp: { playerId: PLAYER_ID, award: { id: 'a1' } },
    item_transfer: { transfer: { id: 't1' }, playerId: PLAYER_ID },
    calendar: { codecVersion: 0 },
    settings: { theme: 'x' },
    counters: { label: 'Luck', counters: {} },
  };

  it('accepts every feature an in-repo caller sends', async () => {
    expect([...TABLE_V1_SHARED_FEATURES].sort()).toEqual(
      Object.keys(payloads).sort()
    );
    for (const [feature, data] of Object.entries(payloads)) {
      const response = await send(sharedPOST, shared(feature, data));
      expect(response.status, feature).toBe(200);
    }
  });

  it('rejects unknown features with 400 and keeps reserved features at 426', async () => {
    const smuggled = await send(
      sharedPOST,
      shared('battlemap-markers:scene-forest', [{ id: 'x', title: 'forged' }])
    );
    expect(smuggled.status).toBe(400);
    expect(
      store.strings.get(
        `campaign:${CODE}:shared:battlemap-markers:scene-forest`
      )
    ).not.toContain('forged');
    for (const feature of ['battlemap', 'initiative', 'initiativeRequest'])
      expect((await send(sharedPOST, shared(feature, {}))).status).toBe(426);
  });

  it('flag off: the default branch still stores arbitrary features as at base', async () => {
    delete process.env.TABLE_PROTOCOL_V1_REQUIRED;
    expect(
      (await send(sharedPOST, shared('custom-feature', { a: 1 }))).status
    ).toBe(200);
    expect(store.strings.get(`campaign:${CODE}:shared:custom-feature`)).toBe(
      JSON.stringify({ a: 1 })
    );
  });
});
