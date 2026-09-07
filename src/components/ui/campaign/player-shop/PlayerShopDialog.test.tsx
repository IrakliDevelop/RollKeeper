import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PlayerShopDialog } from './index';
import {
  formatShortfall,
  describePurchaseError,
} from './PlayerShopDialog.utils';
import { canAfford, purseToCopper, spendCopper } from '@/utils/currency';
import type { Currency } from '@/types/character';
import type { PublicShop, PublicShopItem } from '@/types/shop';

const PURSE: Currency = {
  platinum: 0,
  gold: 34,
  electrum: 0,
  silver: 6,
  copper: 12,
};

function makeItem(overrides: Partial<PublicShopItem> = {}): PublicShopItem {
  return {
    id: 'arrows',
    name: 'Arrows (20)',
    itemKind: 'inventory',
    priceCopper: 100,
    remainingQuantity: 10,
    ...overrides,
  };
}

function makeShop(items: PublicShopItem[]): PublicShop {
  return {
    npcId: 'npc-1',
    merchantName: 'Halvard Brenn',
    merchantDescription: 'Ironmonger of the Low Market',
    entityIds: ['entity-1'],
    items,
  };
}

function mockFetchSequence(
  responses: Array<{ ok?: boolean; status?: number; body: unknown }>
) {
  const fetchMock = vi.fn();
  for (const { ok = true, status = 200, body } of responses) {
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve({
        ok,
        status,
        json: () => Promise.resolve(body),
      })
    );
  }
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderDialog(shop: PublicShop, purse: Currency = PURSE) {
  mockFetchSequence([{ body: { shop } }]);
  render(
    <PlayerShopDialog
      open
      onOpenChange={() => {}}
      campaignCode="ABCD"
      npcId="npc-1"
      playerId="player-1"
      purse={purse}
    />
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('PlayerShopDialog card states', () => {
  it('renders an affordable item with its price/stock line and an active Buy button', async () => {
    renderDialog(makeShop([makeItem()]));
    await screen.findByText('Halvard Brenn');

    expect(screen.getByText('1 gp each · 10 left')).toBeInTheDocument();
    const buyButton = screen.getByRole('button', { name: 'Buy · 1 gp' });
    expect(buyButton).not.toBeDisabled();
  });

  it('renders an unaffordable item with the exact shortfall pill and a disabled Buy button', async () => {
    // priceCopper 6500 (65 gp) vs. a 3472cp purse -> shortfall 3028cp.
    renderDialog(
      makeShop([
        makeItem({
          id: 'potion',
          name: 'Potion of Healing',
          priceCopper: 6500,
          remainingQuantity: 5,
        }),
      ])
    );
    await screen.findByText('Potion of Healing');

    expect(screen.getByText('65 gp each · 5 left')).toBeInTheDocument();
    expect(
      screen.getByText("You're 30 gp 2 sp 8 cp short")
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buy · 65 gp' })).toBeDisabled();
  });

  it('renders a sold-out item with a neutral badge, a dimmed stepper, and an inert Sold out button', async () => {
    renderDialog(
      makeShop([
        makeItem({
          id: 'shirt',
          name: 'Chain Shirt',
          priceCopper: 5000,
          remainingQuantity: 0,
        }),
      ])
    );
    await screen.findByText('Chain Shirt');

    // "Sold out" appears twice: the neutral badge next to the name, and the
    // inert button in place of "Buy".
    expect(screen.getAllByText('Sold out')).toHaveLength(2);
    expect(screen.getByText('50 gp each · none left')).toBeInTheDocument();
    const buyButton = screen.getByRole('button', { name: 'Sold out' });
    expect(buyButton).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'More Chain Shirt' })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Fewer Chain Shirt' })
    ).toBeDisabled();
  });
});

