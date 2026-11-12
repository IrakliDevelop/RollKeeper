// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COIN_NAMES, NPCCurrencyStrip } from '../NPCCurrencyStrip';

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

    fireEvent.change(
      screen.getByRole('textbox', { name: 'GP (gold pieces)' }),
      {
        target: { value: '-10' },
      }
    );

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

  it('names each coin input after the coin', () => {
    render(<NPCCurrencyStrip currency={currency} onChange={vi.fn()} />);

    expect(COIN_NAMES).toEqual({
      platinum: 'PP (platinum pieces)',
      gold: 'GP (gold pieces)',
      electrum: 'EP (electrum pieces)',
      silver: 'SP (silver pieces)',
      copper: 'CP (copper pieces)',
    });
    for (const name of Object.values(COIN_NAMES)) {
      expect(screen.getByRole('textbox', { name })).toBeInTheDocument();
    }
  });

  it('passes the typed amount to onChange', () => {
    const onChange = vi.fn();
    render(<NPCCurrencyStrip currency={currency} onChange={onChange} />);

    fireEvent.change(
      screen.getByRole('textbox', { name: 'GP (gold pieces)' }),
      {
        target: { value: '12' },
      }
    );

    expect(onChange).toHaveBeenCalledWith('gold', 12);
  });

  it('uses no hue-named colour classes', () => {
    const { container } = render(
      <NPCCurrencyStrip currency={currency} onChange={vi.fn()} />
    );

    for (const el of Array.from(container.querySelectorAll('*'))) {
      expect(el.getAttribute('class') ?? '').not.toMatch(
        /(slate|amber|emerald|blue|orange)-/
      );
    }
  });

  it('shows a read-only balance with a thousands separator and no textbox', () => {
    render(
      <NPCCurrencyStrip currency={{ ...currency, gold: 1250 }} readonly />
    );

    expect(screen.getByText('1,250')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('keeps the NPC currency region', () => {
    render(<NPCCurrencyStrip currency={currency} readonly />);

    expect(
      screen.getByRole('region', { name: 'NPC currency' })
    ).toBeInTheDocument();
  });
});
