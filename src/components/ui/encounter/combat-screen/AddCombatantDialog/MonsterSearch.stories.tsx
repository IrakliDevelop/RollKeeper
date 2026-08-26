import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn } from 'storybook/test';
import { MonsterSearch } from './MonsterSearch';
import { createMockProcessedMonster } from '@/test/helpers';

const results = [
  createMockProcessedMonster({ id: 'guard', name: 'Guard', cr: '1/8' }),
  createMockProcessedMonster({
    id: 'guard-drake',
    name: 'Guard Drake',
    cr: '2',
  }),
  createMockProcessedMonster({
    id: 'guardian-naga',
    name: 'Guardian Naga',
    cr: '10',
  }),
];

const meta: Meta<typeof MonsterSearch> = {
  title: 'Encounter/AddCombatantDialog/MonsterSearch',
  component: MonsterSearch,
  args: {
    query: 'guard',
    onQueryChange: fn(),
    results,
    total: 63,
    hasMore: true,
    loading: false,
    loadingMore: false,
    onSelect: fn(),
    onLoadMore: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof MonsterSearch>;

export const Truncated: Story = {
  name: 'Truncated results show count and Load more',
  play: async ({ canvas, args }) => {
    await expect(canvas.getByText('Showing 3 of 63')).toBeInTheDocument();
    const button = canvas.getByRole('button', { name: /load more/i });
    button.click();
    await expect(args.onLoadMore).toHaveBeenCalled();
  },
};

export const LoadingMore: Story = {
  name: 'Load more disabled while loading',
  args: { loadingMore: true },
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button', { name: /loading/i });
    await expect(button).toBeDisabled();
  },
};

export const Complete: Story = {
  name: 'No footer when all results shown',
  args: { total: 3, hasMore: false },
  play: async ({ canvas }) => {
    await expect(canvas.queryByText(/showing/i)).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: /load more/i })
    ).not.toBeInTheDocument();
  },
};
