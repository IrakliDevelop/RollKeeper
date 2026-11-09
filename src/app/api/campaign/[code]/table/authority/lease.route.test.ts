import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
const hashes = new Map<string, Record<string, string>>();
vi.mock('@/lib/redis', () => ({
  getRawRedis: () => ({
    get: async (key: string) => store.get(key) ?? null,
    hget: async (key: string, field: string) =>
      hashes.get(key)?.[field] ?? null,
  }),
}));
const { authorizeTableDm } = vi.hoisted(() => ({ authorizeTableDm: vi.fn() }));
vi.mock('@/lib/tableServer/auth', () => ({ authorizeTableDm }));

import {
  tableAuthorityRoomKeys,
  tableControlKey,
  tableRegistryKey,
} from '@/lib/tableServer/keys';

import { POST as checkpointPOST } from './checkpoint/route';
import { POST as initializePOST } from './initialize-if-empty/route';

/**
 * PR08 desktop B1: two tabs of the same DM share the principal; only the tab
 * holding the live-control lease (session + fence) may capture or restore.
 */
const CODE = 'MANUAL';
const ROOM = '623e4567-e89b-42d3-a456-426614174000';
const params = { params: Promise.resolve({ code: CODE }) };
const relayFetch = vi.fn(async (input: RequestInfo | URL) =>
  String(input).endsWith('/authority-admin/checkpoint')
    ? Response.json({
        generation: 'g1',
        revision: '0',
        casToken: 'c1',
        state: {},
      })
    : Response.json({ status: 'provisioned', generation: 'g2' })
);
const state = {
  elements: [],
  layers: [],
  extensions: { fog: { pluginName: 'fog', version: 1, data: null } },
};
const post = (url: string, body: Record<string, unknown>) =>
  new NextRequest(`http://localhost${url}`, {
    method: 'POST',
    body: JSON.stringify({ dmId: 'dm-1', sceneId: 'scene-1', ...body }),
  });

beforeEach(() => {
  process.env.BATTLEMAP_RELAY_SECRET = 'secret';
  process.env.BATTLEMAP_RELAY_INTERNAL_URL = 'http://relay.test';
  vi.stubGlobal('fetch', relayFetch);
  relayFetch.mockClear();
  authorizeTableDm.mockResolvedValue({
    ok: true,
    principal: { id: 'legacy:dm-1', campaignCode: CODE, role: 'dm' },
  });
  store.clear();
  hashes.clear();
  store.set(
    tableControlKey(CODE),
    JSON.stringify({
      v: 1,
      epoch: 'e1',
      revision: 9,
      writerFence: 7,
      holderSessionId: 'session-tab-B',
      holderPrincipal: 'legacy:dm-1',
      leaseUntil: Date.now() + 60_000,
    })
  );
  hashes.set(tableRegistryKey(CODE), {
    'scene-1': JSON.stringify({ v: 1, sceneId: 'scene-1', roomId: ROOM }),
  });
  store.set(
    tableAuthorityRoomKeys(CODE, ROOM).meta,
    JSON.stringify({ v: 1, generation: 'g1', casToken: 'c1' })
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.BATTLEMAP_RELAY_SECRET;
  delete process.env.BATTLEMAP_RELAY_INTERNAL_URL;
});

describe('authority routes require the live tab (B1)', () => {
  it('refuses a capture from another tab of the same DM without calling the relay', async () => {
    const response = await checkpointPOST(
      post('/checkpoint', {
        holderSessionId: 'session-tab-A',
        expectedFence: 7,
      }),
      params
    );
    expect(response.status).toBe(403);
    expect(relayFetch).not.toHaveBeenCalled();
  });

  it('refuses a restore from another tab of the same DM without provisioning', async () => {
    const response = await initializePOST(
      post('/initialize-if-empty', {
        holderSessionId: 'session-tab-A',
        expectedFence: 7,
        expectedGeneration: 'g1',
        expectedCasToken: 'c1',
        state,
      }),
      params
    );
    expect(response.status).toBe(403);
    expect(relayFetch).not.toHaveBeenCalled();
  });

  it('refuses a request without a session or with a stale fence', async () => {
    for (const lease of [
      {},
      { holderSessionId: 'session-tab-B', expectedFence: 6 },
    ]) {
      const response = await initializePOST(
        post('/initialize-if-empty', {
          ...lease,
          expectedGeneration: 'g1',
          expectedCasToken: 'c1',
          state,
        }),
        params
      );
      expect(response.status).toBe(403);
    }
    expect(relayFetch).not.toHaveBeenCalled();
  });

  it('lets the live tab restore and sends its own fence and session to the relay', async () => {
    const response = await initializePOST(
      post('/initialize-if-empty', {
        holderSessionId: 'session-tab-B',
        expectedFence: 7,
        expectedGeneration: 'g1',
        expectedCasToken: 'c1',
        state,
      }),
      params
    );
    expect(response.status).toBe(200);
    expect(relayFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(
      String(
        (relayFetch.mock.calls[0] as unknown as [string, RequestInit])[1].body
      )
    ) as Record<string, unknown>;
    expect(body).toMatchObject({
      writerFence: 7,
      holderSessionId: 'session-tab-B',
      expectedGeneration: 'g1',
      expectedCasToken: 'c1',
    });
  });
});
