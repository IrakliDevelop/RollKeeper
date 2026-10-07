import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CODE,
  DISPLAY_KEY,
  DM_ID,
  PLAYER_ID,
  ROOM_TAVERN,
  clientRequest,
  createTableFakeRedis,
  params,
  registryEntry,
  type RouteHandler,
  seedTavernAndForest,
  setPresentation,
  setRegistryEntry,
} from './tableFakeRedis';

const fake = vi.hoisted(() => ({ current: null as unknown }));
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
vi.mock('@/lib/tableServer/authorityProof', () => ({
  proveRelayAuthority: vi.fn(async () => true),
}));
vi.mock('@/lib/relayPoke', () => ({
  sendBattleMapPokeToRoom: vi.fn(),
  sendBattleMapPoke: vi.fn(),
  sendInitiativePoke: vi.fn(),
}));

import { GET as listGET } from '../battlemaps/route';
import { GET as detailGET } from '../battlemaps/[id]/route';
import { GET as markersGET } from '../battlemaps/[id]/markers/route';
import { GET as battleMapFogGET } from '../battlemaps/[id]/fog-appearance/route';
import { GET as locationFogGET } from '../locations/[id]/fog-appearance/route';
import { POST as tokenPOST } from '../battlemap-token/route';
import {
  battleMapDetailUrl,
  battleMapListUrl,
  fogAppearanceReadUrl,
  markerDetailsUrl,
  type SideChannelCredential,
} from '@/components/ui/campaign/table/sideChannelRequests';
import {
  mintBattleMapToken,
  type BattleMapTokenRequest,
} from '@/lib/battlemapSync';

const player: SideChannelCredential = { role: 'player', playerId: PLAYER_ID };
const display: SideChannelCredential = {
  role: 'display',
  displayKey: DISPLAY_KEY,
};
const dm: SideChannelCredential = { role: 'dm', dmId: DM_ID };
const AUDIENCES = [player, display];
const FOREST_IDS = ['scene-forest', 'map-forest'];

let store: ReturnType<typeof createTableFakeRedis>;

async function read(route: RouteHandler, url: string, id?: string) {
  const response = await route(clientRequest(url), params(id));
  return {
    status: response.status,
    type: response.headers.get('content-type'),
    text: await response.text(),
  };
}

/** Sends the EXACT request `mintBattleMapToken` builds through the route. */
async function mint(request: BattleMapTokenRequest) {
  let captured: Response | null = null;
  const original = globalThis.fetch;
  globalThis.fetch = vi.fn(
    async (url: RequestInfo | URL, init?: RequestInit) => {
      captured = await tokenPOST(clientRequest(String(url), init), params());
      return captured.clone();
    }
  ) as typeof fetch;
  try {
    const denials: Array<{ status: number; error: string | null }> = [];
    const result = await mintBattleMapToken(CODE, request, {
      onDenied: denial => denials.push(denial),
    });
    const response = captured as Response | null;
    return {
      result,
      denials,
      status: response?.status ?? 0,
      body: response
        ? ((await response.json()) as Record<string, unknown>)
        : {},
    };
  } finally {
    globalThis.fetch = original;
  }
}

const sideReads = (credential: SideChannelCredential, id: string) => [
  read(detailGET, battleMapDetailUrl(CODE, id, credential), id),
  read(markersGET, markerDetailsUrl(CODE, id, credential), id),
  read(
    battleMapFogGET,
    fogAppearanceReadUrl('battlemap', CODE, id, credential),
    id
  ),
  read(
    locationFogGET,
    fogAppearanceReadUrl('location', CODE, id, credential),
    id
  ),
];

const NOT_FOUND = JSON.stringify({ error: 'Not found' });

beforeEach(() => {
  store = createTableFakeRedis();
  fake.current = store;
  seedTavernAndForest(store);
  process.env.TABLE_PROTOCOL_V1_REQUIRED = 'true';
  process.env.BATTLEMAP_RELAY_SECRET = 'synthetic-relay-secret';
});
afterEach(() => {
  delete process.env.TABLE_PROTOCOL_V1_REQUIRED;
  delete process.env.BATTLEMAP_RELAY_SECRET;
});

