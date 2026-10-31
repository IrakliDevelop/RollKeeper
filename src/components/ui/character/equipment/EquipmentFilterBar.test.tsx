import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EquipmentFilterBar } from './EquipmentFilterBar';
import type { EquipmentFilters } from '@/hooks/useEquipmentFilters';

afterEach(cleanup);

const emptyFilters: EquipmentFilters = {
  search: '',
  equipped: 'all',
  attuned: 'all',
  category: 'all',
  rarity: 'all',
  hasCharges: 'all',
};

describe('EquipmentFilterBar', () => {
  it('keeps search visible and starts advanced filters closed', () => {
    render(
      <EquipmentFilterBar
        filters={emptyFilters}
        onFilterChange={vi.fn()}
        onReset={vi.fn()}
        hasActiveFilters={false}
        config={{ showCategory: true, categoryOptions: ['all', 'simple'] }}
      />
    );
    expect(screen.getByPlaceholderText('Search by name')).toBeVisible();
    const trigger = screen.getByRole('button', { name: 'Filters' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('All Categories')).toBeNull();
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows active count and clear action even while fields are closed', () => {
    const onReset = vi.fn();
    render(
      <EquipmentFilterBar
        filters={{ ...emptyFilters, search: 'blade', equipped: 'equipped' }}
        onFilterChange={vi.fn()}
        onReset={onReset}
        hasActiveFilters
        config={{}}
      />
    );
    expect(screen.getByRole('button', { name: 'Filters' })).toHaveTextContent(
      '2'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onReset).toHaveBeenCalledOnce();
  });
});
