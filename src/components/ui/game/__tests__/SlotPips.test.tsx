import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MAX_PIPS, SlotPips, slotPipsLabel } from '../SlotPips';

afterEach(cleanup);

const states = (row: HTMLElement) =>
  Array.from(row.children).map(pip => pip.getAttribute('data-state'));

describe('slotPipsLabel', () => {
  it('counts the slots left at a level', () => {
    expect(slotPipsLabel(2, 4, 1)).toBe('2 of 4 level 1 slots available');
    expect(slotPipsLabel(0, 3, 9)).toBe('0 of 3 level 9 slots available');
  });

  it('names pact slots', () => {
    expect(slotPipsLabel(2, 2, 'pact')).toBe('2 of 2 pact slots available');
  });
});

describe('SlotPips', () => {
  it('fills the available slots first and leaves the spent ones hollow', () => {
    render(<SlotPips total={4} available={2} level={1} />);
    const row = screen.getByRole('img', {
      name: '2 of 4 level 1 slots available',
    });
    expect(states(row)).toEqual(['available', 'available', 'spent', 'spent']);
  });

  it.each([0, -2, Number.NaN])(
    'renders nothing for a level with %s slots',
    total => {
      const { container } = render(
        <SlotPips total={total} available={1} level={3} />
      );
      expect(container).toBeEmptyDOMElement();
    }
  );

  it('draws at most MAX_PIPS pips but labels the real count', () => {
    render(<SlotPips total={1e7} available={3} level={1} />);
    const row = screen.getByRole('img', {
      name: '3 of 10000000 level 1 slots available',
    });
    expect(row.children).toHaveLength(MAX_PIPS);
    expect(states(row).filter(s => s === 'available')).toHaveLength(3);
  });

  it('clamps counts that fall outside the slots', () => {
    render(<SlotPips total={3} available={5} level={2} />);
    expect(
      states(
        screen.getByRole('img', { name: '3 of 3 level 2 slots available' })
      )
    ).toEqual(['available', 'available', 'available']);
    cleanup();
    render(<SlotPips total={3} available={-1} level={2} />);
    expect(
      states(
        screen.getByRole('img', { name: '0 of 3 level 2 slots available' })
      )
    ).toEqual(['spent', 'spent', 'spent']);
  });

  it('treats a missing or fractional count as whole slots', () => {
    render(<SlotPips total={2.5} available={Number.NaN} level="pact" />);
    expect(
      states(screen.getByRole('img', { name: '0 of 2 pact slots available' }))
    ).toEqual(['spent', 'spent']);
  });
});
