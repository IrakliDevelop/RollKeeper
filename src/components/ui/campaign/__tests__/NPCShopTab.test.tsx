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
