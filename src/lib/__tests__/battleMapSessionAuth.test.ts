import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/dmAuth', () => ({
  verifyDmAuthority: vi.fn(),
}));
vi.mock('@/lib/guestSessionSecurity', () => ({
  isHybridGuestServerEnabled: vi.fn(() => false),
  GUEST_SESSION_COOKIE: 'guest-session',
}));
vi.mock('@/lib/campaignMembershipSecurity', () => ({
  validateCampaignMembershipMutation: vi.fn(() => ({ ok: true })),
}));
vi.mock('@/lib/supabase/campaignMembershipServer', () => ({
  authorizeCampaignMembershipRoute: vi.fn(() =>
    Promise.resolve({ mode: 'legacy' })
  ),
}));

import { authorizeBattleMapSession } from '../battleMapSessionAuth';
import { verifyDmAuthority } from '@/lib/dmAuth';
import type { NextRequest } from 'next/server';

function fakeRequest(hasCookie = false): NextRequest {
  return {
    cookies: { has: () => hasCookie },
  } as unknown as NextRequest;
}

function fakeRedis(overrides: Record<string, unknown> = {}) {
  return {
    get: vi.fn((key: string) => Promise.resolve(overrides[key] ?? null)),
    sismember: vi.fn(() => Promise.resolve(true)),
    ...overrides,
  } as unknown as Parameters<typeof authorizeBattleMapSession>[0];
}

beforeEach(() => {
  vi.mocked(verifyDmAuthority).mockResolvedValue('ok');
});

describe('authorizeBattleMapSession', () => {
  it('rejects missing role', async () => {
    const result = await authorizeBattleMapSession(
      fakeRedis(),
      'CODE',
      fakeRequest(),
      {}
    );
    expect(result.authorized).toBe(false);
    if (!result.authorized) expect(result.status).toBe(400);
  });

  it('authorizes DM with valid dmId', async () => {
    const result = await authorizeBattleMapSession(
      fakeRedis(),
      'CODE',
      fakeRequest(),
      { role: 'dm', dmId: 'dm-1' }
    );
    expect(result).toEqual({
      authorized: true,
      role: 'dm',
      userId: 'dm-1',
    });
  });

  it('rejects DM without dmId', async () => {
    const result = await authorizeBattleMapSession(
      fakeRedis(),
      'CODE',
      fakeRequest(),
      { role: 'dm' }
    );
    expect(result.authorized).toBe(false);
    if (!result.authorized) expect(result.status).toBe(400);
  });

  it('rejects DM with failed authority', async () => {
    vi.mocked(verifyDmAuthority).mockResolvedValue('mismatch');
    const result = await authorizeBattleMapSession(
      fakeRedis(),
      'CODE',
      fakeRequest(),
      { role: 'dm', dmId: 'dm-1' }
    );
    expect(result.authorized).toBe(false);
    if (!result.authorized) expect(result.status).toBe(403);
  });

  it('authorizes player with membership', async () => {
    const result = await authorizeBattleMapSession(
      fakeRedis(),
      'CODE',
      fakeRequest(),
      { role: 'player', playerId: 'p-1' }
    );
    expect(result).toEqual({
      authorized: true,
      role: 'player',
      userId: 'p-1',
    });
  });

  it('rejects player without playerId', async () => {
    const result = await authorizeBattleMapSession(
      fakeRedis(),
      'CODE',
      fakeRequest(),
      { role: 'player' }
    );
    expect(result.authorized).toBe(false);
  });

  it('authorizes display with valid key', async () => {
    const redis = fakeRedis();
    vi.mocked(redis.get).mockResolvedValue('key-123');
    const result = await authorizeBattleMapSession(
      redis,
      'CODE',
      fakeRequest(),
      { role: 'display', displayKey: 'key-123' }
    );
    expect(result).toEqual({
      authorized: true,
      role: 'display',
      userId: 'display-CODE',
    });
  });

  it('rejects display with wrong key', async () => {
    const redis = fakeRedis();
    vi.mocked(redis.get).mockResolvedValue('key-123');
    const result = await authorizeBattleMapSession(
      redis,
      'CODE',
      fakeRequest(),
      { role: 'display', displayKey: 'wrong' }
    );
    expect(result.authorized).toBe(false);
    if (!result.authorized) expect(result.status).toBe(403);
  });

  it('rejects unknown role', async () => {
    const result = await authorizeBattleMapSession(
      fakeRedis(),
      'CODE',
      fakeRequest(),
      { role: 'spectator' as 'dm' }
    );
    expect(result.authorized).toBe(false);
    if (!result.authorized) expect(result.status).toBe(400);
  });
});
