import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CODE,
  DISPLAY_CAPABILITY,
  DISPLAY_GENERATION,
  DISPLAY_KEY,
  DISPLAY_NONCE,
  clientRequest,
  createTableFakeRedis,
  issueDisplay,
  params,
  seedTavernAndForest,
} from './tableFakeRedis';
import { installDisplayEval } from './tableDisplayFake';
import { tableControlKey } from '@/lib/tableServer/keys';
import { DISPLAY_VERIFY_SCRIPT } from '@/lib/tableServer/displayScripts';
import { verifyBattleMapToken } from '@/lib/battlemapToken';

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
vi.mock('@/lib/liveMapRooms', () => ({ recordLiveMapRoom: vi.fn() }));

import { POST as tokenPOST } from '../battlemap-token/route';
import { GET as detailGET } from '../battlemaps/[id]/route';
import { GET as battleMapFogGET } from '../battlemaps/[id]/fog-appearance/route';
import { GET as listGET } from '../battlemaps/route';
import {
  battleMapDetailUrl,
  battleMapListUrl,
  fogAppearanceReadUrl,
  sideChannelReadInit,
  type SideChannelCredential,
} from '@/components/ui/campaign/table/sideChannelRequests';
import {
  mintBattleMapToken,
  type BattleMapTokenRequest,
} from '@/lib/battlemapSync';

const SECRET = 'synthetic-relay-secret';
let store: ReturnType<typeof createTableFakeRedis>;
const display: SideChannelCredential = {
  role: 'display',
  capability: DISPLAY_CAPABILITY,
  nonce: DISPLAY_NONCE,
};
const tavernRequest: BattleMapTokenRequest = {
  role: 'display',
  battleMapId: 'map-tavern',
  sceneId: 'scene-tavern',
  displayCapability: DISPLAY_CAPABILITY,
  displaySession: DISPLAY_NONCE,
};

/** Sends the EXACT request `mintBattleMapToken` builds, optionally altered. */
async function mint(
  request: BattleMapTokenRequest,
  alter: (headers: Headers) => void = () => {}
) {
  let captured: Response | null = null;
  const original = globalThis.fetch;
  globalThis.fetch = vi.fn(
    async (url: RequestInfo | URL, init?: RequestInit) => {
      const base = clientRequest(String(url), init);
      const headers = new Headers(base.headers);
      alter(headers);
      captured = await tokenPOST(
        new NextRequest(base.url, {
          method: 'POST',
          headers,
          body: init?.body as BodyInit,
        }),
        params()
      );
      return captured.clone();
    }
  ) as typeof fetch;
  try {
    const result = await mintBattleMapToken(CODE, request);
    const response = captured as Response | null;
    return {
      result,
      status: response?.status ?? 0,
      body: response
        ? ((await response.json()) as Record<string, unknown>)
        : {},
    };
  } finally {
    globalThis.fetch = original;
  }
}

async function read(
  route: (
    request: NextRequest,
    context: ReturnType<typeof params>
  ) => Promise<Response>,
  url: string,
  init: RequestInit,
  id?: string
) {
  const response = await route(clientRequest(url, init), params(id));
  return { status: response.status, text: await response.text() };
}

beforeEach(() => {
  store = createTableFakeRedis();
  installDisplayEval(store);
  fake.current = store;
  seedTavernAndForest(store);
  issueDisplay(store);
  process.env.TABLE_PROTOCOL_V1_REQUIRED = 'true';
  process.env.BATTLEMAP_RELAY_SECRET = SECRET;
  delete process.env.SUPABASE_HYBRID_GUEST_ENABLED;
});
afterEach(() => {
  delete process.env.TABLE_PROTOCOL_V1_REQUIRED;
  delete process.env.BATTLEMAP_RELAY_SECRET;
  delete process.env.SUPABASE_HYBRID_GUEST_ENABLED;
});

