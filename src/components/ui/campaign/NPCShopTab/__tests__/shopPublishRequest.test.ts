// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDmStore } from '@/store/dmStore';
import { mockFetchResponse, resetFetch } from '@/test/mocks/fetch';
import type { CampaignNPC } from '@/types/encounter';

import {
  ShopPublishError,
  closePublishedShop,
  sendShopPublish,
} from '../shopPublishRequest';

function makeNpc(overrides: Partial<CampaignNPC> = {}): CampaignNPC {
  return {
    id: 'npc-1',
    campaignCode: 'ABCD',
    name: 'Merchant Mo',
    armorClass: '10',
    maxHp: 10,
    speed: '30 ft',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  useDmStore.setState({ dmId: 'dm-1' });
});

afterEach(() => {
  resetFetch();
  vi.restoreAllMocks();
});

describe('closePublishedShop', () => {
  it.each([
    ['a closed shop', { shop: { open: false, updatedAt: 'x' } }],
    ['no shop', {}],
  ])('sends nothing for an NPC with %s', (_label, extra) => {
    const fetchFn = mockFetchResponse(200, { success: true, shop: null });

    closePublishedShop(makeNpc(extra));

    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('closes an open shop with one PUT that keeps the description', () => {
    const fetchFn = mockFetchResponse(200, { success: true, shop: null });

    closePublishedShop(
      makeNpc({
        shop: {
          open: true,
          updatedAt: '2026-01-01T00:00:00.000Z',
          description: 'Ironmonger of the Low Market',
        },
      })
    );

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe('/api/campaign/ABCD/shops/npc-1');
    expect(init.method).toBe('PUT');
    const body = JSON.parse(init.body as string);
    expect(body.dmId).toBe('dm-1');
    expect(body.entityIds).toEqual([]);
    expect(body.npc.shop.open).toBe(false);
    expect(body.npc.shop.description).toBe('Ironmonger of the Low Market');
  });

  it('logs a rejected request instead of throwing', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    global.fetch = vi
      .fn()
      .mockRejectedValue(new Error('Network down')) as unknown as typeof fetch;

    expect(() =>
      closePublishedShop(
        makeNpc({ shop: { open: true, updatedAt: '2026-01-01T00:00:00.000Z' } })
      )
    ).not.toThrow();

    await vi.waitFor(() => expect(consoleError).toHaveBeenCalledTimes(1));
  });
});

describe('sendShopPublish', () => {
  it('rejects with a ShopPublishError carrying the status and server text', async () => {
    mockFetchResponse(500, { error: 'Redis down' });

    const error = await sendShopPublish(makeNpc(), 'dm-1', []).catch(
      (e: unknown) => e
    );

    expect(error).toBeInstanceOf(ShopPublishError);
    expect((error as ShopPublishError).status).toBe(500);
    expect((error as ShopPublishError).serverMessage).toBe('Redis down');
  });

  it('resolves on a 2xx response', async () => {
    mockFetchResponse(200, { success: true, shop: {} });

    await expect(
      sendShopPublish(makeNpc(), 'dm-1', ['e1'])
    ).resolves.toBeUndefined();
  });
});
