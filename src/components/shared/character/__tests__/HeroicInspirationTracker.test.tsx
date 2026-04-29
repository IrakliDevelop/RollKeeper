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
