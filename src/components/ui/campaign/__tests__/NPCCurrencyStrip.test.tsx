// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NPCCurrencyStrip } from '../NPCCurrencyStrip';

const currency = {
  platinum: 1,
  gold: 20,
  electrum: 3,
  silver: 40,
  copper: 5,
};

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
});
