import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { CharacterDock } from '../CharacterDock';

afterEach(() => cleanup());

const baseProps = {
  collapsed: false,
  onToggleCollapsed: vi.fn(),
  addToast: vi.fn(),
  onCastPlacement: vi.fn(),
  connectionLive: true,
  hasPendingPlacement: false,
  onCancelPlacement: vi.fn(),
};

describe('CharacterDock Sheet button', () => {
  it('opens the sheet', () => {
    const onOpenSheet = vi.fn();
    render(<CharacterDock {...baseProps} onOpenSheet={onOpenSheet} />);
    fireEvent.click(screen.getByRole('button', { name: /open full sheet/i }));
    expect(onOpenSheet).toHaveBeenCalledTimes(1);
  });

  it('hides the button when no handler is given', () => {
    render(<CharacterDock {...baseProps} />);
    expect(
      screen.queryByRole('button', { name: /open full sheet/i })
    ).toBeNull();
  });
});
