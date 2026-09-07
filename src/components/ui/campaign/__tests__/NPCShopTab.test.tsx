// @vitest-environment jsdom
import { useState } from 'react';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  act,
} from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NPCShopTab } from '@/components/ui/campaign/NPCShopTab';
import { mockFetchResponse, resetFetch } from '@/test/mocks/fetch';
import type { CampaignNPC, NPCInventoryItem } from '@/types/encounter';
import type { ShopSaleLogEntry } from '@/types/shop';

const updateNPC = vi.fn();
const getEncountersByCampaign = vi.fn(() => [] as unknown[]);
let shopSalesLogByNpc: Record<string, ShopSaleLogEntry[]> = {};

vi.mock('@/store/npcStore', () => ({
  useNPCStore: Object.assign(
    (
      selector: (state: {
        shopSalesLogByNpc: typeof shopSalesLogByNpc;
      }) => unknown
    ) => selector({ shopSalesLogByNpc }),
    { getState: () => ({ updateNPC }) }
  ),
}));

vi.mock('@/store/dmStore', () => ({
  useDmStore: (selector: (state: { dmId: string }) => unknown) =>
    selector({ dmId: 'dm-1' }),
}));

vi.mock('@/store/encounterStore', () => ({
  useEncounterStore: { getState: () => ({ getEncountersByCampaign }) },
}));

const PLAYER_NAMES: Record<string, string> = { 'player-1': 'Mirelle Vane' };

vi.mock('@/components/ui/campaign/location-map/usePlayerDirectory', () => ({
  usePlayerDirectory: () => ({
    directory: {
      ids: new Set(Object.keys(PLAYER_NAMES)),
      nameOf: (id: string) => PLAYER_NAMES[id],
    },
    ensureKnown: vi.fn(),
  }),
}));

