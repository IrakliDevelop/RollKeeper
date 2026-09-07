import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import {
  isShopToken,
  useMerchantShopActivation,
} from '@/components/ui/campaign/location-map/useMerchantShopActivation';

import type { CanvasElement, ElementActivationEvent } from '@fieldnotes/core';
import type { PublicShop } from '@/types/shop';

afterEach(() => {
  vi.restoreAllMocks();
});

function tokenEl(overrides: Record<string, unknown> = {}): CanvasElement {
  return {
    id: 'el-1',
    type: 'shape',
    position: { x: 0, y: 0 },
    size: { w: 40, h: 40 },
    zIndex: 0,
    locked: false,
    layerId: 'l1',
    ...overrides,
  } as unknown as CanvasElement;
}

function merchantToken(overrides: Record<string, unknown> = {}): CanvasElement {
  return tokenEl({
    tokenKind: 'combatant',
    entityId: 'entity-1',
    shopNpcId: 'npc-1',
    ...overrides,
  });
}

function activateEvent(element: CanvasElement): ElementActivationEvent {
  return {
    element,
    world: { x: 0, y: 0 },
    pointerType: 'mouse',
    gesture: 'single',
  };
}

function mockFetchShop(shop: PublicShop | null): void {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    json: () => Promise.resolve({ shop }),
  } as Response);
}

const OPEN_SHOP: PublicShop = {
  npcId: 'npc-1',
  merchantName: 'Brenn',
  merchantDescription: 'Ironmonger of the Low Market',
  entityIds: ['entity-1'],
  items: [],
};

describe('isShopToken', () => {
  it('is true for a combatant token stamped with a non-empty shopNpcId', () => {
    expect(isShopToken(merchantToken())).toBe(true);
  });

  it('is false for a combatant token with no shopNpcId (a plain monster/player token)', () => {
    expect(
      isShopToken(tokenEl({ tokenKind: 'combatant', entityId: 'entity-1' }))
    ).toBe(false);
  });

  it('is false for a non-combatant element even if it happens to carry shopNpcId', () => {
    expect(
      isShopToken(
        tokenEl({
          tokenKind: 'player',
          entityId: 'entity-1',
          shopNpcId: 'npc-1',
        })
      )
    ).toBe(false);
  });

  it('is false when entityId or shopNpcId is an empty string', () => {
    expect(isShopToken(merchantToken({ entityId: '' }))).toBe(false);
    expect(isShopToken(merchantToken({ shopNpcId: '' }))).toBe(false);
  });
});

describe('useMerchantShopActivation', () => {
  it('opens the shop when the tapped entity id is in the fetched shop entityIds', async () => {
    mockFetchShop(OPEN_SHOP);
    const { result } = renderHook(() => useMerchantShopActivation('CODE'));

    act(() => {
      result.current.handleActivate(activateEvent(merchantToken()));
    });

    await waitFor(() => expect(result.current.openShop).not.toBeNull());
    expect(result.current.openShop).toEqual({
      npcId: 'npc-1',
      merchantName: 'Brenn',
      merchantDescription: 'Ironmonger of the Low Market',
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/campaign/CODE/shops/npc-1'
    );
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not open when the tapped element is not a shop token (no fetch at all)', async () => {
    mockFetchShop(OPEN_SHOP);
    const { result } = renderHook(() => useMerchantShopActivation('CODE'));

    act(() => {
      result.current.handleActivate(
        activateEvent(tokenEl({ tokenKind: 'combatant', entityId: 'entity-1' }))
      );
    });

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(result.current.openShop).toBeNull();
  });

  it('does not open when the shop is null (closed/unpublished)', async () => {
    mockFetchShop(null);
    const { result } = renderHook(() => useMerchantShopActivation('CODE'));

    act(() => {
      result.current.handleActivate(activateEvent(merchantToken()));
    });

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
    expect(result.current.openShop).toBeNull();
  });

  it('does not open when the shop is open but its entityIds does not include the tapped entity (stale/mismatched stamp)', async () => {
    mockFetchShop({ ...OPEN_SHOP, entityIds: ['some-other-entity'] });
    const { result } = renderHook(() => useMerchantShopActivation('CODE'));

    act(() => {
      result.current.handleActivate(activateEvent(merchantToken()));
    });

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
    expect(result.current.openShop).toBeNull();
  });

  it('does not throw and stays closed when the fetch itself rejects', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    const { result } = renderHook(() => useMerchantShopActivation('CODE'));

    act(() => {
      result.current.handleActivate(activateEvent(merchantToken()));
    });

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
    expect(result.current.openShop).toBeNull();
  });

  it('closeShop clears an open shop', async () => {
    mockFetchShop(OPEN_SHOP);
    const { result } = renderHook(() => useMerchantShopActivation('CODE'));

    act(() => {
      result.current.handleActivate(activateEvent(merchantToken()));
    });
    await waitFor(() => expect(result.current.openShop).not.toBeNull());

    act(() => {
      result.current.closeShop();
    });
    expect(result.current.openShop).toBeNull();
  });

  it('a later tap on a different merchant supersedes an in-flight earlier one, even if the earlier response arrives last', async () => {
    let resolveFirst: ((value: { shop: PublicShop | null }) => void) | null =
      null;
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveFirst = value =>
              resolve({ json: () => Promise.resolve(value) } as Response);
          })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          json: () =>
            Promise.resolve({
              shop: { ...OPEN_SHOP, npcId: 'npc-2', entityIds: ['entity-2'] },
            }),
        } as Response)
      );

    const { result } = renderHook(() => useMerchantShopActivation('CODE'));

    act(() => {
      result.current.handleActivate(activateEvent(merchantToken()));
    });
    act(() => {
      result.current.handleActivate(
        activateEvent(
          merchantToken({ entityId: 'entity-2', shopNpcId: 'npc-2' })
        )
      );
    });

    await waitFor(() => expect(result.current.openShop?.npcId).toBe('npc-2'));

    // The first (slow) request finally resolves — it must NOT clobber the
    // second tap's already-applied result.
    await act(async () => {
      resolveFirst?.({ shop: OPEN_SHOP });
    });
    expect(result.current.openShop?.npcId).toBe('npc-2');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
