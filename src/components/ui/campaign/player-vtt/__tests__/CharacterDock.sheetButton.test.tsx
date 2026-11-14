import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { TooltipProvider } from '@/components/ui/primitives/Tooltip';

import { CharacterDock } from '../CharacterDock';

// The dock's collapse Tooltip needs the provider PlayerVttScreen supplies, and
// Radix measures the trigger with ResizeObserver.
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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
    render(
      <TooltipProvider>
        <CharacterDock {...baseProps} onOpenSheet={onOpenSheet} />
      </TooltipProvider>
    );
    fireEvent.click(
      screen.getByRole('button', { name: /open character sheet/i })
    );
    expect(onOpenSheet).toHaveBeenCalledTimes(1);
  });

  it('hides the button when no handler is given', () => {
    render(
      <TooltipProvider>
        <CharacterDock {...baseProps} />
      </TooltipProvider>
    );
    expect(
      screen.queryByRole('button', { name: /open character sheet/i })
    ).toBeNull();
  });
});
