import { vi } from 'vitest';
import type { ReactElement } from 'react';
import { render, type RenderResult } from '@testing-library/react';

import { TooltipProvider } from '@/components/ui/primitives/Tooltip';

/**
 * Renders inside a `TooltipProvider`, as `OwnSheet` does in the app. A
 * component that carries a `Tooltip` throws without one. `rerender` wraps
 * its argument the same way.
 */
export function renderWithTooltips(ui: ReactElement): RenderResult {
  const result = render(<TooltipProvider>{ui}</TooltipProvider>);
  return {
    ...result,
    rerender: next =>
      result.rerender(<TooltipProvider>{next}</TooltipProvider>),
  };
}

/**
 * Radix measures a tooltip trigger with ResizeObserver, which jsdom lacks.
 * Call in `beforeEach`; undo with `vi.unstubAllGlobals()` in `afterEach`.
 */
export function stubResizeObserver(): void {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
}
