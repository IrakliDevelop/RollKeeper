// @vitest-environment jsdom
import { useState } from 'react';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NPCShopTab } from '@/components/ui/campaign/NPCShopTab';
import { mockFetchResponse, resetFetch } from '@/test/mocks/fetch';
import type { CampaignNPC, NPCInventoryItem } from '@/types/encounter';

const updateNPC = vi.fn();
const getEncountersByCampaign = vi.fn(() => [] as unknown[]);

vi.mock('@/store/npcStore', () => ({
  useNPCStore: { getState: () => ({ updateNPC }) },
}));

vi.mock('@/store/dmStore', () => ({
  useDmStore: (selector: (state: { dmId: string }) => unknown) =>
    selector({ dmId: 'dm-1' }),
}));

vi.mock('@/store/encounterStore', () => ({
  useEncounterStore: { getState: () => ({ getEncountersByCampaign }) },
}));

beforeEach(() => {
  resetFetch();
  getEncountersByCampaign.mockReturnValue([]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

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

  it('renders the sales log empty state (Slice 2 has no sales data source)', () => {
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
        "Players can't see this stock yet. Turn it on to publish."
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
});
