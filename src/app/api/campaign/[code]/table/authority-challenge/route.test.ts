import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { authorizeTableDm, proveRelayAuthority } = vi.hoisted(() => ({
  authorizeTableDm: vi.fn(),
  proveRelayAuthority: vi.fn(),
}));
vi.mock('@/lib/tableServer/auth', () => ({ authorizeTableDm }));
vi.mock('@/lib/tableServer/authorityProof', () => ({ proveRelayAuthority }));

import { POST } from './route';

describe('Table authority challenge route', () => {
  beforeEach(() => {
    process.env.TABLE_PROTOCOL_V1_REQUIRED = 'true';
    authorizeTableDm.mockResolvedValue({
      ok: true,
      principal: { id: 'legacy:dm-a', campaignCode: 'ABC123', role: 'dm' },
    });
    proveRelayAuthority.mockResolvedValue(true);
  });

  afterEach(() => delete process.env.TABLE_PROTOCOL_V1_REQUIRED);

  it('returns success only after the relay reads the same authority', async () => {
    const request = new NextRequest(
      'http://localhost/api/campaign/ABC123/table/authority-challenge',
      { method: 'POST', body: JSON.stringify({ dmId: 'dm-a' }) }
    );
    const response = await POST(request, {
      params: Promise.resolve({ code: 'ABC123' }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      verified: true,
      expiresInSeconds: 30,
    });
  });

  it('fails closed when relay proof fails', async () => {
    proveRelayAuthority.mockResolvedValue(false);
    const request = new NextRequest(
      'http://localhost/api/campaign/ABC123/table/authority-challenge',
      { method: 'POST', body: JSON.stringify({ dmId: 'dm-a' }) }
    );
    const response = await POST(request, {
      params: Promise.resolve({ code: 'ABC123' }),
    });
    expect(response.status).toBe(503);
  });
});
