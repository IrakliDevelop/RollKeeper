import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  mockRedis,
  resetRedis,
  seedRedis,
  seedRedisSet,
} from '@/test/mocks/redis';
import { verifyBattleMapToken } from '@/lib/battlemapToken';

const { authorizeCampaignMembershipRoute, proveRelayAuthority } = vi.hoisted(
  () => ({
    authorizeCampaignMembershipRoute: vi.fn(),
    proveRelayAuthority: vi.fn(),
  })
);
vi.mock('@/lib/supabase/campaignMembershipServer', () => ({
  authorizeCampaignMembershipRoute,
}));
vi.mock('@/lib/tableServer/authorityProof', () => ({ proveRelayAuthority }));

import { POST } from './route';

const CODE = 'A1B2C3D4E5F6';
const ROOM = '123e4567-e89b-42d3-a456-426614174000';
const EPOCH = '223e4567-e89b-42d3-a456-426614174000';
const GENERATION = '323e4567-e89b-42d3-a456-426614174000';

const validLocation = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: 'Location',
  mapImageUrl: 'https://example.test/location.png',
  updatedAt: '2026-10-03T00:00:00.000Z',
  ...extra,
});

function request(body: Record<string, unknown>, secure = false) {
  return new NextRequest(
    `http://localhost/api/campaign/${CODE}/battlemap-token`,
    {
      method: 'POST',
      headers: secure
        ? {
            Origin: 'http://localhost',
            'Content-Type': 'application/json',
            'x-rollkeeper-csrf': '1',
          }
        : { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
}

const params = { params: Promise.resolve({ code: CODE }) };

describe('membership-aware relay authority minting', () => {
  beforeEach(() => {
    resetRedis();
    vi.clearAllMocks();
    delete process.env.BATTLEMAP_FOG_PROTOCOL_REQUIRED;
    process.env.BATTLEMAP_RELAY_SECRET = 'synthetic-relay-secret';
    authorizeCampaignMembershipRoute.mockResolvedValue({ mode: 'legacy' });
    seedRedis(`campaign:${CODE}`, { dmId: 'dm-a', campaignName: 'Synthetic' });
    seedRedisSet(`campaign:${CODE}:players`, ['legacy-a', 'stale-a']);
  });

  it('keeps untouched campaigns on byte-compatible Redis membership', async () => {
    const response = await POST(
      request({ role: 'player', battleMapId: 'map-a', playerId: 'legacy-a' }),
      params
    );
    expect(response.status).toBe(200);
    expect(authorizeCampaignMembershipRoute).toHaveBeenCalledWith(CODE, false);
  });

  it('denies stale Redis players and request-body IDs after Postgres cutover', async () => {
    authorizeCampaignMembershipRoute.mockResolvedValue({
      mode: 'account',
      principal: {
        campaignId: 'campaign-a',
        accountId: 'account-a',
        role: 'player',
        status: 'active',
        epoch: 1,
        legacyPlayerId: 'legacy-a',
        legacyCharacterId: 'character-a',
        characterId: 'cloud-a',
      },
    });
    const stale = await POST(
      request(
        { role: 'player', battleMapId: 'map-a', playerId: 'stale-a' },
        true
      ),
      params
    );
    expect(stale.status).toBe(403);
    const explicit = await POST(
      request(
        { role: 'player', battleMapId: 'map-a', playerId: 'legacy-a' },
        true
      ),
      params
    );
    expect(explicit.status).toBe(200);
  });

  it('requires CSRF and owner/DM account authority for DM relay tokens', async () => {
    authorizeCampaignMembershipRoute.mockResolvedValue({
      mode: 'account',
      principal: {
        campaignId: 'campaign-a',
        accountId: 'owner-a',
        role: 'owner',
        status: 'active',
        epoch: 1,
        legacyPlayerId: null,
        legacyCharacterId: null,
        characterId: null,
      },
    });
    expect(
      (
        await POST(
          request({ role: 'dm', battleMapId: 'map-a', dmId: 'dm-a' }),
          params
        )
      ).status
    ).toBe(403);
    expect(
      (
        await POST(
          request({ role: 'dm', battleMapId: 'map-a', dmId: 'dm-a' }, true),
          params
        )
      ).status
    ).toBe(200);
  });

  it('fails closed when membership authority is stale or unavailable', async () => {
    authorizeCampaignMembershipRoute.mockResolvedValue({
      mode: 'denied',
      status: 503,
    });
    const response = await POST(
      request(
        { role: 'player', battleMapId: 'map-a', playerId: 'legacy-a' },
        true
      ),
      params
    );
    expect(response.status).toBe(503);
  });

  it('leaves display-only live-runtime authority on the isolated display key path', async () => {
    authorizeCampaignMembershipRoute.mockClear();
    seedRedis(`campaign:${CODE}:displaykey`, 'display-a');
    const response = await POST(
      request({
        role: 'display',
        battleMapId: 'map-a',
        displayKey: 'display-a',
      }),
      params
    );
    expect(response.status).toBe(200);
    expect(authorizeCampaignMembershipRoute).not.toHaveBeenCalled();
  });
});

describe('live map room registration', () => {
  beforeEach(() => {
    resetRedis();
    vi.clearAllMocks();
    delete process.env.BATTLEMAP_FOG_PROTOCOL_REQUIRED;
    process.env.BATTLEMAP_RELAY_SECRET = 'synthetic-relay-secret';
    authorizeCampaignMembershipRoute.mockResolvedValue({ mode: 'legacy' });
    seedRedis(`campaign:${CODE}`, { dmId: 'dm-a', campaignName: 'Synthetic' });
    seedRedisSet(`campaign:${CODE}:players`, ['legacy-a']);
  });

  it('records the requested battleMapId for the campaign on a successful mint', async () => {
    const response = await POST(
      request({ role: 'player', battleMapId: 'map-a', playerId: 'legacy-a' }),
      params
    );
    expect(response.status).toBe(200);
    expect(mockRedis.zadd).toHaveBeenCalledWith(
      `campaign:${CODE}:live-maps`,
      expect.objectContaining({ member: 'map-a' })
    );
    const body = (await response.json()) as { token: string };
    expect(
      verifyBattleMapToken(body.token, 'synthetic-relay-secret')
    ).toMatchObject({ room: `${CODE}_map-a` });
  });

  it('tags a location room in the registry when the request says kind: location', async () => {
    const response = await POST(
      request({
        role: 'player',
        battleMapId: 'loc-a',
        playerId: 'legacy-a',
        kind: 'location',
      }),
      params
    );
    expect(response.status).toBe(200);
    expect(mockRedis.zadd).toHaveBeenCalledWith(
      `campaign:${CODE}:live-locations`,
      expect.objectContaining({ member: 'location:loc-a' })
    );
    const body = (await response.json()) as { token: string };
    expect(
      verifyBattleMapToken(body.token, 'synthetic-relay-secret')
    ).toMatchObject({ room: `${CODE}_loc-a` });
  });

  it('treats an unknown kind as battlemap rather than trusting the client string', async () => {
    const response = await POST(
      request({
        role: 'player',
        battleMapId: 'map-a',
        playerId: 'legacy-a',
        kind: 'tv',
      }),
      params
    );
    expect(response.status).toBe(200);
    expect(mockRedis.zadd).toHaveBeenCalledWith(
      `campaign:${CODE}:live-maps`,
      expect.objectContaining({ member: 'map-a' })
    );
  });

  it('rejects a battleMapId that cannot produce a Fieldnotes-safe room', async () => {
    const response = await POST(
      request({
        role: 'player',
        battleMapId: 'map/unsafe',
        playerId: 'legacy-a',
      }),
      params
    );

    expect(response.status).toBe(400);
    expect(authorizeCampaignMembershipRoute).not.toHaveBeenCalled();
    expect(mockRedis.zadd).not.toHaveBeenCalled();
  });

  it('records nothing when authorization is rejected', async () => {
    const response = await POST(
      request({
        role: 'player',
        battleMapId: 'map-a',
        playerId: 'not-a-member',
      }),
      params
    );
    expect(response.status).toBe(403);
    expect(mockRedis.zadd).not.toHaveBeenCalled();
  });

  it('still returns 200 with a valid token when the registry write throws', async () => {
    mockRedis.zadd.mockRejectedValueOnce(new Error('redis unavailable'));
    const response = await POST(
      request({ role: 'player', battleMapId: 'map-a', playerId: 'legacy-a' }),
      params
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(typeof body.token).toBe('string');
    expect(body.token.length).toBeGreaterThan(0);
  });
});

describe('fog protocol capability gate', () => {
  beforeEach(() => {
    resetRedis();
    vi.clearAllMocks();
    process.env.BATTLEMAP_RELAY_SECRET = 'synthetic-relay-secret';
    authorizeCampaignMembershipRoute.mockResolvedValue({ mode: 'legacy' });
    seedRedis(`campaign:${CODE}`, { dmId: 'dm-a', campaignName: 'Synthetic' });
    seedRedisSet(`campaign:${CODE}:players`, ['legacy-a']);
    seedRedis(`campaign:${CODE}:displaykey`, 'display-a');
  });

  it('accepts any request when the gate is off', async () => {
    delete process.env.BATTLEMAP_FOG_PROTOCOL_REQUIRED;
    const response = await POST(
      request({ role: 'player', battleMapId: 'map-a', playerId: 'legacy-a' }),
      params
    );
    expect(response.status).toBe(200);
  });

  it('accepts requests with fog: 1 when the gate is on', async () => {
    process.env.BATTLEMAP_FOG_PROTOCOL_REQUIRED = 'true';
    const response = await POST(
      request({
        role: 'player',
        battleMapId: 'map-a',
        playerId: 'legacy-a',
        protocols: { fog: 1 },
      }),
      params
    );
    expect(response.status).toBe(200);
  });

  it('rejects missing protocols with 426 when the gate is on', async () => {
    process.env.BATTLEMAP_FOG_PROTOCOL_REQUIRED = 'true';
    const response = await POST(
      request({ role: 'player', battleMapId: 'map-a', playerId: 'legacy-a' }),
      params
    );
    expect(response.status).toBe(426);
  });

  it('rejects wrong fog version with 426', async () => {
    process.env.BATTLEMAP_FOG_PROTOCOL_REQUIRED = 'true';
    const response = await POST(
      request({
        role: 'player',
        battleMapId: 'map-a',
        playerId: 'legacy-a',
        protocols: { fog: 2 },
      }),
      params
    );
    expect(response.status).toBe(426);
  });

  it('rejects malformed protocols with 426', async () => {
    process.env.BATTLEMAP_FOG_PROTOCOL_REQUIRED = 'true';
    const response = await POST(
      request({
        role: 'player',
        battleMapId: 'map-a',
        playerId: 'legacy-a',
        protocols: 'not-an-object',
      }),
      params
    );
    expect(response.status).toBe(426);
  });

  it('gate applies to all roles: dm, player, display', async () => {
    process.env.BATTLEMAP_FOG_PROTOCOL_REQUIRED = 'true';
    const dmResp = await POST(
      request({ role: 'dm', battleMapId: 'map-a', dmId: 'dm-a' }),
      params
    );
    expect(dmResp.status).toBe(426);

    const playerResp = await POST(
      request({ role: 'player', battleMapId: 'map-a', playerId: 'legacy-a' }),
      params
    );
    expect(playerResp.status).toBe(426);

    const displayResp = await POST(
      request({
        role: 'display',
        battleMapId: 'map-a',
        displayKey: 'display-a',
      }),
      params
    );
    expect(displayResp.status).toBe(426);
  });

  it('gate runs before authorization: does not reveal whether a map exists', async () => {
    process.env.BATTLEMAP_FOG_PROTOCOL_REQUIRED = 'true';
    const response = await POST(
      request({
        role: 'player',
        battleMapId: 'map-a',
        playerId: 'not-a-member',
      }),
      params
    );
    expect(response.status).toBe(426);
  });
});

describe('Table v1 authority token minting', () => {
  beforeEach(async () => {
    resetRedis();
    vi.clearAllMocks();
    delete process.env.BATTLEMAP_FOG_PROTOCOL_REQUIRED;
    process.env.TABLE_PROTOCOL_V1_REQUIRED = 'true';
    process.env.BATTLEMAP_RELAY_SECRET = 'synthetic-relay-secret';
    authorizeCampaignMembershipRoute.mockResolvedValue({ mode: 'legacy' });
    proveRelayAuthority.mockResolvedValue(true);
    seedRedisSet(`campaign:${CODE}:players`, ['player-a']);
    const tag = `{rk-table-v1:${await import('node:crypto').then(({ createHash }) => createHash('sha256').update(CODE).digest('hex'))}}`;
    seedRedis(
      `campaign:${tag}:table-control`,
      JSON.stringify({
        v: 1,
        epoch: EPOCH,
        writerFence: 4,
        holderPrincipal: 'legacy:dm-a',
        leaseUntil: Date.now() + 60_000,
        presentation: { sceneId: 'scene-a', revision: 1, blanked: false },
        displayGeneration: 3,
      })
    );
    await mockRedis.hset(
      `campaign:${tag}:table-scenes`,
      'scene-a',
      JSON.stringify({
        v: 1,
        sceneId: 'scene-a',
        workspaceInstanceId: 'workspace-a',
        sourceMapId: 'map-a',
        contentRevision: 1,
        safeLabel: 'Scene A',
        registeredAt: 1,
        registryRevision: 1,
        roomId: ROOM,
        deleted: false,
      })
    );
    seedRedis(
      `campaign:${tag}:room:${ROOM}:meta`,
      JSON.stringify({
        v: 1,
        generation: GENERATION,
        revision: 0,
        casToken: 'cas-a',
      })
    );
  });

  it('requires authority negotiation and mints immutable registry-room claims', async () => {
    const upgrade = await POST(
      request({
        role: 'player',
        battleMapId: 'map-a',
        sceneId: 'scene-a',
        playerId: 'player-a',
        protocols: { fog: 1 },
      }),
      params
    );
    expect(upgrade.status).toBe(426);
    const response = await POST(
      request({
        role: 'player',
        battleMapId: 'map-a',
        sceneId: 'scene-a',
        playerId: 'player-a',
        protocols: { fog: 1, authority: 1 },
      }),
      params
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      token: string;
      authority: number;
      room: string;
    };
    expect(body).toMatchObject({ authority: 1, room: ROOM });
    expect(
      verifyBattleMapToken(body.token, 'synthetic-relay-secret')
    ).toMatchObject({
      v: 1,
      campaign: CODE,
      sceneId: 'scene-a',
      room: ROOM,
      roomGeneration: GENERATION,
      role: 'player',
      playerPrincipal: 'player-a',
    });
  });

  it('keeps location requests on the legacy room/token path while the flag is on', async () => {
    seedRedis(
      `campaign:${CODE}:location:location-a`,
      validLocation('location-a')
    );
    const response = await POST(
      request({
        role: 'player',
        battleMapId: 'location-a',
        playerId: 'player-a',
        kind: 'location',
      }),
      params
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      token: string;
      authority?: number;
    };
    expect(body.authority).toBeUndefined();
    expect(
      verifyBattleMapToken(body.token, 'synthetic-relay-secret')
    ).toMatchObject({ room: `${CODE}_location-a` });
    expect(proveRelayAuthority).not.toHaveBeenCalled();
    expect(mockRedis.zadd).toHaveBeenCalledWith(
      `campaign:${CODE}:live-locations`,
      expect.objectContaining({ member: 'location:location-a' })
    );
  });

  it('treats an explicit valid sceneId as v1 even with a location hint', async () => {
    const response = await POST(
      request({
        role: 'player',
        battleMapId: 'map-a',
        sceneId: 'scene-a',
        playerId: 'player-a',
        kind: 'location',
        protocols: { fog: 1, authority: 1 },
      }),
      params
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      authority?: number;
      token: string;
    };
    expect(body.authority).toBe(1);
    expect(
      verifyBattleMapToken(body.token, 'synthetic-relay-secret')
    ).toMatchObject({ resourceKind: 'scene', sceneId: 'scene-a', room: ROOM });
    expect(mockRedis.zadd).not.toHaveBeenCalled();
  });

  it('rejects an unverified no-scene location claim without proof or live-room mutation', async () => {
    const response = await POST(
      request({
        role: 'player',
        battleMapId: 'map-a',
        playerId: 'player-a',
        kind: 'location',
      }),
      params
    );
    expect(response.status).toBe(409);
    expect(proveRelayAuthority).not.toHaveBeenCalled();
    expect(mockRedis.zadd).not.toHaveBeenCalled();
  });

  it('uses the expired-detail metadata fallback only for truly absent detail', async () => {
    seedRedis(`campaign:${CODE}:locations`, [
      validLocation('fallback-a'),
      validLocation('other-a'),
    ]);
    const response = await POST(
      request({
        role: 'player',
        battleMapId: 'fallback-a',
        playerId: 'player-a',
        kind: 'location',
      }),
      params
    );
    expect(response.status).toBe(200);
  });

  it.each([null, 1, '', ' ', 'bad/id', 'x'.repeat(129)])(
    'rejects malformed present sceneId %# without location fallback',
    async sceneId => {
      mockRedis.get.mockClear();
      const response = await POST(
        request({
          role: 'player',
          battleMapId: 'location-a',
          sceneId,
          playerId: 'player-a',
          kind: 'location',
          protocols: { fog: 1, authority: 1 },
        }),
        params
      );
      expect(response.status).toBe(400);
      expect(mockRedis.get).not.toHaveBeenCalledWith(
        `campaign:${CODE}:location:location-a`
      );
    }
  );

  it('rejects an unsafe location battleMapId before location key construction/read', async () => {
    mockRedis.get.mockClear();
    const response = await POST(
      request({
        role: 'player',
        battleMapId: 'bad/location',
        playerId: 'player-a',
        kind: 'location',
      }),
      params
    );
    expect(response.status).toBe(400);
    expect(mockRedis.get).not.toHaveBeenCalledWith(
      `campaign:${CODE}:location:bad/location`
    );
  });

  it('rejects an active source collision but ignores a tombstoned-only collision', async () => {
    seedRedis(`campaign:${CODE}:location:map-a`, validLocation('map-a'));
    const collision = await POST(
      request({
        role: 'player',
        battleMapId: 'map-a',
        playerId: 'player-a',
        kind: 'location',
      }),
      params
    );
    expect(collision.status).toBe(409);
    const tag = `{rk-table-v1:${await import('node:crypto').then(({ createHash }) => createHash('sha256').update(CODE).digest('hex'))}}`;
    await mockRedis.hset(
      `campaign:${tag}:table-scenes`,
      'scene-a',
      JSON.stringify({
        v: 1,
        sceneId: 'scene-a',
        workspaceInstanceId: 'workspace-a',
        sourceMapId: 'map-a',
        contentRevision: 1,
        safeLabel: 'Scene A',
        registeredAt: 1,
        registryRevision: 1,
        roomId: ROOM,
        deleted: true,
      })
    );
    const tombstone = await POST(
      request({
        role: 'player',
        battleMapId: 'map-a',
        playerId: 'player-a',
        kind: 'location',
      }),
      params
    );
    expect(tombstone.status).toBe(200);
  });

  it('performs no location or registry resolver reads for an unauthorized request', async () => {
    mockRedis.get.mockClear();
    mockRedis.hgetall.mockClear();
    const response = await POST(
      request({
        role: 'player',
        battleMapId: 'location-a',
        playerId: 'not-a-member',
        kind: 'location',
      }),
      params
    );
    expect(response.status).toBe(403);
    expect(mockRedis.get).not.toHaveBeenCalledWith(
      `campaign:${CODE}:location:location-a`
    );
    expect(mockRedis.hgetall).not.toHaveBeenCalled();
  });

  it('distinguishes corrupt evidence from resolver read unavailability', async () => {
    seedRedis(`campaign:${CODE}:location:corrupt-a`, 'null');
    const corrupt = await POST(
      request({
        role: 'player',
        battleMapId: 'corrupt-a',
        playerId: 'player-a',
        kind: 'location',
      }),
      params
    );
    expect(corrupt.status).toBe(409);

    mockRedis.get.mockRejectedValueOnce(new Error('redis unavailable'));
    const unavailable = await POST(
      request({
        role: 'player',
        battleMapId: 'location-a',
        playerId: 'player-a',
        kind: 'location',
      }),
      params
    );
    expect(unavailable.status).toBe(503);
  });

  it('maps corrupt registry evidence to 409 and a failed registry read to 503', async () => {
    seedRedis(
      `campaign:${CODE}:location:location-a`,
      validLocation('location-a')
    );
    const tag = `{rk-table-v1:${await import('node:crypto').then(({ createHash }) => createHash('sha256').update(CODE).digest('hex'))}}`;
    await mockRedis.hset(
      `campaign:${tag}:table-scenes`,
      'scene-a',
      JSON.stringify({ unexpected: true })
    );
    const corrupt = await POST(
      request({
        role: 'player',
        battleMapId: 'location-a',
        playerId: 'player-a',
        kind: 'location',
      }),
      params
    );
    expect(corrupt.status).toBe(409);

    mockRedis.hgetall.mockRejectedValueOnce(new Error('registry unavailable'));
    const unavailable = await POST(
      request({
        role: 'player',
        battleMapId: 'location-a',
        playerId: 'player-a',
        kind: 'location',
      }),
      params
    );
    expect(unavailable.status).toBe(503);
  });

  it('fails closed on source-map mismatch or same-authority proof failure', async () => {
    const mismatch = await POST(
      request({
        role: 'player',
        battleMapId: 'map-b',
        sceneId: 'scene-a',
        playerId: 'player-a',
        protocols: { fog: 1, authority: 1 },
      }),
      params
    );
    expect(mismatch.status).toBe(409);
    proveRelayAuthority.mockResolvedValue(false);
    const unavailable = await POST(
      request({
        role: 'player',
        battleMapId: 'map-a',
        sceneId: 'scene-a',
        playerId: 'player-a',
        protocols: { fog: 1, authority: 1 },
      }),
      params
    );
    expect(unavailable.status).toBe(503);
  });

  afterEach(() => {
    delete process.env.TABLE_PROTOCOL_V1_REQUIRED;
  });
});

describe('fog appearance token metadata', () => {
  beforeEach(() => {
    resetRedis();
    vi.clearAllMocks();
    delete process.env.BATTLEMAP_FOG_PROTOCOL_REQUIRED;
    process.env.BATTLEMAP_RELAY_SECRET = 'synthetic-relay-secret';
    authorizeCampaignMembershipRoute.mockResolvedValue({ mode: 'legacy' });
    seedRedisSet(`campaign:${CODE}:players`, ['legacy-a']);
  });

  async function mint() {
    return POST(
      request({ role: 'player', battleMapId: 'map-a', playerId: 'legacy-a' }),
      params
    );
  }

  it('returns a valid V1 projection', async () => {
    seedRedis(`campaign:${CODE}:fog-appearance:map-a`, {
      v: 1,
      appearance: 'cloudy',
      updatedAt: '2026-09-05T00:00:00.000Z',
    });
    const response = await mint();
    expect((await response.json()).fogAppearance).toBe('cloudy');
  });

  it('falls back to solid for a malformed projection record', async () => {
    seedRedis(`campaign:${CODE}:fog-appearance:map-a`, {
      v: 2,
      appearance: 'cloudy',
      updatedAt: '2026-09-05T00:00:00.000Z',
    });
    const response = await mint();
    expect((await response.json()).fogAppearance).toBe('solid');
  });

  it('returns the projected custom appearance without a source preset id', async () => {
    const material = { v: 1, kind: 'solid', color: '#ff0000' };
    seedRedis(`campaign:${CODE}:fog-appearance:map-a`, {
      v: 2,
      appearance: { v: 2, kind: 'custom', material, sourcePresetId: 'fp_1' },
      updatedAt: '2026-09-05T10:00:00.000Z',
    });
    const response = await mint();
    const body = await response.json();
    expect(body.fogAppearance).toEqual({ v: 2, kind: 'custom', material });
    expect(JSON.stringify(body.fogAppearance)).not.toContain('fp_1');
  });
});
