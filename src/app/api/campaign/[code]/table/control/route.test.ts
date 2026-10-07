import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  membership: vi.fn(),
  dmAuthority: vi.fn(),
  eval: vi.fn(),
  get: vi.fn(),
  hgetall: vi.fn(),
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
  getRawRedis: () => ({
    eval: mocks.eval,
    get: mocks.get,
    hgetall: mocks.hgetall,
  }),
  campaignSharedKey: (code: string, feature: string) =>
    `campaign:${code}:shared:${feature}`,
}));
vi.mock('@/lib/relayPoke', () => ({ sendInitiativePoke: vi.fn() }));

import { GET, POST } from './route';

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
  mocks.get.mockReset().mockResolvedValue(null);
  mocks.hgetall.mockReset().mockResolvedValue({});
});
afterEach(() => {
  delete process.env.TABLE_PROTOCOL_V1_REQUIRED;
});

describe('Table control authorization and request boundary', () => {
  it('returns the authenticated registry needed for idempotent scene registration', async () => {
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
    const response = await GET(
      new NextRequest(
        'http://localhost/api/campaign/SYNTH03A/table/control?dmId=dm-one'
      ),
      params
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      current: null,
      registry: [
        {
          sceneId: 'scene-1',
          sourceMapId: 'map-1',
          workspaceInstanceId: 'workspace-1',
        },
      ],
    });
  });

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

  it('PR04: GET answers 503 JSON when control or registry reads fail', async () => {
    const url =
      'http://localhost/api/campaign/SYNTH03A/table/control?dmId=dm-one';
    mocks.get.mockResolvedValue('{not json');
    let response = await GET(new NextRequest(url), params);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'Table control is unavailable',
    });
    mocks.get.mockResolvedValue(null);
    mocks.hgetall.mockRejectedValue(new Error('redis down'));
    response = await GET(new NextRequest(url), params);
    expect(response.status).toBe(503);
  });

  it('PR04: rejects extra keys on base-only presentation commands', async () => {
    const command = {
      type: 'blank',
      operationId: 'op-2',
      expectedEpoch: '19a12345-1234-4123-8123-123456789abc',
      expectedRevision: 1,
      expectedFence: 1,
      holderSessionId: 'session-1',
      sceneId: 'smuggled',
    };
    expect(
      (await POST(request({}, { dmId: 'dm-one', command }), params)).status
    ).toBe(400);
    expect(mocks.eval).not.toHaveBeenCalled();
  });
});
