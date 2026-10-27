import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ConditionChip } from '../ConditionChip';

afterEach(cleanup);

describe('ConditionChip', () => {
  it('is an ember badge with the condition name', () => {
    render(<ConditionChip name="Poisoned" />);
    const chip = screen.getByText('Poisoned').closest('[data-kind]')!;
    expect(chip).toHaveAttribute('data-kind', 'condition');
    expect(chip).toHaveAttribute('data-variant', 'warning');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('is lapis for concentration', () => {
    render(
      <ConditionChip name="Concentrating on Bless" kind="concentration" />
    );
    const chip = screen
      .getByText('Concentrating on Bless')
      .closest('[data-kind]')!;
    expect(chip).toHaveAttribute('data-kind', 'concentration');
    expect(chip).toHaveAttribute('data-variant', 'magic');
  });

  it('shows a stack count from 2 up', () => {
    const { rerender } = render(
      <ConditionChip name="Exhaustion" stackCount={1} />
    );
    expect(screen.queryByText('x1')).toBeNull();
    rerender(<ConditionChip name="Exhaustion" stackCount={3} />);
    expect(screen.getByText('x3')).toBeInTheDocument();
    rerender(<ConditionChip name="Exhaustion" stackCount={2.5} />);
    expect(screen.getByText('x2')).toBeInTheDocument();
  });

  it('removes the condition without clicking the row around it', () => {
    const onRemove = vi.fn();
    const onRow = vi.fn();
    render(
      <div onClick={onRow}>
        <ConditionChip name="Prone" onRemove={onRemove} />
      </div>
    );
    const button = screen.getByRole('button', { name: 'Remove Prone' });
    expect(button).toHaveAttribute('type', 'button');
    fireEvent.click(button);
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRow).not.toHaveBeenCalled();
  });

  it('ends concentration, or takes a custom remove label', () => {
    const { rerender } = render(
      <ConditionChip
        name="Concentrating on Bless"
        kind="concentration"
        onRemove={() => {}}
      />
    );
    expect(
      screen.getByRole('button', { name: 'End concentration' })
    ).toBeInTheDocument();
    rerender(
      <ConditionChip
        name="Poisoned"
        onRemove={() => {}}
        removeLabel="Remove Poisoned from Goblin 2"
      />
    );
    expect(
      screen.getByRole('button', { name: 'Remove Poisoned from Goblin 2' })
    ).toBeInTheDocument();
  });
});
