import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { vi } from 'vitest';
import { InventoryManager } from './InventoryManager';
import type { InventoryItem } from '@/types/character';

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

const sampleItems: InventoryItem[] = [
  {
    id: '1',
    name: 'Longsword',
    category: 'weapon',
    location: 'Belt',
    quantity: 1,
    weight: 3,
    value: 1500,
    description: 'A versatile martial weapon.',
    tags: ['martial', 'melee'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Healing Potion',
    category: 'consumable',
    location: 'Backpack',
    quantity: 3,
    weight: 0.5,
    value: 5000,
    description: 'Heals 2d4+2 hit points.',
    tags: ['healing', 'consumable'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '3',
    name: 'Rope (50 ft)',
    category: 'tool',
    location: 'Backpack',
    quantity: 1,
    weight: 10,
    value: 100,
    description: 'Hempen rope, 50 feet.',
    tags: ['utility'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

const meta: Meta<typeof InventoryManager> = {
  component: InventoryManager,
  tags: ['autodocs'],
  args: {
    items: sampleItems,
    onAddItem: fn(),
    onUpdateItem: fn(),
    onDeleteItem: fn(),
    onQuantityChange: fn(),
    onReorderItems: fn(),
    onSendItem: fn(),
  },
  decorators: [
    Story => (
      <div style={{ maxWidth: 600 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const WithItems: Story = {};

export const WithItemsDark: Story = {
  globals: { theme: 'dark' },
};

export const Empty: Story = {
  args: { items: [] },
};

export const EmptyDark: Story = {
  ...Empty,
  globals: { theme: 'dark' },
};

export const Readonly: Story = {
  args: { readonly: true },
};

export const ReadonlyDark: Story = {
  ...Readonly,
  globals: { theme: 'dark' },
};
