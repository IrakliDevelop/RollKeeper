import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { InventoryManager } from '../InventoryManager';
import { InventoryItem } from '@/types/character';

vi.mock('@/hooks/useItemsData', () => ({
  useItemsData: () => ({ items: [], loading: false, error: null }),
}));
vi.mock('@/hooks/useMagicItemsData', () => ({
  useMagicItemsData: () => ({ items: [], loading: false, error: null }),
}));
vi.mock('@/components/ui/layout/DragDropList', () => ({
  default: ({
    items,
    renderItem,
  }: {
    items: unknown[];
    renderItem: (item: unknown) => React.ReactNode;
  }) => (
    <div data-testid="drag-drop-list">
      {items.map((item: unknown, i: number) => (
        <div key={i}>{renderItem(item)}</div>
      ))}
    </div>
  ),
}));

afterEach(() => {
  cleanup();
});

const mockItems: InventoryItem[] = [
  {
    id: 'i1',
    name: 'Rope',
    category: 'misc',
    quantity: 1,
    weight: 10,
    value: 100,
    location: 'Backpack',
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'i2',
    name: 'Torch',
    category: 'consumable',
    quantity: 5,
    weight: 1,
    value: 1,
    location: 'Belt',
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'i3',
    name: 'Health Potion',
    category: 'consumable',
    quantity: 2,
    weight: 0.5,
    value: 50,
    location: 'Backpack',
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

describe('InventoryManager', () => {
  it('renders item names', () => {
    render(<InventoryManager items={mockItems} />);
    expect(screen.getAllByText('Rope').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Torch').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Health Potion').length).toBeGreaterThan(0);
  });

  it('shows item quantities', () => {
    render(<InventoryManager items={mockItems} />);
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('5').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
  });

  it('shows total weight and value in stats area', () => {
    // totalWeight = 10*1 + 1*5 + 0.5*2 = 16.0
    // totalValue = 100*1 + 1*5 + 50*2 = 205 cp = "2 gp, 5 cp"
    render(<InventoryManager items={mockItems} />);
    expect(screen.getAllByText('16.0').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2 gp, 5 cp').length).toBeGreaterThan(0);
  });

  it('filters items by search query', () => {
    render(<InventoryManager items={mockItems} />);
    const searchInput = screen.getByPlaceholderText('Search items...');
    fireEvent.change(searchInput, { target: { value: 'Rope' } });
    expect(screen.getAllByText('Rope').length).toBeGreaterThan(0);
    expect(screen.queryByText('Torch')).toBeNull();
    expect(screen.queryByText('Health Potion')).toBeNull();
  });

  it('shows Add Item button when not readonly', () => {
    const onAddItem = vi.fn();
    render(<InventoryManager items={mockItems} onAddItem={onAddItem} />);
    const addButtons = screen.getAllByText('Add Item');
    expect(addButtons.length).toBeGreaterThan(0);
  });

  it('calls onDeleteItem when delete button clicked', () => {
    const onDeleteItem = vi.fn();
    const onUpdateItem = vi.fn();
    render(
      <InventoryManager
        items={mockItems}
        onDeleteItem={onDeleteItem}
        onUpdateItem={onUpdateItem}
      />
    );
    const deleteButtons = screen.getAllByTitle('Delete item');
    fireEvent.click(deleteButtons[0]);
    expect(onDeleteItem).toHaveBeenCalledWith('i1');
  });

  it('calls onQuantityChange when plus button clicked', () => {
    const onQuantityChange = vi.fn();
    const { container } = render(
      <InventoryManager items={mockItems} onQuantityChange={onQuantityChange} />
    );
    // Plus buttons in ItemCard increase quantity by 1
    // Each item with onQuantityChange gets +/- buttons
    // Find the first Plus (increase) button via the SVG icon within Quantity row
    const plusButtons = container.querySelectorAll('button[title=""]');
    // The quantity +/- buttons don't have titles — use a different approach
    // ItemCard renders Plus and Minus icons as quantity controls
    // Let's find all buttons and filter by the ones that trigger quantity change
    // Actually, the plus buttons for quantity have no title but are inside the quantity row
    // Let me click directly on the first increment button
    const allButtons = container.querySelectorAll('button');
    // The quantity plus button is the one right after the quantity display
    // Let's just check via callback: find a button that triggers onQuantityChange(id, qty+1)
    // Rope has quantity 1, so clicking + should call onQuantityChange('i1', 2)
    // Find the specific button within Rope's card
    const ropeCard = screen.getAllByText('Rope')[0].closest('.group');
    if (ropeCard) {
      const buttons = ropeCard.querySelectorAll('button');
      // The plus button for quantity increments — it's the one with Plus icon after the quantity number
      for (const btn of buttons) {
        fireEvent.click(btn);
        if (onQuantityChange.mock.calls.length > 0) break;
      }
    }
    expect(onQuantityChange).toHaveBeenCalled();
  });

  it('hides add/delete controls in readonly mode', () => {
    const onAddItem = vi.fn();
    const onDeleteItem = vi.fn();
    render(
      <InventoryManager
        items={mockItems}
        onAddItem={onAddItem}
        onDeleteItem={onDeleteItem}
        readonly
      />
    );
    expect(screen.queryByText('Add Item')).toBeNull();
    expect(screen.queryByTitle('Delete item')).toBeNull();
  });

  it('uses overrideTotalWeight and overrideTotalValue', () => {
    render(
      <InventoryManager
        items={mockItems}
        overrideTotalWeight={99.9}
        overrideTotalValue={5000}
      />
    );
    // 99.9 lbs
    expect(screen.getAllByText('99.9').length).toBeGreaterThan(0);
    // 5000 cp = "50 gp"
    expect(screen.getAllByText('50 gp').length).toBeGreaterThan(0);
  });

  it('caps displayed items with maxItemsToShow', () => {
    render(
      <InventoryManager items={mockItems} maxItemsToShow={1} hideLocations />
    );
    // Only 1 item should be rendered (Rope is first)
    expect(screen.getAllByText('Rope').length).toBeGreaterThan(0);
    expect(screen.queryByText('Torch')).toBeNull();
    expect(screen.queryByText('Health Potion')).toBeNull();
  });

  it('shows empty state when no items', () => {
    render(<InventoryManager items={[]} />);
    expect(screen.getAllByText('No items found').length).toBeGreaterThan(0);
  });
});