describe('PR04 privacy: Private Forest never reaches the audience while Tavern is shown', () => {
  it('list GET returns only the shown scene safe metadata to player and display', async () => {
    for (const credential of AUDIENCES) {
      const response = await read(listGET, battleMapListUrl(CODE, credential));
      expect(response.status).toBe(200);
      expect(JSON.parse(response.text)).toEqual({
        battlemaps: [
          { id: 'scene-tavern', sourceMapId: 'map-tavern', name: 'Tavern' },
        ],
      });
      expect(response.text).not.toMatch(/Forest|secret|cdn\.test/u);
    }
  });

  it('per-map, markers and fog appearance (both path families) answer one uniform 404 for Forest', async () => {
    for (const credential of AUDIENCES) {
      for (const id of FOREST_IDS) {
        for (const response of await Promise.all(sideReads(credential, id))) {
          expect(response).toEqual({
            status: 404,
            type: 'application/json',
            text: NOT_FOUND,
          });
        }
      }
    }
  });

  it('the token route denies Forest uniformly (R4 403) for every spelling', async () => {
    for (const request of [
      { role: 'player', battleMapId: 'map-forest', playerId: PLAYER_ID },
      {
        role: 'player',
        battleMapId: 'map-tavern',
        sceneId: 'scene-forest',
        playerId: PLAYER_ID,
      },
      {
        role: 'display',
        battleMapId: 'map-forest',
        displayKey: DISPLAY_KEY,
      },
    ] as BattleMapTokenRequest[]) {
      const minted = await mint(request);
      expect(minted.result).toBeNull();
      expect(minted.status).toBe(403);
      expect(minted.body).toEqual({ error: 'Scene is unavailable' });
      expect(minted.denials).toEqual([
        { status: 403, error: 'Scene is unavailable' },
      ]);
    }
  });

  it('Tavern is readable through its scene id with registry-safe fields only', async () => {
    for (const credential of AUDIENCES) {
      const [detail, markers, fog, locationFog] = await Promise.all(
        sideReads(credential, 'scene-tavern')
      );
      expect(detail.status).toBe(200);
      expect(JSON.parse(detail.text)).toEqual({
        battleMap: {
          id: 'scene-tavern',
          sourceMapId: 'map-tavern',
          name: 'Tavern',
        },
      });
      expect(JSON.parse(markers.text).markers[0].title).toBe('Tavern chest');
      expect(JSON.parse(fog.text).fogAppearance).toBe('cloudy');
      expect(JSON.parse(locationFog.text).fogAppearance).toBe('cloudy');
    }
    // The source map id is not an audience alias for side channels.
    for (const response of await Promise.all(sideReads(player, 'map-tavern')))
      expect(response.text).toBe(NOT_FOUND);
  });

  it('the token response fog appearance comes from the resolved scene, never the source map', async () => {
    const minted = await mint({
      role: 'player',
      battleMapId: 'map-tavern',
      playerId: PLAYER_ID,
    });
    expect(minted.status).toBe(200);
    expect(minted.body).toMatchObject({
      sceneId: 'scene-tavern',
      room: ROOM_TAVERN,
      fogAppearance: 'cloudy',
      fogAppearanceUpdatedAt: '2026-10-07T00:00:00.000Z',
    });
  });

  it('Blank denies every reader (404) and the token (403) with identical bodies', async () => {
    setPresentation(store, 'scene-tavern', true);
    for (const credential of AUDIENCES) {
      for (const response of await Promise.all(
        sideReads(credential, 'scene-tavern')
      ))
        expect(response.text).toBe(NOT_FOUND);
      expect(
        JSON.parse(
          (await read(listGET, battleMapListUrl(CODE, credential))).text
        )
      ).toEqual({ battlemaps: [] });
    }
    const minted = await mint({
      role: 'player',
      battleMapId: 'map-tavern',
      playerId: PLAYER_ID,
    });
    expect(minted.status).toBe(403);
    expect(minted.body).toEqual({ error: 'Scene is unavailable' });
  });

  it('unpresented and deleted scenes are the same generic 404', async () => {
    setPresentation(store, null);
    for (const response of await Promise.all(sideReads(player, 'scene-tavern')))
      expect(response.text).toBe(NOT_FOUND);
    setPresentation(store, 'scene-tavern');
    setRegistryEntry(
      store,
      registryEntry('scene-tavern', 'map-tavern', 'Tavern', ROOM_TAVERN, {
        deleted: true,
      })
    );
    for (const response of await Promise.all(
      sideReads(display, 'scene-tavern')
    ))
      expect(response.text).toBe(NOT_FOUND);
    for (const response of await Promise.all(sideReads(dm, 'scene-tavern')))
      expect(response.status).toBe(404);
  });
});

