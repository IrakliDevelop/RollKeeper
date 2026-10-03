import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { authorizeTableDm, authorityAdminContext, captureAuthorityCheckpoint } =
  vi.hoisted(() => ({
    authorizeTableDm: vi.fn(),
    authorityAdminContext: vi.fn(),
    captureAuthorityCheckpoint: vi.fn(),
  }));
vi.mock('@/lib/tableServer/auth', () => ({ authorizeTableDm }));
vi.mock('@/lib/tableServer/authorityAdmin', async importOriginal => ({
  ...(await importOriginal<
    typeof import('@/lib/tableServer/authorityAdmin')
  >()),
  authorityAdminContext,
  captureAuthorityCheckpoint,
}));

import { POST } from './route';

describe('authority checkpoint route', () => {
  beforeEach(() => {
    process.env.TABLE_PROTOCOL_V1_REQUIRED = 'true';
    authorizeTableDm.mockResolvedValue({
      ok: true,
      principal: { id: 'legacy:dm-a' },
    });
    authorityAdminContext.mockResolvedValue({ roomGeneration: 'generation-a' });
    captureAuthorityCheckpoint.mockResolvedValue(
      new Response(JSON.stringify({ generation: 'generation-a', state: {} }), {
        status: 200,
      })
    );
  });
  afterEach(() => delete process.env.TABLE_PROTOCOL_V1_REQUIRED);

  it('returns the coherent relay checkpoint for the current holder', async () => {
    const response = await POST(
      new NextRequest('http://localhost/checkpoint', {
        method: 'POST',
        body: JSON.stringify({ dmId: 'dm-a', sceneId: 'scene-a' }),
      }),
      { params: Promise.resolve({ code: 'ABC123' }) }
    );
    expect(response.status).toBe(200);
    expect(captureAuthorityCheckpoint).toHaveBeenCalledOnce();
  });

  it('rejects when current holder/generation context is unavailable', async () => {
    authorityAdminContext.mockResolvedValue(null);
    const response = await POST(
      new NextRequest('http://localhost/checkpoint', {
        method: 'POST',
        body: JSON.stringify({ dmId: 'dm-a', sceneId: 'scene-a' }),
      }),
      { params: Promise.resolve({ code: 'ABC123' }) }
    );
    expect(response.status).toBe(403);
  });
});
