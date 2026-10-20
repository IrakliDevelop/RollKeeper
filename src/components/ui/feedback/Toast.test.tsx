import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dialog, DialogContent, DialogTitle } from './dialog';
import { ToastContainer, useToast, type ToastData } from './Toast';

describe('useToast semantic icons', () => {
  it('stores attack and detail icons separately from display text', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showAttackRoll('Longsword', 20, 5, true, '1d8 + 3');
    });

    expect(result.current.toasts[0]).toMatchObject({
      icon: 'criticalSuccess',
      title: 'Longsword — CRITICAL!',
      details: [
        { icon: 'damage', text: 'Damage: 1d8 + 3' },
        {
          icon: 'criticalSuccess',
          text: "Don't forget to double the damage dice!",
        },
      ],
    });
  });

  it('uses distinct canonical icons for short and long rests', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showShortRest();
      result.current.showLongRest();
    });

    expect(
      result.current.toasts.map(({ icon, title }) => ({ icon, title }))
    ).toEqual([
      { icon: 'restShort', title: 'Short Rest Complete' },
      { icon: 'restLong', title: 'Long Rest Complete' },
    ]);
  });
});

describe('ToastContainer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const toast = (overrides: Partial<ToastData> = {}): ToastData => ({
    id: 'toast-1',
    type: 'rest',
    title: 'Long rest taken',
    message: 'Hit points and spell slots are back',
    details: ['All spell slots restored'],
    ...overrides,
  });

  it('announces toasts through a status region that stays mounted', () => {
    const { rerender } = render(
      <ToastContainer toasts={[]} onDismiss={() => {}} />
    );

    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-atomic', 'false');

    rerender(<ToastContainer toasts={[toast()]} onDismiss={() => {}} />);
    expect(screen.getByRole('status')).toBe(region);
    expect(region).toHaveTextContent('Long rest taken');
  });

  it('stays announced while a modal dialog hides the rest of the page', () => {
    render(
      <>
        <Dialog open>
          <DialogContent aria-describedby={undefined}>
            <DialogTitle>Take a long rest?</DialogTitle>
          </DialogContent>
        </Dialog>
        <ToastContainer toasts={[toast()]} onDismiss={() => {}} />
      </>
    );

    // Radix hides everything outside the dialog except live regions.
    const region = screen.getByRole('status');
    expect(region.closest('[aria-hidden="true"]')).toBeNull();
    expect(region).toHaveTextContent('Long rest taken');
  });

  it.each([
    ['success', 'border-l-verdigris-border', 'bg-verdigris-fill'],
    ['rest', 'border-l-verdigris-border', 'bg-verdigris-fill'],
    ['error', 'border-l-blood-border', 'bg-blood-fill'],
    ['damage', 'border-l-blood-border', 'bg-blood-fill'],
    ['attack', 'border-l-input-border', 'bg-input-border'],
    ['save', 'border-l-input-border', 'bg-input-border'],
    ['info', 'border-l-input-border', 'bg-input-border'],
  ] as const)(
    'draws a %s toast on the elevated surface with a 3px %s rule',
    (type, rule, bar) => {
      render(
        <ToastContainer toasts={[toast({ type })]} onDismiss={() => {}} />
      );

      const card = document.body.querySelector(`[data-toast-type="${type}"]`);
      expect(card).toHaveClass(
        'bg-surface-elevated',
        'border-divider',
        'rounded-md',
        'shadow-overlay',
        'border-l-[3px]',
        rule,
        'duration-180'
      );
      expect(card?.querySelector('[data-toast-countdown] > div')).toHaveClass(
        bar
      );
    }
  );

  it('drops the gradients, shimmer, blur, white text and icon tile', () => {
    render(<ToastContainer toasts={[toast()]} onDismiss={() => {}} />);

    const card = document.body.querySelector('[data-toast-type]')!;
    expect(card.outerHTML).not.toMatch(
      /gradient|shimmer|backdrop-blur|text-white|bg-white|drop-shadow|ring-white/
    );
    expect(document.body.querySelector('style')).toBeNull();
  });

  it('dismisses from a touch-sized button after the 180ms exit', () => {
    const onDismiss = vi.fn();
    render(<ToastContainer toasts={[toast()]} onDismiss={onDismiss} />);

    const dismiss = screen.getByRole('button', {
      name: 'Dismiss notification',
    });
    expect(dismiss).toHaveClass(
      'pointer-coarse:min-h-11',
      'pointer-coarse:min-w-11'
    );

    fireEvent.click(dismiss);
    act(() => {
      vi.advanceTimersByTime(179);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDismiss).toHaveBeenCalledWith('toast-1');
  });

  it('runs a countdown over its duration that reduced motion hides', () => {
    const onDismiss = vi.fn();
    render(
      <ToastContainer
        toasts={[toast({ duration: 4000 })]}
        onDismiss={onDismiss}
      />
    );

    const countdown = document.body.querySelector('[data-toast-countdown]')!;
    expect(countdown).toHaveClass('motion-reduce:hidden');
    expect(countdown).toHaveAttribute('aria-hidden', 'true');
    expect(
      (countdown.firstElementChild as HTMLElement).style.animation
    ).toMatch(/toast-countdown 4000ms linear/);

    act(() => {
      vi.advanceTimersByTime(4000 + 180);
    });
    expect(onDismiss).toHaveBeenCalledWith('toast-1');
  });
});