describe('PR04 privacy: request flags and spoofed identities grant nothing', () => {
  it('a kind=location or role=dm claim from a player cannot read Forest', async () => {
    const url = `${markerDetailsUrl(CODE, 'scene-forest', player)}&kind=location`;
    expect((await read(markersGET, url, 'scene-forest')).text).toBe(NOT_FOUND);
    const forged = await read(
      markersGET,
      markerDetailsUrl(CODE, 'scene-forest', { role: 'dm', dmId: PLAYER_ID }),
      'scene-forest'
    );
    expect(forged.status).toBe(403);
    expect(forged.text).not.toMatch(/Forest/u);
    const location = await mint({
      role: 'player',
      battleMapId: 'scene-forest',
      playerId: PLAYER_ID,
      kind: 'location',
    });
    expect(location.result).toBeNull();
    expect(location.body).not.toHaveProperty('token');
  });

  it('missing, wrong-campaign and stale credentials are 403 before any kind is revealed', async () => {
    for (const id of ['scene-forest', 'scene-tavern', 'map-unknown']) {
      const anonymous = await read(
        markersGET,
        `/api/campaign/${CODE}/battlemaps/${id}/markers`,
        id
      );
      expect(anonymous.status).toBe(403);
      const stranger = await read(
        markersGET,
        markerDetailsUrl(CODE, id, {
          role: 'player',
          playerId: 'not-in-campaign',
        }),
        id
      );
      expect(stranger.status).toBe(403);
      const staleKey = await read(
        battleMapFogGET,
        fogAppearanceReadUrl('battlemap', CODE, id, {
          role: 'display',
          displayKey: 'rotated-away',
        }),
        id
      );
      expect(staleKey.status).toBe(403);
    }
    expect(
      (await read(listGET, `/api/campaign/${CODE}/battlemaps`)).status
    ).toBe(403);
  });
});

describe('PR04 privacy: DM reads, locations and flag-off stay as before', () => {
  it('the DM still reads private scenes and original maps', async () => {
    const markers = await read(
      markersGET,
      markerDetailsUrl(CODE, 'scene-forest', dm),
      'scene-forest'
    );
    expect(JSON.parse(markers.text).markers[0].title).toBe(
      'Forest secret cache'
    );
    const original = await read(
      detailGET,
      battleMapDetailUrl(CODE, 'map-forest', dm),
      'map-forest'
    );
    expect(JSON.parse(original.text).battleMap.mapImageUrl).toContain(
      'map-forest-secret'
    );
    const list = await read(listGET, battleMapListUrl(CODE, dm));
    expect(JSON.parse(list.text).battlemaps).toHaveLength(2);
  });

  it('a verified location keeps its existing authorization path', async () => {
    store.strings.set(
      `campaign:${CODE}:location:loc-1`,
      JSON.stringify({
        id: 'loc-1',
        name: 'Market',
        mapImageUrl: 'https://cdn.test/market.png',
        updatedAt: '2026-10-07T00:00:00.000Z',
      })
    );
    store.strings.set(
      `campaign:${CODE}:fog-appearance:loc-1`,
      JSON.stringify({
        v: 1,
        appearance: 'cloudy',
        updatedAt: '2026-10-07T00:00:00.000Z',
      })
    );
    const fog = await read(
      locationFogGET,
      fogAppearanceReadUrl('location', CODE, 'loc-1', player),
      'loc-1'
    );
    expect(JSON.parse(fog.text).fogAppearance).toBe('cloudy');
    const markers = await read(
      markersGET,
      `/api/campaign/${CODE}/battlemaps/loc-1/markers`,
      'loc-1'
    );
    expect(markers.status).toBe(200);
  });

  it('with Table v1 off every reader behaves exactly as at base', async () => {
    delete process.env.TABLE_PROTOCOL_V1_REQUIRED;
    const list = await read(listGET, `/api/campaign/${CODE}/battlemaps`);
    expect(JSON.parse(list.text).battlemaps).toHaveLength(2);
    const detail = await read(
      detailGET,
      `/api/campaign/${CODE}/battlemaps/map-forest`,
      'map-forest'
    );
    expect(JSON.parse(detail.text).battleMap.id).toBe('map-forest');
    const markers = await read(
      markersGET,
      `/api/campaign/${CODE}/battlemaps/map-forest/markers`,
      'map-forest'
    );
    expect(JSON.parse(markers.text).markers[0].title).toBe(
      'Legacy forest marker'
    );
    const fog = await read(
      battleMapFogGET,
      fogAppearanceReadUrl('battlemap', CODE, 'map-tavern', player),
      'map-tavern'
    );
    expect(JSON.parse(fog.text).fogAppearance).toBe('solid');
  });
});
