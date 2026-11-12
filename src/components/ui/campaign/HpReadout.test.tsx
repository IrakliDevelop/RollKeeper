import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HpReadout } from './HpReadout';

describe('HpReadout', () => {
  afterEach(cleanup);

  it('shows current, max and a bloodied status', () => {
    render(<HpReadout current={30} max={44} />);
    expect(screen.getByText('30')).toHaveClass(
      'type-num-md',
      'text-ember-text'
    );
    expect(screen.getByText('/ 44 HP')).toBeInTheDocument();
    expect(screen.getByText('Bloodied')).toHaveClass('text-ember-text');
  });

  it('keeps a healthy number in the heading colour', () => {
    render(<HpReadout current={44} max={44} />);
    expect(screen.getByText('44')).toHaveClass('text-heading');
    expect(screen.getByText('Healthy')).toHaveClass('text-verdigris-text');
  });

  it('marks critical and down in blood', () => {
    const { rerender } = render(<HpReadout current={5} max={44} />);
    expect(screen.getByText('Critical')).toHaveClass('text-blood-text');
    rerender(<HpReadout current={0} max={44} />);
    expect(screen.getByText('Down')).toHaveClass('text-blood-text');
  });

  it('shows temporary HP in frost only when there is some', () => {
    const { rerender } = render(<HpReadout current={30} max={44} temp={5} />);
    expect(screen.getByText('+5 temp HP')).toHaveClass('text-frost-text');
    rerender(<HpReadout current={30} max={44} temp={0} />);
    expect(screen.queryByText(/temp HP/)).toBeNull();
  });

  it('uses the small number style at size sm and draws the bar', () => {
    const { container } = render(<HpReadout current={30} max={44} size="sm" />);
    expect(screen.getByText('30')).toHaveClass('type-ui');
    expect(container.querySelector('[data-hp-track]')).not.toBeNull();
  });

  it('handles a character with no max HP', () => {
    const { container } = render(<HpReadout current={0} max={0} />);
    expect(screen.getByText('/ 0 HP')).toBeInTheDocument();
    expect(screen.getByText('Down')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/NaN/);
  });
});
