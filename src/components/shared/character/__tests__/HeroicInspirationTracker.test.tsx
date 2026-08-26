import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { HeroicInspirationTracker } from '../HeroicInspirationTracker';
import { HeroicInspiration } from '@/types/character';

afterEach(() => {
  cleanup();
});

const baseInspiration: HeroicInspiration = {
  count: 2,
  maxCount: 5,
};

function renderTracker(
  overrides: Partial<HeroicInspiration> = {},
  props: Record<string, unknown> = {}
) {
  const inspiration = { ...baseInspiration, ...overrides };
  const defaultProps = {
    inspiration,
    onAddInspiration: vi.fn(),
    onUseInspiration: vi.fn(),
    onResetInspiration: vi.fn(),
    onUpdateInspiration: vi.fn(),
    ...props,
  };
  return {
    ...render(<HeroicInspirationTracker {...defaultProps} />),
    ...defaultProps,
  };
}

describe('HeroicInspirationTracker', () => {
  it('renders current count and max', () => {
    renderTracker();
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\/\s*5/).length).toBeGreaterThan(0);
  });

  it('shows inspiration dice text', () => {
    renderTracker();
    expect(screen.getByText('2 inspiration dice')).toBeInTheDocument();
  });

  it('shows singular text for 1 inspiration die', () => {
    renderTracker({ count: 1 });
    expect(screen.getByText('1 inspiration die')).toBeInTheDocument();
  });

  it('Add button calls onAddInspiration(1)', () => {
    const { onAddInspiration } = renderTracker();
    const addBtns = screen.getAllByRole('button', { name: /Add/i });
    const addBtn = addBtns.find(b => b.textContent?.trim() === 'Add')!;
    fireEvent.click(addBtn);
    expect(onAddInspiration).toHaveBeenCalledWith(1);
  });

  it('Use button calls onUseInspiration', () => {
    const { onUseInspiration } = renderTracker();
    const useBtns = screen.getAllByRole('button', { name: /Use/i });
    const useBtn = useBtns.find(b => b.textContent?.trim() === 'Use')!;
    fireEvent.click(useBtn);
    expect(onUseInspiration).toHaveBeenCalled();
  });

  it('Use button is disabled when count is 0', () => {
    renderTracker({ count: 0 });
    const useBtns = screen.getAllByRole('button', { name: /Use/i });
    const useBtn = useBtns.find(b => b.textContent?.trim() === 'Use')!;
    expect(useBtn).toBeDisabled();
  });

  it('Add button is disabled when count equals maxCount', () => {
    renderTracker({ count: 5, maxCount: 5 });
    const addBtns = screen.getAllByRole('button', { name: /Add/i });
    const addBtn = addBtns.find(b => b.textContent?.trim() === 'Add')!;
    expect(addBtn).toBeDisabled();
  });

  it('Reset button calls onResetInspiration', () => {
    const { onResetInspiration } = renderTracker();
    const resetBtn = screen.getByTitle('Reset to 0');
    fireEvent.click(resetBtn);
    expect(onResetInspiration).toHaveBeenCalled();
  });

  it('Settings button toggles settings panel', () => {
    renderTracker();
    expect(screen.queryByText('Max Inspiration:')).not.toBeInTheDocument();
    const settingsBtn = screen.getByTitle('Settings');
    fireEvent.click(settingsBtn);
    expect(screen.getByText('Max Inspiration:')).toBeInTheDocument();
  });

  it('readonly hides action buttons', () => {
    renderTracker({}, { readonly: true });
    expect(
      screen.queryByRole('button', { name: /Add/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Use/i })
    ).not.toBeInTheDocument();
  });
});

