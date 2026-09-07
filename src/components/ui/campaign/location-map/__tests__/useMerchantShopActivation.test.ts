import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import {
  isCombatantToken,
  useMerchantShopActivation,
} from '@/components/ui/campaign/location-map/useMerchantShopActivation';

import type { CanvasElement, ElementActivationEvent } from '@fieldnotes/core';
import type { PublicShop, PublicShopIndexEntry } from '@/types/shop';

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

function combatantToken(
  overrides: Record<string, unknown> = {}
): CanvasElement {
  return tokenEl({
    tokenKind: 'combatant',
    entityId: 'entity-1',
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

const INDEX_ENTRY: PublicShopIndexEntry = {
  npcId: 'npc-1',
  merchantName: 'Brenn',
  entityIds: ['entity-1'],
};

const OPEN_SHOP: PublicShop = {
  npcId: 'npc-1',
  merchantName: 'Brenn',
  merchantDescription: 'Ironmonger of the Low Market',
  entityIds: ['entity-1'],
  items: [],
};

/** Mocks the two-hop fetch chain in order: the index GET, then the
 *  confirming per-npc GET (only reached when a match is found). */
function mockFetchChain(
  indexShops: PublicShopIndexEntry[],
  shop?: PublicShop | null
) {
  const fetchMock = vi.fn();
  fetchMock.mockImplementationOnce(() =>
    Promise.resolve({ json: () => Promise.resolve({ shops: indexShops }) })
  );
  if (shop !== undefined) {
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve({ json: () => Promise.resolve({ shop }) })
    );
  }
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('isCombatantToken', () => {
  it('is true for any combatant token', () => {
    expect(isCombatantToken(combatantToken())).toBe(true);
  });

  it('is false for a player token', () => {
    expect(
      isCombatantToken(tokenEl({ tokenKind: 'player', characterId: 'char-1' }))
    ).toBe(false);
  });

  it('is false for an unstamped element', () => {
    expect(isCombatantToken(tokenEl())).toBe(false);
  });
});

describe('useMerchantShopActivation', () => {
  it('opens the shop when the index matches and the confirmed shop entityIds includes the tapped entity', async () => {
    const fetchMock = mockFetchChain([INDEX_ENTRY], OPEN_SHOP);
    const { result } = renderHook(() => useMerchantShopActivation('CODE'));

    await act(async () => {
      await result.current.handleActivate(activateEvent(combatantToken()));
    });

    expect(result.current.openShop).toEqual({
      npcId: 'npc-1',
      shop: OPEN_SHOP,
    });
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/campaign/CODE/shops');
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/campaign/CODE/shops/npc-1'
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not fetch at all when the tapped element is not a combatant token', async () => {
    const fetchMock = mockFetchChain([INDEX_ENTRY], OPEN_SHOP);
    const { result } = renderHook(() => useMerchantShopActivation('CODE'));

    await act(async () => {
      await result.current.handleActivate(
        activateEvent(tokenEl({ tokenKind: 'player', characterId: 'c-1' }))
      );
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.openShop).toBeNull();
  });

  it('stops after the index fetch (never confirms) when no index entry matches the tapped entity', async () => {
    const fetchMock = mockFetchChain([
      { ...INDEX_ENTRY, entityIds: ['some-other-entity'] },
    ]);
    const { result } = renderHook(() => useMerchantShopActivation('CODE'));

    await act(async () => {
      await result.current.handleActivate(activateEvent(combatantToken()));
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.openShop).toBeNull();
  });

  it('does not open when the index matches but the confirmed shop is null (closed since the index was read)', async () => {
    const fetchMock = mockFetchChain([INDEX_ENTRY], null);
    const { result } = renderHook(() => useMerchantShopActivation('CODE'));

    await act(async () => {
      await result.current.handleActivate(activateEvent(combatantToken()));
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.openShop).toBeNull();
  });

  it('does not open when the confirmed shop no longer lists the tapped entity — the index is a lookup, never an authority', async () => {
    const fetchMock = mockFetchChain([INDEX_ENTRY], {
      ...OPEN_SHOP,
      entityIds: ['some-other-entity'],
    });
    const { result } = renderHook(() => useMerchantShopActivation('CODE'));

    await act(async () => {
      await result.current.handleActivate(activateEvent(combatantToken()));
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.openShop).toBeNull();
  });

  it('does not throw and stays closed when the index fetch itself rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    const { result } = renderHook(() => useMerchantShopActivation('CODE'));

    await act(async () => {
      await result.current.handleActivate(activateEvent(combatantToken()));
    });

    expect(result.current.openShop).toBeNull();
  });

  it('does not throw and stays closed when the confirming fetch rejects', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        Promise.resolve({
          json: () => Promise.resolve({ shops: [INDEX_ENTRY] }),
        })
      )
      .mockRejectedValueOnce(new TypeError('offline'));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useMerchantShopActivation('CODE'));

    await act(async () => {
      await result.current.handleActivate(activateEvent(combatantToken()));
    });

    expect(result.current.openShop).toBeNull();
  });

  it('closeShop clears an open shop', async () => {
    mockFetchChain([INDEX_ENTRY], OPEN_SHOP);
    const { result } = renderHook(() => useMerchantShopActivation('CODE'));

    await act(async () => {
      await result.current.handleActivate(activateEvent(combatantToken()));
    });
    expect(result.current.openShop).not.toBeNull();

    act(() => {
      result.current.closeShop();
    });
    expect(result.current.openShop).toBeNull();
  });

  it('a later tap on a different merchant supersedes an in-flight earlier one, even if the earlier chain resolves last', async () => {
    let resolveFirstIndex:
      | ((value: { shops: PublicShopIndexEntry[] }) => void)
      | null = null;
    const fetchMock = vi
      .fn()
      // First tap's index fetch: parked, resolved manually at the end.
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveFirstIndex = value =>
              resolve({ json: () => Promise.resolve(value) });
          })
      )
      // Second tap's index fetch: resolves immediately with a match.
      .mockImplementationOnce(() =>
        Promise.resolve({
          json: () =>
            Promise.resolve({
              shops: [
                { ...INDEX_ENTRY, npcId: 'npc-2', entityIds: ['entity-2'] },
              ],
            }),
        })
      )
      // Second tap's confirm fetch.
      .mockImplementationOnce(() =>
        Promise.resolve({
          json: () =>
            Promise.resolve({
              shop: { ...OPEN_SHOP, npcId: 'npc-2', entityIds: ['entity-2'] },
            }),
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useMerchantShopActivation('CODE'));

    act(() => {
      void result.current.handleActivate(activateEvent(combatantToken()));
    });
    await act(async () => {
      await result.current.handleActivate(
        activateEvent(combatantToken({ entityId: 'entity-2' }))
      );
    });

    expect(result.current.openShop?.npcId).toBe('npc-2');

    // The first (parked) tap's index response finally arrives, matching
    // ITS OWN entity — it must not clobber the second tap's already-applied
    // result, nor trigger a stray confirm fetch for a superseded request.
    await act(async () => {
      resolveFirstIndex?.({ shops: [INDEX_ENTRY] });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.openShop?.npcId).toBe('npc-2');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
