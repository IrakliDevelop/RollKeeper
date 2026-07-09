import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

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

const getChar = () => useCharacterStore.getState().character;

describe('DockVitals', () => {
  beforeEach(() => {
    seedCharacter();
  });

  afterEach(() => cleanup());

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

  it('disables the Use button at 0 heroic inspiration', () => {
    seedCharacter({ heroicInspiration: { count: 0, maxCount: 3 } });
    render(<DockVitals addToast={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^use$/i })).toBeDisabled();
  });

  it('spends heroic inspiration and fires an advantage toast', () => {
    const addToast = vi.fn();
    render(<DockVitals addToast={addToast} />);
    const useButton = screen.getByRole('button', { name: /^use$/i });
    expect(useButton).not.toBeDisabled();

    fireEvent.click(useButton);

    expect(getChar().heroicInspiration.count).toBe(1);
    expect(addToast).toHaveBeenCalledTimes(1);
    expect(addToast.mock.calls[0][0].title).toMatch(/Heroic Inspiration:/);
  });

  it('disables the + stepper once maxCount is reached', () => {
    seedCharacter({ heroicInspiration: { count: 3, maxCount: 3 } });
    render(<DockVitals addToast={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: /add heroic inspiration/i })
    ).toBeDisabled();
  });

  it('increments heroic inspiration via the + stepper when under max', () => {
    render(<DockVitals addToast={vi.fn()} />);
    fireEvent.click(
      screen.getByRole('button', { name: /add heroic inspiration/i })
    );
    expect(getChar().heroicInspiration.count).toBe(3);
  });

  it('decrements heroic inspiration via the − stepper', () => {
    render(<DockVitals addToast={vi.fn()} />);
    fireEvent.click(
      screen.getByRole('button', { name: /remove heroic inspiration/i })
    );
    expect(getChar().heroicInspiration.count).toBe(1);
  });
});
