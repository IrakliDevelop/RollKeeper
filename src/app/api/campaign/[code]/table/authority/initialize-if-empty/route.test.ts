import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { authorizeTableDm, authorityAdminContext, provisionAuthorityRoom } =
  vi.hoisted(() => ({
    authorizeTableDm: vi.fn(),
    authorityAdminContext: vi.fn(),
    provisionAuthorityRoom: vi.fn(),
  }));
vi.mock('@/lib/tableServer/auth', () => ({ authorizeTableDm }));
vi.mock('@/lib/tableServer/authorityAdmin', async importOriginal => ({
  ...(await importOriginal<
    typeof import('@/lib/tableServer/authorityAdmin')
  >()),
  authorityAdminContext,
  provisionAuthorityRoom,
}));

import { POST } from './route';

const emptyState = {
  elements: [],
  layers: [],
  extensions: { fog: { pluginName: 'fog', version: 1, data: null } },
};

describe('authority initialize-if-empty route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TABLE_PROTOCOL_V1_REQUIRED = 'true';
    authorizeTableDm.mockResolvedValue({
      ok: true,
      principal: { id: 'legacy:dm-a' },
    });
    authorityAdminContext.mockResolvedValue({
      roomGeneration: null,
      casToken: null,
    });
    provisionAuthorityRoom.mockResolvedValue(
      new Response(
        JSON.stringify({ status: 'provisioned', generation: 'new-generation' }),
        { status: 200 }
      )
    );
  });
  afterEach(() => delete process.env.TABLE_PROTOCOL_V1_REQUIRED);

  const request = (extra: Record<string, unknown> = {}) =>
    new NextRequest('http://localhost/initialize', {
      method: 'POST',
      body: JSON.stringify({
        dmId: 'dm-a',
        sceneId: 'scene-a',
        state: emptyState,
        ...extra,
      }),
    });

  it('allows one guarded empty-room initializer', async () => {
    const response = await POST(request(), {
      params: Promise.resolve({ code: 'ABC123' }),
    });
    expect(response.status).toBe(200);
    expect(provisionAuthorityRoom).toHaveBeenCalledWith(
      expect.any(Object),
      emptyState,
      { generation: null, casToken: null }
    );
  });

  it('rejects stale restore generation/CAS before relay mutation', async () => {
    authorityAdminContext.mockResolvedValue({
      roomGeneration: 'generation-current',
      casToken: 'cas-current',
    });
    const response = await POST(
      request({
        expectedGeneration: 'generation-old',
        expectedCasToken: 'cas-old',
      }),
      { params: Promise.resolve({ code: 'ABC123' }) }
    );
    expect(response.status).toBe(409);
    expect(provisionAuthorityRoom).not.toHaveBeenCalled();
  });

  it.each([
    ['object-shaped elements', { ...emptyState, elements: {} }],
    [
      'unknown extension',
      { ...emptyState, extensions: { ...emptyState.extensions, other: {} } },
    ],
    ['missing fog', { ...emptyState, extensions: {} }],
    ['string-encoded state', JSON.stringify(emptyState)],
    [
      'unknown fog member',
      {
        ...emptyState,
        extensions: {
          fog: {
            pluginName: 'fog',
            version: 1,
            data: null,
            unknown: true,
          },
        },
      },
    ],
    [
      'object-shaped fog tiles',
      {
        ...emptyState,
        extensions: {
          fog: {
            pluginName: 'fog',
            version: 1,
            data: { meta: { version: 1 }, tiles: {} },
          },
        },
      },
    ],
    ['unknown top-level member', { ...emptyState, cursor: {} }],
  ])(
    'rejects non-canonical authority state (%s) before relay mutation',
    async (_label, state) => {
      const response = await POST(request({ state }), {
        params: Promise.resolve({ code: 'ABC123' }),
      });
      expect(response.status).toBe(400);
      expect(provisionAuthorityRoom).not.toHaveBeenCalled();
    }
  );
});
