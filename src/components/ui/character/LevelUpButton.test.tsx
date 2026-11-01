import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LevelUpButton } from './tabbedSheetConfig';

vi.mock('@/components/ui/character/LevelUpWizard', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
    <div data-testid="wizard" data-open={isOpen}>
      <button onClick={onClose}>Close wizard</button>
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('LevelUpButton', () => {
  it('keeps the wizard mounted during its close animation', () => {
    vi.useFakeTimers();
    render(<LevelUpButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Level up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close wizard' }));
    expect(screen.getByTestId('wizard')).toHaveAttribute('data-open', 'false');
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByTestId('wizard')).toBeNull();
  });
});
