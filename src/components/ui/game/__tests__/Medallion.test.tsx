import type { AnimationEvent } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Medallion } from '../Medallion';
import {
  abilityNumbers,
  abilityNumbersLabel,
  useNumberSwap,
  type AbilityDisplay,
} from '../abilityNumbers';

beforeEach(() => {
  // The score editor asks for (min-width: 640px); jsdom has no matchMedia.
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * jsdom has no AnimationEvent, so React listens for the prefixed
 * webkitAnimationEnd there; set animationName on a plain event.
 */
function swapEnds(element: Element) {
  const event = new Event('webkitAnimationEnd', { bubbles: true });
  Object.defineProperty(event, 'animationName', { value: 'rk-number-swap' });
  fireEvent(element, event);
}

describe('abilityNumbers', () => {
  it('puts the modifier large by default and the score large on request', () => {
    expect(abilityNumbers(3, 16, 'modifier')).toEqual({
      large: '+3',
      small: '16',
    });
    expect(abilityNumbers(-1, 9, 'score')).toEqual({ large: '9', small: '-1' });
  });

  it('labels both numbers the same way in either mode', () => {
    expect(abilityNumbersLabel('strength', 3, 16)).toBe(
      'Strength: modifier +3, score 16'
    );
    expect(abilityNumbersLabel('dexterity', 0, 10)).toBe(
      'Dexterity: modifier +0, score 10'
    );
  });
});

describe('useNumberSwap', () => {
  function setup(animateSwap: boolean) {
    return renderHook(
      ({ display, animate }: { display: AbilityDisplay; animate: boolean }) =>
        useNumberSwap(display, animate),
      { initialProps: { display: 'modifier', animate: animateSwap } }
    );
  }

  it('never animates the first render', () => {
    const { result } = setup(true);
    expect(result.current).toMatchObject({
      swapKey: 'modifier',
      animate: false,
    });
  });

  it('animates a change made here until the swap ends', () => {
    const { result, rerender } = setup(true);
    rerender({ display: 'score', animate: true });
    expect(result.current).toMatchObject({ swapKey: 'score', animate: true });
    rerender({ display: 'score', animate: true });
    expect(result.current.animate).toBe(true);
    // Another animation ending inside (a popover fading in) changes nothing.
    act(() =>
      result.current.onSwapEnd({
        animationName: 'enter',
      } as AnimationEvent<Element>)
    );
    expect(result.current.animate).toBe(true);
    act(() =>
      result.current.onSwapEnd({
        animationName: 'rk-number-swap',
      } as AnimationEvent<Element>)
    );
    expect(result.current).toMatchObject({ swapKey: 'score', animate: false });
  });

  it('snaps a change made elsewhere', () => {
    const { result, rerender } = setup(true);
    rerender({ display: 'score', animate: true });
    rerender({ display: 'modifier', animate: false });
    expect(result.current).toMatchObject({
      swapKey: 'modifier',
      animate: false,
    });
  });
});

describe('Medallion', () => {
  const base = {
    ability: 'strength',
    score: 16,
    modifier: 3,
    saveProficient: true,
    abilityDisplay: 'modifier',
  } as const;

  it('is one labelled image with no tab stop in play mode', () => {
    render(<Medallion {...base} />);
    const medallion = screen.getByRole('img', {
      name: 'Strength: modifier +3, score 16',
    });
    expect(medallion).toHaveAttribute('data-save-proficient', 'true');
    expect(medallion).toHaveAttribute('data-display', 'modifier');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('marks a save that is not proficient', () => {
    render(<Medallion {...base} saveProficient={false} />);
    expect(screen.getByRole('img')).toHaveAttribute(
      'data-save-proficient',
      'false'
    );
  });

  it('stays plain in edit mode when nothing can save a score', () => {
    render(<Medallion {...base} editing />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('opens the score editor in edit mode and saves the new score', async () => {
    const onScoreChange = vi.fn();
    render(<Medallion {...base} editing onScoreChange={onScoreChange} />);
    const trigger = screen.getByRole('button', {
      name: 'Strength: modifier +3, score 16',
    });
    await userEvent.click(trigger);
    expect(screen.getByText('Modifier +3')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Increase Strength score' })
    );
    expect(screen.getByText('Modifier +3')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Increase Strength score' })
    );
    expect(screen.getByText('Modifier +4')).toBeInTheDocument();
    await act(() =>
      userEvent.click(screen.getByRole('button', { name: 'Save' }))
    );
    expect(onScoreChange).toHaveBeenCalledWith(18);
  });

  it('previews the clamped score, the one Save stores', async () => {
    const onScoreChange = vi.fn();
    render(<Medallion {...base} editing onScoreChange={onScoreChange} />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Strength: modifier +3, score 16' })
    );
    const field = screen.getByRole('textbox', { name: 'Strength score' });
    await userEvent.clear(field);
    await userEvent.type(field, '40');
    expect(screen.getByText('Modifier +10')).toBeInTheDocument();
    expect(screen.queryByText('Modifier +15')).toBeNull();
    await act(() =>
      userEvent.click(screen.getByRole('button', { name: 'Save' }))
    );
    expect(onScoreChange).toHaveBeenCalledWith(30);
  });

  it('only adds the swap animation for a change made here', () => {
    const { container, rerender } = render(<Medallion {...base} animateSwap />);
    const large = () => container.querySelector('[data-number="large"]')!;
    expect(large()).not.toHaveClass('animate-rk-number-swap');
    const before = large();
    rerender(<Medallion {...base} abilityDisplay="score" animateSwap />);
    expect(large()).toHaveTextContent('16');
    expect(large()).toHaveClass('animate-rk-number-swap');
    // A new element, so the animation plays again on every swap.
    expect(large()).not.toBe(before);
    const swapped = large();
    rerender(<Medallion {...base} abilityDisplay="score" animateSwap />);
    expect(large()).toBe(swapped);
    rerender(<Medallion {...base} abilityDisplay="modifier" />);
    expect(large()).toHaveTextContent('+3');
    expect(large()).not.toHaveClass('animate-rk-number-swap');
  });

  it('plays the swap once, not again when edit mode remounts the numbers', () => {
    const onScoreChange = vi.fn();
    const { container, rerender } = render(<Medallion {...base} animateSwap />);
    const large = () => container.querySelector('[data-number="large"]')!;
    rerender(<Medallion {...base} abilityDisplay="score" animateSwap />);
    expect(large()).toHaveClass('animate-rk-number-swap');
    swapEnds(large());
    expect(large()).not.toHaveClass('animate-rk-number-swap');
    rerender(
      <Medallion
        {...base}
        abilityDisplay="score"
        animateSwap
        editing
        onScoreChange={onScoreChange}
      />
    );
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(large()).not.toHaveClass('animate-rk-number-swap');
  });
});
