// @vitest-environment jsdom
import { useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { NPCShopTab } from '@/components/ui/campaign/NPCShopTab';
import type { CampaignNPC, NPCInventoryItem } from '@/types/encounter';

const updateNPC = vi.fn();

vi.mock('@/store/npcStore', () => ({
  useNPCStore: { getState: () => ({ updateNPC }) },
}));

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
});
