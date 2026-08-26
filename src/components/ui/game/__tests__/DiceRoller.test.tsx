import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DiceRoller } from '../DiceRoller';

const mockRoll = vi.fn();
const mockClearDice = vi.fn();
const mockClearHistory = vi.fn();

vi.mock('@/hooks/useDiceRoller', () => ({
  useDiceRoller: () => ({
    isInitialized: true,
    isRolling: false,
    rollHistory: [],
    roll: mockRoll,
    clearDice: mockClearDice,
    clearHistory: mockClearHistory,
    setAutoClearDelay: vi.fn(),
    autoClearDelay: 10000,
  }),
}));

vi.mock('../DiceResultDisplay', () => ({
  DiceResultDisplay: ({ rollHistory }: { rollHistory: unknown[] }) => (
    <div data-testid="dice-results">History: {rollHistory.length}</div>
  ),
}));

describe('DiceRoller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders Dice Roller heading', () => {
    render(<DiceRoller />);
    expect(screen.getByText('Dice Roller')).toBeDefined();
  });

  it('shows Ready status indicator', () => {
    render(<DiceRoller />);
    expect(screen.getByText('Ready')).toBeDefined();
  });

  it('renders quick roll buttons', () => {
    render(<DiceRoller />);
    expect(screen.getByText('1d20')).toBeDefined();
    expect(screen.getByText('2d6')).toBeDefined();
    expect(screen.getByText('1d12')).toBeDefined();
    expect(screen.getByText('4d6')).toBeDefined();
  });

  it('clicking 1d20 button calls roll with correct notation', () => {
    render(<DiceRoller />);
    fireEvent.click(screen.getByText('1d20'));
    expect(mockRoll).toHaveBeenCalledWith('1d20');
  });

  it('custom notation input with Enter key calls roll', () => {
    render(<DiceRoller />);
    const input = screen.getByPlaceholderText('e.g., 3d8+2');
    fireEvent.change(input, { target: { value: '3d8+2' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockRoll).toHaveBeenCalledWith('3d8+2');
  });

  it('custom Roll button calls roll with input value', () => {
    render(<DiceRoller />);
    const input = screen.getByPlaceholderText('e.g., 3d8+2');
    fireEvent.change(input, { target: { value: '2d10+5' } });
    fireEvent.click(screen.getByText('Roll'));
    expect(mockRoll).toHaveBeenCalledWith('2d10+5');
  });

  it('showQuickButtons false hides quick buttons', () => {
    render(<DiceRoller showQuickButtons={false} />);
    expect(screen.queryByText('1d20')).toBeNull();
    expect(screen.queryByText('2d6')).toBeNull();
    expect(screen.queryByText('Quick Rolls')).toBeNull();
  });

  it('custom quick buttons render with provided labels', () => {
    const customButtons = [
      { label: '1d100', notation: '1d100' },
      { label: '3d4', notation: '3d4' },
    ];
    render(<DiceRoller quickButtons={customButtons} />);
    expect(screen.getByText('1d100')).toBeDefined();
    expect(screen.getByText('3d4')).toBeDefined();
    expect(screen.queryByText('1d20')).toBeNull();
  });
});
