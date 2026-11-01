import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LevelUpButton } from './tabbedSheetConfig';

let mounts = 0;
vi.mock('@/components/ui/character/LevelUpWizard', async () => {
  const { useState } = await import('react');
  return {
    default: function MockWizard({
      isOpen,
      onClose,
    }: {
      isOpen: boolean;
      onClose: () => void;
    }) {
      const [mountId] = useState(() => ++mounts);
      return (
        <div data-testid="wizard" data-open={isOpen} data-mount={mountId}>
          <button onClick={onClose}>Close wizard</button>
        </div>
      );
    },
  };
});

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

  it('starts a fresh wizard when reopened during the close animation', () => {
    vi.useFakeTimers();
    render(<LevelUpButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Level up' }));
    const first = screen.getByTestId('wizard').getAttribute('data-mount');
    fireEvent.click(screen.getByRole('button', { name: 'Close wizard' }));
    act(() => vi.advanceTimersByTime(100));
    fireEvent.click(screen.getByRole('button', { name: 'Level up' }));
    const wizard = screen.getByTestId('wizard');
    expect(wizard).toHaveAttribute('data-open', 'true');
    expect(wizard.getAttribute('data-mount')).not.toBe(first);
  });
});
