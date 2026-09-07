// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NPCCurrencyStrip } from '../NPCCurrencyStrip';

const currency = {
  platinum: 1,
  gold: 20,
  electrum: 3,
  silver: 40,
  copper: 5,
};

afterEach(() => {
  cleanup();
});

describe('NPCCurrencyStrip', () => {
  it('renders all five coin balances in one compact section', () => {
    render(<NPCCurrencyStrip currency={currency} readonly />);

    expect(screen.getByText('PP')).toBeInTheDocument();
    expect(screen.getByText('GP')).toBeInTheDocument();
    expect(screen.getByText('EP')).toBeInTheDocument();
    expect(screen.getByText('SP')).toBeInTheDocument();
    expect(screen.getByText('CP')).toBeInTheDocument();
  });

  it('directly updates a balance and clamps it at zero', () => {
    const onChange = vi.fn();
    render(<NPCCurrencyStrip currency={currency} onChange={onChange} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'GP balance' }), {
      target: { value: '-10' },
    });

    expect(onChange).toHaveBeenCalledWith('gold', 0);
  });

  it('defaults its heading to "Currency" when no label is given', () => {
    render(<NPCCurrencyStrip currency={currency} readonly />);

    expect(screen.getByText('Currency')).toBeInTheDocument();
  });

  it('renders a custom label in place of "Currency" when given one', () => {
    render(
      <NPCCurrencyStrip currency={currency} readonly label="Merchant's purse" />
    );

    expect(screen.getByText("Merchant's purse")).toBeInTheDocument();
    expect(screen.queryByText('Currency')).not.toBeInTheDocument();
  });
});
