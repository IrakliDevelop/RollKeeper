import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { HitPointTracker } from '../HitPointTracker';
import { HitPoints } from '@/types/character';

const baseHitPoints: HitPoints = {
  current: 25,
  max: 40,
  temporary: 5,
  calculationMode: 'auto',
  deathSaves: { successes: 0, failures: 0, isStabilized: false },
};

const dyingHitPoints: HitPoints = {
  current: 0,
  max: 40,
  temporary: 0,
  calculationMode: 'auto',
  deathSaves: { successes: 0, failures: 0, isStabilized: false },
};

afterEach(cleanup);

describe('HitPointTracker', () => {
  it('renders current HP, max HP, and temp HP values', () => {
    render(<HitPointTracker hitPoints={baseHitPoints} />);
    expect(screen.getByDisplayValue('25')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByDisplayValue('5')).toBeInTheDocument();
  });

  it('colours the current HP by the shared tiers: heading while healthy, ember while bloodied', () => {
    const { container, unmount } = render(
      <HitPointTracker hitPoints={{ ...baseHitPoints, current: 30 }} />
    );
    expect(container.querySelector('[data-hp-status]')).toHaveAttribute(
      'data-hp-status',
      'healthy'
    );
    unmount();
    const bloodied = render(<HitPointTracker hitPoints={baseHitPoints} />);
    expect(
      bloodied.container.querySelector('[data-hp-status]')
    ).toHaveAttribute('data-hp-status', 'bloodied');
    bloodied.unmount();
  });

  it('renders "Hit points" title', () => {
    render(<HitPointTracker hitPoints={baseHitPoints} />);
    expect(screen.getAllByText('Hit points').length).toBeGreaterThan(0);
  });

  it('shows "Bloodied" status text for healthy character', () => {
    render(<HitPointTracker hitPoints={baseHitPoints} />);
    expect(screen.getAllByText(/Bloodied/).length).toBeGreaterThan(0);
  });

  describe('single HP amount control', () => {
    const amountField = () =>
      screen.getByRole('textbox', { name: 'HP amount' });
    const renderTracker = () => {
      const handlers = {
        onApplyDamage: vi.fn(),
        onApplyHealing: vi.fn(),
        onAddTemporaryHP: vi.fn(),
      };
      render(<HitPointTracker hitPoints={baseHitPoints} {...handlers} />);
      return handlers;
    };

    it('renders one empty amount field with no placeholder and no per-action fields', () => {
      renderTracker();
      expect(amountField()).toHaveValue('');
      expect(amountField()).not.toHaveAttribute('placeholder');
      expect(screen.queryByRole('textbox', { name: 'Damage' })).toBeNull();
      expect(screen.queryByRole('textbox', { name: 'Healing' })).toBeNull();
      expect(
        screen.queryByRole('textbox', { name: 'Temp HP amount' })
      ).toBeNull();
      expect(screen.queryByText('Healing')).toBeNull();
    });

    it('never disables Damage, Heal, Add temp HP, or the multipliers', () => {
      renderTracker();
      for (const name of [
        'Damage',
        'Heal',
        'Add temp HP',
        'Halve damage (resistance)',
        'Double damage (vulnerability)',
      ]) {
        expect(screen.getByRole('button', { name })).not.toBeDisabled();
      }
    });

    it('omits an action whose handler prop is absent', () => {
      render(
        <HitPointTracker hitPoints={baseHitPoints} onApplyDamage={vi.fn()} />
      );
      expect(screen.getByRole('button', { name: 'Damage' })).toBeVisible();
      expect(screen.queryByRole('button', { name: 'Heal' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Add temp HP' })).toBeNull();
    });

    it.each(['Damage', 'Heal', 'Add temp HP'] as const)(
      'focuses the field and calls nothing when %s is pressed with an empty amount',
      button => {
        const handlers = renderTracker();
        fireEvent.click(screen.getByRole('button', { name: button }));
        expect(document.activeElement).toBe(amountField());
        for (const fn of Object.values(handlers))
          expect(fn).not.toHaveBeenCalled();
      }
    );

    it.each([
      ['Damage', '0'],
      ['Damage', '-3'],
      ['Heal', '0'],
      ['Add temp HP', '0'],
    ] as const)(
      'focuses the field and calls nothing when %s is pressed after typing %s',
      async (button, typed) => {
        const user = userEvent.setup();
        const handlers = renderTracker();
        const field = amountField();
        await user.click(field);
        await user.type(field, typed);
        await user.click(screen.getByRole('button', { name: button }));
        for (const fn of Object.values(handlers))
          expect(fn).not.toHaveBeenCalled();
        expect(document.activeElement).toBe(field);
      }
    );

    it.each([
      ['Damage', 'onApplyDamage'],
      ['Heal', 'onApplyHealing'],
      ['Add temp HP', 'onAddTemporaryHP'],
    ] as const)(
      '%s applies the amount to its own handler and clears the field',
      (button, handler) => {
        const handlers = renderTracker();
        fireEvent.change(amountField(), { target: { value: '8' } });
        fireEvent.click(screen.getByRole('button', { name: button }));
        expect(handlers[handler]).toHaveBeenCalledExactlyOnceWith(8);
        for (const [name, fn] of Object.entries(handlers)) {
          if (name !== handler) expect(fn).not.toHaveBeenCalled();
        }
        expect(amountField()).toHaveValue('');
      }
    );

    it('halves (rounding down) and doubles the amount', () => {
      renderTracker();
      fireEvent.change(amountField(), { target: { value: '9' } });
      fireEvent.click(
        screen.getByRole('button', { name: 'Halve damage (resistance)' })
      );
      expect(amountField()).toHaveValue('4');
      fireEvent.change(amountField(), { target: { value: '8' } });
      fireEvent.click(
        screen.getByRole('button', { name: 'Double damage (vulnerability)' })
      );
      expect(amountField()).toHaveValue('16');
    });

    it('focuses the field and leaves it empty when the multipliers are pressed on an empty amount', () => {
      renderTracker();
      for (const name of [
        'Halve damage (resistance)',
        'Double damage (vulnerability)',
      ]) {
        fireEvent.click(screen.getByRole('button', { name }));
        expect(document.activeElement).toBe(amountField());
        expect(amountField()).toHaveValue('');
        amountField().blur();
      }
    });
  });

  it('stacks the readout, then the amount controls, then death saves, with no band grid', () => {
    const { container } = render(
      <HitPointTracker
        hitPoints={dyingHitPoints}
        onApplyDamage={vi.fn()}
        onMakeDeathSave={vi.fn()}
        onUpdateHitPoints={vi.fn()}
      />
    );
    const current = screen.getByRole('textbox', { name: 'Current HP' });
    const amount = screen.getByRole('textbox', { name: 'HP amount' });
    const deathSaves = screen.getByRole('heading', { name: 'Death saves' });
    const before = Node.DOCUMENT_POSITION_FOLLOWING;
    expect(current.compareDocumentPosition(amount) & before).toBeTruthy();
    expect(amount.compareDocumentPosition(deathSaves) & before).toBeTruthy();
    const body = container.querySelector('[data-hp-status]')!;
    expect(body).toHaveClass('space-y-5');
    expect(container.innerHTML).not.toMatch(
      /lg:(grid-cols|col-start|row-start|flex-nowrap)/
    );
  });

  it('shows death saves section when character is dying', () => {
    render(
      <HitPointTracker
        hitPoints={dyingHitPoints}
        onMakeDeathSave={vi.fn()}
        onUpdateHitPoints={vi.fn()}
      />
    );
    expect(screen.getAllByText('Death saves').length).toBeGreaterThan(0);
  });

  it('calls onMakeDeathSave(true, false) when success circle is clicked', () => {
    const onMakeDeathSave = vi.fn();
    const { container } = render(
      <HitPointTracker
        hitPoints={dyingHitPoints}
        onMakeDeathSave={onMakeDeathSave}
        onUpdateHitPoints={vi.fn()}
      />
    );
    const successButtons = container.querySelectorAll(
      'button[aria-label="Mark a death save success"]'
    );
    fireEvent.click(successButtons[0]);
    expect(onMakeDeathSave).toHaveBeenCalledWith(true, false);
  });

  it('calls onMakeDeathSave(false, false) when failure circle is clicked', () => {
    const onMakeDeathSave = vi.fn();
    const { container } = render(
      <HitPointTracker
        hitPoints={dyingHitPoints}
        onMakeDeathSave={onMakeDeathSave}
        onUpdateHitPoints={vi.fn()}
      />
    );
    const failButtons = container.querySelectorAll(
      'button[aria-label="Mark a death save failure"]'
    );
    fireEvent.click(failButtons[0]);
    expect(onMakeDeathSave).toHaveBeenCalledWith(false, false);
  });

  it('calls onMakeDeathSave(true, true) when Natural 20 button is clicked', () => {
    const onMakeDeathSave = vi.fn();
    const { container } = render(
      <HitPointTracker
        hitPoints={dyingHitPoints}
        onMakeDeathSave={onMakeDeathSave}
        onUpdateHitPoints={vi.fn()}
      />
    );
    const buttons = container.querySelectorAll('button');
    const nat20Button = Array.from(buttons).find(b =>
      b.textContent?.includes('Natural 20')
    );
    fireEvent.click(nat20Button!);
    expect(onMakeDeathSave).toHaveBeenCalledWith(true, true);
  });

  it('shows "Dead" text when character has 3 death save failures', () => {
    const deadHitPoints: HitPoints = {
      ...dyingHitPoints,
      deathSaves: { successes: 0, failures: 3, isStabilized: false },
    };
    render(<HitPointTracker hitPoints={deadHitPoints} />);
    expect(screen.getAllByText(/Dead/).length).toBeGreaterThan(0);
  });

  it('shows "Stabilized" text when character is stabilized', () => {
    const stabilizedHitPoints: HitPoints = {
      ...dyingHitPoints,
      deathSaves: { successes: 3, failures: 0, isStabilized: true },
    };
    render(<HitPointTracker hitPoints={stabilizedHitPoints} />);
    expect(screen.getAllByText(/Stabilized/).length).toBeGreaterThan(0);
  });

  it('calls onResetDeathSaves when reset button is clicked', () => {
    const onResetDeathSaves = vi.fn();
    render(
      <HitPointTracker
        hitPoints={dyingHitPoints}
        onMakeDeathSave={vi.fn()}
        onResetDeathSaves={onResetDeathSaves}
        onUpdateHitPoints={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reset death saves' }));
    expect(onResetDeathSaves).toHaveBeenCalled();
  });

  it('shows "Dying" status text when character is at 0 HP and not stabilized', () => {
    render(<HitPointTracker hitPoints={dyingHitPoints} />);
    expect(screen.getAllByText(/Dying/).length).toBeGreaterThan(0);
  });

  describe('sheet mode (editing)', () => {
    const manual: HitPoints = { ...baseHitPoints, calculationMode: 'manual' };

    it('shows max HP as text in play mode; current and temp stay editable', () => {
      render(
        <HitPointTracker
          hitPoints={manual}
          editing={false}
          onToggleCalculationMode={vi.fn()}
          onUpdateHitPoints={vi.fn()}
        />
      );
      expect(screen.queryByDisplayValue('40')).toBeNull();
      expect(screen.getByText('40')).toBeInTheDocument();
      expect(screen.getByDisplayValue('25')).toBeInTheDocument();
      expect(screen.getByDisplayValue('5')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /calculation/ })).toBeNull();
    });

    it('hides the Max calculation line in play mode and shows it with the toggle when editing', () => {
      const { rerender } = render(
        <HitPointTracker
          hitPoints={baseHitPoints}
          editing={false}
          onToggleCalculationMode={vi.fn()}
        />
      );
      expect(screen.queryByText(/Max:/)).toBeNull();
      expect(screen.queryByRole('button', { name: /calculation/ })).toBeNull();
      rerender(
        <HitPointTracker
          hitPoints={baseHitPoints}
          editing
          onToggleCalculationMode={vi.fn()}
        />
      );
      expect(screen.getByText('Max: Auto')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Switch to manual calculation' })
      ).toBeInTheDocument();
    });

    it('edits max HP and shows the calculation toggle by default', () => {
      const onUpdateHitPoints = vi.fn();
      render(
        <HitPointTracker
          hitPoints={manual}
          onToggleCalculationMode={vi.fn()}
          onUpdateHitPoints={onUpdateHitPoints}
        />
      );
      fireEvent.change(screen.getByDisplayValue('40'), {
        target: { value: '45' },
      });
      expect(onUpdateHitPoints).not.toHaveBeenCalled();
      fireEvent.keyDown(screen.getByDisplayValue('45'), { key: 'Enter' });
      expect(onUpdateHitPoints).toHaveBeenCalledWith({ max: 45 });
      expect(
        screen.getByRole('button', { name: /calculation/ })
      ).toBeInTheDocument();
    });

    it('shows the typed max HP after switching to play mode', () => {
      function Host() {
        const [hp, setHp] = useState(manual);
        const [editing, setEditing] = useState(true);
        return (
          <>
            <button onClick={() => setEditing(false)}>play</button>
            <HitPointTracker
              hitPoints={hp}
              editing={editing}
              onUpdateHitPoints={u => setHp(h => ({ ...h, ...u }))}
            />
          </>
        );
      }
      render(<Host />);
      fireEvent.change(screen.getByDisplayValue('40'), {
        target: { value: '52' },
      });
      fireEvent.blur(screen.getByDisplayValue('52'));
      fireEvent.click(screen.getByText('play'));
      expect(screen.getByText('52')).toBeInTheDocument();
    });
  });
});
