import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CombatStartBanner } from './CombatStartBanner';

describe('CombatStartBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // styled-jsx's `jsx` prop warns in jsdom (no transform in the unit project)
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    cleanup();
  });

  it('announces "Combat begins" in a status region', () => {
    render(<CombatStartBanner isVisible />);

    expect(screen.getByRole('status')).toHaveTextContent(/^Combat begins$/);
  });

  it('renders nothing while not visible', () => {
    render(<CombatStartBanner isVisible={false} />);

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('dismisses itself after durationMs and calls onDone once', () => {
    const onDone = vi.fn();
    render(<CombatStartBanner isVisible durationMs={1000} onDone={onDone} />);

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(screen.getByRole('status')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByRole('status')).toBeNull();
    expect(onDone).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('hides its glyphs from assistive tech', () => {
    render(<CombatStartBanner isVisible />);

    const glyphs = screen
      .getByRole('status')
      .parentElement?.querySelectorAll('svg');
    expect(glyphs?.length).toBeGreaterThan(0);
    glyphs?.forEach(svg => expect(svg).toHaveAttribute('aria-hidden', 'true'));
  });
});
