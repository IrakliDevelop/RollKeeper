import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReactElement } from 'react';
import {
  render as rtlRender,
  screen,
  fireEvent,
  cleanup,
} from '@testing-library/react';

import { TooltipProvider } from '@/components/ui/primitives/Tooltip';
import { DockVitals } from '@/components/ui/campaign/player-vtt/CharacterDock/DockVitals';
import { useCharacterStore } from '@/store/characterStore';
import type { CharacterState } from '@/types/character';

function seedCharacter(overrides: Partial<CharacterState> = {}) {
  const store = useCharacterStore.getState();
  const base = store.character;
  store.loadCharacterState({
    ...base,
    hitPoints: { current: 20, max: 30, temporary: 5, deathSaves: undefined },
    heroicInspiration: { count: 2, maxCount: 3 },
    ...overrides,
  } as CharacterState);
}

function seedHp(current: number, max: number) {
  seedCharacter({
    hitPoints: {
      ...useCharacterStore.getState().character.hitPoints,
      current,
      max,
      temporary: 0,
    },
  });
}

const getChar = () => useCharacterStore.getState().character;

// QuickCombatStrip's Tooltips need the provider PlayerVttScreen wraps around
// the floating panels, and Radix measures the trigger with ResizeObserver.
function render(ui: ReactElement) {
  return rtlRender(<TooltipProvider>{ui}</TooltipProvider>);
}

