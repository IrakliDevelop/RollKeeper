import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  TooltipArrow,
  TooltipContent,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from './Tooltip';

function renderOpenTooltip() {
  render(
    <TooltipProvider>
      <TooltipRoot open>
        <TooltipTrigger>AC 16</TooltipTrigger>
        <TooltipContent>
          From chain mail
          <TooltipArrow />
        </TooltipContent>
      </TooltipRoot>
    </TooltipProvider>
  );
  return document.body.querySelector('[data-side]') as HTMLElement;
}

describe('Tooltip', () => {
  beforeEach(() => {
    // Radix positions the tooltip with floating-ui, which observes its size.
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

  it('floats on the elevated surface with a 1px divider, 6px radius and the overlay shadow', () => {
    const content = renderOpenTooltip();

    expect(content).toHaveClass(
      'bg-surface-elevated',
      'border',
      'border-divider',
      'rounded-md',
      'shadow-overlay',
      'duration-180',
      'ease-out'
    );
    expect(content.className).not.toMatch(/shadow-lg|rounded-lg|raised/);
  });

  it('does not clip its arrow, and fills it with the same surface', () => {
    const content = renderOpenTooltip();

    expect(content).not.toHaveClass('overflow-hidden');
    expect(content.querySelector('svg')).toHaveClass('fill-surface-elevated');
  });
});
