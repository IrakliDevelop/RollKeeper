import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import { XPTracker } from '../XPTracker';

afterEach(() => {
  cleanup();
});

const defaultProps = {
  currentXP: 10000,
  currentLevel: 5,
  onAddXP: vi.fn(),
  onSetXP: vi.fn(),
};

describe('XPTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders current XP and level', () => {
    render(<XPTracker {...defaultProps} />);
    expect(screen.getAllByText('10,000').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Level 5').length).toBeGreaterThan(0);
  });

  it('shows XP to next level', () => {
    render(<XPTracker {...defaultProps} />);
    // 14,000 (level 6) - 10,000 = 4,000
    expect(screen.getByText('4,000 XP')).toBeInTheDocument();
    expect(screen.getByText('To Next Level:')).toBeInTheDocument();
  });

  it('shows progress bar with correct percentage', () => {
    const { container } = render(<XPTracker {...defaultProps} />);
    // progress = (10000 - 6500) / (14000 - 6500) * 100 = 3500/7500*100 = 46.666...%
    const progressBar = container.querySelector('[style*="width"]');
    expect(progressBar).not.toBeNull();
    const style = progressBar!.getAttribute('style')!;
    expect(style).toMatch(/width:\s*46\.6/);
    expect(screen.getByText(/46\.7% to Level 6/)).toBeInTheDocument();
  });

  it('adds XP via form submission', () => {
    const onAddXP = vi.fn();
    render(<XPTracker {...defaultProps} onAddXP={onAddXP} />);

    const input = screen.getByPlaceholderText('XP to add...');
    fireEvent.change(input, { target: { value: '500' } });

    const addButton = screen.getByRole('button', { name: 'Add' });
    fireEvent.click(addButton);

    expect(onAddXP).toHaveBeenCalledWith(500);
  });

  it('clears input after submit', () => {
    render(<XPTracker {...defaultProps} />);

    const input = screen.getByPlaceholderText('XP to add...');
    fireEvent.change(input, { target: { value: '500' } });
    expect(input).toHaveValue(500);

    const addButton = screen.getByRole('button', { name: 'Add' });
    fireEvent.click(addButton);

    expect(input).toHaveValue(null);
  });

  it('shows level-up alert when XP reaches next level threshold', () => {
    vi.useFakeTimers();
    // currentXP=13500 + add 500 = 14000 >= 14000 (level 6 threshold)
    // shouldLevelUp(14000, 5) => calculateLevelFromXP(14000) = 6 > 5 => true
    render(<XPTracker {...defaultProps} currentXP={13500} />);

    const input = screen.getByPlaceholderText('XP to add...');
    fireEvent.change(input, { target: { value: '500' } });

    const addButton = screen.getByRole('button', { name: 'Add' });
    fireEvent.click(addButton);

    expect(screen.getByText('LEVEL UP!')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByText('LEVEL UP!')).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it('does not show level-up alert when below threshold', () => {
    render(<XPTracker {...defaultProps} currentXP={10000} />);

    const input = screen.getByPlaceholderText('XP to add...');
    fireEvent.change(input, { target: { value: '100' } });

    const addButton = screen.getByRole('button', { name: 'Add' });
    fireEvent.click(addButton);

    expect(screen.queryByText('LEVEL UP!')).not.toBeInTheDocument();
  });

  it('hides form when readonly is true', () => {
    render(<XPTracker {...defaultProps} readonly />);
    expect(
      screen.queryByPlaceholderText('XP to add...')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add' })
    ).not.toBeInTheDocument();
  });

  it('shows level thresholds by default', () => {
    render(<XPTracker {...defaultProps} />);
    expect(screen.getByText(/Level 5:.*6,500 XP/)).toBeInTheDocument();
    expect(screen.getByText(/Level 6:.*14,000 XP/)).toBeInTheDocument();
  });

  it('hides level thresholds when hideThresholds is true', () => {
    render(<XPTracker {...defaultProps} hideThresholds />);
    expect(screen.queryByText(/Level 5:.*6,500 XP/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Level 6:.*14,000 XP/)).not.toBeInTheDocument();
  });

  it('disables submit button when input is empty', () => {
    render(<XPTracker {...defaultProps} />);
    const addButton = screen.getByRole('button', { name: 'Add' });
    expect(addButton).toBeDisabled();
  });
});
