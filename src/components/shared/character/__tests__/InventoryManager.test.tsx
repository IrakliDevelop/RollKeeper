import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { InventoryManager, inventoryLocationKey } from '../InventoryManager';
import {
  ConfirmDialogHost,
  cancelAllDialogs,
} from '@/components/ui/feedback/confirm-dialog';
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
  cancelAllDialogs();
  cleanup();
  localStorage.removeItem('rollkeeper-ui-prefs');
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

  it('shows and hides row details with the manager detail toggle', () => {
    render(<InventoryManager items={mockItems} />);
    expect(screen.queryByText('10 lb')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show item details' }));
    expect(screen.getByText('10 lb')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Details: Rope' })
    ).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Show item details' }));
    expect(screen.queryByText('10 lb')).toBeNull();
  });

  it('keeps manager details visible when a filtered row remounts', () => {
    render(<InventoryManager items={mockItems} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show item details' }));
    const search = screen.getByRole('searchbox', { name: 'Search items' });
    fireEvent.change(search, { target: { value: 'Torch' } });
    expect(screen.queryByRole('button', { name: 'Details: Rope' })).toBeNull();
    fireEvent.change(search, { target: { value: '' } });
    expect(
      screen.getByRole('button', { name: 'Details: Rope' })
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('10 lb')).toBeVisible();
  });

  it('filters items by search query', () => {
    render(<InventoryManager items={mockItems} />);
    const searchInput = screen.getByPlaceholderText('Search items');
    fireEvent.change(searchInput, { target: { value: 'Rope' } });
    expect(screen.getAllByText('Rope').length).toBeGreaterThan(0);
    expect(screen.queryByText('Torch')).toBeNull();
    expect(screen.queryByText('Health Potion')).toBeNull();
  });

  it('uses search-only and field-filter no-match messages', () => {
    render(<InventoryManager items={mockItems} />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search items' }), {
      target: { value: 'missing' },
    });
    expect(screen.getByText('No items match “missing”.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.click(screen.getByRole('combobox', { name: 'Category' }));
    fireEvent.click(screen.getByRole('option', { name: 'Consumable' }));
    expect(
      screen.getByText('No items match your search or filters.')
    ).toBeVisible();
  });

  it('shows Add item button when not readonly', () => {
    const onAddItem = vi.fn();
    render(<InventoryManager items={mockItems} onAddItem={onAddItem} />);
    const addButtons = screen.getAllByText('Add item');
    expect(addButtons.length).toBeGreaterThan(0);
  });

  it('deletes only after confirming and leaves the item on cancel', async () => {
    const onDeleteItem = vi.fn();
    const onUpdateItem = vi.fn();
    render(
      <>
        <ConfirmDialogHost />
        <InventoryManager
          items={mockItems}
          onDeleteItem={onDeleteItem}
          onUpdateItem={onUpdateItem}
        />
      </>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Details: Rope' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete item', description: 'Rope' })
    );
    expect(
      screen.getByRole('alertdialog', { name: 'Delete Rope?' })
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onDeleteItem).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete item', description: 'Rope' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete item' }));
    await waitFor(() => expect(onDeleteItem).toHaveBeenCalledWith('i1'));
  });

  it('focuses Add item after a confirmed delete removes the row', async () => {
    function Harness() {
      const [items, setItems] = React.useState(mockItems);
      return (
        <InventoryManager
          items={items}
          onAddItem={vi.fn()}
          onDeleteItem={id =>
            setItems(previous => previous.filter(item => item.id !== id))
          }
        />
      );
    }
    render(
      <>
        <ConfirmDialogHost />
        <Harness />
      </>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Details: Rope' }));
    const deleteButton = screen.getByRole('button', { name: 'Delete item' });
    deleteButton.focus();
    fireEvent.click(deleteButton);
    fireEvent.click(screen.getByRole('button', { name: 'Delete item' }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Details: Rope' })).toBeNull()
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add item' })).toHaveFocus()
    );
  });

  it('calls onQuantityChange when plus button clicked', () => {
    const onQuantityChange = vi.fn();
    render(
      <InventoryManager items={mockItems} onQuantityChange={onQuantityChange} />
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Increase quantity: Rope' })
    );
    expect(onQuantityChange).toHaveBeenCalledWith('i1', 2);
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
    expect(screen.queryByText('Add item')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Details: Rope' }));
    expect(screen.queryByRole('button', { name: 'Delete item' })).toBeNull();
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
    expect(screen.getAllByText('Add your first item').length).toBeGreaterThan(
      0
    );
  });

  it('shows the sheet totals explanation only for a sheet summary', () => {
    const { rerender } = render(<InventoryManager items={mockItems} />);
    expect(
      screen.queryByText(/Weight and value include all weapons/)
    ).toBeNull();
    rerender(
      <InventoryManager
        items={mockItems}
        sheetSummary
        overrideTotalWeight={99.9}
        overrideTotalValue={5000}
      />
    );
    expect(
      screen.getByText(/Weight and value include all weapons/)
    ).toBeVisible();
    fireEvent.change(screen.getByPlaceholderText('Search items'), {
      target: { value: 'Rope' },
    });
    expect(screen.getByText('Matching quantity')).toBeVisible();
    expect(screen.getByText('99.9')).toBeVisible();
    expect(screen.getByText('50 gp')).toBeVisible();
  });

  it('keeps generic totals filtered when no sheet override is supplied', () => {
    render(<InventoryManager items={mockItems} />);
    fireEvent.change(screen.getByPlaceholderText('Search items'), {
      target: { value: 'Rope' },
    });
    expect(screen.getByText('10.0')).toBeVisible();
    expect(screen.getByText('1 gp')).toBeVisible();
  });

  it('scopes location collapse by encoded character ID and exact location', () => {
    expect(inventoryLocationKey('a:b', 'Bag:Holding')).not.toBe(
      inventoryLocationKey('a', 'b:Bag:Holding')
    );
    const { rerender } = render(
      <InventoryManager items={mockItems} locationScopeId="character-a" />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Backpack' }));
    expect(screen.queryByText('Rope')).toBeNull();
    rerender(
      <InventoryManager items={mockItems} locationScopeId="character-b" />
    );
    expect(screen.getByText('Rope')).toBeVisible();
    rerender(
      <InventoryManager items={mockItems} locationScopeId="character-a" />
    );
    expect(screen.queryByText('Rope')).toBeNull();
  });
});
