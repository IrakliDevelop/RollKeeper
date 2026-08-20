import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getRedisStore, resetRedis, seedRedis } from '@/test/mocks/redis';

const { authorizeCampaignMembershipRoute } = vi.hoisted(() => ({
  authorizeCampaignMembershipRoute: vi.fn(),
}));

vi.mock('@/lib/supabase/campaignMembershipServer', () => ({
  authorizeCampaignMembershipRoute,
}));

import { PUT } from './route';

const CODE = 'A1B2C3D4E5F6';
const params = { params: Promise.resolve({ code: CODE }) };

function request(secure = false) {
  return new NextRequest(`http://localhost/api/campaign/${CODE}`, {
    method: 'PUT',
    headers: secure
      ? {
          Origin: 'http://localhost',
          'Content-Type': 'application/json',
          'x-rollkeeper-csrf': '1',
        }
      : { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dmId: 'legacy-dm',
      campaignName: 'Synthetic campaign',
      createdAt: '2000-01-01T00:00:00.000Z',
    }),
  });
}

function account(role: 'owner' | 'dm' | 'player') {
  return {
    mode: 'account' as const,
    principal: {
      campaignId: 'campaign-a',
      accountId: 'account-a',
      role,
      status: 'active' as const,
      epoch: 1,
      legacyPlayerId: role === 'player' ? 'legacy-a' : null,
      legacyCharacterId: null,
      characterId: null,
    },
  };
}

describe('membership-aware campaign core mutation', () => {
  beforeEach(() => {
    resetRedis();
    vi.clearAllMocks();
    seedRedis(`campaign:${CODE}`, {
      dmId: 'legacy-dm',
      campaignName: 'Synthetic campaign',
      createdAt: '2000-01-01T00:00:00.000Z',
    });
    authorizeCampaignMembershipRoute.mockResolvedValue({ mode: 'legacy' });
  });

  it('keeps untouched legacy campaign mutation byte-compatible', async () => {
    const before = getRedisStore().get(`campaign:${CODE}`);
    const response = await PUT(request(), params);
    expect(response.status).toBe(200);
    expect(getRedisStore().get(`campaign:${CODE}`)).toBe(before);
    expect(authorizeCampaignMembershipRoute).toHaveBeenCalledWith(CODE, true);
  });

  it('denies request-body dmId and player authority after cutover', async () => {
    authorizeCampaignMembershipRoute.mockResolvedValue(account('player'));
    const before = getRedisStore().get(`campaign:${CODE}`);
    const response = await PUT(request(true), params);
    expect(response.status).toBe(403);
    expect(getRedisStore().get(`campaign:${CODE}`)).toBe(before);
  });

  it('requires Origin and CSRF even for the Postgres-authorized owner', async () => {
    authorizeCampaignMembershipRoute.mockResolvedValue(account('owner'));
    expect((await PUT(request(), params)).status).toBe(403);
    expect((await PUT(request(true), params)).status).toBe(200);
  });

  it('fails closed when membership authority is stale or unavailable', async () => {
    authorizeCampaignMembershipRoute.mockResolvedValue({
      mode: 'denied',
      status: 503,
    });
    expect((await PUT(request(true), params)).status).toBe(503);
  });
});