describe('merchant header reads both name and description from the SAME shop record (controller review fix)', () => {
  it('shows merchantDescription from the fetched shop, not a separately-supplied prop', async () => {
    renderDialog(makeShop([makeItem()]));
    await screen.findByText('Halvard Brenn');
    expect(
      screen.getByText('Ironmonger of the Low Market')
    ).toBeInTheDocument();
  });

  it('omits the description line entirely when the shop record has none', async () => {
    mockFetchSequence([
      {
        body: {
          shop: {
            npcId: 'npc-1',
            merchantName: 'Halvard Brenn',
            entityIds: ['entity-1'],
            items: [makeItem()],
          },
        },
      },
    ]);
    render(
      <PlayerShopDialog
        open
        onOpenChange={() => {}}
        campaignCode="ABCD"
        npcId="npc-1"
        playerId="player-1"
        purse={PURSE}
      />
    );
    await screen.findByText('Halvard Brenn');
    expect(
      screen.queryByText('Ironmonger of the Low Market')
    ).not.toBeInTheDocument();
  });
});

describe('initialShop seeds the dialog and skips the redundant fetch (controller review fix)', () => {
  it('renders immediately from initialShop with no fetch at all', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <PlayerShopDialog
        open
        onOpenChange={() => {}}
        campaignCode="ABCD"
        npcId="npc-1"
        playerId="player-1"
        initialShop={makeShop([makeItem()])}
        purse={PURSE}
      />
    );

    expect(screen.getByText('Halvard Brenn')).toBeInTheDocument();
    expect(
      screen.getByText('Ironmonger of the Low Market')
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('shortfall + preview computation', () => {
  it('formats the shortfall using the same total the debit is checked against (canAfford/purseToCopper)', () => {
    const costCopper = 6500;
    const shortfall = costCopper - purseToCopper(PURSE);
    expect(canAfford(PURSE, costCopper)).toBe(false);
    expect(formatShortfall(shortfall)).toBe("You're 30 gp 2 sp 8 cp short");
  });

  it('shows the footer purse total and, once an item is focused, the post-purchase preview computed via spendCopper', async () => {
    renderDialog(makeShop([makeItem({ remainingQuantity: 10 })]));
    await screen.findByText('Halvard Brenn');

    expect(screen.getByText('34 gp · 6 sp · 12 cp')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'More Arrows (20)' }));

    expect(
      screen.getByText('After buying 2 Arrows (20) — 2 gp')
    ).toBeInTheDocument();
    const after = spendCopper(PURSE, 200)!;
    expect(
      screen.getByText(
        `${after.gold} gp · ${after.silver} sp · ${after.copper} cp`
      )
    ).toBeInTheDocument();
  });
});

describe('session-committed spend corrects affordability across multiple purchases (composition fix)', () => {
  it('marks a second item unaffordable once an earlier purchase this session has committed enough of the purse, even though purse itself is untouched', async () => {
    // 50 gp purse. Sword (40 gp) and Shield (30 gp) are each individually
    // affordable against the raw 50 gp purse — the dialog and the
    // character-sheet debit hook are never co-mounted, so nothing debits
    // `purse` until the sheet is reopened. Buying the Sword first must still
    // make the Shield show as unaffordable, because only 10 gp is actually
    // left to spend this session.
    const purse: Currency = {
      platinum: 0,
      gold: 50,
      electrum: 0,
      silver: 0,
      copper: 0,
    };
    const shop = makeShop([
      makeItem({
        id: 'sword',
        name: 'Sword',
        priceCopper: 4000,
        remainingQuantity: 1,
      }),
      makeItem({
        id: 'shield',
        name: 'Shield',
        priceCopper: 3000,
        remainingQuantity: 1,
      }),
    ]);
    renderDialog(shop, purse);
    await screen.findByText('Sword');

    // Both start out affordable against the raw 50 gp purse.
    expect(screen.getByRole('button', { name: 'Buy · 40 gp' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Buy · 30 gp' })).not.toBeDisabled();

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          entryId: 'sword',
          grantedQuantity: 1,
          costCopper: 4000,
          remainingQuantity: 0,
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Buy · 40 gp' }));
    await waitFor(() =>
      expect(
        screen.getByText(
          'Bought. The item will appear on your character shortly.'
        )
      ).toBeInTheDocument()
    );

    // Only 10 gp of the 50 gp purse remains uncommitted; the 30 gp Shield
    // must now read as unaffordable, with a shortfall pill computed against
    // the SAME effective (post-commitment) total, not the stale 50 gp.
    const shortfall = 3000 - purseToCopper(spendCopper(purse, 4000)!);
    expect(screen.getByText(formatShortfall(shortfall))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buy · 30 gp' })).toBeDisabled();
  });
});

describe('purchase flow', () => {
  it('surfaces a partial grant instead of a flat success message', async () => {
    renderDialog(makeShop([makeItem({ remainingQuantity: 10 })]));
    await screen.findByText('Halvard Brenn');

    const user = userEvent.setup();
    // Request 2 units; the server (magic-item fan-out clamp, or a partial
    // sale) grants only 1.
    await user.click(screen.getByRole('button', { name: 'More Arrows (20)' }));

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          entryId: 'arrows',
          grantedQuantity: 1,
          costCopper: 100,
          remainingQuantity: 9,
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await user.click(screen.getByRole('button', { name: 'Buy · 2 gp' }));

    await waitFor(() =>
      expect(
        screen.getByText(/Bought 1 of 2 — that's all the stock allowed/)
      ).toBeInTheDocument()
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.quantity).toBe(2);
  });

  it('reuses the same requestId across a retry of the same intent, and mints a new one after success', async () => {
    renderDialog(makeShop([makeItem({ remainingQuantity: 10 })]));
    await screen.findByText('Halvard Brenn');

    const fetchMock = vi
      .fn()
      // First attempt: network failure (lost reply).
      .mockRejectedValueOnce(new Error('network down'))
      // Retry of the same intent: succeeds.
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            entryId: 'arrows',
            grantedQuantity: 1,
            costCopper: 100,
            remainingQuantity: 9,
          }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    const buyButton = screen.getByRole('button', { name: 'Buy · 1 gp' });
    await user.click(buyButton);
    await waitFor(() =>
      expect(
        screen.getByText('Could not complete that purchase.')
      ).toBeInTheDocument()
    );
    await user.click(screen.getByRole('button', { name: 'Buy · 1 gp' }));
    await waitFor(() =>
      expect(
        screen.getByText(
          'Bought. The item will appear on your character shortly.'
        )
      ).toBeInTheDocument()
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(secondBody.requestId).toBe(firstBody.requestId);
  });

  it('mints a fresh requestId for a new purchase after a prior success', async () => {
    renderDialog(makeShop([makeItem({ remainingQuantity: 10 })]));
    await screen.findByText('Halvard Brenn');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          entryId: 'arrows',
          grantedQuantity: 1,
          costCopper: 100,
          remainingQuantity: 9,
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Buy · 1 gp' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: 'Buy · 1 gp' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const firstBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(secondBody.requestId).not.toBe(firstBody.requestId);
  });

  it.each([
    ['shop-closed', "This merchant isn't trading right now."],
    ['entry-not-found', 'That item is no longer on offer.'],
    ['insufficient-stock', 'Someone bought the last one.'],
  ])('maps the %s server error to its copy', (error, expected) => {
    expect(describePurchaseError(error)).toBe(expected);
  });

  it('falls back to a generic message for an unmapped error (e.g. the 403 receipt-ownership mismatch)', () => {
    expect(
      describePurchaseError('Purchase request does not match this player/item')
    ).toBe('Could not complete that purchase.');
    expect(describePurchaseError(undefined)).toBe(
      'Could not complete that purchase.'
    );
  });

  it('surfaces each server error code as its mapped copy end-to-end through the dialog', async () => {
    renderDialog(makeShop([makeItem({ remainingQuantity: 10 })]));
    await screen.findByText('Halvard Brenn');

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ error: 'insufficient-stock' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Buy · 1 gp' }));

    await waitFor(() =>
      expect(
        screen.getByText('Someone bought the last one.')
      ).toBeInTheDocument()
    );
  });
});
