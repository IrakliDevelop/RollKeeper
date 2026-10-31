import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { HeroicInspirationTracker } from '../HeroicInspirationTracker';

const callbacks = () => ({
  onAddInspiration: vi.fn(),
  onUseInspiration: vi.fn(),
  onResetInspiration: vi.fn(),
  onUpdateInspiration: vi.fn(),
  onToggleStackable: vi.fn(),
});

afterEach(cleanup);

describe('Heroic Inspiration in the Features tab', () => {
  it('shows count, approved rules, and live gain/use controls in play', () => {
    const actions = callbacks();
    render(
      <HeroicInspirationTracker
        inspiration={{ count: 2, maxCount: 5 }}
        stackable
        editing={false}
        showStackableControl
        {...actions}
      />
    );
    expect(screen.getByText('2 inspiration dice')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Use it to reroll any die you just rolled. You must use the new roll./
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: 'Maximum' })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Gain inspiration' }).at(-1)!
    );
    expect(actions.onAddInspiration).toHaveBeenCalledWith(1);
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Use inspiration' }).at(-1)!
    );
    expect(actions.onUseInspiration).toHaveBeenCalledOnce();
  });

  it('retains the existing active die count action and max disabling', () => {
    const actions = callbacks();
    render(
      <HeroicInspirationTracker
        inspiration={{ count: 2, maxCount: 3 }}
        stackable
        editing={false}
        {...actions}
      />
    );
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Use inspiration' })[0]
    );
    expect(actions.onUpdateInspiration).toHaveBeenCalledWith({ count: 1 });
    const inactive = screen.getAllByRole('button', {
      name: 'Gain inspiration',
    });
    expect(inactive[1]).toBeDisabled();
  });

  it('allows max and stacking changes only in edit mode', () => {
    const actions = callbacks();
    render(
      <HeroicInspirationTracker
        inspiration={{ count: 1, maxCount: 5 }}
        stackable
        editing
        showStackableControl
        {...actions}
      />
    );
    const maximum = screen.getByRole('textbox', { name: 'Maximum' });
    fireEvent.change(maximum, { target: { value: '6' } });
    fireEvent.blur(maximum);
    expect(actions.onUpdateInspiration).toHaveBeenCalledWith({ maxCount: 6 });
    fireEvent.click(
      screen.getByRole('switch', { name: 'Allow stacking (house rule)' })
    );
    expect(actions.onToggleStackable).toHaveBeenCalledWith(false);
  });

  it('hides maximum on exit from edit and when stacking switches off', () => {
    const actions = callbacks();
    const { rerender } = render(
      <HeroicInspirationTracker
        inspiration={{ count: 1 }}
        stackable
        editing
        {...actions}
      />
    );
    expect(
      screen.getByRole('textbox', { name: 'Maximum' })
    ).toBeInTheDocument();
    rerender(
      <HeroicInspirationTracker
        inspiration={{ count: 1 }}
        stackable
        editing={false}
        {...actions}
      />
    );
    expect(
      screen.queryByRole('textbox', { name: 'Maximum' })
    ).not.toBeInTheDocument();
    rerender(
      <HeroicInspirationTracker
        inspiration={{ count: 1 }}
        stackable={false}
        editing
        {...actions}
      />
    );
    expect(
      screen.queryByRole('textbox', { name: 'Maximum' })
    ).not.toBeInTheDocument();
  });

  it('keeps classic gain/use and DM-controlled display', () => {
    const actions = callbacks();
    const { rerender } = render(
      <HeroicInspirationTracker
        inspiration={{ count: 0 }}
        stackable={false}
        dmControlled
        editing={false}
        {...actions}
      />
    );
    expect(screen.getByText('Set by your DM.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Gain inspiration' }));
    expect(actions.onAddInspiration).toHaveBeenCalledWith(1);
    rerender(
      <HeroicInspirationTracker
        inspiration={{ count: 1 }}
        stackable={false}
        dmControlled
        editing={false}
        {...actions}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Use inspiration' }));
    expect(actions.onUseInspiration).toHaveBeenCalledOnce();
  });
});
