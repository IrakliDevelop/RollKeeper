import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  membership: vi.fn(),
  dmAuthority: vi.fn(),
  hgetall: vi.fn(),
}));
vi.mock('@/lib/supabase/campaignMembershipServer', () => ({
  authorizeCampaignMembershipRoute: mocks.membership,
}));
vi.mock('@/lib/dmAuth', () => ({ verifyDmAuthority: mocks.dmAuthority }));
vi.mock('@/lib/guestSessionSecurity', () => ({
  GUEST_SESSION_COOKIE: 'rollkeeper-guest',
  isHybridGuestServerEnabled: () => false,
}));
vi.mock('@/lib/redis', () => ({
  getRedis: () => ({}),
  getRawRedis: () => ({
    eval: vi.fn(),
    get: vi.fn(),
    hgetall: mocks.hgetall,
  }),
}));

import { GET } from './route';

const params = { params: Promise.resolve({ code: 'SYNTH03A' }) };
const url = 'http://localhost/api/campaign/SYNTH03A/table/scenes?dmId=dm-one';

beforeEach(() => {
  mocks.membership.mockReset().mockResolvedValue({ mode: 'legacy' });
  mocks.dmAuthority.mockReset().mockResolvedValue('ok');
  mocks.hgetall.mockReset().mockResolvedValue({});
});

describe('Table scenes registry read (review B7)', () => {
  it('returns the DM registry with Cache-Control: no-store', async () => {
    mocks.hgetall.mockResolvedValue({
      'scene-1': JSON.stringify({
        v: 1,
        sceneId: 'scene-1',
        workspaceInstanceId: 'workspace-1',
        sourceMapId: 'map-1',
        registryRevision: 1,
        deleted: false,
      }),
    });
    const response = await GET(new NextRequest(url), params);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toMatchObject({
      scenes: [{ sceneId: 'scene-1', sourceMapId: 'map-1' }],
    });
  });

  it('maps a Redis failure to a formatted, uncached 503', async () => {
    mocks.hgetall.mockRejectedValue(new Error('redis down'));
    const response = await GET(new NextRequest(url), params);
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      error: 'Table control is unavailable',
    });
  });

  it('keeps the DM authorization denial uncached', async () => {
    mocks.dmAuthority.mockResolvedValue('mismatch');
    const response = await GET(new NextRequest(url), params);
    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.hgetall).not.toHaveBeenCalled();
  });
});