describe('HeroicInspirationTracker stackable modes', () => {
  it('shows classic helper text and hides the Add button when not stackable', () => {
    render(
      <HeroicInspirationTracker
        inspiration={{ count: 1 }}
        stackable={false}
        onAddInspiration={vi.fn()}
        onUseInspiration={vi.fn()}
        onUpdateInspiration={vi.fn()}
      />
    );
    expect(screen.getByText(/only one at a time/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Add$/i })).toBeNull();
  });

  it('shows the stacking helper text when stackable', () => {
    render(
      <HeroicInspirationTracker
        inspiration={{ count: 2 }}
        stackable={true}
        onAddInspiration={vi.fn()}
        onUseInspiration={vi.fn()}
        onUpdateInspiration={vi.fn()}
      />
    );
    expect(screen.getByText(/they\s+stack/i)).toBeInTheDocument();
  });

  it('renders the player stackable switch when showStackableControl is set', () => {
    render(
      <HeroicInspirationTracker
        inspiration={{ count: 0 }}
        stackable={false}
        showStackableControl
        onToggleStackable={vi.fn()}
        onAddInspiration={vi.fn()}
        onUseInspiration={vi.fn()}
        onUpdateInspiration={vi.fn()}
      />
    );
    expect(screen.getByLabelText(/allow stacking/i)).toBeInTheDocument();
  });

  it('renders a DM-controlled note instead of the switch when dmControlled', () => {
    render(
      <HeroicInspirationTracker
        inspiration={{ count: 0 }}
        stackable={false}
        dmControlled
        onAddInspiration={vi.fn()}
        onUseInspiration={vi.fn()}
        onUpdateInspiration={vi.fn()}
      />
    );
    expect(screen.getByText(/set by your dm/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/allow stacking/i)).toBeNull();
  });

  it('hides the settings gear entirely in classic mode', () => {
    render(
      <HeroicInspirationTracker
        inspiration={{ count: 1 }}
        stackable={false}
        onAddInspiration={vi.fn()}
        onUseInspiration={vi.fn()}
        onUpdateInspiration={vi.fn()}
      />
    );
    expect(screen.queryByTitle('Settings')).toBeNull();
    expect(screen.queryByText('Max Inspiration:')).not.toBeInTheDocument();
  });

  it('shows the settings gear in stacking mode', () => {
    render(
      <HeroicInspirationTracker
        inspiration={{ count: 1 }}
        stackable={true}
        onAddInspiration={vi.fn()}
        onUseInspiration={vi.fn()}
        onUpdateInspiration={vi.fn()}
      />
    );
    expect(screen.getByTitle('Settings')).toBeInTheDocument();
  });

  it('closes an open settings panel when stacking is turned off', () => {
    const { rerender } = render(
      <HeroicInspirationTracker
        inspiration={{ count: 1 }}
        stackable={true}
        onAddInspiration={vi.fn()}
        onUseInspiration={vi.fn()}
        onUpdateInspiration={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTitle('Settings'));
    expect(screen.getByText('Max Inspiration:')).toBeInTheDocument();

    rerender(
      <HeroicInspirationTracker
        inspiration={{ count: 1 }}
        stackable={false}
        onAddInspiration={vi.fn()}
        onUseInspiration={vi.fn()}
        onUpdateInspiration={vi.fn()}
      />
    );
    expect(screen.queryByText('Max Inspiration:')).not.toBeInTheDocument();

    rerender(
      <HeroicInspirationTracker
        inspiration={{ count: 1 }}
        stackable={true}
        onAddInspiration={vi.fn()}
        onUseInspiration={vi.fn()}
        onUpdateInspiration={vi.fn()}
      />
    );
    expect(screen.queryByText('Max Inspiration:')).not.toBeInTheDocument();
  });

  it('reports the DM setting as On when stacking is enabled', () => {
    render(
      <HeroicInspirationTracker
        inspiration={{ count: 2 }}
        stackable={true}
        dmControlled
        onAddInspiration={vi.fn()}
        onUseInspiration={vi.fn()}
        onUpdateInspiration={vi.fn()}
      />
    );
    expect(
      screen.getByText(/Stacking is set by your DM:\s*On/i)
    ).toBeInTheDocument();
  });

  it('renders the player switch checked when stacking is enabled', () => {
    render(
      <HeroicInspirationTracker
        inspiration={{ count: 2 }}
        stackable={true}
        showStackableControl
        onToggleStackable={vi.fn()}
        onAddInspiration={vi.fn()}
        onUseInspiration={vi.fn()}
        onUpdateInspiration={vi.fn()}
      />
    );
    expect(screen.getByLabelText(/allow stacking/i)).toBeChecked();
  });

  it('gives the switch an accessible name matching its visible label', () => {
    render(
      <HeroicInspirationTracker
        inspiration={{ count: 0 }}
        stackable={false}
        showStackableControl
        onToggleStackable={vi.fn()}
        onAddInspiration={vi.fn()}
        onUseInspiration={vi.fn()}
        onUpdateInspiration={vi.fn()}
      />
    );
    expect(
      screen.getByRole('switch', { name: 'Allow stacking (house rule)' })
    ).toBeInTheDocument();
  });

  it('toggling the player switch reports the new stacking value', () => {
    const onToggleStackable = vi.fn();
    render(
      <HeroicInspirationTracker
        inspiration={{ count: 0 }}
        stackable={false}
        showStackableControl
        onToggleStackable={onToggleStackable}
        onAddInspiration={vi.fn()}
        onUseInspiration={vi.fn()}
        onUpdateInspiration={vi.fn()}
      />
    );
    fireEvent.click(screen.getByLabelText(/allow stacking/i));
    expect(onToggleStackable).toHaveBeenCalledWith(true);
  });
});
