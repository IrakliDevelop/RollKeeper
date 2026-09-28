import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  membership: vi.fn(),
  dmAuthority: vi.fn(),
  eval: vi.fn(),
  hybridGuest: vi.fn(() => false),
}));
vi.mock('@/lib/supabase/campaignMembershipServer', () => ({
  authorizeCampaignMembershipRoute: mocks.membership,
}));
vi.mock('@/lib/dmAuth', () => ({ verifyDmAuthority: mocks.dmAuthority }));
vi.mock('@/lib/guestSessionSecurity', () => ({
  GUEST_SESSION_COOKIE: 'rollkeeper-guest',
  isHybridGuestServerEnabled: mocks.hybridGuest,
}));
vi.mock('@/lib/redis', () => ({
  getRedis: () => ({}),
  getRawRedis: () => ({ eval: mocks.eval }),
  campaignSharedKey: (code: string, feature: string) =>
    `campaign:${code}:shared:${feature}`,
}));
vi.mock('@/lib/relayPoke', () => ({ sendInitiativePoke: vi.fn() }));

import { POST } from './route';

const params = { params: Promise.resolve({ code: 'SYNTH03A' }) };
const initialize = { type: 'initialize', operationId: 'op-1' };

function request(
  headers: Record<string, string> = {},
  body: unknown = { dmId: 'dm-one', command: initialize }
) {
  return new NextRequest(
    'http://localhost/api/campaign/SYNTH03A/table/control',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost',
        'x-rollkeeper-csrf': '1',
        ...headers,
      },
      body: JSON.stringify(body),
    }
  );
}

beforeEach(() => {
  process.env.TABLE_PROTOCOL_V1_REQUIRED = 'true';
  mocks.membership.mockReset().mockResolvedValue({ mode: 'legacy' });
  mocks.dmAuthority.mockReset().mockResolvedValue('ok');
  mocks.eval
    .mockReset()
    .mockResolvedValue(
      JSON.stringify({ status: 'committed', reason: 'current', current: null })
    );
  mocks.hybridGuest.mockReturnValue(false);
});
afterEach(() => {
  delete process.env.TABLE_PROTOCOL_V1_REQUIRED;
});

describe('Table control authorization and request boundary', () => {
  it('rejects account players even if they claim a DM role', async () => {
    mocks.membership.mockResolvedValue({
      mode: 'account',
      principal: {
        accountId: 'player',
        role: 'player',
        campaignId: 'campaign',
        status: 'active',
        epoch: 1,
      },
    });
    const response = await POST(
      request({}, { dmId: 'dm-one', role: 'owner', command: initialize }),
      params
    );
    expect(response.status).toBe(403);
    expect(mocks.eval).not.toHaveBeenCalled();
  });

  it('binds account DM to both membership and the campaign DM record', async () => {
    mocks.membership.mockResolvedValue({
      mode: 'account',
      principal: {
        accountId: 'owner',
        role: 'owner',
        campaignId: 'campaign',
        status: 'active',
        epoch: 1,
      },
    });
    mocks.dmAuthority.mockResolvedValue('mismatch');
    expect((await POST(request(), params)).status).toBe(403);
    expect(mocks.eval).not.toHaveBeenCalled();
    mocks.dmAuthority.mockResolvedValue('ok');
    expect((await POST(request(), params)).status).toBe(200);
    expect(mocks.eval).toHaveBeenCalledOnce();
  });

  it('rejects absent origin and CSRF before Redis mutation', async () => {
    expect(
      (await POST(request({ origin: 'http://attacker.test' }), params)).status
    ).toBe(403);
    expect(
      (await POST(request({ 'x-rollkeeper-csrf': '0' }), params)).status
    ).toBe(403);
    expect(mocks.eval).not.toHaveBeenCalled();
  });

  it('denies guest cookies in legacy mode', async () => {
    mocks.hybridGuest.mockReturnValue(true);
    const req = request();
    req.cookies.set('rollkeeper-guest', 'synthetic');
    expect((await POST(req, params)).status).toBe(403);
    expect(mocks.eval).not.toHaveBeenCalled();
  });

  it('keeps legacy DM mode deliberate and rejects bodies over 16 KiB', async () => {
    expect((await POST(request(), params)).status).toBe(200);
    expect(mocks.dmAuthority).toHaveBeenCalledWith(
      expect.anything(),
      'SYNTH03A',
      'dm-one'
    );
    expect(
      (
        await POST(
          request(
            {},
            { dmId: 'dm-one', command: initialize, padding: 'x'.repeat(17_000) }
          ),
          params
        )
      ).status
    ).toBe(400);
  });

  it('advertises unavailable when protocol is disabled', async () => {
    process.env.TABLE_PROTOCOL_V1_REQUIRED = 'false';
    expect((await POST(request(), params)).status).toBe(503);
    expect(mocks.eval).not.toHaveBeenCalled();
  });
});