describe('DockVitals', () => {
  beforeEach(() => {
    seedCharacter();
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

  it('applies damage temp-first', () => {
    render(<DockVitals addToast={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox', { name: /hp amount/i }), {
      target: { value: '8' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^damage$/i }));

    expect(getChar().hitPoints.temporary).toBe(0);
    expect(getChar().hitPoints.current).toBe(17);
  });

  it('fires a toast and clears the input after applying damage', () => {
    const addToast = vi.fn();
    render(<DockVitals addToast={addToast} />);
    fireEvent.change(screen.getByRole('textbox', { name: /hp amount/i }), {
      target: { value: '8' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^damage$/i }));

    expect(addToast).toHaveBeenCalledTimes(1);
    expect(addToast.mock.calls[0][0]).toMatchObject({
      title: 'Took 8 damage',
      message: 'HP 17/30',
    });
    expect(screen.getByRole('textbox', { name: /hp amount/i })).toHaveValue('');
  });

  it('heal caps at max', () => {
    render(<DockVitals addToast={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox', { name: /hp amount/i }), {
      target: { value: '50' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^heal$/i }));

    expect(getChar().hitPoints.current).toBe(30);
  });

  it('temp HP takes the larger value instead of stacking', () => {
    render(<DockVitals addToast={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox', { name: /hp amount/i }), {
      target: { value: '3' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^temp$/i }));

    // existing temp (5) was already higher than 3, so it stays 5
    expect(getChar().hitPoints.temporary).toBe(5);
  });

  it('is a no-op on NaN or empty input', () => {
    const addToast = vi.fn();
    render(<DockVitals addToast={addToast} />);
    fireEvent.click(screen.getByRole('button', { name: /^damage$/i }));
    expect(getChar().hitPoints.current).toBe(20);

    fireEvent.change(screen.getByRole('textbox', { name: /hp amount/i }), {
      target: { value: 'abc' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^heal$/i }));
    expect(getChar().hitPoints.current).toBe(20);
    expect(addToast).not.toHaveBeenCalled();
  });

  it('is a no-op on zero or negative input', () => {
    render(<DockVitals addToast={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox', { name: /hp amount/i }), {
      target: { value: '-4' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^damage$/i }));
    expect(getChar().hitPoints.current).toBe(20);
  });

  // Green before 3-10 too (string parse was a no-op); guards NumberInput min={0} against a min={1} clamp on blur.
  it('is a no-op on a typed zero, and keeps the zero in the field', () => {
    const addToast = vi.fn();
    render(<DockVitals addToast={addToast} />);
    const input = screen.getByRole('textbox', { name: /hp amount/i });
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.blur(input);
    expect(input).toHaveValue('0');

    fireEvent.click(screen.getByRole('button', { name: /^damage$/i }));

    expect(getChar().hitPoints.current).toBe(20);
    expect(addToast).not.toHaveBeenCalled();
    expect(input).toHaveValue('0');
  });

  // Green before 3-10 too (string parse was a no-op); guards NumberInput min={0} against a min={1} clamp on blur.
  it('is a no-op on an empty field', () => {
    const addToast = vi.fn();
    render(<DockVitals addToast={addToast} />);
    fireEvent.click(screen.getByRole('button', { name: /^heal$/i }));

    expect(getChar().hitPoints.current).toBe(20);
    expect(addToast).not.toHaveBeenCalled();
  });

  it('shows the HP status word for each tier', () => {
    seedHp(30, 40);
    const { unmount } = render(<DockVitals addToast={vi.fn()} />);
    expect(screen.getByText('Healthy')).toBeInTheDocument();
    unmount();

    seedHp(8, 40);
    const second = render(<DockVitals addToast={vi.fn()} />);
    expect(screen.getByText('Critical')).toBeInTheDocument();
    second.unmount();

    seedHp(0, 40);
    render(<DockVitals addToast={vi.fn()} />);
    expect(screen.getByText('Down')).toBeInTheDocument();
  });

  it('shows no status word at max 0 and does not throw', () => {
    seedHp(0, 0);
    render(<DockVitals addToast={vi.fn()} />);
    for (const word of ['Healthy', 'Bloodied', 'Critical', 'Down']) {
      expect(screen.queryByText(word)).toBeNull();
    }
  });

  it('shows temp HP as plain text', () => {
    render(<DockVitals addToast={vi.fn()} />);
    expect(screen.getByText('+5 temp')).toBeInTheDocument();
  });

  it('renders the exact readout as three adjacent spans', () => {
    seedHp(30, 40);
    render(<DockVitals addToast={vi.fn()} />);
    expect(
      screen.getByText(
        (_, el) => el?.textContent === '30/40' && el.children.length === 3
      )
    ).toBeInTheDocument();
  });

  it('toggles the reaction with a constant name and aria-pressed', () => {
    render(<DockVitals addToast={vi.fn()} />);
    const reaction = screen.getByRole('button', { name: 'Reaction used' });
    expect(reaction).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(reaction);

    expect(
      screen.getByRole('button', { name: 'Reaction used' })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('Used')).toBeNull();
  });

  it('disables the Use button at 0 heroic inspiration', () => {
    seedCharacter({ heroicInspiration: { count: 0, maxCount: 3 } });
    render(<DockVitals addToast={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: /use heroic inspiration/i })
    ).toBeDisabled();
  });

  it('spends heroic inspiration and fires an advantage toast', () => {
    seedCharacter({
      stackableInspiration: true,
      heroicInspiration: { count: 2, maxCount: 3 },
    });
    const addToast = vi.fn();
    render(<DockVitals addToast={addToast} />);
    const useButton = screen.getByRole('button', {
      name: /use heroic inspiration/i,
    });
    expect(useButton).not.toBeDisabled();

    fireEvent.click(useButton);

    expect(getChar().heroicInspiration.count).toBe(1);
    expect(addToast).toHaveBeenCalledTimes(1);
    expect(addToast.mock.calls[0][0].title).toMatch(/Heroic inspiration:/);
  });

  it('disables the + stepper once maxCount is reached', () => {
    seedCharacter({
      stackableInspiration: true,
      heroicInspiration: { count: 3, maxCount: 3 },
    });
    render(<DockVitals addToast={vi.fn()} />);
    expect(
      screen.queryByRole('button', { name: /add heroic inspiration/i })
    ).toBeNull();
  });

  it('increments heroic inspiration via the + stepper when under max', () => {
    seedCharacter({
      stackableInspiration: true,
      heroicInspiration: { count: 2, maxCount: 3 },
    });
    render(<DockVitals addToast={vi.fn()} />);
    fireEvent.click(
      screen.getByRole('button', { name: /add heroic inspiration/i })
    );
    expect(getChar().heroicInspiration.count).toBe(3);
  });

  it('decrements heroic inspiration via the − stepper', () => {
    seedCharacter({
      stackableInspiration: true,
      heroicInspiration: { count: 2, maxCount: 3 },
    });
    render(<DockVitals addToast={vi.fn()} />);
    fireEvent.click(
      screen.getByRole('button', { name: /remove heroic inspiration/i })
    );
    expect(getChar().heroicInspiration.count).toBe(1);
  });

  it('disables the heroic + button at 1 when stacking is off', () => {
    seedCharacter({
      stackableInspiration: false,
      heroicInspiration: { count: 1, maxCount: 3 },
    });
    render(<DockVitals addToast={vi.fn()} />);
    expect(
      screen.queryByRole('button', { name: /add heroic inspiration/i })
    ).toBeNull();
  });

  it('opens the armor class editor from the AC card', () => {
    render(<DockVitals addToast={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /edit armor class/i }));
    // The dialog is named by its title; ArmorClassManager's own heading
    // inside it is a separate element.
    expect(
      screen.getByRole('dialog', { name: 'Armor class' })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('heading', { name: /armor class/i }).length
    ).toBeGreaterThan(0);
  });
});
