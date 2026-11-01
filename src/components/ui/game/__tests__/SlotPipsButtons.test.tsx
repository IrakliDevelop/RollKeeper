import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SlotPipsButtons } from '../SlotPipsButtons';

afterEach(cleanup);

describe('SlotPipsButtons', () => {
  it('spends or restores exactly one slot regardless of which pip is tapped', () => {
    const onSpend = vi.fn();
    const onRestore = vi.fn();
    render(
      <SlotPipsButtons
        total={4}
        available={2}
        level={1}
        onSpend={onSpend}
        onRestore={onRestore}
      />
    );
    const group = screen.getByRole('group', {
      name: '2 of 4 level 1 slots available',
    });
    const pips = group.querySelectorAll('button');
    expect(Array.from(pips, pip => pip.dataset.state)).toEqual([
      'available',
      'available',
      'spent',
      'spent',
    ]);
    fireEvent.click(pips[0]);
    fireEvent.click(pips[3]);
    expect(onSpend).toHaveBeenCalledTimes(1);
    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(onSpend).toHaveBeenCalledWith();
    expect(onRestore).toHaveBeenCalledWith();
    expect(pips[0]).toHaveAccessibleName('Spend a level 1 slot');
    expect(pips[3]).toHaveAccessibleName('Restore a level 1 slot');
    expect(pips[0]).toHaveClass('min-h-6', 'pointer-coarse:min-h-11');
  });

  it('uses the approved pact labels and falls back to static pips without handlers', () => {
    const { rerender } = render(
      <SlotPipsButtons
        total={2}
        available={1}
        level="pact"
        onSpend={vi.fn()}
        onRestore={vi.fn()}
      />
    );
    expect(
      screen.getByRole('button', { name: 'Spend a pact slot' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Restore a pact slot' })
    ).toBeInTheDocument();
    rerender(<SlotPipsButtons total={2} available={1} level="pact" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: '1 of 2 pact slots available' })
    ).toBeInTheDocument();
  });
});
