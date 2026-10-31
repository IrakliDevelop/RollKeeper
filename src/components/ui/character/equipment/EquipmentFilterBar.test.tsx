import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  EquipmentFilterBar,
  getEquipmentEmptyText,
} from './EquipmentFilterBar';
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
    expect(
      screen.getByRole('textbox', { name: 'Search by name' })
    ).toBeVisible();
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

describe('equipment no-match copy', () => {
  it('names a search-only query and uses filter copy when any field is active', () => {
    expect(
      getEquipmentEmptyText('weapons', {
        ...emptyFilters,
        search: 'sword',
      })
    ).toBe('No weapons match “sword”.');
    expect(
      getEquipmentEmptyText('magic items', {
        ...emptyFilters,
        category: 'ring',
      })
    ).toBe('No magic items match your filters.');
    expect(
      getEquipmentEmptyText('armor', {
        ...emptyFilters,
        search: 'plate',
        equipped: 'equipped',
      })
    ).toBe('No armor matches your filters.');
  });
});
