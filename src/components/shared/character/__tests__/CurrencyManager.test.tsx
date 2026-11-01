import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CurrencyManager } from '../CurrencyManager';
import { Currency } from '@/types/character';

afterEach(() => {
  cleanup();
});

const mockCurrency: Currency = {
  copper: 50,
  silver: 20,
  electrum: 5,
  gold: 100,
  platinum: 2,
};

describe('CurrencyManager', () => {
  it('renders all 5 currency type badges', () => {
    render(<CurrencyManager currency={mockCurrency} />);
    expect(screen.getAllByText('pp').length).toBeGreaterThan(0);
    expect(screen.getAllByText('gp').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ep').length).toBeGreaterThan(0);
    expect(screen.getAllByText('sp').length).toBeGreaterThan(0);
    expect(screen.getAllByText('cp').length).toBeGreaterThan(0);
  });

  it('shows current amounts for each currency', () => {
    render(<CurrencyManager currency={mockCurrency} />);
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    expect(screen.getAllByText('100').length).toBeGreaterThan(0);
    expect(screen.getAllByText('5').length).toBeGreaterThan(0);
    expect(screen.getAllByText('20').length).toBeGreaterThan(0);
    expect(screen.getAllByText('50').length).toBeGreaterThan(0);
  });

  it('shows total wealth badge in copper pieces', () => {
    render(<CurrencyManager currency={mockCurrency} />);
    // 2*1000 + 100*100 + 5*50 + 20*10 + 50 = 12,500 cp
    expect(screen.getAllByText('12,500 cp').length).toBeGreaterThan(0);
  });

  it('shows wealth breakdown in gold', () => {
    render(<CurrencyManager currency={mockCurrency} />);
    // 12,500 cp = 125 gp
    expect(screen.getAllByText('125 gp').length).toBeGreaterThan(0);
  });

  it('calls onAddCurrency when Add button clicked with amount', () => {
    const onAddCurrency = vi.fn();
    render(
      <CurrencyManager currency={mockCurrency} onAddCurrency={onAddCurrency} />
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Gold amount' }), {
      target: { value: '50' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add gold' }));

    expect(onAddCurrency).toHaveBeenCalledWith('gold', 50);
  });

  it('calls onSubtractCurrency when Spend button clicked with amount', () => {
    const onSubtractCurrency = vi.fn();
    render(
      <CurrencyManager
        currency={mockCurrency}
        onSubtractCurrency={onSubtractCurrency}
      />
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Silver amount' }), {
      target: { value: '10' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Spend silver' }));

    expect(onSubtractCurrency).toHaveBeenCalledWith('silver', 10);
  });

  it('disables Add/Spend buttons when amount is 0 or empty', () => {
    const onAddCurrency = vi.fn();
    const onSubtractCurrency = vi.fn();
    render(
      <CurrencyManager
        currency={mockCurrency}
        onAddCurrency={onAddCurrency}
        onSubtractCurrency={onSubtractCurrency}
      />
    );

    expect(screen.getByRole('button', { name: 'Add gold' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Spend gold' })).toBeDisabled();
  });

  it('hides Manage Currency section when readonly', () => {
    render(
      <CurrencyManager
        currency={mockCurrency}
        readonly
        onAddCurrency={vi.fn()}
      />
    );
    expect(screen.queryByText('Add or spend coins')).toBeNull();
  });

  it('shows plain conversion content by default in non-compact mode', () => {
    render(<CurrencyManager currency={mockCurrency} />);
    expect(screen.getByRole('heading', { name: 'Conversion' })).toBeVisible();
    expect(
      screen.getByText(
        '10 cp = 1 sp · 5 sp = 1 ep · 10 sp = 1 gp · 10 gp = 1 pp'
      )
    ).toBeVisible();
  });

  it('hides Currency Conversion section in compact mode', () => {
    render(<CurrencyManager currency={mockCurrency} compact />);
    expect(screen.queryByRole('heading', { name: 'Conversion' })).toBeNull();
  });

  it('keeps total-only and hidden-balance modes distinct', () => {
    const { rerender } = render(
      <CurrencyManager currency={mockCurrency} showOnlyTotal />
    );
    expect(screen.getByText('125 gp')).toBeVisible();
    expect(screen.queryByRole('textbox', { name: 'Gold amount' })).toBeNull();
    rerender(
      <CurrencyManager
        currency={mockCurrency}
        hideIndividualCurrencies
        onAddCurrency={vi.fn()}
      />
    );
    expect(screen.getByRole('textbox', { name: 'Gold amount' })).toBeVisible();
    expect(screen.queryByText('100')).toBeNull();
  });

  it('renders compact layout with abbreviated title', () => {
    render(<CurrencyManager currency={mockCurrency} compact />);
    expect(screen.getAllByText('Currency').length).toBeGreaterThan(0);
    // Full currency names hidden in compact
    expect(screen.queryByText('Platinum')).toBeNull();
  });
});