beforeEach(() => {
  resetFetch();
  getEncountersByCampaign.mockReturnValue([]);
  shopSalesLogByNpc = {};
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makeSaleLogEntry(
  overrides: Partial<ShopSaleLogEntry> = {}
): ShopSaleLogEntry {
  return {
    id: 'sale-1',
    entryId: 'item-1',
    itemName: 'Potion of Healing',
    quantity: 1,
    copper: 6500,
    playerId: 'player-1',
    at: '2026-09-07T20:42:00.000Z',
    reconciled: true,
    ...overrides,
  };
}

function makeNpc(overrides: Partial<CampaignNPC> = {}): CampaignNPC {
  return {
    id: 'npc-1',
    campaignCode: 'ABCD',
    name: 'Merchant Mo',
    armorClass: '10',
    maxHp: 10,
    speed: '30 ft',
    inventory: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeItem(overrides: Partial<NPCInventoryItem> = {}): NPCInventoryItem {
  return { id: 'item-1', name: 'Test Item', quantity: 1, ...overrides };
}

/** Wires updateNPC back into local state so sequential edits (e.g. across
 * gp/sp/cp fields) see each other's effect, the way the real store does. */
function Harness({ initial }: { initial: CampaignNPC }) {
  const [npc, setNpc] = useState(initial);
  updateNPC.mockImplementation(
    (_campaignCode: string, _id: string, updates: Partial<CampaignNPC>) => {
      setNpc(prev => ({ ...prev, ...updates }));
    }
  );
  return <NPCShopTab npc={npc} />;
}

describe('NPCShopTab', () => {
  it('shows a "price required" badge and disables the for-sale switch for an unpriceable row', () => {
    render(<Harness initial={makeNpc({ inventory: [makeItem()] })} />);

    expect(screen.getByText('price required')).toBeInTheDocument();
    expect(
      screen.getByRole('switch', { name: 'List Test Item for sale' })
    ).toBeDisabled();
  });

  it('leaves the price placeholders blank for an unpriceable row instead of showing 0', () => {
    render(<Harness initial={makeNpc({ inventory: [makeItem()] })} />);

    const gp = screen.getByRole('textbox', { name: 'Test Item price (gp)' });
    const sp = screen.getByRole('textbox', { name: 'Test Item price (sp)' });
    const cp = screen.getByRole('textbox', { name: 'Test Item price (cp)' });

    // 0 copper is a legitimate DM-authored price — an unpriceable row must
    // not suggest "free" via a 0 placeholder.
    expect(gp).not.toHaveAttribute('placeholder');
    expect(sp).not.toHaveAttribute('placeholder');
    expect(cp).not.toHaveAttribute('placeholder');
  });

  it('gives a known-but-unpriceable rarity (artifact) its own provenance line, not "no rarity"', () => {
    render(
      <Harness
        initial={makeNpc({
          inventory: [makeItem({ rarity: 'artifact' })],
        })}
      />
    );

    expect(
      screen.getByText(
        'magic item · artifact, no guideline price — set a price to sell it'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/no value, no rarity/)).not.toBeInTheDocument();
  });

  it('renders the spec\'s "Merchant\'s purse" label above the currency strip', () => {
    render(<Harness initial={makeNpc()} />);

    expect(screen.getByText("Merchant's purse")).toBeInTheDocument();
    expect(screen.queryByText('Currency')).not.toBeInTheDocument();
  });

  it('shows the derived default as placeholder text, not as the field value', () => {
    // 5432 copper = 54 gp, 3 sp, 2 cp
    render(
      <Harness initial={makeNpc({ inventory: [makeItem({ value: 5432 })] })} />
    );

    const gp = screen.getByRole('textbox', {
      name: 'Test Item price (gp)',
    }) as HTMLInputElement;
    const sp = screen.getByRole('textbox', {
      name: 'Test Item price (sp)',
    }) as HTMLInputElement;
    const cp = screen.getByRole('textbox', {
      name: 'Test Item price (cp)',
    }) as HTMLInputElement;

    expect(gp).toHaveAttribute('placeholder', '54');
    expect(sp).toHaveAttribute('placeholder', '3');
    expect(cp).toHaveAttribute('placeholder', '2');
    expect(gp.value).toBe('');
    expect(sp.value).toBe('');
    expect(cp.value).toBe('');

    // The switch is enabled — item.value alone is enough to price the row.
    expect(
      screen.getByRole('switch', { name: 'List Test Item for sale' })
    ).not.toBeDisabled();
  });

  it('toggling for-sale persists through updateNPC', () => {
    render(
      <Harness initial={makeNpc({ inventory: [makeItem({ value: 100 })] })} />
    );

    fireEvent.click(
      screen.getByRole('switch', { name: 'List Test Item for sale' })
    );

    expect(updateNPC).toHaveBeenCalledWith('ABCD', 'npc-1', {
      inventory: [expect.objectContaining({ id: 'item-1', forSale: true })],
    });
  });

  it('entering gp/sp/cp produces the exact integer priceCopper, mixing all three denominations', () => {
    render(<Harness initial={makeNpc({ inventory: [makeItem()] })} />);

    fireEvent.change(
      screen.getByRole('textbox', { name: 'Test Item price (gp)' }),
      { target: { value: '3' } }
    );
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Test Item price (sp)' }),
      { target: { value: '4' } }
    );
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Test Item price (cp)' }),
      { target: { value: '5' } }
    );

    // 3 gp (300) + 4 sp (40) + 5 cp (5) = 345 copper
    expect(updateNPC).toHaveBeenLastCalledWith('ABCD', 'npc-1', {
      inventory: [expect.objectContaining({ id: 'item-1', priceCopper: 345 })],
    });
  });

  it('lets a DM un-flag a for-sale row that became unpriceable after its value was cleared', () => {
    // Reachable today: flag a priced row for sale, then the underlying
    // item.value goes away (e.g. edited in the Inventory tab). The switch
    // must stay checked-but-editable so the DM can turn it back off, not
    // checked-and-stuck.
    render(
      <Harness
        initial={makeNpc({
          inventory: [makeItem({ forSale: true, value: undefined })],
        })}
      />
    );

    const toggle = screen.getByRole('switch', {
      name: 'List Test Item for sale',
    });
    expect(toggle).toBeChecked();
    expect(toggle).not.toBeDisabled();

    fireEvent.click(toggle);

    expect(updateNPC).toHaveBeenCalledWith('ABCD', 'npc-1', {
      inventory: [expect.objectContaining({ id: 'item-1', forSale: false })],
    });
  });

  it('clearing all three price fields removes the override entirely (falls through to the placeholder)', () => {
    render(
      <Harness
        initial={makeNpc({
          inventory: [makeItem({ priceCopper: 345 })],
        })}
      />
    );

    fireEvent.change(
      screen.getByRole('textbox', { name: 'Test Item price (gp)' }),
      { target: { value: '' } }
    );
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Test Item price (sp)' }),
      { target: { value: '' } }
    );
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Test Item price (cp)' }),
      { target: { value: '' } }
    );

    expect(updateNPC).toHaveBeenLastCalledWith('ABCD', 'npc-1', {
      inventory: [
        expect.objectContaining({ id: 'item-1', priceCopper: undefined }),
      ],
    });
    // The badge/copy re-derives from the now-absent override — this item has
    // no `value` or rarity, so it becomes unpriceable again.
    expect(screen.getByText('price required')).toBeInTheDocument();
  });

  it('typing an explicit 0 price persists as a real 0, not as a cleared field', () => {
    render(<Harness initial={makeNpc({ inventory: [makeItem()] })} />);

    fireEvent.change(
      screen.getByRole('textbox', { name: 'Test Item price (gp)' }),
      { target: { value: '0' } }
    );

    expect(updateNPC).toHaveBeenLastCalledWith('ABCD', 'npc-1', {
      inventory: [expect.objectContaining({ id: 'item-1', priceCopper: 0 })],
    });
    // A real 0 cp price makes the row sellable — no longer "price required".
    expect(screen.queryByText('price required')).not.toBeInTheDocument();
  });

  it('renders the sales log empty state unchanged when no sales are recorded', () => {
    render(<Harness initial={makeNpc({ inventory: [] })} />);

    expect(
      screen.getByText(
        'No sales yet. Sales appear here once the shop is open, even if your tab was closed at the time.'
      )
    ).toBeInTheDocument();
  });

  it('toggles the shop open switch and its subtitle copy is present', () => {
    render(<Harness initial={makeNpc()} />);

    expect(
      screen.getByText(
        "Players can't see this stock yet. Opening it lists the shop for the whole campaign, not just whoever finds the token."
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('switch', { name: 'Open for business' }));

    expect(updateNPC).toHaveBeenCalledWith(
      'ABCD',
      'npc-1',
      expect.objectContaining({
        shop: expect.objectContaining({ open: true }),
      })
    );
  });

  describe('publishing the shop', () => {
    it('toggling on publishes with entityIds resolved from matching encounter entities', async () => {
      getEncountersByCampaign.mockReturnValue([
        {
          id: 'enc-1',
          entities: [
            { id: 'entity-1', npcSourceId: 'npc-1' },
            { id: 'entity-2', npcSourceId: 'npc-1' },
            { id: 'entity-3', npcSourceId: 'someone-else' },
          ],
        },
      ]);
      const fetchFn = mockFetchResponse(200, { success: true, shop: {} });

      render(<Harness initial={makeNpc()} />);
      fireEvent.click(
        screen.getByRole('switch', { name: 'Open for business' })
      );

      await waitFor(() => expect(fetchFn).toHaveBeenCalled());
      const [url, options] = (fetchFn as ReturnType<typeof vi.fn>).mock
        .calls[0];
      expect(url).toBe('/api/campaign/ABCD/shops/npc-1');
      expect((options as RequestInit).method).toBe('PUT');
      const body = JSON.parse((options as RequestInit).body as string);
      expect(body.dmId).toBe('dm-1');
      expect([...body.entityIds].sort()).toEqual(['entity-1', 'entity-2']);
      expect(body.npc.shop).toEqual(expect.objectContaining({ open: true }));
    });

    it('toggling off tears down via the same publish route with shop.open: false', async () => {
      const fetchFn = mockFetchResponse(200, { success: true, shop: null });
      render(
        <Harness
          initial={makeNpc({
            shop: { open: true, updatedAt: '2026-01-01T00:00:00.000Z' },
          })}
        />
      );

      fireEvent.click(
        screen.getByRole('switch', { name: 'Open for business' })
      );

      await waitFor(() => expect(fetchFn).toHaveBeenCalled());
      const [, options] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse((options as RequestInit).body as string);
      expect(body.npc.shop.open).toBe(false);
    });

    it('surfaces a failed publish (non-2xx) to the DM instead of swallowing it', async () => {
      mockFetchResponse(500, { error: 'Failed to publish shop' });
      render(<Harness initial={makeNpc()} />);

      const toggle = screen.getByRole('switch', { name: 'Open for business' });
      fireEvent.click(toggle);
      // Local state flips immediately even though the publish will fail.
      expect(toggle).toBeChecked();

      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Failed to publish shop'
        )
      );
    });

    it('surfaces a rejected fetch (network failure) to the DM too', async () => {
      global.fetch = vi
        .fn()
        .mockRejectedValue(
          new Error('Network down')
        ) as unknown as typeof global.fetch;
      render(<Harness initial={makeNpc()} />);

      fireEvent.click(
        screen.getByRole('switch', { name: 'Open for business' })
      );

      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent('Network down')
      );
    });

    it('preserves shop.description across an off/on toggle cycle (regression: setOpen must merge, never replace)', () => {
      render(
        <Harness
          initial={makeNpc({
            shop: {
              open: true,
              updatedAt: '2026-01-01T00:00:00.000Z',
              description: 'Ironmonger of the Low Market',
            },
          })}
        />
      );

      fireEvent.click(
        screen.getByRole('switch', { name: 'Open for business' })
      );
      expect(updateNPC).toHaveBeenLastCalledWith(
        'ABCD',
        'npc-1',
        expect.objectContaining({
          shop: expect.objectContaining({
            open: false,
            description: 'Ironmonger of the Low Market',
          }),
        })
      );

      fireEvent.click(
        screen.getByRole('switch', { name: 'Open for business' })
      );
      expect(updateNPC).toHaveBeenLastCalledWith(
        'ABCD',
        'npc-1',
        expect.objectContaining({
          shop: expect.objectContaining({
            open: true,
            description: 'Ironmonger of the Low Market',
          }),
        })
      );
    });
  });

  describe('shop description authoring', () => {
    it('labels the field as player-visible and matches the artboard placeholder', () => {
      render(<Harness initial={makeNpc()} />);

      const field = screen.getByLabelText('Shown to players as');
      expect(field).toHaveAttribute(
        'placeholder',
        'Ironmonger of the Low Market'
      );
    });

    it('writes shop.description via updateNPC, preserving open/updatedAt', () => {
      render(
        <Harness
          initial={makeNpc({
            shop: { open: true, updatedAt: '2026-01-01T00:00:00.000Z' },
          })}
        />
      );

      fireEvent.change(screen.getByLabelText('Shown to players as'), {
        target: { value: 'Ironmonger of the Low Market' },
      });

      expect(updateNPC).toHaveBeenCalledWith(
        'ABCD',
        'npc-1',
        expect.objectContaining({
          shop: expect.objectContaining({
            open: true,
            description: 'Ironmonger of the Low Market',
          }),
        })
      );
    });

    it('round-trips the authored description into the publish payload sent to the shop route', async () => {
      const fetchFn = mockFetchResponse(200, { success: true, shop: {} });
      render(<Harness initial={makeNpc()} />);

      fireEvent.change(screen.getByLabelText('Shown to players as'), {
        target: { value: 'Ironmonger of the Low Market' },
      });
      fireEvent.click(
        screen.getByRole('switch', { name: 'Open for business' })
      );

      await waitFor(() => expect(fetchFn).toHaveBeenCalled());
      const [, options] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse((options as RequestInit).body as string);
      expect(body.npc.shop.description).toBe('Ironmonger of the Low Market');
    });
  });

  describe('open-state chrome (artboard 1a, Task 13b)', () => {
    it('the toggle card is neutral when closed and emerald-tinted when open', () => {
      render(<Harness initial={makeNpc()} />);

      const closedCard = screen
        .getByRole('switch', { name: 'Open for business' })
        .closest('div');
      expect(closedCard).toHaveClass('border-divider');
      expect(closedCard).toHaveClass('bg-surface-secondary');

      fireEvent.click(
        screen.getByRole('switch', { name: 'Open for business' })
      );

      const openCard = screen
        .getByRole('switch', { name: 'Open for business' })
        .closest('div');
      expect(openCard).toHaveClass('border-accent-emerald-border');
      expect(openCard).toHaveClass('bg-accent-emerald-bg');
    });

    it('switches the subtitle to the open-state copy, counting only for-sale/priceable/in-stock rows', () => {
      render(
        <Harness
          initial={makeNpc({
            name: 'Halvard Brenn',
            inventory: [
              makeItem({ id: 'i1', value: 100, forSale: true, quantity: 5 }),
              makeItem({ id: 'i2', value: 100, forSale: true, quantity: 0 }),
              makeItem({ id: 'i3', value: 100, forSale: false, quantity: 3 }),
            ],
          })}
        />
      );

      fireEvent.click(
        screen.getByRole('switch', { name: 'Open for business' })
      );

      expect(
        screen.getByText(
          "1 item still in stock. Players who tap Halvard Brenn's token can buy now."
        )
      ).toBeInTheDocument();
    });

    it('replaces (not supplements) the Stock helper line when open', () => {
      render(<Harness initial={makeNpc({ name: 'Halvard Brenn' })} />);

      expect(
        screen.getByText(
          "Price falls back to the item's value, then its rarity. Placeholder is what players would pay."
        )
      ).toBeInTheDocument();

      fireEvent.click(
        screen.getByRole('switch', { name: 'Open for business' })
      );

      expect(
        screen.queryByText(
          "Price falls back to the item's value, then its rarity. Placeholder is what players would pay."
        )
      ).not.toBeInTheDocument();
      expect(
        screen.getByText(
          "Stock reflects sales already reconciled to Halvard Brenn's inventory."
        )
      ).toBeInTheDocument();
    });

    it('states the campaign-wide reach of publishing in the closed-state subtitle', () => {
      render(<Harness initial={makeNpc()} />);

      expect(
        screen.getByText(
          "Players can't see this stock yet. Opening it lists the shop for the whole campaign, not just whoever finds the token."
        )
      ).toBeInTheDocument();
    });
  });

  describe('sales log (Task 13b)', () => {
    it('renders populated sales rows and the running summary', () => {
      shopSalesLogByNpc = {
        'npc-1': [
          makeSaleLogEntry({
            id: 's1',
            itemName: 'Potion of Healing',
            quantity: 1,
            copper: 6500,
            at: '2026-09-07T20:42:00.000Z',
          }),
          makeSaleLogEntry({
            id: 's2',
            itemName: 'Chain Shirt',
            quantity: 2,
            copper: 10000,
            entryId: 'item-2',
            at: '2026-09-07T20:47:00.000Z',
          }),
        ],
      };

      render(<Harness initial={makeNpc()} />);

      expect(screen.getByText('2 sales · 165 gp')).toBeInTheDocument();
      expect(screen.getByText('Potion of Healing ×1')).toBeInTheDocument();
      expect(screen.getByText('Chain Shirt ×2')).toBeInTheDocument();
      expect(screen.getByText('65 gp')).toBeInTheDocument();
      expect(screen.getByText('100 gp')).toBeInTheDocument();
      expect(screen.getAllByText(/Mirelle Vane/).length).toBe(2);
    });

    it('shows an unreconciled sale distinctly rather than dropping it', () => {
      shopSalesLogByNpc = {
        'npc-1': [
          makeSaleLogEntry({ itemName: 'Unknown item', reconciled: false }),
        ],
      };

      render(<Harness initial={makeNpc()} />);

      expect(screen.getByText('unreconciled')).toBeInTheDocument();
    });

    it('shows a "N sold" badge on the matching stock row', () => {
      shopSalesLogByNpc = {
        'npc-1': [makeSaleLogEntry({ entryId: 'item-1', quantity: 2 })],
      };

      render(
        <Harness
          initial={makeNpc({
            inventory: [makeItem({ id: 'item-1', value: 100, quantity: 3 })],
          })}
        />
      );

      expect(screen.getByText('2 sold')).toBeInTheDocument();
    });

    it('appends "— none left" once the sold-out row has zero remaining stock', () => {
      shopSalesLogByNpc = {
        'npc-1': [makeSaleLogEntry({ entryId: 'item-1', quantity: 2 })],
      };

      render(
        <Harness
          initial={makeNpc({
            inventory: [makeItem({ id: 'item-1', value: 100, quantity: 0 })],
          })}
        />
      );

      expect(screen.getByText('2 sold — none left')).toBeInTheDocument();
    });
  });

  describe('republishing while open (Task 13b, controller ruling R22)', () => {
    it('a price edit while open triggers exactly one debounced republish', async () => {
      vi.useFakeTimers();
      const fetchFn = mockFetchResponse(200, { success: true, shop: {} });
      render(
        <Harness
          initial={makeNpc({
            shop: { open: true, updatedAt: '2026-01-01T00:00:00.000Z' },
            inventory: [makeItem({ value: 100 })],
          })}
        />
      );

      const gp = screen.getByRole('textbox', {
        name: 'Test Item price (gp)',
      });
      fireEvent.change(gp, { target: { value: '1' } });
      fireEvent.change(gp, { target: { value: '12' } });
      fireEvent.change(gp, { target: { value: '123' } });

      expect(fetchFn).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(600);

      expect(fetchFn).toHaveBeenCalledTimes(1);
      const [, options] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse((options as RequestInit).body as string);
      expect(body.npc.inventory[0].priceCopper).toBe(12300);

      vi.useRealTimers();
    });

    it('does not republish an edit made while the shop is closed', async () => {
      vi.useFakeTimers();
      const fetchFn = mockFetchResponse(200, { success: true, shop: {} });
      render(
        <Harness initial={makeNpc({ inventory: [makeItem({ value: 100 })] })} />
      );

      fireEvent.change(
        screen.getByRole('textbox', { name: 'Test Item price (gp)' }),
        { target: { value: '5' } }
      );

      await vi.advanceTimersByTimeAsync(600);

      expect(fetchFn).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('the fire-time re-check prevents a stale republish when the shop closes by another means after scheduling', async () => {
      // The race this guards against: a debounced republish is scheduled
      // (a price edit while open), then something OTHER than this tab's own
      // "Open for business" toggle sets `shop.open` to false — e.g. a
      // cross-tab/cross-device NPC sync landing mid-debounce. `setOpen`
      // itself always cancels a pending debounce, so that path can never
      // exercise this; only a change that bypasses `setOpen` can, which is
      // exactly what a live sync does — it writes straight through
      // `updateNPC`, never through this tab's `useShopPublish`.
      vi.useFakeTimers();
      const fetchFn = mockFetchResponse(200, { success: true, shop: {} });
      render(
        <Harness
          initial={makeNpc({
            shop: { open: true, updatedAt: '2026-01-01T00:00:00.000Z' },
            inventory: [makeItem({ value: 100 })],
          })}
        />
      );

      fireEvent.change(
        screen.getByRole('textbox', { name: 'Test Item price (gp)' }),
        { target: { value: '5' } }
      );

      act(() => {
        updateNPC('ABCD', 'npc-1', {
          shop: { open: false, updatedAt: '2026-01-02T00:00:00.000Z' },
        });
      });

      await vi.advanceTimersByTimeAsync(600);

      expect(fetchFn).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('a price edit after a sale republishes with the already-decremented quantity unchanged (Slice 3 final review, Critical finding)', async () => {
      // The item started at 10, and a sale of 2 has already been drained by
      // `useDmShopSalesSync` — this NPC's inventory quantity (8) is already
      // net of that sale by the time this tab ever sees it. A price edit
      // must republish exactly that 8, never a stale pre-sale 10 the old
      // (double-subtracting) SHOP_SEED_SCRIPT would have needed to correct
      // for. This proves the DM-side half of the fix: the client was never
      // the one adding the bug back in, but pins that a price-only edit
      // never mutates `quantity` on its way out either.
      vi.useFakeTimers();
      const fetchFn = mockFetchResponse(200, { success: true, shop: {} });
      render(
        <Harness
          initial={makeNpc({
            shop: { open: true, updatedAt: '2026-01-01T00:00:00.000Z' },
            inventory: [makeItem({ value: 100, quantity: 8 })],
          })}
        />
      );

      fireEvent.change(
        screen.getByRole('textbox', { name: 'Test Item price (gp)' }),
        { target: { value: '5' } }
      );

      await vi.advanceTimersByTimeAsync(600);

      expect(fetchFn).toHaveBeenCalledTimes(1);
      const [, options] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse((options as RequestInit).body as string);
      expect(body.npc.inventory[0].quantity).toBe(8);
      expect(body.npc.inventory[0].priceCopper).toBe(500);

      vi.useRealTimers();
    });

    it('flushes a pending debounced republish on unmount instead of silently dropping it (Slice 3 final review, Minor finding)', async () => {
      vi.useFakeTimers();
      const fetchFn = mockFetchResponse(200, { success: true, shop: {} });
      const { unmount } = render(
        <Harness
          initial={makeNpc({
            shop: { open: true, updatedAt: '2026-01-01T00:00:00.000Z' },
            inventory: [makeItem({ value: 100 })],
          })}
        />
      );

      fireEvent.change(
        screen.getByRole('textbox', { name: 'Test Item price (gp)' }),
        { target: { value: '5' } }
      );

      // Unmount well within the 600ms debounce window — closing the NPC
      // dialog right after typing must not lose this edit.
      expect(fetchFn).not.toHaveBeenCalled();
      unmount();

      expect(fetchFn).toHaveBeenCalledTimes(1);
      const [, options] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse((options as RequestInit).body as string);
      expect(body.npc.inventory[0].priceCopper).toBe(500);

      vi.useRealTimers();
    });

    it('surfaces a failed republish to the DM', async () => {
      vi.useFakeTimers();
      mockFetchResponse(500, { error: 'Failed to publish shop' });
      render(
        <Harness
          initial={makeNpc({
            shop: { open: true, updatedAt: '2026-01-01T00:00:00.000Z' },
            inventory: [makeItem({ value: 100 })],
          })}
        />
      );

      fireEvent.change(
        screen.getByRole('textbox', { name: 'Test Item price (gp)' }),
        { target: { value: '5' } }
      );

      await vi.advanceTimersByTimeAsync(600);
      // The debounced republish's fetch has now fired; switch back to real
      // timers so `waitFor`'s own polling (which uses `setTimeout`) can run
      // while the fetch/json promise chain resolves.
      vi.useRealTimers();

      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Failed to publish shop'
        )
      );
    });
  });
});
