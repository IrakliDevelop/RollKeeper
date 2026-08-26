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

    // Find the Gold label in the Manage Currency section, then find its input
    const goldLabels = screen.getAllByText('Gold');
    // The last "Gold" label is in the Manage Currency section
    const manageGoldLabel = goldLabels[goldLabels.length - 1];
    const goldSection = manageGoldLabel.closest('.space-y-2')!;
    const goldInput = goldSection.querySelector('input')!;

    fireEvent.change(goldInput, { target: { value: '50' } });

    const addButtons = goldSection.querySelectorAll('button');
    const addButton = Array.from(addButtons).find(b =>
      b.textContent?.includes('Add')
    )!;
    fireEvent.click(addButton);

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

    const silverLabels = screen.getAllByText('Silver');
    const manageSilverLabel = silverLabels[silverLabels.length - 1];
    const silverSection = manageSilverLabel.closest('.space-y-2')!;
    const silverInput = silverSection.querySelector('input')!;

    fireEvent.change(silverInput, { target: { value: '10' } });

    const spendButtons = silverSection.querySelectorAll('button');
    const spendButton = Array.from(spendButtons).find(b =>
      b.textContent?.includes('Spend')
    )!;
    fireEvent.click(spendButton);

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

    // Find gold section in manage area
    const goldLabels = screen.getAllByText('Gold');
    const manageGoldLabel = goldLabels[goldLabels.length - 1];
    const goldSection = manageGoldLabel.closest('.space-y-2')!;
    const buttons = goldSection.querySelectorAll('button');

    // Both Add and Spend should be disabled (input defaults to 0)
    buttons.forEach(button => {
      expect(button).toBeDisabled();
    });
  });

  it('hides Manage Currency section when readonly', () => {
    render(
      <CurrencyManager
        currency={mockCurrency}
        readonly
        onAddCurrency={vi.fn()}
      />
    );
    expect(screen.queryByText('Manage Currency')).toBeNull();
  });

  it('shows Currency Conversion section by default in non-compact mode', () => {
    render(<CurrencyManager currency={mockCurrency} />);
    expect(screen.getAllByText('Currency Conversion').length).toBeGreaterThan(
      0
    );
  });

  it('hides Currency Conversion section in compact mode', () => {
    render(<CurrencyManager currency={mockCurrency} compact />);
    expect(screen.queryByText('Currency Conversion')).toBeNull();
  });

  it('renders compact layout with abbreviated title', () => {
    render(<CurrencyManager currency={mockCurrency} compact />);
    expect(screen.getAllByText('Currency').length).toBeGreaterThan(0);
    // Full currency names hidden in compact
    expect(screen.queryByText('Platinum')).toBeNull();
  });
});
