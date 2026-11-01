import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MarkerField } from '../MarkerField';

describe('MarkerField', () => {
  beforeEach(() => {
    // Radix and the picker both observe element sizes.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
    // The emoji picker loads its data over the network; keep it loading.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {}))
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('floats the emoji picker on the elevated surface with the overlay shadow', () => {
    render(
      <MarkerField
        mode="emoji"
        color="#a07b2c"
        emoji={null}
        onModeChange={() => {}}
        onColorChange={() => {}}
        onEmojiChange={() => {}}
      />
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Marker emoji: none selected' })
    );

    const popover = screen.getByRole('dialog');
    expect(popover).toHaveClass(
      'bg-surface-elevated',
      'border-divider',
      'rounded-md',
      'shadow-overlay'
    );
    expect(popover.className).not.toMatch(/shadow-lg|rounded-lg/);
  });
});
