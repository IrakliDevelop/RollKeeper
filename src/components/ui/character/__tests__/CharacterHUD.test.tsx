import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import CharacterHUD from '@/components/ui/character/CharacterHUD';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import type { CharacterState } from '@/types/character';

afterEach(cleanup);

function hudProps(character: CharacterState) {
  return {
    character,
    onShortRest: vi.fn(),
    onLongRest: vi.fn(),
    onIncrementDays: vi.fn(),
    onDecrementDays: vi.fn(),
    onToggleInspiration: vi.fn(),
    onToggleReaction: vi.fn(),
    onStopConcentration: vi.fn(),
    onNavigateToConditions: vi.fn(),
    onNavigateToCombat: vi.fn(),
    onNavigateToSpells: vi.fn(),
  };
}

function withHp(
  current: number,
  max: number,
  temporary = 0,
  overrides: Partial<CharacterState> = {}
) {
  return makeCharacter({
    ...overrides,
    hitPoints: { current, max, temporary, calculationMode: 'auto' },
  });
}

function renderHud(character: CharacterState) {
  const props = hudProps(character);
  const view = render(<CharacterHUD {...props} />);
  return { ...view, props };
}

/** The HP button; its name starts with "Hit points". */
function hpButton() {
  return screen.getByRole('button', { name: /^Hit points / });
}

describe('CharacterHUD hit points', () => {
  it.each([
    [42, 42, 'healthy', 'Healthy'],
    [32, 42, 'healthy', 'Healthy'],
    [31, 42, 'bloodied', 'Bloodied'],
    [149, 200, 'bloodied', 'Bloodied'],
    [12, 42, 'bloodied', 'Bloodied'],
    [5, 42, 'critical', 'Critical'],
    [0, 42, 'down', 'Down'],
  ])('shows %i of %i as %s', (current, max, status, word) => {
    renderHud(withHp(current, max));
    const button = hpButton();
    expect(button).toHaveAttribute('data-hp-status', status);
    expect(button).toHaveTextContent(word);
    expect(button).toHaveAccessibleName(
      `Hit points ${current} of ${max}, ${word}. Open the Combat tab`
    );
  });

  it('shows no tier without a max', () => {
    const { container } = renderHud(withHp(5, 0));
    const button = hpButton();
    const bar = container.querySelector<HTMLElement>('[data-part="bar"]');
    expect(bar?.style.width).toBe('0%');
    expect(button).not.toHaveAttribute('data-hp-status');
    expect(button).toHaveAccessibleName(
      'Hit points 5 of 0. Open the Combat tab'
    );
    for (const word of ['Healthy', 'Bloodied', 'Critical', 'Down']) {
      expect(button).not.toHaveTextContent(word);
    }
  });

  it('shows temporary HP and describes the button with it', () => {
    renderHud(withHp(30, 40, 5));
    const temp = screen.getByText('+5 temp');
    expect(hpButton()).toHaveAttribute('aria-describedby', temp.id);
    expect(hpButton()).toHaveAccessibleDescription('+5 temp');
  });

  it('hides temporary HP at 0', () => {
    renderHud(withHp(30, 40, 0));
    expect(screen.queryByText(/temp/)).toBeNull();
    expect(hpButton()).not.toHaveAttribute('aria-describedby');
  });

  it('shows the current and max values', () => {
    renderHud(withHp(30, 40));
    expect(hpButton()).toHaveTextContent('30/40');
  });

  it('fills the bar to the HP percentage', () => {
    const { container } = renderHud(withHp(21, 42));
    const bar = container.querySelector<HTMLElement>('[data-part="bar"]');
    expect(bar?.style.width).toBe('50%');
  });

  it('opens the Combat tab', () => {
    const { props } = renderHud(withHp(30, 40));
    fireEvent.click(hpButton());
    expect(props.onNavigateToCombat).toHaveBeenCalledTimes(1);
  });
});
