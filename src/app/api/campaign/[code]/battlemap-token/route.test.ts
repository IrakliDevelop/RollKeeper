import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetRedis, seedRedis, seedRedisSet } from '@/test/mocks/redis';

const { authorizeCampaignMembershipRoute } = vi.hoisted(() => ({
  authorizeCampaignMembershipRoute: vi.fn(),
}));
vi.mock('@/lib/supabase/campaignMembershipServer', () => ({
  authorizeCampaignMembershipRoute,
}));

import { POST } from './route';

const CODE = 'A1B2C3D4E5F6';

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

afterEach(() => {
  delete process.env.NEXT_PUBLIC_PROCEDURAL_FOG_ENABLED;
});

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

  it('keeps token metadata solid while the procedural rollout is disabled', async () => {
    seedRedis(`campaign:${CODE}:fog-appearance:map-a`, {
      v: 1,
      appearance: 'cloudy',
      updatedAt: '2026-09-05T00:00:00.000Z',
    });
    const response = await mint();
    expect((await response.json()).fogAppearance).toBe('solid');
  });

  it('returns a valid projection when the rollout is enabled', async () => {
    process.env.NEXT_PUBLIC_PROCEDURAL_FOG_ENABLED = 'true';
    seedRedis(`campaign:${CODE}:fog-appearance:map-a`, {
      v: 1,
      appearance: 'cloudy',
      updatedAt: '2026-09-05T00:00:00.000Z',
    });
    const response = await mint();
    expect((await response.json()).fogAppearance).toBe('cloudy');
  });

  it('falls back to solid for a future projection version', async () => {
    process.env.NEXT_PUBLIC_PROCEDURAL_FOG_ENABLED = 'true';
    seedRedis(`campaign:${CODE}:fog-appearance:map-a`, {
      v: 2,
      appearance: 'cloudy',
      updatedAt: '2026-09-05T00:00:00.000Z',
    });
    const response = await mint();
    expect((await response.json()).fogAppearance).toBe('solid');
  });
});