describe('PR05 token mint with the display capability (E5, R4-F2, C5-5)', () => {
  it('signs the verified generation for the presented scene', async () => {
    const minted = await mint(tavernRequest);
    expect(minted.status).toBe(200);
    expect(minted.body).toMatchObject({ sceneId: 'scene-tavern' });
    const claims = verifyBattleMapToken(String(minted.body.token), SECRET);
    expect(claims).toMatchObject({
      role: 'display',
      userId: `display-${CODE}`,
      sceneId: 'scene-tavern',
      displayGeneration: DISPLAY_GENERATION,
    });
  });

  it('denies a rotation landing between verification and resolution', async () => {
    const evaluate = (
      store.rawRedis as unknown as {
        eval: (
          script: string,
          keys: string[],
          args: string[]
        ) => Promise<string>;
      }
    ).eval;
    Object.assign(store.rawRedis, {
      eval: async (script: string, keys: string[], args: string[]) => {
        const result = await evaluate(script, keys, args);
        if (script === DISPLAY_VERIFY_SCRIPT) {
          const control = JSON.parse(
            store.strings.get(tableControlKey(CODE))!
          ) as Record<string, unknown>;
          control.displayGeneration = DISPLAY_GENERATION + 1;
          store.strings.set(tableControlKey(CODE), JSON.stringify(control));
        }
        return result;
      },
    });
    const minted = await mint(tavernRequest);
    expect(minted.result).toBeNull();
    expect(minted.status).toBe(403);
    expect(minted.body).toEqual({ error: 'Display link expired' });
  });

  it('rejects the pre-PR05 plaintext key, foreign scenes and an unbound session', async () => {
    const legacy = await mint({
      role: 'display',
      battleMapId: 'map-tavern',
      sceneId: 'scene-tavern',
      displayKey: DISPLAY_KEY,
    });
    expect(legacy.status).toBe(403);
    expect(legacy.body).toEqual({ error: 'Display link expired' });
    const forest = await mint({
      ...tavernRequest,
      battleMapId: 'map-forest',
      sceneId: 'scene-forest',
    });
    expect(forest.status).toBe(403);
    expect(forest.body).toEqual({ error: 'Scene is unavailable' });
    issueDisplay(store, false);
    const unbound = await mint(tavernRequest);
    expect(unbound.status).toBe(409);
    expect(unbound.body).toEqual({ error: 'stale' });
  });

  it('validates same-origin Origin and CSRF but skips the guest-cookie check', async () => {
    for (const alter of [
      (headers: Headers) => headers.delete('origin'),
      (headers: Headers) => headers.set('origin', 'https://evil.test'),
      (headers: Headers) => headers.delete('x-rollkeeper-csrf'),
    ]) {
      const refused = await mint(tavernRequest, alter);
      expect(refused.status).toBe(403);
      expect(refused.body).toEqual({
        error: 'Request origin or CSRF validation failed',
      });
    }
    process.env.SUPABASE_HYBRID_GUEST_ENABLED = 'true';
    const withGuestCookie = await mint(tavernRequest, headers =>
      headers.set('cookie', 'rk_guest_session=stale')
    );
    expect(withGuestCookie.status).toBe(200);
  });

  it('denies a display location claim under v1 with the neutral body (review 01 F4)', async () => {
    store.strings.set(
      `campaign:${CODE}:location:loc-1`,
      JSON.stringify({
        id: 'loc-1',
        name: 'Market',
        mapImageUrl: 'https://cdn.test/market.png',
        updatedAt: '2026-10-07T00:00:00.000Z',
      })
    );
    const minted = await mint({
      role: 'display',
      battleMapId: 'loc-1',
      kind: 'location',
      displayCapability: DISPLAY_CAPABILITY,
      displaySession: DISPLAY_NONCE,
    });
    expect(minted.status).toBe(403);
    expect(minted.body).toEqual({ error: 'Scene is unavailable' });
    expect(minted.result).toBeNull();
  });

  it('flag off keeps the legacy plaintext display key path unchanged', async () => {
    delete process.env.TABLE_PROTOCOL_V1_REQUIRED;
    const minted = await mint({
      role: 'display',
      battleMapId: 'map-tavern',
      displayKey: DISPLAY_KEY,
    });
    expect(minted.status).toBe(200);
    expect(
      verifyBattleMapToken(String(minted.body.token), SECRET)
    ).toMatchObject({ role: 'display', userId: `display-${CODE}` });
    const wrong = await mint({
      role: 'display',
      battleMapId: 'map-tavern',
      displayKey: 'wrong',
    });
    expect(wrong.status).toBe(403);
  });
});

describe('PR05 side-channel GETs carry the display credential in headers', () => {
  it('reads the shown scene with header credentials and never via query', async () => {
    const init = sideChannelReadInit(display);
    const url = battleMapDetailUrl(CODE, 'scene-tavern', display);
    expect(url).not.toMatch(/capability|session|displayKey|Cap5|Nonce5/u);
    expect(JSON.stringify(init)).not.toContain('displayKey');
    const detail = await read(detailGET, url, init, 'scene-tavern');
    expect(detail.status).toBe(200);
    expect(JSON.parse(detail.text).battleMap.id).toBe('scene-tavern');
    const fog = await read(
      battleMapFogGET,
      fogAppearanceReadUrl('battlemap', CODE, 'scene-tavern', display),
      init,
      'scene-tavern'
    );
    expect(fog.status).toBe(200);
    expect(JSON.parse(fog.text).fogAppearance).toBe('cloudy');
    const list = await read(listGET, battleMapListUrl(CODE, display), init);
    expect(JSON.parse(list.text).battlemaps).toHaveLength(1);
  });

  it('ignores a query displayKey under v1 and rejects foreign origins', async () => {
    const queryKey = await read(
      detailGET,
      `/api/campaign/${CODE}/battlemaps/scene-tavern?role=display&displayKey=${DISPLAY_KEY}`,
      {},
      'scene-tavern'
    );
    expect(queryKey.status).toBe(403);
    const init = sideChannelReadInit(display);
    const { 'x-rollkeeper-csrf': _csrf, ...withoutCsrf } =
      init.headers as Record<string, string>;
    void _csrf;
    const noCsrf = await read(
      detailGET,
      battleMapDetailUrl(CODE, 'scene-tavern', display),
      { headers: withoutCsrf },
      'scene-tavern'
    );
    expect(noCsrf.status).toBe(403);
    expect(JSON.parse(noCsrf.text)).toEqual({
      error: 'Request origin or CSRF validation failed',
    });
    for (const extra of [
      { origin: 'https://evil.test' },
      { 'sec-fetch-site': 'cross-site' },
    ] as Array<Record<string, string>>) {
      const refused = await read(
        detailGET,
        battleMapDetailUrl(CODE, 'scene-tavern', display),
        { headers: { ...(init.headers as Record<string, string>), ...extra } },
        'scene-tavern'
      );
      expect(refused.status).toBe(403);
      expect(JSON.parse(refused.text)).toEqual({
        error: 'Request origin or CSRF validation failed',
      });
    }
  });
});
